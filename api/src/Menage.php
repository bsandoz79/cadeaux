<?php

declare(strict_types=1);

namespace Cadeaux;

/**
 * Ménage quotidien (tâche planifiée, voir bin/menage.php) :
 * - un compte sans activité depuis 3 ans moins 30 jours reçoit un e-mail d'avertissement ;
 * - 30 jours après l'avertissement, s'il n'y a eu aucune visite, le compte et toutes ses données sont supprimés
 *   (une visite annule l'avertissement, voir Comptes::depuisJeton) ;
 * - les connexions expirées et les traces de limite d'abus sont effacées ;
 * - les RIB d'organisateurs gardés depuis plus de 60 jours sont effacés.
 */
final class Menage
{
    public const ANNEES_INACTIVITE = 3;
    public const JOURS_PREAVIS = 30;

    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge,
        private readonly Courrier $courrier,
        private readonly string $adresseSite = 'https://cadeaux.bsandoz.fr',
    ) {
    }

    /** @return array{avertis: int, supprimes: int, jetons: int, ribs: int} */
    public function lancer(): array
    {
        $maintenant = $this->horloge->maintenant();
        $format = 'Y-m-d H:i:s';
        $finInactivite = $maintenant->modify(sprintf('-%d years', self::ANNEES_INACTIVITE));
        $seuilAvertissement = $finInactivite->modify(sprintf('+%d days', self::JOURS_PREAVIS))->format($format);
        $finPreavis = $maintenant->modify(sprintf('-%d days', self::JOURS_PREAVIS))->format($format);

        // 1. Suppressions : averti depuis 30 jours, toujours sans activité.
        $requete = $this->pdo->prepare('SELECT id FROM comptes WHERE averti_le IS NOT NULL AND averti_le <= ? AND COALESCE(derniere_activite, cree_le) < ?');
        $requete->execute([$finPreavis, $seuilAvertissement]);
        $comptes = new Comptes($this->pdo, $this->horloge);
        $supprimes = 0;
        foreach ($requete->fetchAll(\PDO::FETCH_COLUMN) as $id) {
            $comptes->supprimer((int) $id);
            ++$supprimes;
        }

        // 2. Avertissements : un seul e-mail ; s'il échoue, nouvel essai le lendemain.
        $requete = $this->pdo->prepare('SELECT id, email, nom FROM comptes WHERE averti_le IS NULL AND COALESCE(derniere_activite, cree_le) < ?');
        $requete->execute([$seuilAvertissement]);
        $avertis = 0;
        foreach ($requete->fetchAll(\PDO::FETCH_ASSOC) as $c) {
            if ($this->courrier->envoyer((string) $c['email'], 'Votre compte Cadeaux sera supprimé dans 30 jours', $this->texteAvertissement((string) $c['nom']))) {
                $this->pdo->prepare('UPDATE comptes SET averti_le = ? WHERE id = ?')->execute([$this->horloge->texte(), $c['id']]);
                ++$avertis;
            }
        }

        // 3. Connexions expirées et traces de limite d'abus.
        $finJetons = $maintenant->modify(sprintf('-%d days', Comptes::JOURS_VALIDITE_JETON))->format($format);
        $jetons = $this->pdo->prepare('DELETE FROM jetons WHERE COALESCE(utilise_le, cree_le) < ?');
        $jetons->execute([$finJetons]);
        $this->pdo->prepare('DELETE FROM tentatives WHERE le < ?')
            ->execute([$maintenant->modify(sprintf('-%d minutes', Limiteur::FENETRE_MINUTES))->format($format)]);

        $this->pdo->prepare('DELETE FROM liens WHERE expire_le < ?')->execute([$this->horloge->texte()]);

        // 4. RIB d'organisateurs gardés depuis plus de 60 jours.
        $ribs = $this->coffreInutile();

        return ['avertis' => $avertis, 'supprimes' => $supprimes, 'jetons' => $jetons->rowCount(), 'ribs' => $ribs];
    }

    private function coffreInutile(): int
    {
        // La purge n'a pas besoin de la clé de chiffrement : elle ne fait qu'effacer.
        return (new Ribs($this->pdo, $this->horloge, new Coffre('')))->purger();
    }

    private function texteAvertissement(string $nom): string
    {
        return <<<TXT
            Bonjour {$nom},

            Vous ne vous êtes pas connecté à Cadeaux depuis près de trois ans. Pour ne pas garder vos données
            inutilement, votre compte et tout ce qu'il contient (proches, occasions, cadeaux, cagnottes) seront
            supprimés dans 30 jours.

            Pour garder votre compte, il suffit de vous connecter avant cette date :
            {$this->adresseSite}

            Vous pouvez aussi télécharger vos données depuis « Mon compte » avant la suppression.

            Cadeaux
            TXT;
    }
}
