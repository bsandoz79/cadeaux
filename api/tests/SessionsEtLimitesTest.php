<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

use Cadeaux\Cagnottes;
use Cadeaux\Schema;

final class SessionsEtLimitesTest extends ApiTestCase
{
    public function testUneConnexionInutiliseePendant90JoursExpire(): void
    {
        $jeton = $this->inscrire();
        $this->horloge->instant = '2027-02-14 10:00:00'; // 89 jours plus tard : encore valable, et prolongée
        self::assertSame(200, $this->appel('GET', '/moi', [], $jeton)->statut);
        $this->horloge->instant = '2027-05-14 10:00:00'; // 89 jours après la dernière visite
        self::assertSame(200, $this->appel('GET', '/moi', [], $jeton)->statut);
        $this->horloge->instant = '2027-08-13 10:00:00'; // 91 jours sans visite
        self::assertSame(401, $this->appel('GET', '/moi', [], $jeton)->statut);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM jetons')->fetchColumn());
    }

    public function testChaqueVisiteNoteLaDerniereActiviteEtAnnuleLAvertissement(): void
    {
        $jeton = $this->inscrire();
        $this->pdo->exec("UPDATE comptes SET averti_le = '2026-11-17 10:00:00'");
        $this->horloge->instant = '2026-11-20 08:00:00';
        $this->appel('GET', '/moi', [], $jeton);
        $ligne = $this->pdo->query('SELECT derniere_activite, averti_le FROM comptes')->fetch(\PDO::FETCH_ASSOC);
        self::assertSame(['derniere_activite' => '2026-11-20 08:00:00', 'averti_le' => null], $ligne);
    }

    public function testLeLienDeCagnotteEstProtegeContreLeSpam(): void
    {
        $jeton = $this->inscrire();
        $code = $this->appel('POST', '/cagnottes', ['titre' => 'Montre', 'beneficiaire' => 'Julie', 'objectif' => 15000], $jeton)->donnees['code'];
        for ($i = 0; $i < Cagnottes::PARTS_PAR_IP; ++$i) {
            self::assertSame(201, $this->appel('POST', "/c/$code/participations", ['nom' => "P$i", 'montant' => 100])->statut);
        }
        self::assertSame(429, $this->appel('POST', "/c/$code/participations", ['nom' => 'Encore', 'montant' => 100])->statut);

        // Un quart d'heure plus tard, c'est de nouveau possible.
        $this->horloge->instant = '2026-11-17 10:16:00';
        self::assertSame(201, $this->appel('POST', "/c/$code/participations", ['nom' => 'Plus tard', 'montant' => 100])->statut);
    }

    public function testUneCagnottePleineRefuseDeNouvellesParts(): void
    {
        $jeton = $this->inscrire();
        $c = $this->appel('POST', '/cagnottes', ['titre' => 'Montre', 'beneficiaire' => 'Julie', 'objectif' => 15000], $jeton)->donnees;
        $insert = $this->pdo->prepare("INSERT INTO participations (cagnotte_id, nom, montant, cree_le) VALUES (?, 'X', 100, '2026-11-17 10:00:00')");
        for ($i = 0; $i < Cagnottes::PARTS_MAX; ++$i) {
            $insert->execute([$c['id']]);
        }
        self::assertSame(409, $this->appel('POST', '/c/' . $c['code'] . '/participations', ['nom' => 'Tom', 'montant' => 100])->statut);
        self::assertSame(409, $this->appel('POST', '/cagnottes/' . $c['id'] . '/participations', ['nom' => 'Tom', 'montant' => 100], $jeton)->statut);
    }

    public function testUneBaseDeLaPremiereVersionEstMiseAJour(): void
    {
        $pdo = new \PDO('sqlite::memory:', null, null, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]);
        $pdo->exec('CREATE TABLE comptes (id INTEGER PRIMARY KEY AUTOINCREMENT, email VARCHAR(190) NOT NULL UNIQUE, nom VARCHAR(80) NOT NULL, mot_de_passe VARCHAR(255) NOT NULL, cree_le VARCHAR(19) NOT NULL)');
        $pdo->exec('CREATE TABLE jetons (id INTEGER PRIMARY KEY AUTOINCREMENT, compte_id INTEGER NOT NULL, empreinte CHAR(64) NOT NULL UNIQUE, cree_le VARCHAR(19) NOT NULL)');
        $pdo->exec("INSERT INTO comptes (email, nom, mot_de_passe, cree_le) VALUES ('a@example.com', 'A', 'x', '2026-01-01 00:00:00')");

        Schema::installer($pdo);
        Schema::installer($pdo); // deux fois sans erreur

        $colonnes = array_column($pdo->query('PRAGMA table_info(comptes)')->fetchAll(\PDO::FETCH_ASSOC), 'name');
        self::assertContains('derniere_activite', $colonnes);
        self::assertContains('utilise_le', array_column($pdo->query('PRAGMA table_info(jetons)')->fetchAll(\PDO::FETCH_ASSOC), 'name'));
        self::assertSame('A', $pdo->query('SELECT nom FROM comptes')->fetchColumn());
    }
}
