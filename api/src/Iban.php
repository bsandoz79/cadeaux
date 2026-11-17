<?php

declare(strict_types=1);

namespace Cadeaux;

/** IBAN : nettoyage, contrôle (clé modulo 97, norme ISO 13616), présentation par groupes de 4, version masquée. */
final class Iban
{
    public static function normaliser(string $saisie): string
    {
        return strtoupper((string) preg_replace('/[\s\-.]/', '', $saisie));
    }

    public static function valide(string $iban): bool
    {
        if (preg_match('/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/', $iban) !== 1) {
            return false;
        }
        // Les 4 premiers caractères passent à la fin, chaque lettre devient un nombre (A = 10 … Z = 35).
        $chiffres = '';
        foreach (str_split(substr($iban, 4) . substr($iban, 0, 4)) as $c) {
            $chiffres .= ctype_alpha($c) ? (string) (ord($c) - 55) : $c;
        }
        $reste = 0;
        foreach (str_split($chiffres, 7) as $morceau) {
            $reste = (int) ($reste . $morceau) % 97;
        }

        return $reste === 1;
    }

    /** « FR76 3000 6000 0112 3456 7890 189 ». */
    public static function formater(string $iban): string
    {
        return trim(chunk_split($iban, 4, ' '));
    }

    /** « FR76 •••• •••• •••• •••• •••0 189 » : le pays et les derniers chiffres seulement. */
    public static function masquer(string $iban): string
    {
        $visible = substr($iban, 0, 4) . str_repeat('•', max(0, strlen($iban) - 8)) . substr($iban, -4);

        return trim(implode(' ', mb_str_split($visible, 4)));
    }
}
