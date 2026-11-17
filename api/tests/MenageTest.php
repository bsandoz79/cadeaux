<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

use Cadeaux\Courrier;
use Cadeaux\Menage;

final class MenageTest extends ApiTestCase
{
    /** @var list<array{string, string, string}> */
    private array $envoyes = [];
    private bool $envoiEnPanne = false;

    private function menage(): Menage
    {
        $courrier = new class($this) implements Courrier {
            public function __construct(private readonly MenageTest $test)
            {
            }

            public function envoyer(string $destinataire, string $sujet, string $texte): bool
            {
                return $this->test->recevoir($destinataire, $sujet, $texte);
            }
        };

        return new Menage($this->pdo, $this->horloge, $courrier);
    }

    public function recevoir(string $destinataire, string $sujet, string $texte): bool
    {
        if ($this->envoiEnPanne) {
            return false;
        }
        $this->envoyes[] = [$destinataire, $sujet, $texte];

        return true;
    }

    public function testUnCompteActifNEstPasTouche(): void
    {
        $this->inscrire();
        $this->horloge->instant = '2029-06-01 04:00:00'; // 2 ans et demi plus tard
        self::assertSame(['avertis' => 0, 'supprimes' => 0, 'jetons' => 1], $this->menage()->lancer());
        self::assertSame([], $this->envoyes);
    }

    public function testAvertiPuisSupprimeTrenteJoursPlusTard(): void
    {
        $this->inscrire();
        $this->appel('POST', '/personnes', ['nom' => 'Maman'], $this->inscrire('autre@example.com', 'Autre'));
        $this->pdo->exec("UPDATE comptes SET derniere_activite = '2029-12-01 00:00:00' WHERE email = 'autre@example.com'");

        $this->horloge->instant = '2029-10-20 04:00:00'; // 3 ans moins 28 jours
        self::assertSame(1, $this->menage()->lancer()['avertis']);
        self::assertSame('baptiste@example.com', $this->envoyes[0][0]);
        self::assertStringContainsString('supprimé dans 30 jours', $this->envoyes[0][1]);
        self::assertStringContainsString('Bonjour Baptiste', $this->envoyes[0][2]);

        // Le lendemain : pas de deuxième e-mail.
        $this->horloge->instant = '2029-10-21 04:00:00';
        self::assertSame(['avertis' => 0, 'supprimes' => 0], array_slice($this->menage()->lancer(), 0, 2));

        // 30 jours après l'avertissement : supprimé, l'autre compte reste.
        $this->horloge->instant = '2029-11-19 04:00:00';
        self::assertSame(1, $this->menage()->lancer()['supprimes']);
        self::assertSame(['autre@example.com'], $this->pdo->query('SELECT email FROM comptes')->fetchAll(\PDO::FETCH_COLUMN));
        self::assertCount(1, $this->envoyes);
    }

    public function testUneVisiteApresLAvertissementGardeLeCompte(): void
    {
        $this->inscrire();
        $this->horloge->instant = '2029-10-20 04:00:00';
        $this->menage()->lancer();
        // Il se reconnecte (nouvelle connexion : l'ancienne a expiré).
        $this->appel('POST', '/connexion', ['email' => 'baptiste@example.com', 'motDePasse' => 'un-bon-mot-de-passe']);
        $this->horloge->instant = '2029-11-25 04:00:00';
        self::assertSame(0, $this->menage()->lancer()['supprimes']);
        self::assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM comptes')->fetchColumn());
    }

    public function testEnvoiRateRetenteLeLendemainSansSupprimer(): void
    {
        $this->inscrire();
        $this->envoiEnPanne = true;
        $this->horloge->instant = '2029-10-20 04:00:00';
        self::assertSame(0, $this->menage()->lancer()['avertis']);
        $this->horloge->instant = '2029-12-30 04:00:00';
        self::assertSame(0, $this->menage()->lancer()['supprimes'], 'jamais supprimé sans avertissement envoyé');
        $this->envoiEnPanne = false;
        self::assertSame(1, $this->menage()->lancer()['avertis']);
    }
}
