<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * Tout ce qui passe par un lien envoyé par e-mail :
 * - confirmation de l'adresse à l'inscription (lien valable 7 jours) ;
 * - mot de passe oublié (lien valable 1 heure ; toutes les connexions sont fermées après le changement) ;
 * - changement d'adresse : lien envoyé à la nouvelle adresse, et changement fait seulement 48 heures après la demande ;
 *   l'ancienne adresse reçoit un lien « Ce n'est pas moi » ;
 * - « Ce n'est pas moi » (changement d'adresse, de mot de passe, nouvel appareil, RIB ajouté) : toutes les connexions
 *   fermées, compte bloqué jusqu'à un nouveau mot de passe, RIB des cagnottes effacés, changement d'adresse annulé.
 * Un compte qui vient de changer de mot de passe ou d'adresse ne peut pas ajouter de RIB pendant 48 heures.
 * Comme les jetons de connexion, seul le hachage SHA-256 du lien est gardé ; un lien ne sert qu'une fois.
 * « Mot de passe oublié » répond toujours la même chose, que le compte existe ou non.
 */
final class Identite
{
    private const DUREES = ['confirmation' => '+7 days', 'motdepasse' => '+1 hour', 'email' => '+7 days', 'alerte' => '+7 days'];
    public const DELAI_SECURITE_HEURES = 48;

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
        $this->pdo->prepare('UPDATE comptes SET mot_de_passe = ?, email_confirme = 1, bloque = 0, securite_le = ? WHERE id = ?')
            ->execute([password_hash($motDePasse, PASSWORD_DEFAULT), $this->horloge->texte(), $id]);
        $this->pdo->prepare('DELETE FROM jetons WHERE compte_id = ?')->execute([$id]);

        return $this->comptes->ouvrirSession($id);
    }

    /** @return array{type: string, email: string, le?: ?string} */
    public function confirmer(string $lien): array
    {
        $l = $this->utiliserLien($lien, ['confirmation', 'email']);
        $id = (int) $l['compte_id'];
        if ($l['type'] === 'email') {
            $maj = $this->pdo->prepare('UPDATE changements_email SET confirme = 1 WHERE compte_id = ? AND nouvel_email = ?');
            $maj->execute([$id, $l['nouvel_email']]);
            if ($maj->rowCount() === 0) {
                throw new ErreurHttp(410, 'Ce changement d’adresse a été annulé.');
            }
            $this->appliquerChangementsEchus($id);
            $c = $this->pdo->prepare('SELECT demande_le FROM changements_email WHERE compte_id = ?');
            $c->execute([$id]);
            $demande = $c->fetchColumn();

            return [
                'type' => 'email',
                'email' => (string) $l['nouvel_email'],
                // Date à laquelle l'adresse changera (null : c'est déjà fait).
                'le' => $demande === false ? null : (new \DateTimeImmutable((string) $demande))->modify(sprintf('+%d hours', self::DELAI_SECURITE_HEURES))->format('Y-m-d H:i:s'),
            ];
        }
        $this->pdo->prepare('UPDATE comptes SET email_confirme = 1 WHERE id = ?')->execute([$id]);

        return ['type' => (string) $l['type'], 'email' => (string) $this->comptes->compte($id)['email']];
    }

    /** Changer de mot de passe depuis « Mon compte » : les autres appareils sont déconnectés. */
    public function changerMotDePasse(int $compteId, string $actuel, string $nouveau, ?string $jetonCourant): void
    {
        $this->verifierMotDePasseActuel($compteId, $actuel);
        self::verifierMotDePasse($nouveau, 'nouveau');
        $this->pdo->prepare('UPDATE comptes SET mot_de_passe = ?, securite_le = ? WHERE id = ?')->execute([password_hash($nouveau, PASSWORD_DEFAULT), $this->horloge->texte(), $compteId]);
        $this->pdo->prepare('DELETE FROM jetons WHERE compte_id = ? AND empreinte <> ?')->execute([$compteId, hash('sha256', (string) $jetonCourant)]);
        $compte = $this->comptes->compte($compteId);
        $this->courrier->envoyer((string) $compte['email'], 'Votre mot de passe a été changé', <<<TXT
            Bonjour {$compte['nom']},

            Le mot de passe de votre compte Cadeaux vient d'être changé.

            Ce n'est pas vous ? Bloquez votre compte tout de suite :
            {$this->site}/securite/{$this->creerLien($compteId, 'alerte')}

            Cadeaux
            TXT);
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
        $this->pdo->prepare('DELETE FROM changements_email WHERE compte_id = ?')->execute([$compteId]);
        $this->pdo->prepare('INSERT INTO changements_email (compte_id, nouvel_email, demande_le) VALUES (?, ?, ?)')
            ->execute([$compteId, $nouvelle, $this->horloge->texte()]);
        $lien = $this->creerLien($compteId, 'email', $nouvelle);
        $h = self::DELAI_SECURITE_HEURES;
        $this->courrier->envoyer($nouvelle, 'Confirmez votre nouvelle adresse e-mail', <<<TXT
            Bonjour {$compte['nom']},

            Pour utiliser cette adresse sur Cadeaux, ouvrez ce lien :
            {$this->site}/confirmer/{$lien}

            Par sécurité, le changement se fera {$h} heures après la demande.
            Vous n'avez rien demandé ? Ignorez ce message.

            Cadeaux
            TXT);
        $this->courrier->envoyer((string) $compte['email'], 'Changement de votre adresse e-mail', <<<TXT
            Bonjour {$compte['nom']},

            Une demande a été faite pour remplacer votre adresse sur Cadeaux par {$nouvelle}.
            Si c'est bien vous, il n'y a rien à faire : le changement se fera dans {$h} heures.

            Ce n'est pas vous ? Bloquez votre compte et annulez le changement :
            {$this->site}/securite/{$this->creerLien($compteId, 'alerte')}

            Cadeaux
            TXT);
    }

    /**
     * Changements d'adresse confirmés depuis plus de 48 heures : appliqués (appelé à la confirmation, à chaque visite et
     * par la tâche quotidienne). Sans compte, tous ceux qui sont dus.
     */
    public function appliquerChangementsEchus(?int $compteId = null): int
    {
        $limite = $this->horloge->maintenant()->modify(sprintf('-%d hours', self::DELAI_SECURITE_HEURES))->format('Y-m-d H:i:s');
        $requete = $this->pdo->prepare('SELECT compte_id, nouvel_email FROM changements_email WHERE confirme = 1 AND demande_le <= ?' . ($compteId === null ? '' : ' AND compte_id = ?'));
        $requete->execute($compteId === null ? [$limite] : [$limite, $compteId]);
        $faits = 0;
        foreach ($requete->fetchAll(\PDO::FETCH_ASSOC) as $c) {
            $id = (int) $c['compte_id'];
            $this->pdo->prepare('DELETE FROM changements_email WHERE compte_id = ?')->execute([$id]);
            $pris = $this->pdo->prepare('SELECT 1 FROM comptes WHERE email = ? AND id <> ?');
            $pris->execute([$c['nouvel_email'], $id]);
            if ($pris->fetchColumn() !== false) {
                continue; // adresse prise entre-temps : le changement est abandonné
            }
            $this->pdo->prepare('UPDATE comptes SET email = ?, email_confirme = 1, securite_le = ? WHERE id = ?')->execute([$c['nouvel_email'], $this->horloge->texte(), $id]);
            ++$faits;
        }

        return $faits;
    }

    /**
     * « Ce n'est pas moi » : tout est verrouillé, et un lien pour un nouveau mot de passe part à l'adresse du compte
     * (qui reste la vraie : un changement d'adresse en cours est annulé).
     */
    public function bloquer(string $lien): void
    {
        $l = $this->utiliserLien($lien, ['alerte']);
        $id = (int) $l['compte_id'];
        $this->pdo->prepare('DELETE FROM changements_email WHERE compte_id = ?')->execute([$id]);
        $this->pdo->prepare("DELETE FROM liens WHERE compte_id = ? AND type IN ('email', 'alerte')")->execute([$id]);
        $this->pdo->prepare('DELETE FROM jetons WHERE compte_id = ?')->execute([$id]);
        $this->pdo->prepare('DELETE FROM appareils WHERE compte_id = ?')->execute([$id]);
        $this->pdo->prepare('UPDATE comptes SET bloque = 1 WHERE id = ?')->execute([$id]);
        $this->pdo->prepare('UPDATE cagnottes SET rib_titulaire = NULL, rib_iban = NULL, rib_masque = NULL, rib_le = NULL WHERE compte_id = ?')->execute([$id]);
        $compte = $this->comptes->compte($id);
        $this->courrier->envoyer((string) $compte['email'], 'Compte bloqué : choisissez un nouveau mot de passe', <<<TXT
            Bonjour {$compte['nom']},

            Votre compte Cadeaux est bloqué : toutes les connexions sont fermées, les RIB de vos cagnottes sont effacés
            et le changement d'adresse en cours est annulé.

            Pour le débloquer, choisissez un nouveau mot de passe (lien valable 1 heure) :
            {$this->site}/motdepasse/{$this->creerLien($id, 'motdepasse')}

            Passé ce délai, utilisez « Mot de passe oublié ? » sur le site.

            Cadeaux
            TXT);
    }

    /**
     * Connexion réussie : un appareil inconnu (identifiant envoyé par le navigateur, gardé haché) déclenche un e-mail.
     */
    public function nouvelleConnexion(int $compteId, ?string $appareil, string $navigateur, bool $prevenir = true): void
    {
        $empreinte = hash('sha256', $appareil !== null && preg_match('/^[a-zA-Z0-9-]{16,64}$/', $appareil) === 1 ? $appareil : bin2hex(random_bytes(16)));
        $connu = $this->pdo->prepare('SELECT 1 FROM appareils WHERE compte_id = ? AND empreinte = ?');
        $connu->execute([$compteId, $empreinte]);
        if ($connu->fetchColumn() !== false) {
            $this->pdo->prepare('UPDATE appareils SET vu_le = ? WHERE compte_id = ? AND empreinte = ?')->execute([$this->horloge->texte(), $compteId, $empreinte]);

            return;
        }
        $this->pdo->prepare('INSERT INTO appareils (compte_id, empreinte, vu_le) VALUES (?, ?, ?)')->execute([$compteId, $empreinte, $this->horloge->texte()]);
        if (!$prevenir) {
            return;
        }
        $compte = $this->comptes->compte($compteId);
        $quand = Rappels::dateLisible($this->horloge->maintenant()) . ' à ' . $this->horloge->maintenant()->format('H:i') . ' (heure UTC)';
        $sur = self::navigateurLisible($navigateur);
        $this->courrier->envoyer((string) $compte['email'], 'Nouvelle connexion à votre compte', <<<TXT
            Bonjour {$compte['nom']},

            Une connexion à votre compte Cadeaux vient d'avoir lieu depuis un nouvel appareil :
            {$sur}, le {$quand}.

            C'est vous ? Il n'y a rien à faire.
            Ce n'est pas vous ? Bloquez votre compte tout de suite :
            {$this->site}/securite/{$this->creerLien($compteId, 'alerte')}

            Cadeaux
            TXT);
    }

    /** Ajouter un RIB : mot de passe redemandé, et jamais dans les 48 heures qui suivent un changement sensible. */
    public function autoriserRib(int $compteId, string $motDePasse): void
    {
        $requete = $this->pdo->prepare('SELECT mot_de_passe, securite_le FROM comptes WHERE id = ?');
        $requete->execute([$compteId]);
        $c = $requete->fetch(\PDO::FETCH_ASSOC);
        if ($c === false || !password_verify($motDePasse, (string) $c['mot_de_passe'])) {
            throw ErreurHttp::invalide(['motDePasse' => 'Mot de passe incorrect.']);
        }
        $limite = $this->horloge->maintenant()->modify(sprintf('-%d hours', self::DELAI_SECURITE_HEURES))->format('Y-m-d H:i:s');
        if ($c['securite_le'] !== null && $c['securite_le'] > $limite) {
            throw new ErreurHttp(423, sprintf('Par sécurité, un RIB ne peut pas être ajouté dans les %d heures qui suivent un changement de mot de passe ou d’adresse.', self::DELAI_SECURITE_HEURES));
        }
    }

    /** E-mail après l'ajout d'un RIB, avec « Ce n'est pas moi ». */
    public function alerterRib(int $compteId, string $cagnotte, string $ibanMasque): void
    {
        $compte = $this->comptes->compte($compteId);
        $this->courrier->envoyer((string) $compte['email'], 'Un RIB a été ajouté à votre cagnotte', <<<TXT
            Bonjour {$compte['nom']},

            Un RIB ({$ibanMasque}) vient d'être ajouté à votre cagnotte « {$cagnotte} ».
            Les participants le voient en cliquant sur « Payer par virement ».

            Ce n'est pas vous ? Bloquez votre compte tout de suite (le RIB sera effacé) :
            {$this->site}/securite/{$this->creerLien($compteId, 'alerte')}

            Cadeaux
            TXT);
    }

    /** « Chrome sur Windows », « Safari sur iPhone »… (rien n'est gardé : seulement écrit dans l'e-mail). */
    public static function navigateurLisible(string $ua): string
    {
        $navigateur = match (true) {
            str_contains($ua, 'Edg/') => 'Edge',
            str_contains($ua, 'OPR/') => 'Opera',
            str_contains($ua, 'Firefox/') => 'Firefox',
            str_contains($ua, 'Chrome/') => 'Chrome',
            str_contains($ua, 'Safari/') => 'Safari',
            default => 'un navigateur',
        };
        $systeme = match (true) {
            str_contains($ua, 'iPhone') => 'iPhone',
            str_contains($ua, 'iPad') => 'iPad',
            str_contains($ua, 'Android') => 'Android',
            str_contains($ua, 'Windows') => 'Windows',
            str_contains($ua, 'Mac OS X') => 'Mac',
            str_contains($ua, 'Linux') => 'Linux',
            default => 'un appareil inconnu',
        };

        return "$navigateur sur $systeme";
    }

    private function creerLien(int $compteId, string $type, ?string $nouvelEmail = null): string
    {
        // Un seul lien valable à la fois par type (sauf « Ce n'est pas moi » : chaque alerte garde le sien).
        if ($type !== 'alerte') {
            $this->pdo->prepare('DELETE FROM liens WHERE compte_id = ? AND type = ?')->execute([$compteId, $type]);
        }
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
