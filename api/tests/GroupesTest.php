<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

final class GroupesTest extends ApiTestCase
{
    public function testUnProchePeutEtreDansPlusieursGroupes(): void
    {
        $jeton = $this->inscrire();
        $famille = $this->appel('POST', '/groupes', ['nom' => 'Famille'], $jeton)->donnees['id'];
        $amis = $this->appel('POST', '/groupes', ['nom' => 'Amis'], $jeton)->donnees['id'];
        self::assertSame(['Amis', 'Famille'], array_column($this->appel('GET', '/groupes', [], $jeton)->donnees, 'nom'));

        $lea = $this->appel('POST', '/personnes', ['nom' => 'Léa', 'groupeIds' => [$famille, $amis]], $jeton)->donnees;
        self::assertSame([$famille, $amis], $lea['groupeIds']);
        $tom = $this->appel('POST', '/personnes', ['nom' => 'Tom'], $jeton)->donnees;
        self::assertSame([], $tom['groupeIds']);

        $modifie = $this->appel('PATCH', '/personnes/' . $lea['id'], ['groupeIds' => [$amis]], $jeton)->donnees;
        self::assertSame([$amis], $modifie['groupeIds']);
        // Changer le nom seul ne touche pas aux groupes.
        self::assertSame([$amis], $this->appel('PATCH', '/personnes/' . $lea['id'], ['nom' => 'Léa B.'], $jeton)->donnees['groupeIds']);
        self::assertSame([[$amis], []], array_column($this->appel('GET', '/personnes', [], $jeton)->donnees, 'groupeIds'));
    }

    public function testSupprimerUnGroupeGardeSesProches(): void
    {
        $jeton = $this->inscrire();
        $g = $this->appel('POST', '/groupes', ['nom' => 'Collègues'], $jeton)->donnees['id'];
        $p = $this->appel('POST', '/personnes', ['nom' => 'Inès', 'groupeIds' => [$g]], $jeton)->donnees['id'];
        self::assertSame(204, $this->appel('DELETE', "/groupes/$g", [], $jeton)->statut);
        self::assertSame([], $this->appel('GET', '/personnes', [], $jeton)->donnees[0]['groupeIds']);
        self::assertSame($p, $this->appel('GET', '/personnes', [], $jeton)->donnees[0]['id']);
    }

    public function testGroupesDUnAutreCompteOuInvalides(): void
    {
        $jeton = $this->inscrire();
        $autre = $this->inscrire('autre@example.com', 'Autre');
        $sien = $this->appel('POST', '/groupes', ['nom' => 'Ses amis'], $autre)->donnees['id'];
        self::assertSame(422, $this->appel('POST', '/personnes', ['nom' => 'X', 'groupeIds' => [$sien]], $jeton)->statut);
        self::assertSame(422, $this->appel('POST', '/personnes', ['nom' => 'X', 'groupeIds' => 'Famille'], $jeton)->statut);
        self::assertSame(422, $this->appel('POST', '/groupes', ['nom' => ''], $jeton)->statut);
        self::assertSame([], $this->appel('GET', '/groupes', [], $jeton)->donnees);
    }
}
