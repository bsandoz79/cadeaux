<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

use Cadeaux\Horloge;

/** Horloge fixe, réglable dans les tests. */
final class HorlogeFixe extends Horloge
{
    public string $instant = '2026-11-17 10:00:00';

    public function maintenant(): \DateTimeImmutable
    {
        return new \DateTimeImmutable($this->instant, new \DateTimeZone('UTC'));
    }
}
