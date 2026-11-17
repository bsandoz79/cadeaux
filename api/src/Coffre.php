<?php

declare(strict_types=1);

namespace Cadeaux;

/**
 * Chiffrement des données sensibles gardées en base (RIB des organisateurs) : libsodium, secretbox (XSalsa20-Poly1305).
 * La clé est un fichier hors de la base (api/var/cle-coffre, créé au premier usage, inaccessible par le web) :
 * une copie de la base seule ne permet pas de lire les RIB.
 */
final class Coffre
{
    public function __construct(private readonly string $fichierCle)
    {
    }

    public function chiffrer(string $clair): string
    {
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);

        return base64_encode($nonce . sodium_crypto_secretbox($clair, $nonce, $this->cle()));
    }

    public function dechiffrer(string $chiffre): ?string
    {
        $brut = base64_decode($chiffre, true);
        if ($brut === false || strlen($brut) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
            return null;
        }
        $clair = sodium_crypto_secretbox_open(
            substr($brut, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES),
            substr($brut, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES),
            $this->cle(),
        );

        return $clair === false ? null : $clair;
    }

    private function cle(): string
    {
        if (!is_file($this->fichierCle)) {
            @mkdir(dirname($this->fichierCle), 0o750, true);
            $cle = sodium_crypto_secretbox_keygen();
            // « x » : si deux requêtes créent la clé en même temps, la seconde garde celle de la première.
            $f = @fopen($this->fichierCle, 'x');
            if ($f !== false) {
                fwrite($f, $cle);
                fclose($f);
                @chmod($this->fichierCle, 0o600);
            }
        }
        $cle = (string) file_get_contents($this->fichierCle);
        if (strlen($cle) !== SODIUM_CRYPTO_SECRETBOX_KEYBYTES) {
            throw new \RuntimeException('Clé du coffre invalide.');
        }

        return $cle;
    }
}
