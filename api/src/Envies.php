<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * Liste d'envies partagée par lien (sur le modèle de Giftster ou Elfster).
 * - Le propriétaire gère ses envies (Collection « envies ») et crée ou coupe le lien de partage.
 * - Ceux qui ont le lien réservent une envie (« Je m'en occupe ») avec un prénom ; une seule réservation par envie.
 *   Ils reçoivent une clé pour annuler leur réservation.
 * - Le propriétaire ne voit jamais les réservations, même en ouvrant son propre lien : la surprise est gardée.
 */
final class Envies
{
    public const RESERVATIONS_PAR_IP = 20;

    private readonly Limiteur $limiteur;

    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge,
    ) {
        $this->limiteur = new Limiteur($pdo, $horloge);
    }

    /** @return array{code: ?string, message: ?string} */
    public function lien(int $compteId): array
    {
        $requete = $this->pdo->prepare('SELECT code, message FROM listes WHERE compte_id = ?');
        $requete->execute([$compteId]);
        $ligne = $requete->fetch(\PDO::FETCH_ASSOC);

        return ['code' => $ligne['code'] ?? null, 'message' => $ligne['message'] ?? null];
    }

    /**
     * Crée le lien de partage s'il n'existe pas, et enregistre le message affiché en haut de la liste.
     *
     * @param array<string, mixed> $donnees
     *
     * @return array{code: ?string, message: ?string}
     */
    public function partager(int $compteId, array $donnees): array
    {
        $message = trim((string) ($donnees['message'] ?? ''));
        if (mb_strlen($message) > 500) {
            throw ErreurHttp::invalide(['message' => '500 caractères au plus.']);
        }
        $message = $message === '' ? null : $message;
        if ($this->lien($compteId)['code'] === null) {
            $this->pdo->prepare('INSERT INTO listes (compte_id, code, message, cree_le) VALUES (?, ?, ?, ?)')
                ->execute([$compteId, Cagnottes::nouveauCode(), $message, $this->horloge->texte()]);
        } else {
            $this->pdo->prepare('UPDATE listes SET message = ? WHERE compte_id = ?')->execute([$message, $compteId]);
        }

        return $this->lien($compteId);
    }

    /** Coupe le lien : l'ancienne adresse ne marche plus (un nouveau partage donne une nouvelle adresse). */
    public function arreterPartage(int $compteId): void
    {
        $this->pdo->prepare('DELETE FROM listes WHERE compte_id = ?')->execute([$compteId]);
    }

    /** @return array<string, mixed> liste vue depuis le lien ; réservations cachées au propriétaire */
    public function publique(string $code, ?int $compteConnecte): array
    {
        $liste = $this->parCode($code);
        $proprietaire = (int) $liste['compte_id'];
        $estProprietaire = $compteConnecte === $proprietaire;
        $nom = $this->pdo->prepare('SELECT nom FROM comptes WHERE id = ?');
        $nom->execute([$proprietaire]);

        $requete = $this->pdo->prepare(
            'SELECT e.*, r.id AS reservation_id, r.nom AS reserve_par, r.cagnotte_code FROM envies e
             LEFT JOIN reservations r ON r.envie_id = e.id
             WHERE e.compte_id = ? ORDER BY e.priorite DESC, e.id DESC',
        );
        $requete->execute([$proprietaire]);

        return [
            'proprietaire' => (string) $nom->fetchColumn(),
            'message' => $liste['message'],
            'estProprietaire' => $estProprietaire,
            'envies' => array_map(static fn (array $e): array => [
                'id' => (int) $e['id'],
                'titre' => $e['titre'],
                'lien' => $e['lien'],
                'image' => $e['image'],
                'prix' => $e['prix'] === null ? null : (int) $e['prix'],
                'note' => $e['note'],
                'priorite' => (bool) $e['priorite'],
                'reservation' => $estProprietaire || $e['reservation_id'] === null ? null : [
                    'id' => (int) $e['reservation_id'],
                    'nom' => $e['reserve_par'],
                    // Cagnotte lancée pour cette envie : les autres proches peuvent y participer.
                    'cagnotte' => $e['cagnotte_code'],
                ],
            ], $requete->fetchAll(\PDO::FETCH_ASSOC)),
        ];
    }

    /**
     * Liste d'envies d'un compte vue par un autre compte connecté (proche associé) ; ses propres réservations sont
     * marquées « parMoi ».
     *
     * @return array<string, mixed>
     */
    public function listePour(int $proprietaire, int $moi): array
    {
        $nom = $this->pdo->prepare('SELECT nom FROM comptes WHERE id = ?');
        $nom->execute([$proprietaire]);
        $requete = $this->pdo->prepare(
            'SELECT e.*, r.id AS reservation_id, r.nom AS reserve_par, r.cagnotte_code, r.compte_id AS reserve_compte FROM envies e
             LEFT JOIN reservations r ON r.envie_id = e.id
             WHERE e.compte_id = ? ORDER BY e.priorite DESC, e.id DESC',
        );
        $requete->execute([$proprietaire]);

        return [
            'proprietaire' => (string) $nom->fetchColumn(),
            'envies' => array_map(static fn (array $e): array => [
                'id' => (int) $e['id'],
                'titre' => $e['titre'],
                'lien' => $e['lien'],
                'image' => $e['image'],
                'prix' => $e['prix'] === null ? null : (int) $e['prix'],
                'note' => $e['note'],
                'priorite' => (bool) $e['priorite'],
                'reservation' => $e['reservation_id'] === null ? null : [
                    'id' => (int) $e['reservation_id'],
                    'nom' => $e['reserve_par'],
                    'cagnotte' => $e['cagnotte_code'],
                    'parMoi' => $e['reserve_compte'] !== null && (int) $e['reserve_compte'] === $moi,
                ],
            ], $requete->fetchAll(\PDO::FETCH_ASSOC)),
        ];
    }

    /** @return array{id: int, nom: string} */
    public function reserverConnecte(int $proprietaire, int $envieId, int $moi, string $nom): array
    {
        $requete = $this->pdo->prepare('SELECT 1 FROM envies WHERE id = ? AND compte_id = ?');
        $requete->execute([$envieId, $proprietaire]);
        if ($requete->fetchColumn() === false) {
            throw ErreurHttp::introuvable();
        }
        try {
            $this->pdo->prepare('INSERT INTO reservations (envie_id, nom, cle, cree_le, compte_id) VALUES (?, ?, ?, ?, ?)')
                ->execute([$envieId, $nom, hash('sha256', bin2hex(random_bytes(32))), $this->horloge->texte(), $moi]);
        } catch (\PDOException $e) {
            if ($e->getCode() === '23000') {
                throw new ErreurHttp(409, 'Quelqu’un s’en occupe déjà.');
            }
            throw $e;
        }

        return ['id' => (int) $this->pdo->lastInsertId(), 'nom' => $nom];
    }

    public function annulerConnecte(int $proprietaire, int $envieId, int $moi): void
    {
        $requete = $this->pdo->prepare('DELETE FROM reservations WHERE envie_id = ? AND compte_id = ? AND envie_id IN (SELECT id FROM envies WHERE compte_id = ?)');
        $requete->execute([$envieId, $moi, $proprietaire]);
        if ($requete->rowCount() === 0) {
            throw new ErreurHttp(403, 'Seule la personne qui a réservé peut annuler.');
        }
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array{reservation: array{id: int, nom: string}, cle: string}
     */
    public function reserver(string $code, int $envieId, array $donnees, string $ip, ?int $compteConnecte, ?string $cagnotteCode = null): array
    {
        $liste = $this->parCode($code);
        $this->envieDeLaListe($liste, $envieId);
        if ($compteConnecte === (int) $liste['compte_id']) {
            throw new ErreurHttp(403, 'C’est votre liste : ce sont les autres qui réservent.');
        }
        $nom = trim((string) ($donnees['nom'] ?? ''));
        if ($nom === '' || mb_strlen($nom) > 80) {
            throw ErreurHttp::invalide(['nom' => 'Indiquez votre prénom (80 caractères au plus).']);
        }
        if ($this->limiteur->depasse('reservation:' . $ip, self::RESERVATIONS_PAR_IP)) {
            throw new ErreurHttp(429, 'Trop de réservations d’un coup. Réessayez dans un quart d’heure.');
        }
        $cle = bin2hex(random_bytes(32));
        try {
            $this->pdo->prepare('INSERT INTO reservations (envie_id, nom, cle, cree_le, cagnotte_code) VALUES (?, ?, ?, ?, ?)')
                ->execute([$envieId, $nom, hash('sha256', $cle), $this->horloge->texte(), $cagnotteCode]);
        } catch (\PDOException $e) {
            if ($e->getCode() === '23000') {
                throw new ErreurHttp(409, 'Quelqu’un s’en occupe déjà.');
            }
            throw $e;
        }
        $this->limiteur->noter('reservation:' . $ip);

        return ['reservation' => ['id' => (int) $this->pdo->lastInsertId(), 'nom' => $nom], 'cle' => $cle];
    }

    /**
     * Envie de la liste (pour lancer une cagnotte) : titre, prix, lien, et prénom du propriétaire.
     *
     * @return array{titre: string, prix: ?int, lien: ?string, proprietaire: string}
     */
    public function envieAPartager(string $code, int $envieId, int $compteConnecte): array
    {
        $liste = $this->parCode($code);
        $this->envieDeLaListe($liste, $envieId);
        if ($compteConnecte === (int) $liste['compte_id']) {
            throw new ErreurHttp(403, 'C’est votre liste : ce sont les autres qui se cotisent.');
        }
        $requete = $this->pdo->prepare('SELECT e.titre, e.prix, e.lien, c.nom FROM envies e JOIN comptes c ON c.id = e.compte_id WHERE e.id = ?');
        $requete->execute([$envieId]);
        $e = $requete->fetch(\PDO::FETCH_ASSOC);

        return ['titre' => (string) $e['titre'], 'prix' => $e['prix'] === null ? null : (int) $e['prix'], 'lien' => $e['lien'], 'proprietaire' => (string) $e['nom']];
    }

    public function annulerReservation(string $code, int $envieId, ?string $cle): void
    {
        $this->envieDeLaListe($this->parCode($code), $envieId);
        $requete = $this->pdo->prepare('SELECT cle FROM reservations WHERE envie_id = ?');
        $requete->execute([$envieId]);
        $empreinte = $requete->fetchColumn();
        if ($empreinte === false) {
            throw ErreurHttp::introuvable();
        }
        if ($cle === null || !hash_equals((string) $empreinte, hash('sha256', $cle))) {
            throw new ErreurHttp(403, 'Seule la personne qui a réservé peut annuler.');
        }
        $this->pdo->prepare('DELETE FROM reservations WHERE envie_id = ?')->execute([$envieId]);
    }

    /** Une envie supprimée par son propriétaire emporte sa réservation. */
    public function apresSuppression(int $envieId): void
    {
        $this->pdo->prepare('DELETE FROM reservations WHERE envie_id = ?')->execute([$envieId]);
    }

    /** @return array<string, mixed> */
    private function parCode(string $code): array
    {
        $requete = $this->pdo->prepare('SELECT * FROM listes WHERE code = ?');
        $requete->execute([$code]);

        return $requete->fetch(\PDO::FETCH_ASSOC) ?: throw ErreurHttp::introuvable();
    }

    /** @param array<string, mixed> $liste */
    private function envieDeLaListe(array $liste, int $envieId): void
    {
        $requete = $this->pdo->prepare('SELECT 1 FROM envies WHERE id = ? AND compte_id = ?');
        $requete->execute([$envieId, $liste['compte_id']]);
        if ($requete->fetchColumn() === false) {
            throw ErreurHttp::introuvable();
        }
    }
}
