<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

final class CagnottesTest extends ApiTestCase
{
    /** @return array{string, array<string, mixed>} jeton de l'organisateur et cagnotte */
    private function cagnotte(array $donnees = []): array
    {
        $jeton = $this->inscrire();
        $r = $this->appel('POST', '/cagnottes', $donnees + [
            'titre' => 'Montre pour les 30 ans de Julie',
            'beneficiaire' => 'Julie',
            'objectif' => 15000,
            'mode' => 'libre',
        ], $jeton);
        self::assertSame(201, $r->statut, json_encode($r->donnees));

        return [$jeton, $r->donnees];
    }

    public function testCreationAvecUnCodeSecret(): void
    {
        [, $c] = $this->cagnotte();
        self::assertMatchesRegularExpression('/^[a-f0-9]{16}$/', $c['code']);
        self::assertFalse($c['close']);
    }

    public function testPartsEgalesDemandentLeNombreDeParticipants(): void
    {
        $jeton = $this->inscrire();
        $r = $this->appel('POST', '/cagnottes', ['titre' => 'Montre', 'beneficiaire' => 'Julie', 'objectif' => 15000, 'mode' => 'egal'], $jeton);
        self::assertSame(422, $r->statut);
        self::assertArrayHasKey('nombreParts', $r->donnees['champs']);
    }

    public function testLeLienPartagePermetDeParticiperSansCompte(): void
    {
        [$jeton, $c] = $this->cagnotte();
        $publique = $this->appel('GET', '/c/' . $c['code']);
        self::assertSame(['Julie', 'Baptiste', []], [$publique->donnees['beneficiaire'], $publique->donnees['organisateur'], $publique->donnees['participations']]);

        $part = $this->appel('POST', '/c/' . $c['code'] . '/participations', ['nom' => 'Tom', 'montant' => 2000]);
        self::assertSame(201, $part->statut);
        $cle = $part->donnees['cle'];
        $id = $part->donnees['participation']['id'];

        // Il modifie sa part avec sa clé ; un autre ne peut pas.
        $chemin = '/c/' . $c['code'] . '/participations/' . $id;
        self::assertSame(403, $this->appel('PATCH', $chemin, ['nom' => 'Tom', 'montant' => 1])->statut);
        self::assertSame(403, $this->appel('PATCH', $chemin, ['nom' => 'Tom', 'montant' => 1], null, ['x-cle-participation' => str_repeat('0', 64)])->statut);
        $modif = $this->appel('PATCH', $chemin, ['nom' => 'Tom', 'montant' => 3000], null, ['x-cle-participation' => $cle]);
        self::assertSame(3000, $modif->donnees['montant']);

        // L'organisateur voit la part et la marque payée.
        $vue = $this->appel('GET', '/cagnottes/' . $c['id'], [], $jeton)->donnees;
        self::assertSame([['id' => $id, 'nom' => 'Tom', 'montant' => 3000, 'paye' => false, 'organisateur' => false]], $vue['participations']);
        $payee = $this->appel('PATCH', '/cagnottes/' . $c['id'] . '/participations/' . $id, ['paye' => true], $jeton);
        self::assertTrue($payee->donnees['paye']);
        self::assertSame(3000, $payee->donnees['montant']);

        // Il retire sa part.
        self::assertSame(204, $this->appel('DELETE', $chemin, [], null, ['x-cle-participation' => $cle])->statut);
        self::assertSame([], $this->appel('GET', '/c/' . $c['code'])->donnees['participations']);
    }

    public function testLOrganisateurCompleteLeReste(): void
    {
        [$jeton, $c] = $this->cagnotte();
        $this->appel('POST', '/c/' . $c['code'] . '/participations', ['nom' => 'Tom', 'montant' => 4000]);
        $r = $this->appel('POST', '/cagnottes/' . $c['id'] . '/participations', ['nom' => 'Baptiste', 'montant' => 11000, 'paye' => true, 'organisateur' => true], $jeton);
        self::assertSame(201, $r->statut);
        self::assertTrue($r->donnees['organisateur']);

        $liste = $this->appel('GET', '/cagnottes', [], $jeton)->donnees;
        self::assertSame([15000, 11000, 11000, 2], [$liste[0]['total'], $liste[0]['totalPaye'], $liste[0]['maPart'], $liste[0]['nombreParticipations']]);
    }

    public function testCagnotteCloseOuCodeInconnu(): void
    {
        [$jeton, $c] = $this->cagnotte();
        $this->appel('PATCH', '/cagnottes/' . $c['id'], ['close' => true], $jeton);
        self::assertSame(409, $this->appel('POST', '/c/' . $c['code'] . '/participations', ['nom' => 'Tom', 'montant' => 100])->statut);
        self::assertSame(404, $this->appel('GET', '/c/0000000000000000')->statut);
    }

    public function testMontantInvalide(): void
    {
        [, $c] = $this->cagnotte();
        $r = $this->appel('POST', '/c/' . $c['code'] . '/participations', ['nom' => '', 'montant' => 0]);
        self::assertSame(['nom', 'montant'], array_keys($r->donnees['champs']));
    }

    public function testUnAutreCompteNeGerePasLaCagnotte(): void
    {
        [, $c] = $this->cagnotte();
        $autre = $this->inscrire('autre@example.com', 'Autre');
        self::assertSame(404, $this->appel('GET', '/cagnottes/' . $c['id'], [], $autre)->statut);
        self::assertSame(404, $this->appel('POST', '/cagnottes/' . $c['id'] . '/participations', ['nom' => 'X', 'montant' => 100], $autre)->statut);
    }
}
