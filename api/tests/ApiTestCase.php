<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

use Cadeaux\Application;
use Cadeaux\Horloge;
use Cadeaux\Http\Reponse;
use Cadeaux\Http\Requete;
use Cadeaux\Schema;
use PHPUnit\Framework\TestCase;

/** Base des tests : API complète sur une base SQLite en mémoire, horloge fixe. */
abstract class ApiTestCase extends TestCase
{
    protected Application $app;
    protected \PDO $pdo;

    protected function setUp(): void
    {
        $this->pdo = new \PDO('sqlite::memory:', null, null, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]);
        $this->pdo->exec('PRAGMA foreign_keys = ON');
        Schema::installer($this->pdo);
        $horloge = new class extends Horloge {
            public function maintenant(): \DateTimeImmutable
            {
                return new \DateTimeImmutable('2026-11-17 10:00:00', new \DateTimeZone('UTC'));
            }
        };
        $this->app = new Application($this->pdo, $horloge);
    }

    /**
     * @param array<string, mixed>  $corps
     * @param array<string, string> $entetes
     */
    protected function appel(string $methode, string $chemin, array $corps = [], ?string $jeton = null, array $entetes = []): Reponse
    {
        if ($jeton !== null) {
            $entetes['authorization'] = 'Bearer ' . $jeton;
        }

        return $this->app->traiter(new Requete($methode, $chemin, $corps, $entetes, '203.0.113.7'));
    }

    /** Crée un compte et renvoie son jeton. */
    protected function inscrire(string $email = 'baptiste@example.com', string $nom = 'Baptiste'): string
    {
        $reponse = $this->appel('POST', '/comptes', ['email' => $email, 'nom' => $nom, 'motDePasse' => 'un-bon-mot-de-passe']);
        self::assertSame(201, $reponse->statut);

        return $reponse->donnees['jeton'];
    }
}
