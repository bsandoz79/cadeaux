<?php

declare(strict_types=1);

namespace Cadeaux\Http;

/** Réponse JSON. */
final class Reponse
{
    public function __construct(
        public readonly int $statut,
        public readonly mixed $donnees = null,
    ) {
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
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        if ($this->statut !== 204) {
            echo json_encode($this->donnees, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        }
    }
}
