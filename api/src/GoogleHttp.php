<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * Appel du point d'échange de Google (OAuth 2.0, code + PKCE), en HTTPS avec vérification du certificat.
 * Le jeton d'identité arrive directement de Google par cette connexion chiffrée : ses informations sont lues sans
 * vérifier sa signature (permis par OpenID Connect dans ce cas), puis contrôlées par ConnexionGoogle.
 */
final class GoogleHttp implements Google
{
    private const ECHANGE = 'https://oauth2.googleapis.com/token';

    public function __construct(private readonly string $id, private readonly string $secret)
    {
    }

    public function identifiantClient(): string
    {
        return $this->id;
    }

    public function echanger(string $code, string $verificateur, string $redirection): array
    {
        $contexte = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\nAccept: application/json\r\n",
            'content' => http_build_query([
                'code' => $code,
                'client_id' => $this->id,
                'client_secret' => $this->secret,
                'redirect_uri' => $redirection,
                'grant_type' => 'authorization_code',
                'code_verifier' => $verificateur,
            ]),
            'timeout' => 10,
            'ignore_errors' => true,
        ]]);
        $reponse = @file_get_contents(self::ECHANGE, false, $contexte);
        $donnees = is_string($reponse) ? json_decode($reponse, true) : null;
        $jeton = is_array($donnees) ? ($donnees['id_token'] ?? null) : null;
        if (!is_string($jeton) || substr_count($jeton, '.') !== 2) {
            error_log('Cadeaux, connexion Google : échange refusé (' . (is_array($donnees) ? (string) ($donnees['error'] ?? '?') : 'pas de réponse') . ').');
            throw new ErreurHttp(502, 'Google n’a pas confirmé la connexion. Réessayez.');
        }
        $contenu = json_decode((string) base64_decode(strtr(explode('.', $jeton)[1], '-_', '+/'), true), true);
        if (!is_array($contenu)) {
            throw new ErreurHttp(502, 'Réponse de Google illisible. Réessayez.');
        }

        return $contenu;
    }
}
