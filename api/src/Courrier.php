<?php

declare(strict_types=1);

namespace Cadeaux;

/** Envoi d'un e-mail en texte simple. Renvoie false si l'envoi a échoué. */
interface Courrier
{
    public function envoyer(string $destinataire, string $sujet, string $texte): bool;
}
