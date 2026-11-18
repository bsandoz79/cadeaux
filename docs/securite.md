# Sécurité

## En place

| Sujet | Mesure | Où |
|---|---|---|
| Mots de passe | `password_hash` (algorithme par défaut de PHP), 8 caractères au moins, réhachage automatique | `api/src/Comptes.php` |
| Connexion | Jeton aléatoire de 256 bits ; seule son empreinte SHA-256 est stockée ; envoyé dans l'en-tête `Authorization` (pas de cookie, donc pas de CSRF) | `Comptes.php`, `Http/Requete.php` |
| Force brute | 5 essais ratés en 15 minutes par adresse ou par IP, puis refus (429) ; les essais sont effacés après 15 minutes | `Comptes.php`, `Limiteur.php` |
| Vol de compte | Changement de mot de passe depuis « Mon compte » appliqué au clic sur un lien envoyé à l'adresse du compte (1 h ; nouveau mot de passe gardé haché dans le lien). Changement d'adresse appliqué 48 h après la demande (et après le lien de la nouvelle adresse), « Ce n'est pas moi » envoyé à l'ancienne. Mot de passe changé, RIB ajouté, connexion depuis un nouvel appareil : e-mail avec « Ce n'est pas moi ». Ce lien (7 jours, usage unique, bouton à cliquer pour ne pas être déclenché par les antivirus des messageries) ferme toutes les connexions, bloque le compte jusqu'à un nouveau mot de passe, efface les RIB des cagnottes et annule le changement d'adresse ; le lien de nouveau mot de passe part à la vraie adresse. Ajouter un RIB demande le mot de passe et est refusé 48 h après un changement de mot de passe ou d'adresse (423). Un RIB de moins de 48 h est signalé aux participants (« vérifiez auprès de l'organisateur avant de virer »). | `Identite.php`, `Ribs.php`, `Cagnottes.php` |
| Liens par e-mail | Confirmation d'adresse (7 jours), mot de passe oublié (1 heure), changement d'adresse (24 heures, lien envoyé à la nouvelle, ancienne prévenue) ; 256 bits, empreinte seule gardée, usage unique, un seul lien valable par type. « Mot de passe oublié » répond pareil que le compte existe ou non, limité à 5 demandes par IP et 3 par adresse par quart d'heure. Nouveau mot de passe = toutes les connexions fermées ; changement depuis « Mon compte » = mot de passe actuel demandé, autres appareils déconnectés | `Identite.php` |
| Durée des connexions | Une connexion inutilisée pendant 90 jours expire et son jeton est effacé ; chaque visite la prolonge | `Comptes.php` |
| Cloisonnement | Chaque lecture, modification et suppression filtre sur le compte connecté ; une référence vers l'élément d'un autre compte est refusée | `api/src/Collection.php` |
| Entrées | Validation par champ (type, longueur, date réelle, montant, liste de choix, URL `http(s)` seulement) ; requêtes préparées | `Collection.php`, `Cagnottes.php` |
| Cagnotte partagée | Code aléatoire de 64 bits dans le lien ; clé de 256 bits par participation (empreinte stockée) pour modifier sa part ; cagnotte terminée = plus de participation | `Cagnottes.php` |
| Abus du lien partagé | 10 parts par adresse IP et par quart d'heure, 100 parts au plus par cagnotte ; 20 réservations d'envies par IP et par quart d'heure | `Cagnottes.php`, `Envies.php`, `Limiteur.php` |
| Liste d'envies | Code aléatoire de 64 bits, lien coupable (nouveau code au prochain partage) ; une seule réservation par envie (contrainte d'unicité) ; clé de 256 bits pour annuler ; réservations jamais renvoyées au propriétaire, même connecté sur son propre lien | `Envies.php` |
| Évolution de la base | Tables et colonnes ajoutées automatiquement au premier appel après une mise à jour (version du schéma) | `Schema.php` |
| Erreurs | Message générique au navigateur, détail dans le journal du serveur | `Application.php` |
| Fichiers du serveur | `.htaccess` de l'API : code, dépendances, tests et configuration inaccessibles ; listes de dossiers coupées | `api/.htaccess` |
| Tâche planifiée | `bin/menage.php` refuse de s'exécuter hors ligne de commande, dossier `bin` inaccessible par le web ; e-mails sans en-tête injectable | `bin/menage.php`, `CourrierPhp.php` |
| Sauvegardes | Copie de la base chaque nuit avant le ménage, dans un dossier hors du site (droits 700, fichiers 600), 14 jours gardés ; fichier écrit sous un nom provisoire puis renommé une fois complet. Restauration seulement en ligne de commande, dans une base vide, copie complète vérifiée (sinon rien n'est écrit), noms de tables et de colonnes contrôlés | `Sauvegarde.php`, `bin/restaurer.php` |
| Moteurs de recherche | Pages privées (compte, cagnottes, listes d'envies, liens reçus par e-mail) marquées `noindex` (en-tête et balise), absentes du plan du site ; `/api/` interdit dans `robots.txt` | `front/public/.htaccess`, `api/partage.php`, `App.tsx` |
| Connexion Google | OAuth 2.0 côté serveur (code + PKCE S256 + état aléatoire de 256 bits, 10 min, 20 départs par IP et par quart d’heure), aucun script Google sur le site ; jeton d'identité reçu de Google en HTTPS puis contrôlé (destinataire, émetteur, expiration, adresse vérifiée) ; adresse de retour fixe et page de retour limitée à une liste ; code de session à usage unique (2 min) lié à une preuve gardée dans l'onglet (contre la connexion forcée par un lien volé) ; compte bloqué refusé ; e-mail « Nouvelle connexion » sur un nouvel appareil. Secret client dans les secrets GitHub | `ConnexionGoogle.php`, `GoogleHttp.php` |
| Secrets | `config.local.php` jamais versionné, écrit au déploiement depuis les secrets GitHub | `.github/workflows/deploy.yml` |
| En-têtes | `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, `Cache-Control: no-store` sur l'API, HTTPS imposé | `front/public/.htaccess`, `Http/Reponse.php` |
| Appli installée | `sw.js` ne garde que les fichiers du site (pages et `/assets/`), jamais les réponses de l'API ni les données ; servi sans cache pour que chaque mise à jour soit prise | `front/public/sw.js` |
| RIB des organisateurs | IBAN contrôlé (modulo 97), chiffré avec libsodium (secretbox) ; clé dans `api/var/cle-coffre` (créée au premier usage, droits 600, dossier inaccessible par le web, jamais envoyée par le déploiement). Renvoyé en entier seulement par `GET /c/{code}/rib` (30 fois par IP et par quart d'heure), jamais dans l'aperçu ni dans la page de la cagnotte. Effacé à la fin, au paiement complet, et après 60 jours. Si la clé est perdue, les RIB sont illisibles : il suffit de les ressaisir. | `Ribs.php`, `Coffre.php`, `Iban.php` |
| Aperçu des liens | `/c/{code}` est servi par `api/partage.php` : code vérifié (16 caractères hexadécimaux), textes échappés, seulement titre, bénéficiaire, objectif et total (pas les participants) ; image mise en cache 10 minutes | `api/partage.php`, `Apercu.php` |
| CSP | Site : seul le code du site s'exécute (`script-src 'self'`, aucun script en ligne), styles du site seulement (attributs `style` permis pour les barres), images en https, appels réseau vers le site seulement, pas d'affichage dans un cadre. API : `default-src 'none'`. Vérifié dans Chrome sur 11 pages : aucune violation. | `front/public/.htaccess`, `Http/Reponse.php` |

## Extension Chrome : permissions

| Permission | Pourquoi |
|---|---|
| `activeTab` + `scripting` | Lire le produit de l'onglet ouvert, **seulement** quand l'utilisateur clique sur l'icône. |
| `storage` | Garder le jeton de connexion dans l'extension (jamais dans la page visitée). |
| `https://cadeaux.bsandoz.fr/*` | Appeler l'API. |
| `https://www.amazon.fr/*` (**facultative**) | Demandée seulement quand l'utilisateur active « Après mes achats sur Amazon, me demander… ». Retirée quand il la désactive (ou clique « Ne plus me demander »). Le script `amazon.js` n'est ajouté qu'après cet accord. |
| Service de fond (`fond.js`) | Fait les appels à l'API pour l'encadré d'Amazon (une page ne peut pas l'appeler) ; n'accepte que les messages de l'extension elle-même et seulement 5 routes (`GET /personnes`, `GET /occasions`, `POST /cadeaux`, `PATCH /cadeaux/{id}`, `POST /cagnottes`). |
| Script sur le site (`site.js`, cadeaux.bsandoz.fr seulement) | Connexion de l'extension par le site (Google ou mot de passe) : répond à la page qu'il est là et transmet le code à usage unique (64 caractères hexadécimaux, 2 min) donné après le clic sur « Connecter l'extension ». Messages acceptés seulement de la page elle-même (même fenêtre, origine du site) ; le service de fond n'accepte ce code que d'un expéditeur dont l'origine est le site, et l'échange contre une connexion propre à l'extension (e-mail « Nouvelle connexion »). |
| Ressources accessibles (`produit.js`, `amazon-logique.js`) | Chargées par le script d'Amazon ; ne contiennent ni donnée ni secret. Leur présence révèle à amazon.fr que l'extension est installée. |

L'encadré d'Amazon vit dans un Shadow DOM fermé : la page ne peut pas le lire, et tout texte venant d'Amazon y est échappé avant affichage.

## Dépendances
- `composer audit` : aucune faille (17/11/2026).
- `npm audit` : faille « haute » dans `picomatch` (ReDoS, GHSA-fc5q-39xc-vjpf), utilisé seulement par les outils de construction et de test (Vite, Vitest), jamais envoyé aux visiteurs. La correction proposée ferait revenir Vitest à une ancienne version : risque accepté, à revérifier à chaque mise à jour des outils.

## Points à traiter
