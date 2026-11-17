<?php

declare(strict_types=1);

namespace Cadeaux;

/**
 * Rappels par e-mail, envoyés par la tâche quotidienne (bin/menage.php) aux comptes qui les acceptent et dont
 * l'adresse est confirmée :
 * - anniversaire d'un proche dans 7 jours, avec le budget et ce qui est déjà prévu pour lui ;
 * - cagnotte dont la date limite tombe dans 2 jours et à laquelle il manque de l'argent.
 * Un seul e-mail par compte et par jour ; chaque rappel n'est envoyé qu'une fois (table rappels_envoyes).
 */
final class Rappels
{
    public const JOURS_AVANT_ANNIVERSAIRE = 7;
    public const JOURS_AVANT_DATE_LIMITE = 2;

    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge,
        private readonly Courrier $courrier,
        private readonly string $adresseSite = 'https://cadeaux.bsandoz.fr',
    ) {
    }

    /** @return int nombre d'e-mails envoyés */
    public function envoyer(): int
    {
        $jour = $this->horloge->maintenant()->setTime(0, 0);
        $anniversaire = $jour->modify(sprintf('+%d days', self::JOURS_AVANT_ANNIVERSAIRE));
        $limite = $jour->modify(sprintf('+%d days', self::JOURS_AVANT_DATE_LIMITE))->format('Y-m-d');

        $envoyes = 0;
        foreach ($this->pdo->query('SELECT id, email, nom FROM comptes WHERE rappels = 1 AND email_confirme = 1')->fetchAll(\PDO::FETCH_ASSOC) as $compte) {
            $id = (int) $compte['id'];
            $lignes = [];
            $cles = [];

            foreach ($this->anniversaires($id, $anniversaire) as [$cle, $texte]) {
                $lignes[] = $texte;
                $cles[] = $cle;
            }
            foreach ($this->cagnottes($id, $limite) as [$cle, $texte]) {
                $lignes[] = $texte;
                $cles[] = $cle;
            }
            if ($lignes === []) {
                continue;
            }
            $sujet = count($lignes) === 1 ? 'Rappel : ' . strtok($lignes[0], "\n") : sprintf('%d rappels pour vos cadeaux', count($lignes));
            $corps = "Bonjour {$compte['nom']},\n\n" . implode("\n\n", $lignes)
                . "\n\n{$this->adresseSite}\n\nVous recevez ce rappel parce qu'il est activé dans « Mon compte ». Vous pouvez le couper à tout moment.\nCadeaux\n";
            if ($this->courrier->envoyer((string) $compte['email'], $sujet, $corps)) {
                $note = $this->pdo->prepare('INSERT INTO rappels_envoyes (compte_id, cle, envoye_le) VALUES (?, ?, ?)');
                foreach ($cles as $cle) {
                    $note->execute([$id, $cle, $this->horloge->texte()]);
                }
                ++$envoyes;
            }
        }

        return $envoyes;
    }

    /** @return list<array{string, string}> */
    private function anniversaires(int $compteId, \DateTimeImmutable $date): array
    {
        $mmjj = $date->format('m-d');
        // Né un 29 février : rappelé pour le 28 février les années non bissextiles.
        $fevrier29 = $mmjj === '02-28' && $date->format('L') === '0';
        $requete = $this->pdo->prepare('SELECT id, nom, date_naissance FROM personnes WHERE compte_id = ? AND date_naissance IS NOT NULL');
        $requete->execute([$compteId]);
        $resultat = [];
        foreach ($requete->fetchAll(\PDO::FETCH_ASSOC) as $p) {
            $naissance = (string) $p['date_naissance'];
            if (substr($naissance, 5) !== $mmjj && !($fevrier29 && substr($naissance, 5) === '02-29')) {
                continue;
            }
            $cle = 'anniversaire:' . $p['id'] . ':' . $date->format('Y-m-d');
            if ($this->dejaEnvoye($compteId, $cle)) {
                continue;
            }
            $age = (int) $date->format('Y') - (int) substr($naissance, 0, 4);
            $texte = sprintf('%s a %d ans le %s.', $p['nom'], $age, self::dateLisible($date));
            $texte .= "\n" . $this->prevuPour($compteId, (int) $p['id'], $date->format('Y-m-d'));
            $resultat[] = [$cle, $texte];
        }

        return $resultat;
    }

    /** Ce qui est prévu pour ce proche à son anniversaire (occasion de ce jour-là) : budget et cadeaux. */
    private function prevuPour(int $compteId, int $personneId, string $date): string
    {
        $occasion = $this->pdo->prepare("SELECT id FROM occasions WHERE compte_id = ? AND type = 'anniversaire' AND date = ?");
        $occasion->execute([$compteId, $date]);
        $ids = array_map('intval', $occasion->fetchAll(\PDO::FETCH_COLUMN));
        if ($ids === []) {
            return 'Rien de prévu pour l’instant.';
        }
        $marques = implode(',', array_fill(0, count($ids), '?'));
        $cadeaux = $this->pdo->prepare("SELECT titre, COALESCE(montant_depense, montant_prevu) AS montant FROM cadeaux WHERE personne_id = ? AND occasion_id IN ($marques)");
        $cadeaux->execute([$personneId, ...$ids]);
        $liste = array_map(
            static fn (array $c): string => $c['titre'] . ($c['montant'] !== null ? ' (' . self::euros((int) $c['montant']) . ')' : ''),
            $cadeaux->fetchAll(\PDO::FETCH_ASSOC),
        );
        $budget = $this->pdo->prepare("SELECT SUM(montant) FROM budgets WHERE personne_id = ? AND occasion_id IN ($marques)");
        $budget->execute([$personneId, ...$ids]);
        $montantBudget = $budget->fetchColumn();

        return ($montantBudget ? 'Budget : ' . self::euros((int) $montantBudget) . '. ' : '')
            . ($liste === [] ? 'Pas encore de cadeau.' : 'Prévu : ' . implode(', ', $liste) . '.');
    }

    /** @return list<array{string, string}> */
    private function cagnottes(int $compteId, string $limite): array
    {
        $requete = $this->pdo->prepare(
            'SELECT g.id, g.titre, g.beneficiaire, g.objectif, COALESCE(SUM(p.montant), 0) AS total
             FROM cagnottes g LEFT JOIN participations p ON p.cagnotte_id = g.id
             WHERE g.compte_id = ? AND g.close = 0 AND g.date_limite = ?
             GROUP BY g.id, g.titre, g.beneficiaire, g.objectif',
        );
        $requete->execute([$compteId, $limite]);
        $resultat = [];
        foreach ($requete->fetchAll(\PDO::FETCH_ASSOC) as $g) {
            $manque = (int) $g['objectif'] - (int) $g['total'];
            $cle = 'cagnotte:' . $g['id'] . ':' . $limite;
            if ($manque <= 0 || $this->dejaEnvoye($compteId, $cle)) {
                continue;
            }
            $resultat[] = [$cle, sprintf(
                "Cagnotte « %s » pour %s : il manque %s, date limite le %s.\n%s/cagnottes/%d",
                $g['titre'],
                $g['beneficiaire'],
                self::euros($manque),
                self::dateLisible(new \DateTimeImmutable($limite)),
                $this->adresseSite,
                $g['id'],
            )];
        }

        return $resultat;
    }

    private function dejaEnvoye(int $compteId, string $cle): bool
    {
        $requete = $this->pdo->prepare('SELECT 1 FROM rappels_envoyes WHERE compte_id = ? AND cle = ?');
        $requete->execute([$compteId, $cle]);

        return $requete->fetchColumn() !== false;
    }

    public static function euros(int $centimes): string
    {
        return $centimes % 100 === 0
            ? number_format($centimes / 100, 0, ',', ' ') . ' €'
            : number_format($centimes / 100, 2, ',', ' ') . ' €';
    }

    /** « samedi 28 novembre ». */
    public static function dateLisible(\DateTimeImmutable $date): string
    {
        $jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        $mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

        return $jours[(int) $date->format('w')] . ' ' . (int) $date->format('j') . ' ' . $mois[(int) $date->format('n') - 1];
    }
}
