<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

use Cadeaux\Apercu;

final class ApercuTest extends ApiTestCase
{
    private const MODELE = '<!doctype html><html><head><meta charset="UTF-8" /><meta name="description" content="Ancien" /><title>Cadeaux</title></head><body><div id="root"></div></body></html>';

    public function testDonneesEtBalisesDeLApercu(): void
    {
        $jeton = $this->inscrire();
        $g = $this->appel('POST', '/cagnottes', ['titre' => 'Montre "acier" <sport>', 'beneficiaire' => 'Julie', 'objectif' => 15000], $jeton)->donnees;
        $this->appel('POST', '/c/' . $g['code'] . '/participations', ['nom' => 'Tom', 'montant' => 10000]);

        $d = (new Apercu($this->pdo))->donnees($g['code']);
        self::assertSame([15000, 10000, false], [$d['objectif'], $d['total'], $d['close']]);
        self::assertNull((new Apercu($this->pdo))->donnees('0000000000000000'));

        $html = Apercu::html(self::MODELE, $d, 'https://cadeaux.bsandoz.fr');
        self::assertStringContainsString('<meta property="og:title" content="Cagnotte pour Julie : Montre &quot;acier&quot; &lt;sport&gt;" />', $html);
        self::assertStringContainsString('content="100 € sur 150 € · il manque 50 € · Mets ta part en un clic"', $html);
        self::assertStringContainsString('<meta property="og:image" content="https://cadeaux.bsandoz.fr/c/' . $g['code'] . '/apercu.png?t=10000" />', $html);
        self::assertStringContainsString('content="66 % de la cagnotte atteint"', $html);
        self::assertStringNotContainsString('Tom', $html, 'les participants ne sont pas dans l’aperçu');
        self::assertStringNotContainsString('Ancien', $html);
        self::assertSame(1, substr_count($html, '<title>'));
        self::assertStringContainsString('<div id="root"></div>', $html);
    }

    public function testLesBalisesDeLaPageDAccueilSontRemplacees(): void
    {
        $modele = (string) file_get_contents(dirname(__DIR__, 2) . '/front/index.html');
        $d = ['code' => '0123456789abcdef', 'titre' => 'Montre', 'beneficiaire' => 'Julie', 'objectif' => 15000, 'total' => 0, 'close' => false];

        $html = Apercu::html($modele, $d, 'https://cadeaux.bsandoz.fr');

        foreach (['<title>', 'og:title', 'og:url', 'og:image"', 'name="description"'] as $balise) {
            self::assertSame(1, substr_count($html, $balise), "$balise une seule fois");
        }
        self::assertStringNotContainsString('rel="canonical"', $html);
        self::assertStringNotContainsString('application/ld+json', $html);
        self::assertStringContainsString('<meta property="og:url" content="https://cadeaux.bsandoz.fr/c/0123456789abcdef" />', $html);
        self::assertStringContainsString('<link rel="manifest"', $html, 'le reste de la page est gardé');
    }

    public function testImagePngValide(): void
    {
        $png = Apercu::png(['objectif' => 15000, 'total' => 10000, 'close' => false]);
        self::assertSame("\x89PNG\r\n\x1a\n", substr($png, 0, 8));
        ['l' => $l, 'h' => $h] = unpack('Nl/Nh', substr($png, 16, 8));
        self::assertSame([1200, 630], [$l, $h]);
        // Données décompressées : 630 lignes de (1 + 1200 × 3) octets.
        $idat = substr($png, 33 + 8, unpack('N', substr($png, 33, 4))[1]);
        self::assertSame(630 * (1 + 1200 * 3), strlen((string) gzuncompress($idat)));
        self::assertSame(0, Apercu::pourcentage(0, 15000));
        self::assertSame(100, Apercu::pourcentage(20000, 15000));
    }
}
