<?php

declare(strict_types=1);

// Ménage quotidien, lancé par une tâche planifiée (cPanel → Tâches Cron), par exemple chaque nuit à 4 h :
//   php /home/<compte>/cadeaux.bsandoz.fr/api/bin/menage.php
// Comptes inactifs avertis puis supprimés, connexions expirées effacées. Voir src/Menage.php.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../vendor/autoload.php';

use Cadeaux\CourrierPhp;
use Cadeaux\Horloge;
use Cadeaux\Menage;

/** @var array{dsn: string, utilisateur?: string, motDePasse?: string, expediteur?: string} $config */
$config = require __DIR__ . '/../config.local.php';
$pdo = new PDO($config['dsn'], $config['utilisateur'] ?? null, $config['motDePasse'] ?? null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

$resultat = (new Menage($pdo, new Horloge(), new CourrierPhp($config['expediteur'] ?? 'Cadeaux <cadeaux@bsandoz.fr>')))->lancer();
echo date('c') . ' ' . json_encode($resultat) . PHP_EOL;
