<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

final class BudgetsTest extends ApiTestCase
{
    /** @return array{string, int, int} jeton, occasion, personne */
    private function noelEtPapa(): array
    {
        $jeton = $this->inscrire();
        $noel = $this->appel('POST', '/occasions', ['type' => 'noel', 'titre' => 'Noël 2026', 'date' => '2026-12-25'], $jeton)->donnees['id'];
        $papa = $this->appel('POST', '/personnes', ['nom' => 'Papa'], $jeton)->donnees['id'];

        return [$jeton, $noel, $papa];
    }

    public function testUnBudgetParPersonneEtParOccasion(): void
    {
        [$jeton, $noel, $papa] = $this->noelEtPapa();
        $b = $this->appel('POST', '/budgets', ['occasionId' => $noel, 'personneId' => $papa, 'montant' => 5000], $jeton);
        self::assertSame(201, $b->statut);
        self::assertSame(['id' => $b->donnees['id'], 'occasionId' => $noel, 'personneId' => $papa, 'montant' => 5000], $b->donnees);

        // Un deuxième budget pour la même personne et la même occasion : refusé, on modifie le premier.
        self::assertSame(409, $this->appel('POST', '/budgets', ['occasionId' => $noel, 'personneId' => $papa, 'montant' => 100], $jeton)->statut);
        self::assertSame(6000, $this->appel('PATCH', '/budgets/' . $b->donnees['id'], ['montant' => 6000], $jeton)->donnees['montant']);
    }

    public function testChampsObligatoiresEtCloisonnement(): void
    {
        [$jeton, $noel] = $this->noelEtPapa();
        $r = $this->appel('POST', '/budgets', ['occasionId' => $noel], $jeton);
        self::assertSame(['personneId', 'montant'], array_keys($r->donnees['champs']));

        $autre = $this->inscrire('autre@example.com', 'Autre');
        $sienne = $this->appel('POST', '/personnes', ['nom' => 'X'], $autre)->donnees['id'];
        $r = $this->appel('POST', '/budgets', ['occasionId' => $noel, 'personneId' => $sienne, 'montant' => 100], $jeton);
        self::assertArrayHasKey('personneId', $r->donnees['champs']);
    }

    public function testSupprimerLOccasionSupprimeSesBudgets(): void
    {
        [$jeton, $noel, $papa] = $this->noelEtPapa();
        $this->appel('POST', '/budgets', ['occasionId' => $noel, 'personneId' => $papa, 'montant' => 5000], $jeton);
        $this->appel('DELETE', "/occasions/$noel", [], $jeton);
        self::assertSame([], $this->appel('GET', '/budgets', [], $jeton)->donnees);
    }
}
