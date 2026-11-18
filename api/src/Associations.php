<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * Associer un proche (fiche créée par l'utilisateur) au vrai compte de cette personne, avec son accord :
 * - l'utilisateur crée un lien d'invitation (30 jours) et l'envoie lui-même (WhatsApp, Snap, SMS) ;
 * - la personne, connectée, accepte ou refuse ; elle peut retirer l'association ensuite (« Mon compte »), l'utilisateur aussi.
 * Une fois associé : sa liste d'envies visible et réservable depuis la fiche (le propriétaire ne voit jamais les
 * réservations), sa date de naissance (si elle l'a mise) reprise par la fiche, invitations directes aux cagnottes.
 */
final class Associations
{
    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge,
        private readonly Courrier $courrier,
        private readonly Comptes $comptes,
        private readonly Envies $envies,
        private readonly string $site,
    ) {
    }

    /** @return array{url: string} lien d'invitation à envoyer à la personne */
    public function inviter(int $compteId, int $personneId): array
    {
        $this->proche($compteId, $personneId);
        $this->pdo->prepare('DELETE FROM invitations WHERE personne_id = ?')->execute([$personneId]);
        $jeton = bin2hex(random_bytes(32));
        $this->pdo->prepare('INSERT INTO invitations (compte_id, personne_id, empreinte, expire_le) VALUES (?, ?, ?, ?)')
            ->execute([$compteId, $personneId, hash('sha256', $jeton), $this->horloge->maintenant()->modify('+30 days')->format('Y-m-d H:i:s')]);

        return ['url' => "{$this->site}/rejoindre/$jeton"];
    }

    /** @return array{inviteur: string, nom: string} ce que montre l'invitation */
    public function voir(string $jeton): array
    {
        $i = $this->invitation($jeton);

        return ['inviteur' => (string) $i['inviteur'], 'nom' => (string) $i['nom']];
    }

    public function accepter(string $jeton, int $compteId): void
    {
        $i = $this->invitation($jeton);
        if ((int) $i['compte_id'] === $compteId) {
            throw new ErreurHttp(409, 'C’est votre propre invitation : envoyez-la à la personne concernée.');
        }
        // Une seule fiche associée par compte chez un même utilisateur.
        $this->pdo->prepare('UPDATE personnes SET compte_lie_id = NULL WHERE compte_id = ? AND compte_lie_id = ?')->execute([$i['compte_id'], $compteId]);
        $this->pdo->prepare('UPDATE personnes SET compte_lie_id = ? WHERE id = ?')->execute([$compteId, $i['personne_id']]);
        $this->pdo->prepare('DELETE FROM invitations WHERE id = ?')->execute([$i['id']]);
    }

    public function refuser(string $jeton): void
    {
        $this->pdo->prepare('DELETE FROM invitations WHERE id = ?')->execute([$this->invitation($jeton)['id']]);
    }

    /** @return list<array{personneId: int, inviteur: string, nom: string}> qui m'a associé à une de ses fiches */
    public function associesAMoi(int $compteId): array
    {
        $requete = $this->pdo->prepare('SELECT p.id, p.nom, c.nom AS inviteur FROM personnes p JOIN comptes c ON c.id = p.compte_id WHERE p.compte_lie_id = ? ORDER BY c.nom');
        $requete->execute([$compteId]);

        return array_map(static fn (array $l): array => ['personneId' => (int) $l['id'], 'inviteur' => (string) $l['inviteur'], 'nom' => (string) $l['nom']], $requete->fetchAll(\PDO::FETCH_ASSOC));
    }

    /** La personne associée retire l'association. */
    public function retirerPourMoi(int $compteId, int $personneId): void
    {
        $this->pdo->prepare('UPDATE personnes SET compte_lie_id = NULL WHERE id = ? AND compte_lie_id = ?')->execute([$personneId, $compteId]);
    }

    /** L'utilisateur dissocie sa fiche. */
    public function dissocier(int $compteId, int $personneId): void
    {
        $this->proche($compteId, $personneId);
        $this->pdo->prepare('UPDATE personnes SET compte_lie_id = NULL WHERE id = ?')->execute([$personneId]);
        $this->pdo->prepare('DELETE FROM invitations WHERE personne_id = ?')->execute([$personneId]);
    }

    /**
     * Informations venues des comptes associés, pour les fiches : nom du compte, date de naissance s'il l'a mise.
     *
     * @return array<int, array{nom: string, dateNaissance: ?string}> par fiche
     */
    public function comptesLies(int $compteId): array
    {
        $requete = $this->pdo->prepare('SELECT p.id, c.nom, c.date_naissance FROM personnes p JOIN comptes c ON c.id = p.compte_lie_id WHERE p.compte_id = ?');
        $requete->execute([$compteId]);
        $resultat = [];
        foreach ($requete->fetchAll(\PDO::FETCH_ASSOC) as $l) {
            $resultat[(int) $l['id']] = ['nom' => (string) $l['nom'], 'dateNaissance' => $l['date_naissance']];
        }

        return $resultat;
    }

    /**
     * Fiche avec son compte associé : « compteLie », et la date de naissance du compte si la fiche n'en a pas.
     *
     * @param array<string, mixed> $personne
     * @param array<int, array{nom: string, dateNaissance: ?string}> $lies
     *
     * @return array<string, mixed>
     */
    public static function avecCompteLie(array $personne, array $lies): array
    {
        $lie = $lies[$personne['id']] ?? null;
        if ($lie !== null && $personne['dateNaissance'] === null && $lie['dateNaissance'] !== null) {
            $personne['dateNaissance'] = $lie['dateNaissance'];
            $personne['dateDuCompte'] = true;
        }

        return $personne + ['compteLie' => $lie === null ? null : ['nom' => $lie['nom']]];
    }

    /** @return array<string, mixed> liste d'envies du proche associé (sans compte associé : 404) */
    public function enviesDuProche(int $compteId, int $personneId): array
    {
        return $this->envies->listePour($this->compteDuProche($compteId, $personneId), $compteId);
    }

    /** @return array{id: int, nom: string} */
    public function reserverPourProche(int $compteId, int $personneId, int $envieId): array
    {
        return $this->envies->reserverConnecte($this->compteDuProche($compteId, $personneId), $envieId, $compteId, (string) $this->comptes->compte($compteId)['nom']);
    }

    public function annulerPourProche(int $compteId, int $personneId, int $envieId): void
    {
        $this->envies->annulerConnecte($this->compteDuProche($compteId, $personneId), $envieId, $compteId);
    }

    /**
     * Inviter des proches associés à une cagnotte : ils la retrouvent dans leur compte, et reçoivent un e-mail.
     *
     * @param mixed $personneIds
     *
     * @return int nombre d'invitations envoyées
     */
    public function inviterACagnotte(int $compteId, int $cagnotteId, mixed $personneIds): int
    {
        $requete = $this->pdo->prepare('SELECT code, titre, beneficiaire, close FROM cagnottes WHERE id = ? AND compte_id = ?');
        $requete->execute([$cagnotteId, $compteId]);
        $g = $requete->fetch(\PDO::FETCH_ASSOC) ?: throw ErreurHttp::introuvable();
        if ((bool) $g['close']) {
            throw new ErreurHttp(409, 'Cette cagnotte est terminée.');
        }
        if (!is_array($personneIds) || array_filter($personneIds, static fn ($id): bool => !is_int($id)) !== []) {
            throw ErreurHttp::invalide(['personneIds' => 'Liste de proches invalide.']);
        }
        $organisateur = (string) $this->comptes->compte($compteId)['nom'];
        $envoyees = 0;
        foreach (array_unique($personneIds) as $pid) {
            $lie = $this->compteDuProche($compteId, $pid);
            $existe = $this->pdo->prepare('SELECT 1 FROM cagnottes_invites WHERE cagnotte_id = ? AND compte_id = ?');
            $existe->execute([$cagnotteId, $lie]);
            if ($existe->fetchColumn() !== false) {
                continue;
            }
            $this->pdo->prepare('INSERT INTO cagnottes_invites (cagnotte_id, compte_id, invite_le) VALUES (?, ?, ?)')->execute([$cagnotteId, $lie, $this->horloge->texte()]);
            $invite = $this->comptes->compte($lie);
            if ($invite['emailConfirme']) {
                $this->courrier->envoyer((string) $invite['email'], "{$organisateur} vous invite à une cagnotte", <<<TXT
                    Bonjour {$invite['nom']},

                    {$organisateur} organise une cagnotte pour {$g['beneficiaire']} : « {$g['titre']} ».
                    Pour mettre votre part :
                    {$this->site}/c/{$g['code']}

                    Cadeaux
                    TXT);
            }
            ++$envoyees;
        }

        return $envoyees;
    }

    /** @return list<array<string, mixed>> cagnottes où je suis invité */
    public function mesInvitationsCagnottes(int $compteId): array
    {
        $requete = $this->pdo->prepare(
            'SELECT g.code, g.titre, g.beneficiaire, g.objectif, g.date_limite, c.nom AS organisateur,
                    (SELECT COALESCE(SUM(montant), 0) FROM participations WHERE cagnotte_id = g.id) AS total
             FROM cagnottes_invites i JOIN cagnottes g ON g.id = i.cagnotte_id JOIN comptes c ON c.id = g.compte_id
             WHERE i.compte_id = ? AND g.close = 0 ORDER BY i.invite_le DESC',
        );
        $requete->execute([$compteId]);

        return array_map(static fn (array $l): array => [
            'code' => $l['code'], 'titre' => $l['titre'], 'beneficiaire' => $l['beneficiaire'], 'organisateur' => $l['organisateur'],
            'objectif' => (int) $l['objectif'], 'total' => (int) $l['total'], 'dateLimite' => $l['date_limite'],
        ], $requete->fetchAll(\PDO::FETCH_ASSOC));
    }

    /** @return array<string, mixed> */
    private function invitation(string $jeton): array
    {
        $requete = $this->pdo->prepare(
            'SELECT i.*, c.nom AS inviteur, p.nom FROM invitations i JOIN comptes c ON c.id = i.compte_id JOIN personnes p ON p.id = i.personne_id WHERE i.empreinte = ?',
        );
        $requete->execute([hash('sha256', $jeton)]);
        $i = $requete->fetch(\PDO::FETCH_ASSOC);
        if ($i === false || $i['expire_le'] < $this->horloge->texte()) {
            throw new ErreurHttp(410, 'Cette invitation n’est plus valable. Demandez-en une nouvelle.');
        }

        return $i;
    }

    private function proche(int $compteId, int $personneId): void
    {
        $requete = $this->pdo->prepare('SELECT 1 FROM personnes WHERE id = ? AND compte_id = ?');
        $requete->execute([$personneId, $compteId]);
        if ($requete->fetchColumn() === false) {
            throw ErreurHttp::introuvable();
        }
    }

    private function compteDuProche(int $compteId, int $personneId): int
    {
        $requete = $this->pdo->prepare('SELECT compte_lie_id FROM personnes WHERE id = ? AND compte_id = ?');
        $requete->execute([$personneId, $compteId]);
        $lie = $requete->fetchColumn();
        if ($lie === false || $lie === null) {
            throw new ErreurHttp(404, 'Ce proche n’est pas associé à un compte.');
        }

        return (int) $lie;
    }
}
