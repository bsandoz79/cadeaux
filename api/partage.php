<?php

declare(strict_types=1);

// Page /c/{code} et son image /c/{code}/apercu.png (réécrites ici par le .htaccess du site) : aperçu du lien dans
// Snapchat, WhatsApp, etc. Le visiteur reçoit la même application que d'habitude. Voir src/Apercu.php.
require __DIR__ . '/vendor/autoload.php';

use Cadeaux\Application;
use Cadeaux\Apercu;

$code = (string) ($_GET['code'] ?? '');
$image = isset($_GET['image']);
$modele = (string) @file_get_contents($GLOBALS['modeleIndex'] ?? dirname(__DIR__) . '/index.html'); // tests : index de dist

$g = null;
if (preg_match('/^[a-f0-9]{16}$/', $code) === 1 && is_file(__DIR__ . '/config.local.php')) {
    try {
        $g = (new Apercu(Application::base(__DIR__ . '/config.local.php')))->donnees($code);
    } catch (Throwable $e) {
        error_log((string) $e);
    }
}

if ($image) {
    if ($g === null) {
        http_response_code(404);
        exit;
    }
    header('Content-Type: image/png');
    header('Cache-Control: public, max-age=600');
    echo Apercu::png($g);
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
header('X-Robots-Tag: noindex, nofollow'); // page d'une cagnotte privée : aperçu pour les messageries, jamais dans Google
if ($g === null) {
    http_response_code(404); // l'application affiche « Cagnotte introuvable »
    echo $modele;
    exit;
}
$site = 'https://' . preg_replace('/[^a-z0-9.:\-]/i', '', (string) ($_SERVER['HTTP_HOST'] ?? 'cadeaux.bsandoz.fr'));
echo Apercu::html($modele, $g, $site);
