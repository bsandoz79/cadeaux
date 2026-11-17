<?php

declare(strict_types=1);

// Point d'entrée de l'API : https://cadeaux.bsandoz.fr/api/…
require __DIR__ . '/vendor/autoload.php';

use Cadeaux\Application;
use Cadeaux\Http\Reponse;
use Cadeaux\Http\Requete;

$config = __DIR__ . '/config.local.php';
if (!is_file($config)) {
    (new Reponse(503, ['message' => 'Le service n’est pas encore configuré.']))->envoyer();
    exit;
}

Application::depuisConfig($config)->traiter(Requete::depuisGlobales())->envoyer();
