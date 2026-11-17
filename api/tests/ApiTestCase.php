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
    /** Horloge réglable : `$this->horloge->instant = '…'`. */
    protected HorlogeFixe $horloge;
    protected string $cleCoffre;

    protected function tearDown(): void
    {
        @unlink($this->cleCoffre);
    }

    protected function setUp(): void
    {
        $this->pdo = new \PDO('sqlite::memory:', null, null, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]);
        $this->pdo->exec('PRAGMA foreign_keys = ON');
        Schema::installer($this->pdo);
        $this->horloge = new HorlogeFixe();
        $this->cleCoffre = tempnam(sys_get_temp_dir(), 'coffre');
        unlink($this->cleCoffre);
        $this->app = new Application($this->pdo, $this->horloge, new \Cadeaux\Coffre($this->cleCoffre));
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
