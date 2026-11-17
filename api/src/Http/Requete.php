<?php

declare(strict_types=1);

namespace Cadeaux\Http;

/** Requête HTTP reçue : méthode, chemin (sans /api), corps JSON et en-têtes utiles. */
final class Requete
{
    /**
     * @param array<string, mixed>  $corps
     * @param array<string, string> $entetes en-têtes, noms en minuscules
     */
    public function __construct(
        public readonly string $methode,
        public readonly string $chemin,
        public readonly array $corps = [],
        public readonly array $entetes = [],
        public readonly string $ip = '',
    ) {
    }

    public static function depuisGlobales(): self
    {
        $chemin = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $chemin = preg_replace('#^/api(?=/|$)#', '', $chemin) ?: '/';

        $entetes = [];
        foreach ($_SERVER as $cle => $valeur) {
            if (str_starts_with($cle, 'HTTP_')) {
                $entetes[strtolower(str_replace('_', '-', substr($cle, 5)))] = (string) $valeur;
            }
        }
        // Apache en CGI retire souvent l'en-tête Authorization : le .htaccess le recopie ici.
        if (!isset($entetes['authorization']) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $entetes['authorization'] = (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }

        $brut = file_get_contents('php://input') ?: '';
        $corps = $brut === '' ? [] : json_decode($brut, true);

        return new self(
            strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            rtrim($chemin, '/') ?: '/',
            is_array($corps) ? $corps : [],
            $entetes,
            (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
        );
    }

    public function entete(string $nom): ?string
    {
        return $this->entetes[strtolower($nom)] ?? null;
    }

    /** Jeton de connexion : « Authorization: Bearer … ». */
    public function jeton(): ?string
    {
        $valeur = $this->entete('authorization') ?? '';

        return preg_match('/^Bearer\s+([a-f0-9]{64})$/i', trim($valeur), $m) === 1 ? strtolower($m[1]) : null;
    }
}
