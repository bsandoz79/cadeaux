<?php

declare(strict_types=1);

// Restaurer une copie de la base (voir docs/sauvegardes.md), dans une base vide :
//   php api/bin/restaurer.php /chemin/cadeaux-AAAA-MM-JJ.jsonl.gz
// La base visée est celle de api/config.local.php.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../vendor/autoload.php';

use Cadeaux\Sauvegarde;

$fichier = $argv[1] ?? '';
if ($fichier === '' || !is_file($fichier)) {
    fwrite(STDERR, "Usage : php api/bin/restaurer.php /chemin/cadeaux-AAAA-MM-JJ.jsonl.gz\n");
    exit(2);
}

/** @var array{dsn: string, utilisateur?: string, motDePasse?: string} $config */
$config = require __DIR__ . '/../config.local.php';
$pdo = new PDO($config['dsn'], $config['utilisateur'] ?? null, $config['motDePasse'] ?? null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

try {
    $nombre = Sauvegarde::restaurer($pdo, $fichier);
} catch (Throwable $e) {
    fwrite(STDERR, 'Rien n’a été restauré : ' . $e->getMessage() . "\n");
    exit(1);
}
echo "$nombre enregistrements restaurés depuis " . basename($fichier) . PHP_EOL;
