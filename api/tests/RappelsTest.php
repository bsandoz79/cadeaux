<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

use Cadeaux\Courrier;
use Cadeaux\Rappels;

final class RappelsTest extends ApiTestCase
{
    /** @var list<array{string, string, string}> */
    public array $envoyes = [];

    private function rappels(): Rappels
    {
        $test = $this;
        $courrier = new class($test) implements Courrier {
            public function __construct(private readonly RappelsTest $test)
            {
            }

            public function envoyer(string $destinataire, string $sujet, string $texte): bool
            {
                $this->test->envoyes[] = [$destinataire, $sujet, $texte];

                return true;
            }
        };

        return new Rappels($this->pdo, $this->horloge, $courrier);
    }

    public function testAnniversaireDansSeptJoursAvecBudgetEtCadeauPrevu(): void
    {
        $jeton = $this->inscrire();
        $lea = $this->appel('POST', '/personnes', ['nom' => 'Léa', 'dateNaissance' => '1996-11-24'], $jeton)->donnees['id'];
        $this->appel('POST', '/personnes', ['nom' => 'Tom', 'dateNaissance' => '1990-11-25'], $jeton);
        $o = $this->appel('POST', '/occasions', ['type' => 'anniversaire', 'titre' => 'Anniversaire de Léa', 'date' => '2026-11-24'], $jeton)->donnees['id'];
        $this->appel('POST', '/budgets', ['occasionId' => $o, 'personneId' => $lea, 'montant' => 4000], $jeton);
        $this->appel('POST', '/cadeaux', ['titre' => 'Livre', 'occasionId' => $o, 'personneId' => $lea, 'montantPrevu' => 2000, 'statut' => 'prevu'], $jeton);

        self::assertSame(1, $this->rappels()->envoyer()); // le 17 novembre : J-7 pour Léa, pas pour Tom
        [$a, $sujet, $texte] = $this->envoyes[0];
        self::assertSame('baptiste@example.com', $a);
        self::assertSame('Rappel : Léa a 30 ans le mardi 24 novembre.', $sujet);
        self::assertStringContainsString('Budget : 40 €. Prévu : Livre (20 €).', $texte);
        self::assertStringNotContainsString('Tom', $texte);

        // Le lendemain : pas de nouvel e-mail pour Léa ; Tom arrive à J-7.
        $this->horloge->instant = '2026-11-18 04:00:00';
        $this->envoyes = [];
        self::assertSame(1, $this->rappels()->envoyer());
        self::assertStringContainsString('Tom a 36 ans le mercredi 25 novembre.', $this->envoyes[0][2]);
        self::assertStringContainsString('Rien de prévu pour l’instant.', $this->envoyes[0][2]);
        self::assertSame(0, $this->rappels()->envoyer());
    }

    public function testCagnotteIncompleteDeuxJoursAvantSaDateLimite(): void
    {
        $jeton = $this->inscrire();
        $g = $this->appel('POST', '/cagnottes', ['titre' => 'Montre', 'beneficiaire' => 'Julie', 'objectif' => 15000, 'dateLimite' => '2026-11-19'], $jeton)->donnees;
        $this->appel('POST', '/c/' . $g['code'] . '/participations', ['nom' => 'Tom', 'montant' => 10000]);
        $pleine = $this->appel('POST', '/cagnottes', ['titre' => 'Fleurs', 'beneficiaire' => 'Maman', 'objectif' => 3000, 'dateLimite' => '2026-11-19'], $jeton)->donnees;
        $this->appel('POST', '/c/' . $pleine['code'] . '/participations', ['nom' => 'Tom', 'montant' => 3000]);
        $this->appel('POST', '/personnes', ['nom' => 'Léa', 'dateNaissance' => '1996-11-24'], $jeton);

        self::assertSame(1, $this->rappels()->envoyer());
        [, $sujet, $texte] = $this->envoyes[0];
        self::assertSame('2 rappels pour vos cadeaux', $sujet);
        self::assertStringContainsString('Cagnotte « Montre » pour Julie : il manque 50 €, date limite le jeudi 19 novembre.', $texte);
        self::assertStringContainsString('/cagnottes/' . $g['id'], $texte);
        self::assertStringNotContainsString('Fleurs', $texte);
    }

    public function testRappelsCoupesDansMonCompte(): void
    {
        $jeton = $this->inscrire();
        $this->appel('POST', '/personnes', ['nom' => 'Léa', 'dateNaissance' => '1996-11-24'], $jeton);
        $moi = $this->appel('PATCH', '/moi', ['rappels' => false], $jeton);
        self::assertFalse($moi->donnees['rappels']);
        self::assertSame(0, $this->rappels()->envoyer());
        self::assertSame(422, $this->appel('PATCH', '/moi', ['nom' => ''], $jeton)->statut);
    }

    public function testNeUn29FevrierRappelePourLe28LesAnneesNonBissextiles(): void
    {
        $jeton = $this->inscrire();
        $this->appel('POST', '/personnes', ['nom' => 'Hugo', 'dateNaissance' => '2000-02-29'], $jeton);
        $this->horloge->instant = '2027-02-21 04:00:00'; // 28 février 2027 dans 7 jours
        self::assertSame(1, $this->rappels()->envoyer());
        self::assertStringContainsString('Hugo a 27 ans le dimanche 28 février.', $this->envoyes[0][2]);
    }
}
