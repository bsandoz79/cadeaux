<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * Comptes et connexion. Mot de passe haché (password_hash), jeton aléatoire dont seule l'empreinte SHA-256 est gardée.
 * Après 5 essais ratés en 15 minutes pour une même adresse ou une même IP, la connexion est refusée un moment.
 * Une connexion inutilisée pendant 90 jours expire ; chaque visite note la dernière activité du compte
 * (pour la suppression des comptes inactifs, voir Menage).
 */
final class Comptes
{
    private const ESSAIS_MAX = 5;
    public const JOURS_VALIDITE_JETON = 90;

    private readonly Limiteur $limiteur;

    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge,
    ) {
        $this->limiteur = new Limiteur($pdo, $horloge);
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array{jeton: string, compte: array<string, mixed>}
     */
    public function inscrire(array $donnees): array
    {
        $email = mb_strtolower(trim((string) ($donnees['email'] ?? '')));
        $nom = trim((string) ($donnees['nom'] ?? ''));
        $motDePasse = (string) ($donnees['motDePasse'] ?? '');

        $erreurs = [];
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || mb_strlen($email) > 190) {
            $erreurs['email'] = 'Adresse e-mail invalide.';
        }
        if ($nom === '' || mb_strlen($nom) > 80) {
            $erreurs['nom'] = 'Indiquez votre prénom (80 caractères au plus).';
        }
        if (mb_strlen($motDePasse) < 8 || mb_strlen($motDePasse) > 200) {
            $erreurs['motDePasse'] = 'Au moins 8 caractères.';
        }
        if ($erreurs !== []) {
            throw ErreurHttp::invalide($erreurs);
        }

        $existe = $this->pdo->prepare('SELECT 1 FROM comptes WHERE email = ?');
        $existe->execute([$email]);
        if ($existe->fetchColumn() !== false) {
            throw ErreurHttp::invalide(['email' => 'Un compte existe déjà avec cette adresse.']);
        }

        // Rappels par e-mail : seulement si la case a été cochée à l'inscription.
        $this->pdo->prepare('INSERT INTO comptes (email, nom, mot_de_passe, cree_le, rappels, email_confirme) VALUES (?, ?, ?, ?, ?, 0)')
            ->execute([$email, $nom, password_hash($motDePasse, PASSWORD_DEFAULT), $this->horloge->texte(), ($donnees['rappels'] ?? false) ? 1 : 0]);
        $id = (int) $this->pdo->lastInsertId();

        return $this->ouvrirSession($id);
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array{jeton: string, compte: array<string, mixed>}
     */
    public function connecter(array $donnees, string $ip): array
    {
        $email = mb_strtolower(trim((string) ($donnees['email'] ?? '')));
        $motDePasse = (string) ($donnees['motDePasse'] ?? '');
        $cles = ['email:' . $email, 'ip:' . $ip];

        if (array_filter($cles, fn (string $cle): bool => $this->limiteur->depasse($cle, self::ESSAIS_MAX)) !== []) {
            throw new ErreurHttp(429, 'Trop d’essais. Réessayez dans un quart d’heure.');
        }

        $requete = $this->pdo->prepare('SELECT id, mot_de_passe, bloque FROM comptes WHERE email = ?');
        $requete->execute([$email]);
        $ligne = $requete->fetch(\PDO::FETCH_ASSOC);

        if ($ligne === false || !password_verify($motDePasse, (string) $ligne['mot_de_passe'])) {
            foreach ($cles as $cle) {
                $this->limiteur->noter($cle);
            }
            throw new ErreurHttp(401, 'Adresse ou mot de passe incorrect.');
        }

        $id = (int) $ligne['id'];
        if ((bool) $ligne['bloque']) {
            throw new ErreurHttp(403, 'Compte bloqué par sécurité : choisissez un nouveau mot de passe avec le lien reçu par e-mail (ou « Mot de passe oublié ? »).');
        }
        if (password_needs_rehash((string) $ligne['mot_de_passe'], PASSWORD_DEFAULT)) {
            $this->pdo->prepare('UPDATE comptes SET mot_de_passe = ? WHERE id = ?')
                ->execute([password_hash($motDePasse, PASSWORD_DEFAULT), $id]);
        }

        return $this->ouvrirSession($id);
    }

    /** @return array{jeton: string, compte: array<string, mixed>} */
    public function ouvrirSession(int $id): array
    {
        return ['jeton' => $this->nouveauJeton($id), 'compte' => $this->compte($id)];
    }

    /**
     * Identifiant du compte connecté avec ce jeton, ou null (jeton inconnu ou expiré).
     * La date d'utilisation est mise à jour au plus une fois par heure, pour ne pas écrire à chaque requête.
     */
    public function depuisJeton(?string $jeton): ?int
    {
        if ($jeton === null) {
            return null;
        }
        $empreinte = hash('sha256', $jeton);
        $requete = $this->pdo->prepare('SELECT compte_id, cree_le, utilise_le FROM jetons WHERE empreinte = ?');
        $requete->execute([$empreinte]);
        $ligne = $requete->fetch(\PDO::FETCH_ASSOC);
        if ($ligne === false) {
            return null;
        }

        $maintenant = $this->horloge->maintenant();
        $derniere = (string) ($ligne['utilise_le'] ?? $ligne['cree_le']);
        if ($derniere < $maintenant->modify(sprintf('-%d days', self::JOURS_VALIDITE_JETON))->format('Y-m-d H:i:s')) {
            $this->pdo->prepare('DELETE FROM jetons WHERE empreinte = ?')->execute([$empreinte]);

            return null;
        }
        $id = (int) $ligne['compte_id'];
        if ($derniere < $maintenant->modify('-1 hour')->format('Y-m-d H:i:s')) {
            $this->pdo->prepare('UPDATE jetons SET utilise_le = ? WHERE empreinte = ?')->execute([$this->horloge->texte(), $empreinte]);
            $this->noterActivite($id);
        }

        return $id;
    }

    /** Le compte sert : il n'est plus inactif, l'éventuel avertissement de suppression est annulé. */
    private function noterActivite(int $id): void
    {
        $this->pdo->prepare('UPDATE comptes SET derniere_activite = ?, averti_le = NULL WHERE id = ?')->execute([$this->horloge->texte(), $id]);
    }

    public function deconnecter(string $jeton): void
    {
        $this->pdo->prepare('DELETE FROM jetons WHERE empreinte = ?')->execute([hash('sha256', $jeton)]);
    }

    /** @return array<string, mixed> */
    public function compte(int $id): array
    {
        $requete = $this->pdo->prepare('SELECT id, email, nom, rappels, email_confirme, date_naissance, google_sub, mot_de_passe_defini FROM comptes WHERE id = ?');
        $requete->execute([$id]);
        $ligne = $requete->fetch(\PDO::FETCH_ASSOC) ?: throw ErreurHttp::introuvable();

        return ['id' => (int) $ligne['id'], 'email' => $ligne['email'], 'nom' => $ligne['nom'], 'rappels' => (bool) $ligne['rappels'], 'emailConfirme' => (bool) $ligne['email_confirme'], 'dateNaissance' => $ligne['date_naissance'], 'google' => $ligne['google_sub'] !== null, 'motDePasse' => (bool) $ligne['mot_de_passe_defini']];
    }

    /**
     * Réglages du compte : prénom et rappels par e-mail.
     *
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function regler(int $id, array $donnees): array
    {
        if (array_key_exists('nom', $donnees)) {
            $nom = trim((string) $donnees['nom']);
            if ($nom === '' || mb_strlen($nom) > 80) {
                throw ErreurHttp::invalide(['nom' => 'Indiquez votre prénom (80 caractères au plus).']);
            }
            $this->pdo->prepare('UPDATE comptes SET nom = ? WHERE id = ?')->execute([$nom, $id]);
        }
        if (array_key_exists('dateNaissance', $donnees)) {
            $date = $donnees['dateNaissance'];
            if ($date !== null && $date !== '') {
                $d = \DateTimeImmutable::createFromFormat('!Y-m-d', (string) $date);
                if ($d === false || $d->format('Y-m-d') !== $date) {
                    throw ErreurHttp::invalide(['dateNaissance' => 'Date invalide.']);
                }
            }
            $this->pdo->prepare('UPDATE comptes SET date_naissance = ? WHERE id = ?')->execute([$date ?: null, $id]);
        }
        if (array_key_exists('rappels', $donnees)) {
            $this->pdo->prepare('UPDATE comptes SET rappels = ? WHERE id = ?')->execute([$donnees['rappels'] ? 1 : 0, $id]);
        }

        return $this->compte($id);
    }

    /** Supprime le compte et tout ce qui lui appartient. */
    public function supprimer(int $id): void
    {
        // Ce que d'autres ont lié à ce compte : associations retirées, ses réservations et invitations effacées.
        $this->pdo->prepare('UPDATE personnes SET compte_lie_id = NULL WHERE compte_lie_id = ?')->execute([$id]);
        foreach (['reservations' => 'envie_id IN (SELECT id FROM envies WHERE compte_id = ?) OR compte_id = ?', 'invitations' => 'compte_id = ? OR personne_id IN (SELECT id FROM personnes WHERE compte_id = ?)', 'cagnottes_invites' => 'compte_id = ? OR cagnotte_id IN (SELECT id FROM cagnottes WHERE compte_id = ?)', 'envies' => 'compte_id = ?', 'listes' => 'compte_id = ?', 'rappels_envoyes' => 'compte_id = ?', 'liens' => 'compte_id = ?', 'changements_email' => 'compte_id = ?', 'appareils' => 'compte_id = ?', 'participations' => 'cagnotte_id IN (SELECT id FROM cagnottes WHERE compte_id = ?)', 'cagnottes' => 'compte_id = ?', 'cadeaux' => 'compte_id = ?', 'budgets' => 'compte_id = ?', 'occasions' => 'compte_id = ?', 'personnes_groupes' => 'personne_id IN (SELECT id FROM personnes WHERE compte_id = ?)', 'groupes' => 'compte_id = ?', 'personnes' => 'compte_id = ?', 'jetons' => 'compte_id = ?', 'comptes' => 'id = ?'] as $table => $condition) {
            $this->pdo->prepare("DELETE FROM $table WHERE $condition")->execute(array_fill(0, substr_count($condition, '?'), $id));
        }
    }

    private function nouveauJeton(int $compteId): string
    {
        $jeton = bin2hex(random_bytes(32));
        $this->pdo->prepare('INSERT INTO jetons (compte_id, empreinte, cree_le, utilise_le) VALUES (?, ?, ?, ?)')
            ->execute([$compteId, hash('sha256', $jeton), $this->horloge->texte(), $this->horloge->texte()]);
        $this->noterActivite($compteId);

        return $jeton;
    }
}
