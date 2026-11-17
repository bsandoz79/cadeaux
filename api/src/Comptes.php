<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * Comptes et connexion. Mot de passe haché (password_hash), jeton aléatoire dont seule l'empreinte SHA-256 est gardée.
 * Après 5 essais ratés en 15 minutes pour une même adresse ou une même IP, la connexion est refusée un moment.
 */
final class Comptes
{
    private const ESSAIS_MAX = 5;
    private const FENETRE_MINUTES = 15;

    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge,
    ) {
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

        $this->pdo->prepare('INSERT INTO comptes (email, nom, mot_de_passe, cree_le) VALUES (?, ?, ?, ?)')
            ->execute([$email, $nom, password_hash($motDePasse, PASSWORD_DEFAULT), $this->horloge->texte()]);
        $id = (int) $this->pdo->lastInsertId();

        return ['jeton' => $this->nouveauJeton($id), 'compte' => $this->compte($id)];
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

        if ($this->tropDEssais($cles)) {
            throw new ErreurHttp(429, 'Trop d’essais. Réessayez dans un quart d’heure.');
        }

        $requete = $this->pdo->prepare('SELECT id, mot_de_passe FROM comptes WHERE email = ?');
        $requete->execute([$email]);
        $ligne = $requete->fetch(\PDO::FETCH_ASSOC);

        if ($ligne === false || !password_verify($motDePasse, (string) $ligne['mot_de_passe'])) {
            foreach ($cles as $cle) {
                $this->pdo->prepare('INSERT INTO tentatives (cle, le) VALUES (?, ?)')->execute([$cle, $this->horloge->texte()]);
            }
            throw new ErreurHttp(401, 'Adresse ou mot de passe incorrect.');
        }

        $id = (int) $ligne['id'];
        if (password_needs_rehash((string) $ligne['mot_de_passe'], PASSWORD_DEFAULT)) {
            $this->pdo->prepare('UPDATE comptes SET mot_de_passe = ? WHERE id = ?')
                ->execute([password_hash($motDePasse, PASSWORD_DEFAULT), $id]);
        }

        return ['jeton' => $this->nouveauJeton($id), 'compte' => $this->compte($id)];
    }

    /** Identifiant du compte connecté avec ce jeton, ou null. */
    public function depuisJeton(?string $jeton): ?int
    {
        if ($jeton === null) {
            return null;
        }
        $requete = $this->pdo->prepare('SELECT compte_id FROM jetons WHERE empreinte = ?');
        $requete->execute([hash('sha256', $jeton)]);
        $id = $requete->fetchColumn();

        return $id === false ? null : (int) $id;
    }

    public function deconnecter(string $jeton): void
    {
        $this->pdo->prepare('DELETE FROM jetons WHERE empreinte = ?')->execute([hash('sha256', $jeton)]);
    }

    /** @return array<string, mixed> */
    public function compte(int $id): array
    {
        $requete = $this->pdo->prepare('SELECT id, email, nom FROM comptes WHERE id = ?');
        $requete->execute([$id]);
        $ligne = $requete->fetch(\PDO::FETCH_ASSOC) ?: throw ErreurHttp::introuvable();

        return ['id' => (int) $ligne['id'], 'email' => $ligne['email'], 'nom' => $ligne['nom']];
    }

    /** Supprime le compte et tout ce qui lui appartient. */
    public function supprimer(int $id): void
    {
        foreach (['participations' => 'cagnotte_id IN (SELECT id FROM cagnottes WHERE compte_id = ?)', 'cagnottes' => 'compte_id = ?', 'cadeaux' => 'compte_id = ?', 'occasions' => 'compte_id = ?', 'personnes' => 'compte_id = ?', 'jetons' => 'compte_id = ?', 'comptes' => 'id = ?'] as $table => $condition) {
            $this->pdo->prepare("DELETE FROM $table WHERE $condition")->execute([$id]);
        }
    }

    private function nouveauJeton(int $compteId): string
    {
        $jeton = bin2hex(random_bytes(32));
        $this->pdo->prepare('INSERT INTO jetons (compte_id, empreinte, cree_le) VALUES (?, ?, ?)')
            ->execute([$compteId, hash('sha256', $jeton), $this->horloge->texte()]);

        return $jeton;
    }

    /** @param list<string> $cles */
    private function tropDEssais(array $cles): bool
    {
        $depuis = $this->horloge->maintenant()->modify(sprintf('-%d minutes', self::FENETRE_MINUTES))->format('Y-m-d H:i:s');
        $this->pdo->prepare('DELETE FROM tentatives WHERE le < ?')->execute([$depuis]);
        $requete = $this->pdo->prepare('SELECT COUNT(*) FROM tentatives WHERE cle = ? AND le >= ?');
        foreach ($cles as $cle) {
            $requete->execute([$cle, $depuis]);
            if ((int) $requete->fetchColumn() >= self::ESSAIS_MAX) {
                return true;
            }
        }

        return false;
    }
}
