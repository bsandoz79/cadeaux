<?php

declare(strict_types=1);

namespace Cadeaux;

/** Heure courante en UTC, remplaçable dans les tests. */
class Horloge
{
    public function maintenant(): \DateTimeImmutable
    {
        return new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    public function texte(): string
    {
        return $this->maintenant()->format('Y-m-d H:i:s');
    }
}
