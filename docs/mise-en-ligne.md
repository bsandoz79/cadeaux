# Mise en ligne sur o2switch

Le site se met en ligne tout seul à chaque envoi sur `main` (GitHub Actions, `.github/workflows/deploy.yml`) : tests, construction, puis envoi en FTPS.

## Une seule fois

### 1. Dans cPanel (o2switch)

1. **Sous-domaine** : `cadeaux.bsandoz.fr`, dossier `cadeaux.bsandoz.fr`.
2. **Compte FTP** : par exemple `cadeaux@bsandoz.fr`, avec comme dossier **exactement** celui du sous-domaine (`cadeaux.bsandoz.fr`).
3. **Base de données** (« Bases de données MySQL ») :
   - créer une base, par exemple `saba3655_cadeaux` ;
   - créer un utilisateur avec un mot de passe solide ;
   - ajouter l'utilisateur à la base avec **tous les privilèges**.
4. **Version de PHP** (« Sélectionner une version de PHP ») : 8.2 ou plus récent.
5. **HTTPS** : le certificat Let's Encrypt du sous-domaine (« SSL/TLS Status », lancer AutoSSL si besoin).

### 2. Sur GitHub

Dépôt `bsandoz79/cadeaux` → Settings → Secrets and variables → Actions → onglet **Secrets** :

| Secret | Valeur |
|---|---|
| `FTP_USERNAME` | le compte FTP (ex. `cadeaux@bsandoz.fr`) |
| `FTP_PASSWORD` | son mot de passe |
| `DB_NAME` | le nom complet de la base (ex. `saba3655_cadeaux`) |
| `DB_USER` | le nom complet de l'utilisateur de la base |
| `DB_PASSWORD` | son mot de passe |

`FTP_SERVER` (par défaut `muguet.o2switch.net`) et `FTP_DIR` (par défaut la racine du compte FTP) sont facultatifs.

### 3. Tâche planifiée (sauvegarde, comptes inactifs, rappels)

cPanel → « Tâches Cron » → ajouter une tâche **une fois par jour** (par exemple à 4 h) avec la commande :

```
php /home/<compte>/cadeaux.bsandoz.fr/api/bin/menage.php
```

(`<compte>` : l'identifiant cPanel, visible dans le gestionnaire de fichiers.) Elle fait d'abord une copie de la base dans `/home/<compte>/sauvegardes-cadeaux/` (14 jours gardés, voir [sauvegardes.md](sauvegardes.md)), puis avertit par e-mail les comptes sans activité depuis presque 3 ans, supprime 30 jours plus tard ceux qui ne sont pas revenus, et efface les connexions expirées.

Les e-mails partent de `cadeaux@bsandoz.fr` : créer cette adresse (ou une redirection) dans cPanel → « Comptes de messagerie » pour recevoir les éventuelles réponses.

Pour qu'ils n'arrivent pas dans les indésirables, le domaine doit avoir des enregistrements **SPF**, **DKIM** et **DMARC** : cPanel → « Délivrabilité des e-mails » → « Réparer » sur bsandoz.fr. Vérification le 17/11/2026 : DKIM et DMARC présents, **SPF absent**. Test : « Mon compte » → « M'envoyer un e-mail de test ».

### 4. Premier envoi

Envoyer sur `main` (ou relancer le workflow dans l'onglet Actions). Les tables de la base sont créées au premier appel de l'API, sans rien lancer sur le serveur.

## Ce qui est envoyé

- `front/dist/` à la racine du sous-domaine (site, `.htaccess`, archive de l'extension `extension-cadeaux.zip`) ;
- `api/` dans `api/` (code, dépendances de production, `config.local.php` écrit avec les secrets). Son `.htaccess` interdit l'accès au code, aux dépendances et à la configuration.

## Extension Chrome

En attendant une publication sur le Chrome Web Store (compte développeur Google, frais d'inscription uniques), l'extension s'installe depuis l'archive du site : page « Mon compte », puis `chrome://extensions` → Mode développeur → « Charger l'extension non empaquetée ».

## Connexion avec Google (facultatif)

Sans ces réglages, le site marche normalement et le bouton « Continuer avec Google » n'apparaît pas.

1. https://console.cloud.google.com → créer un projet (par exemple « Cadeaux »).
2. « API et services » → « Écran de consentement OAuth » : type **Externe**, nom « Cadeaux », adresse d'assistance, logo facultatif ; domaine autorisé `bsandoz.fr` ; liens vers https://cadeaux.bsandoz.fr/confidentialite et https://cadeaux.bsandoz.fr/mentions-legales. Champs d'accès : `openid`, `email`, `profile` (pas de validation Google nécessaire pour ceux-là). Puis **Publier l'application** (sinon seuls les comptes de test peuvent se connecter).
3. « Identifiants » → « Créer des identifiants » → **ID client OAuth** → type **Application Web** :
   - origine JavaScript autorisée : `https://cadeaux.bsandoz.fr` ;
   - URI de redirection autorisé : `https://cadeaux.bsandoz.fr/api/google/retour` (exactement).
4. Copier l'**ID client** et le **code secret** dans deux secrets GitHub : `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`, puis relancer le déploiement (Actions → « Déploiement o2switch » → Run workflow).
