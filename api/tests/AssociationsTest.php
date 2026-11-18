<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

final class AssociationsTest extends ApiTestCase
{
    /** @return array{string, string, int} jetons de Baptiste et de Léa, fiche « Léa » chez Baptiste, associée */
    private function associes(): array
    {
        $moi = $this->inscrire();
        $fiche = $this->appel('POST', '/personnes', ['nom' => 'Ma sœur Léa'], $moi)->donnees['id'];
        $url = $this->appel('POST', "/personnes/$fiche/invitation", [], $moi)->donnees['url'];
        self::assertSame(1, preg_match('#/rejoindre/([a-f0-9]{64})$#', $url, $m));
        $lea = $this->inscrire('lea@example.com', 'Léa');
        self::assertSame(['inviteur' => 'Baptiste', 'nom' => 'Ma sœur Léa'], $this->appel('GET', '/invitations/' . $m[1])->donnees);
        self::assertSame(204, $this->appel('POST', '/invitations/' . $m[1] . '/accepter', [], $lea)->statut);

        return [$moi, $lea, $fiche];
    }

    public function testInvitationAccepteeAvecLAccordDeLaPersonne(): void
    {
        [$moi, $lea, $fiche] = $this->associes();
        self::assertSame(['nom' => 'Léa'], $this->appel('GET', '/personnes', [], $moi)->donnees[0]['compteLie']);
        self::assertSame([['personneId' => $fiche, 'inviteur' => 'Baptiste', 'nom' => 'Ma sœur Léa']], $this->appel('GET', '/moi/associations', [], $lea)->donnees);

        // Elle retire l'association quand elle veut.
        self::assertSame(204, $this->appel('DELETE', "/moi/associations/$fiche", [], $lea)->statut);
        self::assertNull($this->appel('GET', '/personnes', [], $moi)->donnees[0]['compteLie']);
    }

    public function testInvitationSansCompteOuAMoiMemeOuExpiree(): void
    {
        $moi = $this->inscrire();
        $fiche = $this->appel('POST', '/personnes', ['nom' => 'Léa'], $moi)->donnees['id'];
        preg_match('#/rejoindre/([a-f0-9]{64})$#', $this->appel('POST', "/personnes/$fiche/invitation", [], $moi)->donnees['url'], $m);
        self::assertSame(401, $this->appel('POST', '/invitations/' . $m[1] . '/accepter')->statut);
        self::assertSame(409, $this->appel('POST', '/invitations/' . $m[1] . '/accepter', [], $moi)->statut);
        $this->horloge->instant = '2026-12-18 10:00:00';
        self::assertSame(410, $this->appel('GET', '/invitations/' . $m[1])->statut);
        $autre = $this->inscrire('autre@example.com', 'Autre');
        self::assertSame(404, $this->appel('POST', "/personnes/$fiche/invitation", [], $autre)->statut);
    }

    public function testSaListeDEnviesEtSaDateDeNaissance(): void
    {
        [$moi, $lea, $fiche] = $this->associes();
        $this->appel('PATCH', '/moi', ['dateNaissance' => '1996-11-27'], $lea);
        $envie = $this->appel('POST', '/envies', ['titre' => 'Platine vinyle', 'prix' => 19900], $lea)->donnees['id'];

        $p = $this->appel('GET', '/personnes', [], $moi)->donnees[0];
        self::assertSame(['1996-11-27', true], [$p['dateNaissance'], $p['dateDuCompte']]);

        $liste = $this->appel('GET', "/personnes/$fiche/envies", [], $moi)->donnees;
        self::assertSame(['Léa', 'Platine vinyle', null], [$liste['proprietaire'], $liste['envies'][0]['titre'], $liste['envies'][0]['reservation']]);
        self::assertSame(201, $this->appel('POST', "/personnes/$fiche/envies/$envie/reservation", [], $moi)->statut);
        self::assertTrue($this->appel('GET', "/personnes/$fiche/envies", [], $moi)->donnees['envies'][0]['reservation']['parMoi']);
        // Léa ne voit pas la réservation, ni sur sa liste ni dans son export.
        self::assertArrayNotHasKey('reservation', $this->appel('GET', '/envies', [], $lea)->donnees[0]);
        self::assertStringNotContainsString('Baptiste', json_encode($this->appel('GET', '/moi/export', [], $lea)->donnees['envies']));
        self::assertSame(204, $this->appel('DELETE', "/personnes/$fiche/envies/$envie/reservation", [], $moi)->statut);

        // Sans association : rien.
        $autre = $this->appel('POST', '/personnes', ['nom' => 'Tom'], $moi)->donnees['id'];
        self::assertSame(404, $this->appel('GET', "/personnes/$autre/envies", [], $moi)->statut);
    }

    public function testInviterAUneCagnotte(): void
    {
        [$moi, $lea, $fiche] = $this->associes();
        $this->pdo->exec("UPDATE comptes SET email_confirme = 1");
        $g = $this->appel('POST', '/cagnottes', ['titre' => 'Fleurs', 'beneficiaire' => 'Maman', 'objectif' => 4000], $moi)->donnees;
        $this->courriels = [];
        self::assertSame(['envoyees' => 1], $this->appel('POST', '/cagnottes/' . $g['id'] . '/invites', ['personneIds' => [$fiche]], $moi)->donnees);
        self::assertSame(['envoyees' => 0], $this->appel('POST', '/cagnottes/' . $g['id'] . '/invites', ['personneIds' => [$fiche]], $moi)->donnees, 'déjà invitée');
        self::assertSame('lea@example.com', $this->courriels[0]['a']);
        self::assertStringContainsString('/c/' . $g['code'], $this->courriels[0]['texte']);
        $invites = $this->appel('GET', '/moi/cagnottes-invite', [], $lea)->donnees;
        self::assertSame(['Fleurs', 'Baptiste'], [$invites[0]['titre'], $invites[0]['organisateur']]);
    }

    public function testSupprimerSonCompteRetireLesAssociations(): void
    {
        [$moi, $lea] = $this->associes();
        $this->appel('DELETE', '/moi', [], $lea);
        self::assertNull($this->appel('GET', '/personnes', [], $moi)->donnees[0]['compteLie']);
    }
}
