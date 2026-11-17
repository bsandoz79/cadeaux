<?php

declare(strict_types=1);

namespace Cadeaux;

/** E-mail envoyé par la fonction mail() de PHP (serveur d'envoi de l'hébergeur). */
final class CourrierPhp implements Courrier
{
    public function __construct(private readonly string $expediteur)
    {
    }

    public function envoyer(string $destinataire, string $sujet, string $texte): bool
    {
        // Pas de retour à la ligne dans les en-têtes : aucune injection d'en-tête possible.
        if (preg_match('/[\r\n]/', $destinataire . $this->expediteur) === 1) {
            return false;
        }

        // « @ » : un serveur d'envoi injoignable ne doit pas glisser d'avertissement dans la réponse JSON ;
        // l'échec est signalé par la valeur renvoyée (false).
        // Expéditeur technique (enveloppe) = l'adresse affichée : SPF et DMARC vérifient le même domaine
        // (sinon l'hébergeur met son adresse technique, et Gmail peut refuser ou classer en indésirable).
        $enveloppe = preg_match('/<([^<>@\s]+@[^<>\s]+)>|^([^<>@\s]+@[^<>\s]+)$/', $this->expediteur, $m) === 1 ? ($m[1] ?: $m[2]) : null;

        return @mail(
            $destinataire,
            mb_encode_mimeheader($sujet, 'UTF-8'),
            $texte,
            [
                'From' => $this->expediteur,
                'Reply-To' => $enveloppe ?? $this->expediteur,
                'Date' => date(DATE_RFC2822),
                'MIME-Version' => '1.0',
                'Content-Type' => 'text/plain; charset=UTF-8',
                'Content-Transfer-Encoding' => '8bit',
            ],
            $enveloppe !== null ? '-f' . $enveloppe : '',
        );
    }
}
