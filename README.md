# Cadeaux

https://cadeaux.bsandoz.fr

Notez les cadeaux de Noël, d'anniversaire et des autres fêtes, voyez ce qu'ils coûtent dans l'année et organisez un cadeau commun avec une cagnotte partagée par lien.

- **Occasions** : Noël, anniversaires, fête des mères… Pour chaque occasion, qui reçoit quoi, le budget prévu et ce qui a été dépensé. Pour Noël, on peut reprendre les personnes et les montants de l'année précédente.
- **Proches** : avec leur date de naissance, les anniversaires des deux prochains mois s'affichent sur l'accueil.
- **Bilan de l'année** : total, déjà dépensé, encore prévu, part des cagnottes ; détail par occasion et par personne ; comparaison avec l'année d'avant.
- **Idées** : notées sur le site ou avec l'extension Chrome, puis rattachées à une occasion.
- **Cagnottes** : parts égales (150 € à 7 : six parts de 21,43 € et une de 21,42 €) ou parts libres que l'organisateur complète. Les participants ajoutent leur part depuis le lien, sans compte. Le site note les montants ; l'argent ne passe pas par lui.
- **Extension Chrome** : sur la page d'un produit, un clic l'ajoute aux idées avec son nom, son prix et sa photo.

## Organisation

| Dossier | Contenu |
|---|---|
| `front/` | Site React 19, Vite, TypeScript. Calculs (argent, cagnotte, bilan, anniversaires) dans `src/calculs/`, testés. |
| `api/` | API PHP 8.2+ sans framework, PDO (MySQL en ligne, SQLite pour les tests), PHPUnit. |
| `extension/` | Extension Chrome (Manifest V3), sans dépendance. |
| `docs/` | Journal des modifications, mise en ligne. |

## Commandes

```sh
# Site
cd front && npm install
npm run lint && npm run test && npm run build

# API
cd api && composer install
composer test
```

Pour essayer l'API en local, copier `api/config.local.php.dist` en `api/config.local.php` avec une base SQLite (`'dsn' => 'sqlite:/chemin/cadeaux.sqlite'`) : les tables sont créées au premier appel.

## Sécurité

- Mots de passe hachés (`password_hash`), jetons de connexion aléatoires dont seule l'empreinte SHA-256 est gardée.
- Connexion bloquée 15 minutes après 5 essais ratés (par adresse et par adresse IP).
- Chaque requête vérifie que l'élément appartient au compte connecté.
- Cagnotte : lien avec un code aléatoire de 16 caractères ; chaque participant reçoit une clé pour modifier ou retirer sa propre part.
- Aucun secret dans le dépôt : `api/config.local.php` est écrit au déploiement à partir des secrets GitHub.

Mise en ligne : voir [docs/mise-en-ligne.md](docs/mise-en-ligne.md).
