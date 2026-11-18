<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * « Continuer avec Google » (OAuth 2.0 avec code, PKCE et état), sans script de Google sur le site :
 * 1. debut()  : le navigateur part chez Google avec un état aléatoire (10 minutes) ;
 * 2. retour() : Google renvoie un code, échangé contre l'identité ; le compte est retrouvé, relié ou créé ;
 *               le navigateur revient sur le site avec un code à usage unique (2 minutes) ;
 * 3. session(): le site échange ce code contre une connexion, avec la preuve tirée au hasard au départ et gardée
 *               dans l'onglet (sessionStorage) : un lien de retour volé ne connecte personne d'autre.
 */
final class ConnexionGoogle
{
    private const AUTORISATION = 'https://accounts.google.com/o/oauth2/v2/auth';
    private const EMETTEURS = ['https://accounts.google.com', 'accounts.google.com'];
    /** Pages où revenir après la connexion (liste d'envies, cagnotte, invitation, connexion de l'extension) ; sinon l'accueil. */
    private const RETOUR = '#^/((l|c)/[a-f0-9]{16}|rejoindre/[a-f0-9]{64}|extension)$#';
    /** Départs vers Google par adresse IP et par quart d'heure. */
    private const DEPARTS_MAX = 20;

    private readonly Limiteur $limiteur;

    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge,
        private readonly Google $google,
        private readonly Comptes $comptes,
        private readonly string $site,
    ) {
        $this->limiteur = new Limiteur($pdo, $horloge);
    }

    private function redirection(): string
    {
        return $this->site . '/api/google/retour';
    }

    /** Adresse de Google où envoyer le navigateur. `$preuve` : 64 caractères hexadécimaux tirés par le site. */
    /** `$compteId` : compte connecté qui relie son compte Google (depuis « Mon compte »), sinon null. */
    public function debut(string $preuve, string $retour, string $ip, ?int $compteId = null): string
    {
        if (preg_match('/^[a-f0-9]{64}$/', $preuve) !== 1) {
            throw new ErreurHttp(400, 'Demande de connexion invalide.');
        }
        if ($this->limiteur->depasse('google:' . $ip, self::DEPARTS_MAX)) {
            throw new ErreurHttp(429, 'Trop d’essais. Réessayez dans un quart d’heure.');
        }
        $this->limiteur->noter('google:' . $ip);
        $etat = bin2hex(random_bytes(32));
        $verificateur = bin2hex(random_bytes(32));
        $this->pdo->prepare('INSERT INTO google_etats (empreinte, preuve, verificateur, retour, compte_id, expire_le) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([
                hash('sha256', $etat),
                hash('sha256', $preuve),
                $verificateur,
                preg_match(self::RETOUR, $retour) === 1 ? $retour : null,
                $compteId,
                $this->horloge->maintenant()->modify('+10 minutes')->format('Y-m-d H:i:s'),
            ]);

        return self::AUTORISATION . '?' . http_build_query([
            'client_id' => $this->google->identifiantClient(),
            'redirect_uri' => $this->redirection(),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $etat,
            'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $verificateur, true)), '+/', '-_'), '='),
            'code_challenge_method' => 'S256',
            'prompt' => 'select_account',
        ]);
    }

    /**
     * Retour de Google : adresse du site où renvoyer le navigateur (avec un code à usage unique, ou un motif d'échec).
     *
     * @param array<string, mixed> $parametres paramètres de l'adresse (code, state, error)
     */
    public function retour(array $parametres): string
    {
        $etat = (string) ($parametres['state'] ?? '');
        $ligne = $this->pdo->prepare('SELECT * FROM google_etats WHERE empreinte = ?');
        $ligne->execute([hash('sha256', $etat)]);
        $depart = $ligne->fetch(\PDO::FETCH_ASSOC);
        if ($depart === false || $depart['expire_le'] < $this->horloge->texte()) {
            return $this->site . '/?google=expire';
        }
        $this->pdo->prepare('DELETE FROM google_etats WHERE id = ?')->execute([$depart['id']]);
        if (isset($parametres['error']) || !isset($parametres['code'])) {
            return $this->site . '/?google=annule';
        }

        if ($depart['compte_id'] !== null) {
            return $this->retourPourRelier((int) $depart['compte_id'], (string) $parametres['code'], $depart);
        }

        try {
            $identite = $this->verifier($this->google->echanger((string) $parametres['code'], (string) $depart['verificateur'], $this->redirection()));
            [$compteId, $nouveau] = $this->compte($identite);
        } catch (ErreurHttp $e) {
            return $this->site . '/?google=' . ($e->statut === 403 ? 'bloque' : 'erreur');
        }

        $code = bin2hex(random_bytes(32));
        $this->pdo->prepare('INSERT INTO liens (compte_id, type, empreinte, donnee, expire_le) VALUES (?, ?, ?, ?, ?)')
            ->execute([
                $compteId,
                'google',
                hash('sha256', $code),
                json_encode(['preuve' => $depart['preuve'], 'retour' => $depart['retour'], 'nouveau' => $nouveau]),
                $this->horloge->maintenant()->modify('+2 minutes')->format('Y-m-d H:i:s'),
            ]);

        return $this->site . '/connexion/google?code=' . $code;
    }

    /**
     * Retour de Google pour relier un compte existant : rien n'est créé ni connecté ici. Le site finit avec
     * `relier()`, depuis l'onglet où « Relier » a été cliqué (même preuve, même compte connecté).
     *
     * @param array<string, mixed> $depart
     */
    private function retourPourRelier(int $compteId, string $code, array $depart): string
    {
        try {
            $identite = $this->verifier($this->google->echanger($code, (string) $depart['verificateur'], $this->redirection()));
        } catch (ErreurHttp) {
            return $this->site . '/compte?google=erreur';
        }
        if ($this->compteDeGoogle($identite['sub'], $compteId) !== null) {
            return $this->site . '/compte?google=deja';
        }
        $lien = bin2hex(random_bytes(32));
        $this->pdo->prepare('INSERT INTO liens (compte_id, type, empreinte, donnee, expire_le) VALUES (?, ?, ?, ?, ?)')
            ->execute([
                $compteId,
                'googlelier',
                hash('sha256', $lien),
                json_encode(['preuve' => $depart['preuve'], 'sub' => $identite['sub']]),
                $this->horloge->maintenant()->modify('+2 minutes')->format('Y-m-d H:i:s'),
            ]);

        return $this->site . '/connexion/google?code=' . $lien . '&relier=1';
    }

    /** Fin de « Relier mon compte Google » : même compte connecté, même onglet, identifiant Google encore libre. */
    public function relier(int $compteId, string $code, string $preuve): void
    {
        $requete = $this->pdo->prepare("SELECT * FROM liens WHERE empreinte = ? AND type = 'googlelier'");
        $requete->execute([hash('sha256', $code)]);
        $lien = $requete->fetch(\PDO::FETCH_ASSOC);
        if ($lien === false || $lien['expire_le'] < $this->horloge->texte() || (int) $lien['compte_id'] !== $compteId) {
            throw new ErreurHttp(410, 'Cette demande a expiré. Recommencez depuis « Mon compte ».');
        }
        $this->pdo->prepare('DELETE FROM liens WHERE id = ?')->execute([$lien['id']]);
        /** @var array{preuve: string, sub: string} $donnee */
        $donnee = json_decode((string) $lien['donnee'], true);
        if (!hash_equals($donnee['preuve'], hash('sha256', $preuve))) {
            throw new ErreurHttp(403, 'Cette demande a été commencée dans un autre navigateur. Recommencez ici.');
        }
        if ($this->compteDeGoogle($donnee['sub'], $compteId) !== null) {
            throw new ErreurHttp(409, 'Ce compte Google est déjà relié à un autre compte Cadeaux.');
        }
        $this->pdo->prepare('UPDATE comptes SET google_sub = ? WHERE id = ?')->execute([$donnee['sub'], $compteId]);
    }

    /** Délier Google : seulement si un mot de passe permet encore de se connecter. */
    public function delier(int $compteId): void
    {
        $requete = $this->pdo->prepare('SELECT mot_de_passe_defini FROM comptes WHERE id = ?');
        $requete->execute([$compteId]);
        if (!(bool) $requete->fetchColumn()) {
            throw new ErreurHttp(409, 'Choisissez d’abord un mot de passe : sans Google, c’est lui qui vous permettra de vous connecter.');
        }
        $this->pdo->prepare('UPDATE comptes SET google_sub = NULL WHERE id = ?')->execute([$compteId]);
    }

    /** Autre compte déjà relié à cet identifiant Google, ou null. */
    private function compteDeGoogle(string $sub, int $saufCompte): ?int
    {
        $requete = $this->pdo->prepare('SELECT id FROM comptes WHERE google_sub = ? AND id <> ?');
        $requete->execute([$sub, $saufCompte]);
        $id = $requete->fetchColumn();

        return $id === false ? null : (int) $id;
    }

    /**
     * Dernière étape : le code à usage unique et la preuve gardée dans l'onglet donnent la connexion.
     *
     * @return array{jeton: string, compte: array<string, mixed>, retour: string|null, nouveau: bool}
     */
    public function session(string $code, string $preuve): array
    {
        $requete = $this->pdo->prepare("SELECT * FROM liens WHERE empreinte = ? AND type = 'google'");
        $requete->execute([hash('sha256', $code)]);
        $lien = $requete->fetch(\PDO::FETCH_ASSOC);
        if ($lien === false || $lien['expire_le'] < $this->horloge->texte()) {
            throw new ErreurHttp(410, 'Cette connexion a expiré. Recommencez avec « Continuer avec Google ».');
        }
        $this->pdo->prepare('DELETE FROM liens WHERE id = ?')->execute([$lien['id']]);
        /** @var array{preuve: string, retour: string|null, nouveau: bool} $donnee */
        $donnee = json_decode((string) $lien['donnee'], true);
        if (!hash_equals($donnee['preuve'], hash('sha256', $preuve))) {
            throw new ErreurHttp(403, 'Cette connexion a été commencée dans un autre navigateur. Recommencez ici.');
        }

        return $this->comptes->ouvrirSession((int) $lien['compte_id']) + ['retour' => $donnee['retour'], 'nouveau' => $donnee['nouveau']];
    }

    /**
     * Contrôle de l'identité donnée par Google : destinée à ce site, émise par Google, pas expirée, adresse vérifiée.
     *
     * @param array<string, mixed> $contenu
     *
     * @return array{sub: string, email: string, prenom: string}
     */
    private function verifier(array $contenu): array
    {
        $email = mb_strtolower(trim((string) ($contenu['email'] ?? '')));
        $valide = ($contenu['aud'] ?? null) === $this->google->identifiantClient()
            && in_array($contenu['iss'] ?? null, self::EMETTEURS, true)
            && (int) ($contenu['exp'] ?? 0) > $this->horloge->maintenant()->getTimestamp()
            && preg_match('/^[0-9]{1,64}$/', (string) ($contenu['sub'] ?? '')) === 1
            && ($contenu['email_verified'] ?? false) === true
            && filter_var($email, FILTER_VALIDATE_EMAIL) !== false
            && mb_strlen($email) <= 190;
        if (!$valide) {
            throw new ErreurHttp(401, 'Identité Google refusée.');
        }
        $prenom = trim((string) ($contenu['given_name'] ?? $contenu['name'] ?? ''));

        return ['sub' => (string) $contenu['sub'], 'email' => $email, 'prenom' => mb_substr($prenom !== '' ? $prenom : strstr($email, '@', true), 0, 80)];
    }

    /**
     * Compte de cette personne : déjà relié à Google, sinon celui de la même adresse (vérifiée par Google), sinon créé.
     *
     * @param array{sub: string, email: string, prenom: string} $identite
     *
     * @return array{int, bool} identifiant du compte, et vrai s'il vient d'être créé
     */
    private function compte(array $identite): array
    {
        $parGoogle = $this->pdo->prepare('SELECT id, bloque FROM comptes WHERE google_sub = ?');
        $parGoogle->execute([$identite['sub']]);
        $ligne = $parGoogle->fetch(\PDO::FETCH_ASSOC);
        if ($ligne === false) {
            $parEmail = $this->pdo->prepare('SELECT id, bloque FROM comptes WHERE email = ?');
            $parEmail->execute([$identite['email']]);
            $ligne = $parEmail->fetch(\PDO::FETCH_ASSOC);
            if ($ligne !== false && !(bool) $ligne['bloque']) {
                // Même adresse, vérifiée par Google : le compte existant est relié (et son adresse confirmée).
                $this->pdo->prepare('UPDATE comptes SET google_sub = ?, email_confirme = 1 WHERE id = ?')->execute([$identite['sub'], $ligne['id']]);
            }
        }
        if ($ligne !== false) {
            if ((bool) $ligne['bloque']) {
                throw new ErreurHttp(403, 'Compte bloqué par sécurité.');
            }

            return [(int) $ligne['id'], false];
        }

        // Nouveau compte : pas de mot de passe connu (« Mot de passe oublié ? » permet d'en choisir un), adresse confirmée.
        $this->pdo->prepare('INSERT INTO comptes (email, nom, mot_de_passe, cree_le, rappels, email_confirme, google_sub, mot_de_passe_defini) VALUES (?, ?, ?, ?, 0, 1, ?, 0)')
            ->execute([$identite['email'], $identite['prenom'], password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT), $this->horloge->texte(), $identite['sub']]);

        return [(int) $this->pdo->lastInsertId(), true];
    }
}
