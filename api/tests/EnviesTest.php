<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

final class EnviesTest extends ApiTestCase
{
    /** @return array{string, string, int} jeton du propriétaire, code du lien, id d'une envie */
    private function listePartagee(): array
    {
        $jeton = $this->inscrire();
        $envie = $this->appel('POST', '/envies', ['titre' => 'Casque audio', 'prix' => 8990, 'lien' => 'https://example.com/casque', 'priorite' => true], $jeton);
        self::assertSame(201, $envie->statut);
        self::assertTrue($envie->donnees['priorite']);
        $lien = $this->appel('POST', '/liste', ['message' => 'Merci !'], $jeton)->donnees;
        self::assertMatchesRegularExpression('/^[a-f0-9]{16}$/', $lien['code']);

        return [$jeton, $lien['code'], $envie->donnees['id']];
    }

    public function testPartagerSaListeEtLaVoirSansCompte(): void
    {
        [, $code] = $this->listePartagee();
        $vue = $this->appel('GET', "/l/$code")->donnees;
        self::assertSame(['Baptiste', 'Merci !', false], [$vue['proprietaire'], $vue['message'], $vue['estProprietaire']]);
        self::assertSame(['Casque audio', 8990, true, null], [$vue['envies'][0]['titre'], $vue['envies'][0]['prix'], $vue['envies'][0]['priorite'], $vue['envies'][0]['reservation']]);
    }

    public function testReserverUneEnvieUneSeuleFoisEtAnnulerAvecSaCle(): void
    {
        [, $code, $id] = $this->listePartagee();
        $r = $this->appel('POST', "/l/$code/envies/$id/reservation", ['nom' => 'Léa']);
        self::assertSame(201, $r->statut);
        self::assertSame(409, $this->appel('POST', "/l/$code/envies/$id/reservation", ['nom' => 'Tom'])->statut);
        self::assertSame('Léa', $this->appel('GET', "/l/$code")->donnees['envies'][0]['reservation']['nom']);

        self::assertSame(403, $this->appel('DELETE', "/l/$code/envies/$id/reservation", [], null, ['x-cle-reservation' => str_repeat('a', 64)])->statut);
        self::assertSame(204, $this->appel('DELETE', "/l/$code/envies/$id/reservation", [], null, ['x-cle-reservation' => $r->donnees['cle']])->statut);
        self::assertNull($this->appel('GET', "/l/$code")->donnees['envies'][0]['reservation']);
    }

    public function testLeProprietaireNeVoitJamaisLesReservations(): void
    {
        [$jeton, $code, $id] = $this->listePartagee();
        $this->appel('POST', "/l/$code/envies/$id/reservation", ['nom' => 'Léa']);

        $vue = $this->appel('GET', "/l/$code", [], $jeton)->donnees;
        self::assertTrue($vue['estProprietaire']);
        self::assertNull($vue['envies'][0]['reservation']);
        self::assertArrayNotHasKey('reservation', $this->appel('GET', '/envies', [], $jeton)->donnees[0]);
        self::assertStringNotContainsString('Léa', json_encode($this->appel('GET', '/moi/export', [], $jeton)->donnees));
        // Et il ne peut pas réserver ses propres envies.
        self::assertSame(403, $this->appel('POST', "/l/$code/envies/$id/reservation", ['nom' => 'Moi'], $jeton)->statut);
    }

    public function testCouperLeLienEtSupprimerUneEnvie(): void
    {
        [$jeton, $code, $id] = $this->listePartagee();
        $this->appel('POST', "/l/$code/envies/$id/reservation", ['nom' => 'Léa']);
        self::assertSame(204, $this->appel('DELETE', "/envies/$id", [], $jeton)->statut);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM reservations')->fetchColumn());

        self::assertSame(204, $this->appel('DELETE', '/liste', [], $jeton)->statut);
        self::assertSame(404, $this->appel('GET', "/l/$code")->statut);
        self::assertNotSame($code, $this->appel('POST', '/liste', [], $jeton)->donnees['code']);
    }

    public function testUneEnvieDUneAutreListeEstIntrouvable(): void
    {
        [, $code] = $this->listePartagee();
        $autre = $this->inscrire('autre@example.com', 'Autre');
        $sienne = $this->appel('POST', '/envies', ['titre' => 'Vélo'], $autre)->donnees['id'];
        self::assertSame(404, $this->appel('POST', "/l/$code/envies/$sienne/reservation", ['nom' => 'Léa'])->statut);
        self::assertSame(422, $this->appel('POST', "/l/$code/envies/1/reservation", ['nom' => ''])->statut);
    }

    public function testSupprimerLeCompteEffaceListeEnviesEtReservations(): void
    {
        [$jeton, $code, $id] = $this->listePartagee();
        $this->appel('POST', "/l/$code/envies/$id/reservation", ['nom' => 'Léa']);
        $this->appel('DELETE', '/moi', [], $jeton);
        foreach (['listes', 'envies', 'reservations'] as $table) {
            self::assertSame(0, (int) $this->pdo->query("SELECT COUNT(*) FROM $table")->fetchColumn(), $table);
        }
    }
}
