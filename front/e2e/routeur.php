<?php

// Serveur des parcours (php -S) : comme le .htaccess en ligne, /api va à l'API, /c/{code} à la page d'aperçu,
// un fichier existant est servi tel quel, tout le reste reçoit l'application (index.html).
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$api = dirname(__DIR__, 2) . '/api';

if (str_starts_with($uri, '/api')) {
    require $api . '/index.php';

    return true;
}
if (preg_match('#^/c/([a-f0-9]{16})(/apercu\.png)?$#', $uri, $m) === 1) {
    $_GET['code'] = $m[1];
    if (!empty($m[2])) {
        $_GET['image'] = 1;
    }
    // partage.php lit index.html à côté du dossier api en ligne ; ici, celui de dist.
    $GLOBALS['modeleIndex'] = $_SERVER['DOCUMENT_ROOT'] . '/index.html';
    require $api . '/partage.php';

    return true;
}
if ($uri !== '/' && is_file($_SERVER['DOCUMENT_ROOT'] . $uri)) {
    return false;
}
header('Content-Type: text/html; charset=utf-8');
readfile($_SERVER['DOCUMENT_ROOT'] . '/index.html');

return true;
