<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

final class AgendaTest extends ApiTestCase
{
    private function lien(string $jeton): string
    {
        $url = $this->appel('POST', '/moi/agenda', [], $jeton)->donnees['url'];
        self::assertMatchesRegularExpression('#^https://cadeaux\.test/api/agenda/[a-f0-9]{64}\.ics$#', $url);

        return substr((string) parse_url($url, PHP_URL_PATH), strlen('/api'));
    }

    public function testAnniversairesChaqueAnneeOccasionsEtCagnottesOuvertes(): void
    {
        $jeton = $this->inscrire();
        $maman = $this->appel('POST', '/personnes', ['nom' => 'Maman, la meilleure', 'dateNaissance' => '1962-05-14'], $jeton)->donnees;
        $this->appel('POST', '/personnes', ['nom' => 'Sans date'], $jeton);
        $this->appel('POST', '/occasions', ['type' => 'noel', 'titre' => 'Noël 2026', 'date' => '2026-12-25'], $jeton);
        $this->appel('POST', '/occasions', ['type' => 'anniversaire', 'titre' => 'Anniversaire de Maman', 'date' => '2026-05-14'], $jeton);
        $this->appel('POST', '/cagnottes', ['titre' => 'Une montre', 'beneficiaire' => 'Julie', 'objectif' => 15000, 'dateLimite' => '2026-12-20'], $jeton);

        $reponse = $this->appel('GET', $this->lien($jeton));

        self::assertSame(200, $reponse->statut);
        self::assertStringStartsWith('text/calendar', (string) $reponse->type);
        $ics = (string) $reponse->donnees;
        self::assertStringStartsWith("BEGIN:VCALENDAR\r\n", $ics);
        self::assertStringEndsWith("END:VCALENDAR\r\n", $ics);
        self::assertStringContainsString("UID:anniversaire-{$maman['id']}@cadeaux.bsandoz.fr\r\n", $ics);
        self::assertStringContainsString("DTSTART;VALUE=DATE:19620514\r\nDTEND;VALUE=DATE:19620515\r\nRRULE:FREQ=YEARLY\r\n", $ics);
        self::assertStringContainsString('SUMMARY:Anniversaire de Maman\, la meilleure', $ics, 'virgule échappée');
        self::assertStringContainsString("SUMMARY:Noël 2026\r\n", $ics);
        self::assertStringContainsString('DTSTART;VALUE=DATE:20261225', $ics);
        self::assertStringContainsString('SUMMARY:Fin de la cagnotte pour Julie : Une montre', $ics);
        self::assertSame(3, substr_count($ics, 'BEGIN:VEVENT'), 'l’occasion « anniversaire » n’est pas en double, le proche sans date est absent');
        foreach (explode("\r\n", $ics) as $ligne) {
            self::assertLessThanOrEqual(75, strlen($ligne), $ligne);
        }
    }

    public function testUnNouveauLienRemplaceLAncienEtOnPeutLeCouper(): void
    {
        $jeton = $this->inscrire();
        $ancien = $this->lien($jeton);
        $nouveau = $this->lien($jeton);

        self::assertSame(404, $this->appel('GET', $ancien)->statut);
        self::assertSame(200, $this->appel('GET', $nouveau)->statut);
        self::assertTrue($this->appel('GET', '/moi', [], $jeton)->donnees['agenda']);

        self::assertSame(204, $this->appel('DELETE', '/moi/agenda', [], $jeton)->statut);
        self::assertSame(404, $this->appel('GET', $nouveau)->statut);
        self::assertFalse($this->appel('GET', '/moi', [], $jeton)->donnees['agenda']);
    }

    public function testChaqueAgendaNeMontreQueSonCompte(): void
    {
        $julie = $this->inscrire('julie@example.com', 'Julie');
        $this->appel('POST', '/personnes', ['nom' => 'Secret de Julie', 'dateNaissance' => '1990-01-01'], $julie);
        $baptiste = $this->inscrire();

        self::assertStringNotContainsString('Secret de Julie', (string) $this->appel('GET', $this->lien($baptiste))->donnees);
        self::assertSame(404, $this->appel('GET', '/agenda/' . str_repeat('0', 64) . '.ics')->statut);
    }
}
