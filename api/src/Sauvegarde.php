<?php

declare(strict_types=1);

namespace Cadeaux;

/**
 * Copie de toute la base dans un fichier compressé, une par jour, les 14 dernières gardées.
 * Format indépendant du moteur (une ligne JSON par enregistrement) : une copie faite en MySQL
 * se restaure aussi dans une base SQLite, pour vérifier son contenu sans toucher au site.
 * Les RIB y restent chiffrés : sans le fichier api/var/cle-coffre, ils sont illisibles.
 */
final class Sauvegarde
{
    public const GARDER = 14;
    private const PREFIXE = 'cadeaux-';

    public function __construct(private readonly \PDO $pdo, private readonly Horloge $horloge)
    {
    }

    /** Écrit la copie du jour dans le dossier (créé au besoin, lisible par le seul propriétaire) et renvoie son chemin. */
    public function ecrire(string $dossier): string
    {
        if (!is_dir($dossier) && !mkdir($dossier, 0o700, true) && !is_dir($dossier)) {
            throw new \RuntimeException("Dossier des sauvegardes impossible à créer : $dossier");
        }
        $instant = $this->horloge->maintenant();
        $fichier = $dossier . '/' . self::PREFIXE . $instant->format('Y-m-d') . '.jsonl.gz';
        $provisoire = $fichier . '.partiel';
        $gz = gzopen($provisoire, 'wb6');
        if ($gz === false) {
            throw new \RuntimeException("Écriture impossible : $provisoire");
        }
        chmod($provisoire, 0o600);
        $lignes = 0;
        try {
            self::ecrireLigne($gz, ['version' => Schema::VERSION, 'le' => $this->horloge->texte()]);
            foreach ($this->tables() as $table) {
                $requete = $this->pdo->query("SELECT * FROM $table ORDER BY 1");
                while (($ligne = $requete->fetch(\PDO::FETCH_ASSOC)) !== false) {
                    self::ecrireLigne($gz, ['t' => $table, 'l' => $ligne]);
                    ++$lignes;
                }
            }
            self::ecrireLigne($gz, ['fin' => $lignes]);
        } finally {
            gzclose($gz);
        }
        // Le fichier du jour n'apparaît qu'une fois complet : une copie coupée en route ne remplace jamais la précédente.
        rename($provisoire, $fichier);

        return $fichier;
    }

    /** Supprime les copies au-delà des plus récentes et renvoie le nombre supprimé. */
    public static function nettoyer(string $dossier, int $garder = self::GARDER): int
    {
        $fichiers = glob($dossier . '/' . self::PREFIXE . '*.jsonl.gz') ?: [];
        rsort($fichiers);
        $retires = 0;
        foreach (array_slice($fichiers, $garder) as $ancien) {
            if (unlink($ancien)) {
                ++$retires;
            }
        }

        return $retires;
    }

    /**
     * Recharge une copie dans une base vide (tables créées au besoin) et renvoie le nombre d'enregistrements.
     * Refuse une base qui contient déjà des comptes, et une copie incomplète.
     */
    public static function restaurer(\PDO $pdo, string $fichier): int
    {
        $gz = @gzopen($fichier, 'rb');
        if ($gz === false) {
            throw new \RuntimeException("Fichier illisible : $fichier");
        }
        $mysql = $pdo->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql';
        try {
            $entete = self::lireLigne($gz);
            if (!isset($entete['version']) || $entete['version'] > Schema::VERSION) {
                throw new \RuntimeException('Copie d’une version plus récente du site : mettre le code à jour avant de restaurer.');
            }
            Schema::installer($pdo);
            if ((int) $pdo->query('SELECT COUNT(*) FROM comptes')->fetchColumn() > 0) {
                throw new \RuntimeException('La base contient déjà des comptes : restaurer dans une base vide.');
            }
            $pdo->exec($mysql ? 'SET FOREIGN_KEY_CHECKS = 0' : 'PRAGMA foreign_keys = OFF');
            $pdo->beginTransaction();
            $lignes = 0;
            $fin = null;
            $requetes = [];
            while (($donnee = self::lireLigne($gz)) !== null) {
                if (isset($donnee['fin'])) {
                    $fin = (int) $donnee['fin'];
                    break;
                }
                $table = (string) $donnee['t'];
                if (preg_match('/^[a-z_]+$/', $table) !== 1) {
                    throw new \RuntimeException("Nom de table inattendu : $table");
                }
                /** @var array<string, scalar|null> $ligne */
                $ligne = $donnee['l'];
                $colonnes = array_keys($ligne);
                foreach ($colonnes as $colonne) {
                    if (preg_match('/^[a-z_]+$/', $colonne) !== 1) {
                        throw new \RuntimeException("Nom de colonne inattendu : $colonne");
                    }
                }
                $cle = $table . ':' . implode(',', $colonnes);
                $requetes[$cle] ??= $pdo->prepare(sprintf(
                    'INSERT INTO %s (%s) VALUES (%s)',
                    $table,
                    implode(', ', $colonnes),
                    implode(', ', array_fill(0, count($colonnes), '?')),
                ));
                $requetes[$cle]->execute(array_values($ligne));
                ++$lignes;
            }
            if ($fin !== $lignes) {
                throw new \RuntimeException('Copie incomplète : rien n’a été restauré.');
            }
            $pdo->commit();

            return $lignes;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        } finally {
            gzclose($gz);
            $pdo->exec($mysql ? 'SET FOREIGN_KEY_CHECKS = 1' : 'PRAGMA foreign_keys = ON');
        }
    }

    /** @return list<string> */
    private function tables(): array
    {
        $mysql = $this->pdo->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql';
        $noms = $this->pdo->query($mysql
            ? 'SHOW TABLES'
            : "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")->fetchAll(\PDO::FETCH_COLUMN);

        return array_values(array_map('strval', $noms));
    }

    /** @param resource $gz */
    private static function ecrireLigne($gz, array $donnee): void
    {
        gzwrite($gz, json_encode($donnee, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . "\n");
    }

    /**
     * @param resource $gz
     * @return array<string, mixed>|null
     */
    private static function lireLigne($gz): ?array
    {
        $texte = gzgets($gz);
        if ($texte === false || trim($texte) === '') {
            return null;
        }

        return json_decode($texte, true, 512, JSON_THROW_ON_ERROR);
    }
}
