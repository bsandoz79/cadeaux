<?php

declare(strict_types=1);

namespace Cadeaux\Http;

/** Réponse JSON. */
final class Reponse
{
    public function __construct(
        public readonly int $statut,
        public readonly mixed $donnees = null,
        /** Adresse de redirection (302), pour les allers-retours avec Google. */
        public readonly ?string $redirection = null,
        /** Type d'un contenu qui n'est pas du JSON (agenda iCalendar). */
        public readonly ?string $type = null,
    ) {
    }

    /** Contenu brut (agenda) : `$donnees` est le texte envoyé tel quel. */
    public static function texte(string $contenu, string $type): self
    {
        return new self(200, $contenu, null, $type);
    }

    public static function redirection(string $adresse): self
    {
        return new self(302, null, $adresse);
    }

    public static function ok(mixed $donnees): self
    {
        return new self(200, $donnees);
    }

    public static function cree(mixed $donnees): self
    {
        return new self(201, $donnees);
    }

    public static function vide(): self
    {
        return new self(204);
    }

    public function envoyer(): void
    {
        http_response_code($this->statut);
        if ($this->redirection !== null) {
            header('Location: ' . $this->redirection);
            header('Cache-Control: no-store');
            header('Referrer-Policy: no-referrer');

            return;
        }
        if ($this->type !== null) {
            header('Content-Type: ' . $this->type);
            // Relu par les agendas toutes les quelques heures ; jamais dans un moteur de recherche.
            header('Cache-Control: private, max-age=3600');
            header('X-Robots-Tag: noindex');
            header('X-Content-Type-Options: nosniff');
            echo (string) $this->donnees;

            return;
        }
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        // Une réponse de l'API n'est jamais une page : rien à charger, rien à afficher dans un cadre.
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
        if ($this->statut !== 204) {
            echo json_encode($this->donnees, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        }
    }
}
