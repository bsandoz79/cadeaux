<?php

declare(strict_types=1);

namespace Cadeaux\Http;

/** Erreur renvoyée telle quelle au navigateur : statut HTTP et message en français. */
final class ErreurHttp extends \RuntimeException
{
    /** @param array<string, string> $champs erreur par champ, pour les formulaires */
    public function __construct(
        public readonly int $statut,
        string $message,
        public readonly array $champs = [],
    ) {
        parent::__construct($message);
    }

    public static function introuvable(): self
    {
        return new self(404, 'Introuvable.');
    }

    public static function nonConnecte(): self
    {
        return new self(401, 'Connectez-vous pour continuer.');
    }

    /** @param array<string, string> $champs */
    public static function invalide(array $champs): self
    {
        return new self(422, 'Certains champs sont à corriger.', $champs);
    }
}
