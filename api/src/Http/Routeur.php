<?php

declare(strict_types=1);

namespace Cadeaux\Http;

/** Associe « MÉTHODE /chemin/{param} » à une action. */
final class Routeur
{
    /** @var list<array{string, string, \Closure}> */
    private array $routes = [];

    public function ajouter(string $methode, string $motif, \Closure $action): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[A-Za-z0-9_-]+)', $motif) . '$#';
        $this->routes[] = [$methode, $regex, $action];
    }

    public function traiter(Requete $requete): Reponse
    {
        $cheminTrouve = false;
        foreach ($this->routes as [$methode, $regex, $action]) {
            if (preg_match($regex, $requete->chemin, $m) !== 1) {
                continue;
            }
            $cheminTrouve = true;
            if ($methode !== $requete->methode) {
                continue;
            }
            $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);

            return $action($requete, ...$params);
        }

        throw $cheminTrouve ? new ErreurHttp(405, 'Méthode non autorisée.') : ErreurHttp::introuvable();
    }
}
