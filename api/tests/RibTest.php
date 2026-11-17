<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

use Cadeaux\Iban;
use Cadeaux\Menage;
use Cadeaux\Ribs;

final class RibTest extends ApiTestCase
{
    // IBAN d'exemple publié par la Banque de France (valide, fictif).
    private const IBAN = 'FR76 3000 6000 0112 3456 7890 189';

    /** @return array{string, array<string, mixed>} */
    private function cagnotteAvecRib(): array
    {
        $jeton = $this->inscrire();
        $g = $this->appel('POST', '/cagnottes', ['titre' => 'Montre', 'beneficiaire' => 'Julie', 'objectif' => 15000], $jeton)->donnees;
        $r = $this->appel('PUT', '/cagnottes/' . $g['id'] . '/rib', ['titulaire' => 'Baptiste Sandoz', 'iban' => 'fr76 3000-6000 0112 3456 7890 189'], $jeton);
        self::assertSame(200, $r->statut, json_encode($r->donnees));
        self::assertSame(['titulaire' => 'Baptiste Sandoz', 'ibanMasque' => 'FR76 •••• •••• •••• •••• •••0 189'], $r->donnees);

        return [$jeton, $g];
    }

    public function testIban(): void
    {
        self::assertTrue(Iban::valide(Iban::normaliser(self::IBAN)));
        self::assertTrue(Iban::valide('DE89370400440532013000'));
        self::assertFalse(Iban::valide('FR7630006000011234567890188'), 'clé fausse');
        self::assertFalse(Iban::valide('FR76'));
        self::assertSame(self::IBAN, Iban::formater('FR7630006000011234567890189'));
    }

    public function testLeRibEstChiffreEtMontreSeulementSurDemande(): void
    {
        [$jeton, $g] = $this->cagnotteAvecRib();
        $brut = (string) $this->pdo->query('SELECT rib_iban FROM cagnottes')->fetchColumn();
        self::assertStringNotContainsString('3000', base64_decode($brut), 'pas d’IBAN en clair dans la base');

        $publique = $this->appel('GET', '/c/' . $g['code'])->donnees;
        self::assertSame(['titulaire' => 'Baptiste Sandoz'], $publique['rib']);
        self::assertStringNotContainsString('3000', json_encode($publique));

        self::assertSame(['titulaire' => 'Baptiste Sandoz', 'iban' => self::IBAN], $this->appel('GET', '/c/' . $g['code'] . '/rib')->donnees);
        self::assertSame('FR76 •••• •••• •••• •••• •••0 189', $this->appel('GET', '/cagnottes/' . $g['id'], [], $jeton)->donnees['rib']['ibanMasque']);
        self::assertSame('Baptiste Sandoz', $this->appel('GET', '/cagnottes', [], $jeton)->donnees[0]['rib']['titulaire']);
    }

    public function testRibInvalideOuCagnotteDUnAutre(): void
    {
        [, $g] = $this->cagnotteAvecRib();
        $autre = $this->inscrire('autre@example.com', 'Autre');
        self::assertSame(404, $this->appel('PUT', '/cagnottes/' . $g['id'] . '/rib', ['titulaire' => 'X', 'iban' => self::IBAN], $autre)->statut);
        self::assertSame(404, $this->appel('DELETE', '/cagnottes/' . $g['id'] . '/rib', [], $autre)->statut);
        $mienne = $this->appel('POST', '/cagnottes', ['titre' => 'X', 'beneficiaire' => 'Y', 'objectif' => 100], $autre)->donnees;
        $r = $this->appel('PUT', '/cagnottes/' . $mienne['id'] . '/rib', ['titulaire' => '', 'iban' => 'FR76 1234'], $autre);
        self::assertSame(['titulaire', 'iban'], array_keys($r->donnees['champs']));
    }

    public function testEffaceQuandLaCagnotteEstTerminee(): void
    {
        [$jeton, $g] = $this->cagnotteAvecRib();
        $this->appel('PATCH', '/cagnottes/' . $g['id'], ['close' => true], $jeton);
        self::assertNull($this->pdo->query('SELECT rib_iban FROM cagnottes')->fetchColumn());
        self::assertSame(404, $this->appel('GET', '/c/' . $g['code'] . '/rib')->statut);
    }

    public function testEffaceQuandToutesLesPartsSontPayees(): void
    {
        [$jeton, $g] = $this->cagnotteAvecRib();
        $tom = $this->appel('POST', '/c/' . $g['code'] . '/participations', ['nom' => 'Tom', 'montant' => 10000])->donnees['participation']['id'];
        $this->appel('POST', '/cagnottes/' . $g['id'] . '/participations', ['nom' => 'Baptiste', 'montant' => 5000, 'paye' => true, 'organisateur' => true], $jeton);
        self::assertNotNull($this->appel('GET', '/cagnottes/' . $g['id'], [], $jeton)->donnees['rib'], 'Tom n’a pas encore payé');
        $this->appel('PATCH', '/cagnottes/' . $g['id'] . '/participations/' . $tom, ['paye' => true], $jeton);
        self::assertNull($this->appel('GET', '/cagnottes/' . $g['id'], [], $jeton)->donnees['rib']);
    }

    public function testEffaceParLOrganisateurOuApres60Jours(): void
    {
        [$jeton, $g] = $this->cagnotteAvecRib();
        self::assertSame(204, $this->appel('DELETE', '/cagnottes/' . $g['id'] . '/rib', [], $jeton)->statut);
        self::assertNull($this->appel('GET', '/c/' . $g['code'])->donnees['rib']);

        $this->appel('PUT', '/cagnottes/' . $g['id'] . '/rib', ['titulaire' => 'B', 'iban' => self::IBAN], $jeton);
        $this->horloge->instant = '2027-01-15 04:00:00'; // 59 jours
        $courrier = new class implements \Cadeaux\Courrier {
            public function envoyer(string $destinataire, string $sujet, string $texte): bool
            {
                return true;
            }
        };
        self::assertSame(0, (new Menage($this->pdo, $this->horloge, $courrier))->lancer()['ribs']);
        $this->horloge->instant = '2027-01-17 04:00:00'; // 61 jours
        self::assertSame(1, (new Menage($this->pdo, $this->horloge, $courrier))->lancer()['ribs']);
        self::assertNull($this->pdo->query('SELECT rib_iban FROM cagnottes')->fetchColumn());
    }

    public function testAffichageLimiteParIp(): void
    {
        [, $g] = $this->cagnotteAvecRib();
        for ($i = 0; $i < Ribs::AFFICHAGES_PAR_IP; ++$i) {
            $this->appel('GET', '/c/' . $g['code'] . '/rib');
        }
        self::assertSame(429, $this->appel('GET', '/c/' . $g['code'] . '/rib')->statut);
    }
}
