<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

use Cadeaux\Sauvegarde;
use Cadeaux\Schema;

final class SauvegardeTest extends ApiTestCase
{
    private string $dossier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dossier = sys_get_temp_dir() . '/cadeaux-sauvegardes-' . bin2hex(random_bytes(4));
    }

    protected function tearDown(): void
    {
        foreach (glob($this->dossier . '/*') ?: [] as $fichier) {
            unlink($fichier);
        }
        @rmdir($this->dossier);
        parent::tearDown();
    }

    private function baseVide(): \PDO
    {
        $pdo = new \PDO('sqlite::memory:', null, null, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]);
        $pdo->exec('PRAGMA foreign_keys = ON');

        return $pdo;
    }

    /** @return array<string, int> */
    private function compter(\PDO $pdo): array
    {
        $noms = $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")->fetchAll(\PDO::FETCH_COLUMN);
        $nombres = [];
        foreach ($noms as $nom) {
            $nombres[$nom] = (int) $pdo->query("SELECT COUNT(*) FROM $nom")->fetchColumn();
        }

        return $nombres;
    }

    public function testUneCopieSeRestaureALIdentiqueDansUneBaseVide(): void
    {
        $jeton = $this->inscrire();
        $personne = $this->appel('POST', '/personnes', ['nom' => 'Maman Éloïse', 'dateNaissance' => '1960-05-02'], $jeton)->donnees;
        $this->appel('POST', '/cagnottes', ['titre' => 'Une montre', 'beneficiaire' => 'Julie', 'objectif' => 15000], $jeton);

        $fichier = (new Sauvegarde($this->pdo, $this->horloge))->ecrire($this->dossier);
        self::assertFileExists($fichier);
        self::assertStringEndsWith('.jsonl.gz', $fichier);
        self::assertFileDoesNotExist($fichier . '.partiel');

        $copie = $this->baseVide();
        $nombre = Sauvegarde::restaurer($copie, $fichier);

        self::assertSame($this->compter($this->pdo), $this->compter($copie));
        self::assertSame(array_sum($this->compter($this->pdo)), $nombre);
        $ligne = $copie->query('SELECT nom, date_naissance FROM personnes WHERE id = ' . (int) $personne['id'])->fetch(\PDO::FETCH_ASSOC);
        self::assertSame(['nom' => 'Maman Éloïse', 'date_naissance' => '1960-05-02'], $ligne);
        // Les numéros continuent après ceux de la copie : rien n'est écrasé par les ajouts suivants.
        $copie->exec("INSERT INTO comptes (email, nom, mot_de_passe, cree_le) VALUES ('nouveau@example.com', 'N', 'x', '2026-01-01 00:00:00')");
        self::assertGreaterThan((int) $this->pdo->query('SELECT MAX(id) FROM comptes')->fetchColumn(), (int) $copie->lastInsertId());
    }

    public function testLaRestaurationRefuseUneBaseQuiContientDejaDesComptes(): void
    {
        $this->inscrire();
        $fichier = (new Sauvegarde($this->pdo, $this->horloge))->ecrire($this->dossier);

        $this->expectExceptionMessage('La base contient déjà des comptes');
        Sauvegarde::restaurer($this->pdo, $fichier);
    }

    public function testUneCopieCoupeeNeRestaureRien(): void
    {
        $this->inscrire();
        $fichier = (new Sauvegarde($this->pdo, $this->horloge))->ecrire($this->dossier);
        $lignes = gzfile($fichier);
        self::assertNotFalse($lignes);
        $coupee = $this->dossier . '/coupee.jsonl.gz';
        file_put_contents($coupee, gzencode(implode('', array_slice($lignes, 0, -1))));

        $copie = $this->baseVide();
        try {
            Sauvegarde::restaurer($copie, $coupee);
            self::fail('Une copie sans sa dernière ligne doit être refusée.');
        } catch (\RuntimeException $e) {
            self::assertStringContainsString('incomplète', $e->getMessage());
        }
        self::assertSame(0, (int) $copie->query('SELECT COUNT(*) FROM comptes')->fetchColumn());
    }

    public function testUneCopieDUneVersionPlusRecenteEstRefusee(): void
    {
        mkdir($this->dossier, 0o700, true);
        $fichier = $this->dossier . '/future.jsonl.gz';
        file_put_contents($fichier, gzencode(json_encode(['version' => Schema::VERSION + 1, 'le' => 'x']) . "\n" . json_encode(['fin' => 0]) . "\n"));

        $this->expectExceptionMessage('version plus récente');
        Sauvegarde::restaurer($this->baseVide(), $fichier);
    }

    public function testSeulesLesQuatorzeCopiesLesPlusRecentesSontGardees(): void
    {
        $sauvegarde = new Sauvegarde($this->pdo, $this->horloge);
        for ($jour = 1; $jour <= 16; ++$jour) {
            $this->horloge->instant = sprintf('2026-03-%02d 03:00:00', $jour);
            $sauvegarde->ecrire($this->dossier);
        }

        self::assertSame(2, Sauvegarde::nettoyer($this->dossier));
        $restants = array_map('basename', glob($this->dossier . '/cadeaux-*.jsonl.gz') ?: []);
        self::assertCount(Sauvegarde::GARDER, $restants);
        self::assertNotContains('cadeaux-2026-03-01.jsonl.gz', $restants);
        self::assertNotContains('cadeaux-2026-03-02.jsonl.gz', $restants);
        self::assertContains('cadeaux-2026-03-16.jsonl.gz', $restants);
    }
}
