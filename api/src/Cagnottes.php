<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * Participations aux cagnottes communes.
 * - Page publique (lien avec un code secret) : chacun voit la cagnotte et ajoute sa part, sans compte. Il reçoit une
 *   clé, gardée dans son navigateur, pour modifier ou retirer sa part ensuite.
 * - Organisateur (connecté) : voit tout, marque les parts payées, ajoute ou retire des parts, complète le reste.
 */
final class Cagnottes
{
    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge,
    ) {
    }

    /** @return array<string, mixed> cagnotte vue par les participants */
    public function publique(string $code): array
    {
        $c = $this->parCode($code);
        $organisateur = $this->pdo->prepare('SELECT nom FROM comptes WHERE id = ?');
        $organisateur->execute([$c['compte_id']]);

        return [
            'code' => $c['code'],
            'titre' => $c['titre'],
            'beneficiaire' => $c['beneficiaire'],
            'objectif' => (int) $c['objectif'],
            'mode' => $c['mode'],
            'nombreParts' => $c['nombre_parts'] === null ? null : (int) $c['nombre_parts'],
            'dateLimite' => $c['date_limite'],
            'lien' => $c['lien'],
            'message' => $c['message'],
            'close' => (bool) $c['close'],
            'organisateur' => (string) $organisateur->fetchColumn(),
            'participations' => $this->participations((int) $c['id']),
        ];
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array{participation: array<string, mixed>, cle: string}
     */
    public function participer(string $code, array $donnees): array
    {
        $c = $this->parCode($code);
        if ($c['close']) {
            throw new ErreurHttp(409, 'Cette cagnotte est close.');
        }
        [$nom, $montant] = $this->validerPart($donnees);
        $cle = bin2hex(random_bytes(32));
        $id = $this->inserer((int) $c['id'], $nom, $montant, false, hash('sha256', $cle));

        return ['participation' => $this->participation((int) $c['id'], $id), 'cle' => $cle];
    }

    /**
     * Le participant modifie sa part avec sa clé.
     *
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function modifierSaPart(string $code, int $id, ?string $cle, array $donnees): array
    {
        $c = $this->parCode($code);
        $this->verifierCle((int) $c['id'], $id, $cle);
        if ($c['close']) {
            throw new ErreurHttp(409, 'Cette cagnotte est close.');
        }
        [$nom, $montant] = $this->validerPart($donnees);
        $this->pdo->prepare('UPDATE participations SET nom = ?, montant = ? WHERE id = ?')->execute([$nom, $montant, $id]);

        return $this->participation((int) $c['id'], $id);
    }

    public function retirerSaPart(string $code, int $id, ?string $cle): void
    {
        $c = $this->parCode($code);
        $this->verifierCle((int) $c['id'], $id, $cle);
        $this->pdo->prepare('DELETE FROM participations WHERE id = ?')->execute([$id]);
    }

    /** @return list<array<string, mixed>> */
    public function participations(int $cagnotteId): array
    {
        $requete = $this->pdo->prepare('SELECT * FROM participations WHERE cagnotte_id = ? ORDER BY id');
        $requete->execute([$cagnotteId]);

        return array_map(self::versJson(...), $requete->fetchAll(\PDO::FETCH_ASSOC));
    }

    /**
     * L'organisateur ajoute une part (la sienne, ou celle de quelqu'un qui lui a donné de l'argent en main propre).
     *
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function ajouterParOrganisateur(int $compteId, int $cagnotteId, array $donnees): array
    {
        $this->cagnotteDuCompte($compteId, $cagnotteId);
        [$nom, $montant] = $this->validerPart($donnees);
        $id = $this->inserer($cagnotteId, $nom, $montant, (bool) ($donnees['paye'] ?? false), null, (bool) ($donnees['organisateur'] ?? false));

        return $this->participation($cagnotteId, $id);
    }

    /**
     * @param array<string, mixed> $donnees nom, montant, paye (chacun facultatif)
     *
     * @return array<string, mixed>
     */
    public function modifierParOrganisateur(int $compteId, int $cagnotteId, int $id, array $donnees): array
    {
        $this->cagnotteDuCompte($compteId, $cagnotteId);
        $actuelle = $this->participation($cagnotteId, $id);
        [$nom, $montant] = $this->validerPart($donnees + $actuelle);
        $paye = array_key_exists('paye', $donnees) ? (bool) $donnees['paye'] : $actuelle['paye'];
        $this->pdo->prepare('UPDATE participations SET nom = ?, montant = ?, paye = ? WHERE id = ?')
            ->execute([$nom, $montant, $paye ? 1 : 0, $id]);

        return $this->participation($cagnotteId, $id);
    }

    public function retirerParOrganisateur(int $compteId, int $cagnotteId, int $id): void
    {
        $this->cagnotteDuCompte($compteId, $cagnotteId);
        $this->participation($cagnotteId, $id);
        $this->pdo->prepare('DELETE FROM participations WHERE id = ?')->execute([$id]);
    }

    public static function nouveauCode(): string
    {
        return bin2hex(random_bytes(8));
    }

    /** @return array<string, mixed> */
    private function parCode(string $code): array
    {
        $requete = $this->pdo->prepare('SELECT * FROM cagnottes WHERE code = ?');
        $requete->execute([$code]);

        return $requete->fetch(\PDO::FETCH_ASSOC) ?: throw ErreurHttp::introuvable();
    }

    private function cagnotteDuCompte(int $compteId, int $cagnotteId): void
    {
        $requete = $this->pdo->prepare('SELECT 1 FROM cagnottes WHERE id = ? AND compte_id = ?');
        $requete->execute([$cagnotteId, $compteId]);
        if ($requete->fetchColumn() === false) {
            throw ErreurHttp::introuvable();
        }
    }

    /** @return array<string, mixed> */
    private function participation(int $cagnotteId, int $id): array
    {
        $requete = $this->pdo->prepare('SELECT * FROM participations WHERE id = ? AND cagnotte_id = ?');
        $requete->execute([$id, $cagnotteId]);

        return self::versJson($requete->fetch(\PDO::FETCH_ASSOC) ?: throw ErreurHttp::introuvable());
    }

    private function verifierCle(int $cagnotteId, int $id, ?string $cle): void
    {
        $requete = $this->pdo->prepare('SELECT cle FROM participations WHERE id = ? AND cagnotte_id = ?');
        $requete->execute([$id, $cagnotteId]);
        $empreinte = $requete->fetchColumn();
        if ($empreinte === false) {
            throw ErreurHttp::introuvable();
        }
        if (!is_string($empreinte) || $cle === null || !hash_equals($empreinte, hash('sha256', $cle))) {
            throw new ErreurHttp(403, 'Seule la personne qui a ajouté cette part peut la modifier.');
        }
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array{string, int}
     */
    private function validerPart(array $donnees): array
    {
        $nom = trim((string) ($donnees['nom'] ?? ''));
        $montant = $donnees['montant'] ?? null;
        $erreurs = [];
        if ($nom === '' || mb_strlen($nom) > 80) {
            $erreurs['nom'] = 'Indiquez votre prénom (80 caractères au plus).';
        }
        if (!is_int($montant) || $montant <= 0 || $montant > 10_000_000) {
            $erreurs['montant'] = 'Indiquez un montant.';
        }
        if ($erreurs !== []) {
            throw ErreurHttp::invalide($erreurs);
        }

        return [$nom, (int) $montant];
    }

    private function inserer(int $cagnotteId, string $nom, int $montant, bool $paye, ?string $empreinteCle, bool $organisateur = false): int
    {
        $this->pdo->prepare('INSERT INTO participations (cagnotte_id, nom, montant, paye, organisateur, cle, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$cagnotteId, $nom, $montant, $paye ? 1 : 0, $organisateur ? 1 : 0, $empreinteCle, $this->horloge->texte()]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private static function versJson(array $ligne): array
    {
        return [
            'id' => (int) $ligne['id'],
            'nom' => (string) $ligne['nom'],
            'montant' => (int) $ligne['montant'],
            'paye' => (bool) $ligne['paye'],
            'organisateur' => (bool) $ligne['organisateur'],
        ];
    }
}
