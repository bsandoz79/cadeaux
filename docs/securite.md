# Sécurité

## En place

| Sujet | Mesure | Où |
|---|---|---|
| Mots de passe | `password_hash` (algorithme par défaut de PHP), 8 caractères au moins, réhachage automatique | `api/src/Comptes.php` |
| Connexion | Jeton aléatoire de 256 bits ; seule son empreinte SHA-256 est stockée ; envoyé dans l'en-tête `Authorization` (pas de cookie, donc pas de CSRF) | `Comptes.php`, `Http/Requete.php` |
| Force brute | 5 essais ratés en 15 minutes par adresse ou par IP, puis refus (429) ; les essais sont effacés après 15 minutes | `Comptes.php`, `Limiteur.php` |
| Durée des connexions | Une connexion inutilisée pendant 90 jours expire et son jeton est effacé ; chaque visite la prolonge | `Comptes.php` |
| Cloisonnement | Chaque lecture, modification et suppression filtre sur le compte connecté ; une référence vers l'élément d'un autre compte est refusée | `api/src/Collection.php` |
| Entrées | Validation par champ (type, longueur, date réelle, montant, liste de choix, URL `http(s)` seulement) ; requêtes préparées | `Collection.php`, `Cagnottes.php` |
| Cagnotte partagée | Code aléatoire de 64 bits dans le lien ; clé de 256 bits par participation (empreinte stockée) pour modifier sa part ; cagnotte terminée = plus de participation | `Cagnottes.php` |
| Abus du lien partagé | 10 parts par adresse IP et par quart d'heure, 100 parts au plus par cagnotte | `Cagnottes.php`, `Limiteur.php` |
| Évolution de la base | Tables et colonnes ajoutées automatiquement au premier appel après une mise à jour (version du schéma) | `Schema.php` |
| Erreurs | Message générique au navigateur, détail dans le journal du serveur | `Application.php` |
| Fichiers du serveur | `.htaccess` de l'API : code, dépendances, tests et configuration inaccessibles ; listes de dossiers coupées | `api/.htaccess` |
| Tâche planifiée | `bin/menage.php` refuse de s'exécuter hors ligne de commande, dossier `bin` inaccessible par le web ; e-mails sans en-tête injectable | `bin/menage.php`, `CourrierPhp.php` |
| Secrets | `config.local.php` jamais versionné, écrit au déploiement depuis les secrets GitHub | `.github/workflows/deploy.yml` |
| En-têtes | `nosniff`, `Referrer-Policy`, `Cache-Control: no-store` sur l'API, HTTPS imposé | `front/public/.htaccess`, `Http/Reponse.php` |

## Extension Chrome : permissions

| Permission | Pourquoi |
|---|---|
| `activeTab` + `scripting` | Lire le produit de l'onglet ouvert, **seulement** quand l'utilisateur clique sur l'icône. |
| `storage` | Garder le jeton de connexion dans l'extension (jamais dans la page visitée). |
| `https://cadeaux.bsandoz.fr/*` | Appeler l'API. |

## Points à traiter
- Politique de sécurité du contenu (en-tête CSP) sur le site.
