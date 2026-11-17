<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * RIB de l'organisateur d'une cagnotte, pour que les participants paient par virement.
 * - IBAN vérifié (clé modulo 97), chiffré en base (Coffre) ; seule une version masquée est gardée en clair.
 * - Montré en entier seulement sur demande (« Afficher le RIB »), avec une limite par adresse IP.
 * - Effacé quand la cagnotte est terminée, quand les parts payées atteignent l'objectif, et au plus tard 60 jours
 *   après son enregistrement (tâche quotidienne). L'organisateur peut l'effacer à tout moment.
 */
final class Ribs
{
    public const JOURS_MAX = 60;
    public const AFFICHAGES_PAR_IP = 30;

    private readonly Limiteur $limiteur;

    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge,
        private readonly Coffre $coffre,
    ) {
        $this->limiteur = new Limiteur($pdo, $horloge);
    }

    /**
     * @param array<string, mixed> $donnees titulaire, iban
     *
     * @return array{titulaire: string, ibanMasque: string}
     */
    public function enregistrer(int $compteId, int $cagnotteId, array $donnees): array
    {
        $requete = $this->pdo->prepare('SELECT close FROM cagnottes WHERE id = ? AND compte_id = ?');
        $requete->execute([$cagnotteId, $compteId]);
        $close = $requete->fetchColumn();
        if ($close === false) {
            throw ErreurHttp::introuvable();
        }
        if ((bool) $close) {
            throw new ErreurHttp(409, 'Cette cagnotte est terminée.');
        }
        $titulaire = trim((string) ($donnees['titulaire'] ?? ''));
        $iban = Iban::normaliser((string) ($donnees['iban'] ?? ''));
        $erreurs = [];
        if ($titulaire === '' || mb_strlen($titulaire) > 80) {
            $erreurs['titulaire'] = 'Indiquez le nom du titulaire du compte.';
        }
        if (!Iban::valide($iban)) {
            $erreurs['iban'] = 'IBAN invalide : vérifiez-le sur votre RIB (ex. FR76 3000 6000 0112 3456 7890 189).';
        }
        if ($erreurs !== []) {
            throw ErreurHttp::invalide($erreurs);
        }
        $masque = Iban::masquer($iban);
        $this->pdo->prepare('UPDATE cagnottes SET rib_titulaire = ?, rib_iban = ?, rib_masque = ?, rib_le = ? WHERE id = ?')
            ->execute([$titulaire, $this->coffre->chiffrer($iban), $masque, $this->horloge->texte(), $cagnotteId]);

        return ['titulaire' => $titulaire, 'ibanMasque' => $masque];
    }

    public function effacer(int $cagnotteId): void
    {
        $this->pdo->prepare('UPDATE cagnottes SET rib_titulaire = NULL, rib_iban = NULL, rib_masque = NULL, rib_le = NULL WHERE id = ?')
            ->execute([$cagnotteId]);
    }

    public function effacerPourLeCompte(int $compteId, int $cagnotteId): void
    {
        $requete = $this->pdo->prepare('SELECT 1 FROM cagnottes WHERE id = ? AND compte_id = ?');
        $requete->execute([$cagnotteId, $compteId]);
        if ($requete->fetchColumn() === false) {
            throw ErreurHttp::introuvable();
        }
        $this->effacer($cagnotteId);
    }

    /** @return array{titulaire: string, ibanMasque: string}|null ce que voit l'organisateur */
    public function resume(int $cagnotteId): ?array
    {
        $requete = $this->pdo->prepare('SELECT rib_titulaire, rib_masque FROM cagnottes WHERE id = ? AND rib_iban IS NOT NULL');
        $requete->execute([$cagnotteId]);
        $l = $requete->fetch(\PDO::FETCH_ASSOC);

        return $l === false ? null : ['titulaire' => (string) $l['rib_titulaire'], 'ibanMasque' => (string) $l['rib_masque']];
    }

    /** @return array{titulaire: string, iban: string} RIB complet, pour un participant qui le demande */
    public function pourParticipant(string $code, string $ip): array
    {
        if ($this->limiteur->depasse('rib:' . $ip, self::AFFICHAGES_PAR_IP)) {
            throw new ErreurHttp(429, 'Trop de demandes. Réessayez dans un quart d’heure.');
        }
        $this->limiteur->noter('rib:' . $ip);
        $requete = $this->pdo->prepare('SELECT rib_titulaire, rib_iban FROM cagnottes WHERE code = ? AND close = 0 AND rib_iban IS NOT NULL');
        $requete->execute([$code]);
        $l = $requete->fetch(\PDO::FETCH_ASSOC);
        $iban = $l === false ? null : $this->coffre->dechiffrer((string) $l['rib_iban']);
        if ($iban === null) {
            throw new ErreurHttp(404, 'Pas de RIB pour cette cagnotte.');
        }

        return ['titulaire' => (string) $l['rib_titulaire'], 'iban' => Iban::formater($iban)];
    }

    /** Tâche quotidienne : RIB enregistrés depuis plus de 60 jours. @return int nombre de RIB effacés */
    public function purger(): int
    {
        $limite = $this->horloge->maintenant()->modify(sprintf('-%d days', self::JOURS_MAX))->format('Y-m-d H:i:s');
        $requete = $this->pdo->prepare('UPDATE cagnottes SET rib_titulaire = NULL, rib_iban = NULL, rib_masque = NULL, rib_le = NULL WHERE rib_le IS NOT NULL AND rib_le < ?');
        $requete->execute([$limite]);

        return $requete->rowCount();
    }
}
