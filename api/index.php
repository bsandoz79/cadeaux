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

try {
    $application = Application::depuisConfig($config);
} catch (PDOException $e) {
    // Base injoignable (identifiants, droits, serveur) : message clair au navigateur, détail dans le journal du serveur.
    error_log('Cadeaux, connexion à la base : ' . $e->getMessage());
    (new Reponse(503, ['message' => 'La base de données ne répond pas. Réessayez dans un instant.', 'code' => 'base']))->envoyer();
    exit;
}

$application->traiter(Requete::depuisGlobales())->envoyer();
