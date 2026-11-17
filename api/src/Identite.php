<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * Tout ce qui passe par un lien envoyé par e-mail :
 * - confirmation de l'adresse à l'inscription (lien valable 7 jours) ;
 * - mot de passe oublié (lien valable 1 heure ; toutes les connexions sont fermées après le changement) ;
 * - changement d'adresse (lien envoyé à la nouvelle adresse, valable 24 heures ; l'ancienne est prévenue).
 * Comme les jetons de connexion, seul le hachage SHA-256 du lien est gardé ; un lien ne sert qu'une fois.
 * « Mot de passe oublié » répond toujours la même chose, que le compte existe ou non.
 */
final class Identite
{
    private const DUREES = ['confirmation' => '+7 days', 'motdepasse' => '+1 hour', 'email' => '+24 hours'];

    private readonly Limiteur $limiteur;

    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge,
        private readonly Courrier $courrier,
        private readonly Comptes $comptes,
        private readonly string $site,
    ) {
        $this->limiteur = new Limiteur($pdo, $horloge);
    }

    public function envoyerConfirmation(int $compteId): void
    {
        $compte = $this->comptes->compte($compteId);
        if ($compte['emailConfirme']) {
            return;
        }
        if ($this->limiteur->depasse('confirmation:' . $compteId, 3)) {
            throw new ErreurHttp(429, 'E-mail déjà renvoyé plusieurs fois. Réessayez dans un quart d’heure.');
        }
        $this->limiteur->noter('confirmation:' . $compteId);
        $lien = $this->creerLien($compteId, 'confirmation');
        $this->courrier->envoyer((string) $compte['email'], 'Confirmez votre adresse e-mail', <<<TXT
            Bonjour {$compte['nom']},

            Pour confirmer votre adresse e-mail sur Cadeaux, ouvrez ce lien (valable 7 jours) :
            {$this->site}/confirmer/{$lien}

            Sans confirmation, vous ne recevrez pas les rappels par e-mail.
            Vous n'avez pas créé de compte ? Ignorez ce message.

            Cadeaux
            TXT);
    }

    /** E-mail de test (« Mon compte ») : vérifier qu'il arrive, et pas dans les indésirables. */
    public function envoyerTest(int $compteId): string
    {
        if ($this->limiteur->depasse('test:' . $compteId, 3)) {
            throw new ErreurHttp(429, 'Déjà 3 e-mails de test : réessayez dans un quart d’heure.');
        }
        $this->limiteur->noter('test:' . $compteId);
        $compte = $this->comptes->compte($compteId);
        $parti = $this->courrier->envoyer((string) $compte['email'], 'E-mail de test', <<<TXT
            Bonjour {$compte['nom']},

            Ceci est un e-mail de test : s'il est arrivé dans votre boîte de réception, les rappels arriveront aussi.
            S'il est dans les indésirables, marquez-le « Pas un spam ».

            Cadeaux
            TXT);
        if (!$parti) {
            throw new ErreurHttp(502, 'L’e-mail n’a pas pu partir. Réessayez plus tard.');
        }

        return (string) $compte['email'];
    }

    public function demanderReinitialisation(string $email, string $ip): void
    {
        $email = mb_strtolower(trim($email));
        if ($this->limiteur->depasse('oubli:' . $ip, 5) || $this->limiteur->depasse('oubli:' . $email, 3)) {
            throw new ErreurHttp(429, 'Trop de demandes. Réessayez dans un quart d’heure.');
        }
        $this->limiteur->noter('oubli:' . $ip);
        $this->limiteur->noter('oubli:' . $email);
        $requete = $this->pdo->prepare('SELECT id, nom FROM comptes WHERE email = ?');
        $requete->execute([$email]);
        $compte = $requete->fetch(\PDO::FETCH_ASSOC);
        if ($compte === false) {
            return; // même réponse : on ne dit pas si l'adresse a un compte
        }
        $lien = $this->creerLien((int) $compte['id'], 'motdepasse');
        $this->courrier->envoyer($email, 'Choisir un nouveau mot de passe', <<<TXT
            Bonjour {$compte['nom']},

            Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :
            {$this->site}/motdepasse/{$lien}

            Vous n'avez rien demandé ? Ignorez ce message : votre mot de passe ne change pas.

            Cadeaux
            TXT);
    }

    /**
     * Nouveau mot de passe depuis le lien reçu : toutes les connexions sont fermées, puis une nouvelle est ouverte.
     *
     * @return array{jeton: string, compte: array<string, mixed>}
     */
    public function reinitialiser(string $lien, string $motDePasse): array
    {
        self::verifierMotDePasse($motDePasse, 'motDePasse');
        $l = $this->utiliserLien($lien, ['motdepasse']);
        $id = (int) $l['compte_id'];
        $this->pdo->prepare('UPDATE comptes SET mot_de_passe = ?, email_confirme = 1 WHERE id = ?')->execute([password_hash($motDePasse, PASSWORD_DEFAULT), $id]);
        $this->pdo->prepare('DELETE FROM jetons WHERE compte_id = ?')->execute([$id]);

        return $this->comptes->ouvrirSession($id);
    }

    /** @return array{type: string, email: string} */
    public function confirmer(string $lien): array
    {
        $l = $this->utiliserLien($lien, ['confirmation', 'email']);
        $id = (int) $l['compte_id'];
        if ($l['type'] === 'email') {
            $pris = $this->pdo->prepare('SELECT 1 FROM comptes WHERE email = ? AND id <> ?');
            $pris->execute([$l['nouvel_email'], $id]);
            if ($pris->fetchColumn() !== false) {
                throw new ErreurHttp(409, 'Cette adresse est déjà utilisée par un autre compte.');
            }
            $this->pdo->prepare('UPDATE comptes SET email = ?, email_confirme = 1 WHERE id = ?')->execute([$l['nouvel_email'], $id]);
        } else {
            $this->pdo->prepare('UPDATE comptes SET email_confirme = 1 WHERE id = ?')->execute([$id]);
        }

        return ['type' => (string) $l['type'], 'email' => (string) $this->comptes->compte($id)['email']];
    }

    /** Changer de mot de passe depuis « Mon compte » : les autres appareils sont déconnectés. */
    public function changerMotDePasse(int $compteId, string $actuel, string $nouveau, ?string $jetonCourant): void
    {
        $this->verifierMotDePasseActuel($compteId, $actuel);
        self::verifierMotDePasse($nouveau, 'nouveau');
        $this->pdo->prepare('UPDATE comptes SET mot_de_passe = ? WHERE id = ?')->execute([password_hash($nouveau, PASSWORD_DEFAULT), $compteId]);
        $this->pdo->prepare('DELETE FROM jetons WHERE compte_id = ? AND empreinte <> ?')->execute([$compteId, hash('sha256', (string) $jetonCourant)]);
    }

    /** Changer d'adresse : confirmée par un lien envoyé à la nouvelle, l'ancienne est prévenue. */
    public function demanderChangementEmail(int $compteId, string $nouvelle, string $motDePasse): void
    {
        $this->verifierMotDePasseActuel($compteId, $motDePasse);
        $nouvelle = mb_strtolower(trim($nouvelle));
        if (filter_var($nouvelle, FILTER_VALIDATE_EMAIL) === false || mb_strlen($nouvelle) > 190) {
            throw ErreurHttp::invalide(['email' => 'Adresse e-mail invalide.']);
        }
        $pris = $this->pdo->prepare('SELECT 1 FROM comptes WHERE email = ?');
        $pris->execute([$nouvelle]);
        if ($pris->fetchColumn() !== false) {
            throw ErreurHttp::invalide(['email' => 'Cette adresse est déjà utilisée.']);
        }
        if ($this->limiteur->depasse('email:' . $compteId, 3)) {
            throw new ErreurHttp(429, 'Trop de demandes. Réessayez dans un quart d’heure.');
        }
        $this->limiteur->noter('email:' . $compteId);
        $compte = $this->comptes->compte($compteId);
        $lien = $this->creerLien($compteId, 'email', $nouvelle);
        $this->courrier->envoyer($nouvelle, 'Confirmez votre nouvelle adresse e-mail', <<<TXT
            Bonjour {$compte['nom']},

            Pour utiliser cette adresse sur Cadeaux, ouvrez ce lien (valable 24 heures) :
            {$this->site}/confirmer/{$lien}

            Vous n'avez rien demandé ? Ignorez ce message.

            Cadeaux
            TXT);
        $this->courrier->envoyer((string) $compte['email'], 'Changement de votre adresse e-mail', <<<TXT
            Bonjour {$compte['nom']},

            Une demande a été faite pour remplacer votre adresse sur Cadeaux par {$nouvelle}.
            Le changement ne se fera que si le lien envoyé à cette adresse est ouvert.

            Ce n'est pas vous ? Changez votre mot de passe : {$this->site}/compte

            Cadeaux
            TXT);
    }

    private function creerLien(int $compteId, string $type, ?string $nouvelEmail = null): string
    {
        // Un seul lien valable à la fois par type : les anciens ne marchent plus.
        $this->pdo->prepare('DELETE FROM liens WHERE compte_id = ? AND type = ?')->execute([$compteId, $type]);
        $lien = bin2hex(random_bytes(32));
        $this->pdo->prepare('INSERT INTO liens (compte_id, type, empreinte, nouvel_email, expire_le) VALUES (?, ?, ?, ?, ?)')
            ->execute([$compteId, $type, hash('sha256', $lien), $nouvelEmail, $this->horloge->maintenant()->modify(self::DUREES[$type])->format('Y-m-d H:i:s')]);

        return $lien;
    }

    /**
     * @param list<string> $types
     *
     * @return array<string, mixed>
     */
    private function utiliserLien(string $lien, array $types): array
    {
        $requete = $this->pdo->prepare('SELECT * FROM liens WHERE empreinte = ?');
        $requete->execute([hash('sha256', $lien)]);
        $l = $requete->fetch(\PDO::FETCH_ASSOC);
        if ($l === false || !in_array($l['type'], $types, true) || $l['expire_le'] < $this->horloge->texte()) {
            throw new ErreurHttp(410, 'Ce lien n’est plus valable. Refaites une demande.');
        }
        $this->pdo->prepare('DELETE FROM liens WHERE id = ?')->execute([$l['id']]);

        return $l;
    }

    private function verifierMotDePasseActuel(int $compteId, string $motDePasse): void
    {
        $requete = $this->pdo->prepare('SELECT mot_de_passe FROM comptes WHERE id = ?');
        $requete->execute([$compteId]);
        if (!password_verify($motDePasse, (string) $requete->fetchColumn())) {
            throw ErreurHttp::invalide(['actuel' => 'Mot de passe incorrect.']);
        }
    }

    private static function verifierMotDePasse(string $motDePasse, string $champ): void
    {
        if (mb_strlen($motDePasse) < 8 || mb_strlen($motDePasse) > 200) {
            throw ErreurHttp::invalide([$champ => 'Au moins 8 caractères.']);
        }
    }
}
