<?php

declare(strict_types=1);

namespace Cadeaux;

/** Échange avec Google (connexion « Continuer avec Google ») : remplacé par un faux dans les tests. */
interface Google
{
    public function identifiantClient(): string;

    /**
     * Échange le code reçu au retour de Google contre l'identité de la personne.
     *
     * @return array<string, mixed> contenu du jeton d'identité (sub, email, email_verified, given_name, aud, iss, exp…)
     */
    public function echanger(string $code, string $verificateur, string $redirection): array;
}
