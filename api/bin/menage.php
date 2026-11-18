<?php

declare(strict_types=1);

// Ménage quotidien, lancé par une tâche planifiée (cPanel → Tâches Cron), par exemple chaque nuit à 4 h :
//   php /home/<compte>/cadeaux.bsandoz.fr/api/bin/menage.php
// D'abord une copie de la base (src/Sauvegarde.php, 14 jours gardés), puis comptes inactifs avertis et supprimés,
// connexions expirées effacées (src/Menage.php), rappels par e-mail (src/Rappels.php).

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../vendor/autoload.php';

use Cadeaux\CourrierPhp;
use Cadeaux\Horloge;
use Cadeaux\Menage;
use Cadeaux\Comptes;
use Cadeaux\Identite;
use Cadeaux\Rappels;
use Cadeaux\Sauvegarde;

/** @var array{dsn: string, utilisateur?: string, motDePasse?: string, expediteur?: string, site?: string, sauvegardes?: string} $config */
$config = require __DIR__ . '/../config.local.php';
$pdo = new PDO($config['dsn'], $config['utilisateur'] ?? null, $config['motDePasse'] ?? null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

// Copie faite avant le ménage : un compte supprimé cette nuit reste récupérable pendant 14 jours.
// Dossier hors du site (en ligne : /home/<compte>/sauvegardes-cadeaux), jamais servi par le web ni écrasé par un déploiement.
$dossier = $config['sauvegardes'] ?? dirname(__DIR__, 3) . '/sauvegardes-cadeaux';
$copie = (new Sauvegarde($pdo, new Horloge()))->ecrire($dossier);
$resultat = ['sauvegarde' => basename($copie), 'sauvegardesRetirees' => Sauvegarde::nettoyer($dossier)];

$courrier = new CourrierPhp($config['expediteur'] ?? 'Cadeaux <cadeaux@bsandoz.fr>');
$resultat += (new Menage($pdo, new Horloge(), $courrier))->lancer();
$resultat['rappels'] = (new Rappels($pdo, new Horloge(), $courrier))->envoyer();
$resultat['adresses'] = (new Identite($pdo, new Horloge(), $courrier, new Comptes($pdo, new Horloge()), $config['site'] ?? 'https://cadeaux.bsandoz.fr'))->appliquerChangementsEchus();
echo date('c') . ' ' . json_encode($resultat) . PHP_EOL;
