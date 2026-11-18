<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

final class ElementsTest extends ApiTestCase
{
    public function testProchesOccasionsEtCadeaux(): void
    {
        $jeton = $this->inscrire();
        $maman = $this->appel('POST', '/personnes', ['nom' => 'Maman', 'dateNaissance' => '1970-03-12'], $jeton)->donnees;
        self::assertSame(['id' => $maman['id'], 'nom' => 'Maman', 'dateNaissance' => '1970-03-12', 'note' => null, 'lien' => null, 'groupeIds' => [], 'compteLie' => null], $maman);

        $noel = $this->appel('POST', '/occasions', ['type' => 'noel', 'titre' => 'Noël 2026', 'date' => '2026-12-25'], $jeton)->donnees;
        $cadeau = $this->appel('POST', '/cadeaux', [
            'titre' => 'Écharpe',
            'occasionId' => $noel['id'],
            'personneId' => $maman['id'],
            'montantPrevu' => 3000,
            'statut' => 'prevu',
            'lien' => 'https://example.com/echarpe',
        ], $jeton);
        self::assertSame(201, $cadeau->statut);
        self::assertSame(3000, $cadeau->donnees['montantPrevu']);
        self::assertSame('2026-11-17 10:00:00', $cadeau->donnees['creeLe']);

        $achete = $this->appel('PATCH', '/cadeaux/' . $cadeau->donnees['id'], ['statut' => 'achete', 'montantDepense' => 2790], $jeton)->donnees;
        self::assertSame(['achete', 2790, 3000, 'Écharpe'], [$achete['statut'], $achete['montantDepense'], $achete['montantPrevu'], $achete['titre']]);

        self::assertCount(1, $this->appel('GET', '/cadeaux', [], $jeton)->donnees);
    }

    public function testLienDeParenteEtNouvellesOccasions(): void
    {
        $jeton = $this->inscrire();
        self::assertSame('grand-mere-maternelle', $this->appel('POST', '/personnes', ['nom' => 'Mamie Jo', 'lien' => 'grand-mere-maternelle'], $jeton)->donnees['lien']);
        self::assertArrayHasKey('lien', $this->appel('POST', '/personnes', ['nom' => 'X', 'lien' => 'voisin'], $jeton)->donnees['champs']);
        foreach (['plaisir', 'reussite'] as $type) {
            self::assertSame(201, $this->appel('POST', '/occasions', ['type' => $type, 'titre' => 'Test', 'date' => '2026-11-18'], $jeton)->statut);
        }
    }

    public function testUneIdeeSansOccasionAvecStatutParDefaut(): void
    {
        $jeton = $this->inscrire();
        $idee = $this->appel('POST', '/cadeaux', ['titre' => 'Montre', 'montantPrevu' => 15000, 'image' => 'https://example.com/m.jpg'], $jeton)->donnees;
        self::assertSame('idee', $idee['statut']);
        self::assertNull($idee['occasionId']);
    }

    public function testValidation(): void
    {
        $jeton = $this->inscrire();
        $r = $this->appel('POST', '/occasions', ['type' => 'paques', 'titre' => '', 'date' => '2026-02-30'], $jeton);
        self::assertSame(422, $r->statut);
        self::assertSame(['type', 'titre', 'date'], array_keys($r->donnees['champs']));

        $r = $this->appel('POST', '/cadeaux', ['titre' => 'X', 'montantPrevu' => -5, 'lien' => 'javascript:alert(1)'], $jeton);
        self::assertSame(['montantPrevu', 'lien'], array_keys($r->donnees['champs']));
    }

    public function testUnCompteNeVoitNiNeToucheLesElementsDUnAutre(): void
    {
        $moi = $this->inscrire();
        $autre = $this->inscrire('autre@example.com', 'Autre');
        $sienne = $this->appel('POST', '/personnes', ['nom' => 'Sa sœur'], $autre)->donnees;

        self::assertSame([], $this->appel('GET', '/personnes', [], $moi)->donnees);
        self::assertSame(404, $this->appel('PATCH', '/personnes/' . $sienne['id'], ['nom' => 'Piratée'], $moi)->statut);
        self::assertSame(404, $this->appel('DELETE', '/personnes/' . $sienne['id'], [], $moi)->statut);
        // Pas de cadeau rattaché à la personne d'un autre compte.
        $r = $this->appel('POST', '/cadeaux', ['titre' => 'X', 'personneId' => $sienne['id']], $moi);
        self::assertSame(422, $r->statut);
        self::assertArrayHasKey('personneId', $r->donnees['champs']);
    }

    public function testUnCadeauPayeAvecUneCagnotte(): void
    {
        $jeton = $this->inscrire();
        $g = $this->appel('POST', '/cagnottes', ['titre' => 'Montre', 'beneficiaire' => 'Papa', 'objectif' => 15000], $jeton)->donnees;
        $c = $this->appel('POST', '/cadeaux', ['titre' => 'Montre', 'statut' => 'achete', 'cagnotteId' => $g['id']], $jeton)->donnees;
        self::assertSame($g['id'], $c['cagnotteId']);

        $autre = $this->inscrire('autre@example.com', 'Autre');
        $sienne = $this->appel('POST', '/cagnottes', ['titre' => 'X', 'beneficiaire' => 'Y', 'objectif' => 100], $autre)->donnees;
        self::assertSame(422, $this->appel('PATCH', '/cadeaux/' . $c['id'], ['cagnotteId' => $sienne['id']], $jeton)->statut);

        $this->appel('DELETE', '/cagnottes/' . $g['id'], [], $jeton);
        self::assertNull($this->appel('GET', '/cadeaux', [], $jeton)->donnees[0]['cagnotteId']);
    }

    public function testSupprimerUnProcheGardeSesCadeaux(): void
    {
        $jeton = $this->inscrire();
        $p = $this->appel('POST', '/personnes', ['nom' => 'Léa'], $jeton)->donnees;
        $c = $this->appel('POST', '/cadeaux', ['titre' => 'Livre', 'personneId' => $p['id'], 'montantDepense' => 1500, 'statut' => 'offert'], $jeton)->donnees;
        $this->pdo->exec('PRAGMA foreign_keys = ON');
        self::assertSame(204, $this->appel('DELETE', '/personnes/' . $p['id'], [], $jeton)->statut);
        $cadeaux = $this->appel('GET', '/cadeaux', [], $jeton)->donnees;
        self::assertSame($c['id'], $cadeaux[0]['id']);
        self::assertNull($cadeaux[0]['personneId']);
    }
}
