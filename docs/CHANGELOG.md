# Journal des modifications

## [Non publié]

### Ajouté (rappels)
- Rappels par e-mail, au plus un par jour : anniversaire d'un proche dans 7 jours (âge, budget, ce qui est prévu), cagnotte incomplète 2 jours avant sa date limite. Désactivables dans « Mon compte ». Envoyés par la tâche quotidienne `api/bin/menage.php`.

### Sécurité
- En-tête CSP sur le site (seul le code du site s'exécute, pas d'affichage dans un cadre) et sur l'API ; `X-Frame-Options` et `Permissions-Policy`.

### Tests
- Tests d'écrans (`front/src/App.test.tsx`, fausse API `front/src/test/fausseApi.ts`) : inscription, pages légales sans compte, « déjà offert » et budget dépassé, montant mal écrit refusé sans appel au serveur, part de cagnotte par lien, réservation d'envie et vue du propriétaire.

### Corrigé (accessibilité)
- Le nom d'un champ ne contient plus son texte d'aide (« Mot de passe », et non « Mot de passe Au moins 8 caractères. ») : l'aide et l'erreur sont lues après, reliées par `aria-describedby`.

### Modifié (code)
- Chargement des pages regroupé dans un seul outil (`useChargement`) : réponses arrivées trop tard ignorées, plus aucun avertissement du lint.

### Ajouté
- Cadeau payé à plusieurs : un cadeau peut être rattaché à une cagnotte (« Payé à plusieurs avec une cagnotte ») ; il coûte alors la part de l'organisateur, comptée au nom du proche et de l'occasion, sans double compte dans le bilan. L'extension rattache automatiquement le cadeau à la cagnotte qu'elle crée.
- Extension : option « Après mes achats sur Amazon, me demander « C'est un cadeau ? » » (autorisation demandée à l'activation) : le produit commandé est noté acheté pour le proche choisi, puis cagnotte proposée avec envoi par WhatsApp ou SMS. Choix « pour moi » qui ajoute à la liste d'envies. Voir `docs/fonctionnalites/extension-achat-amazon.md`.
- Liste d'envies partagée par lien : les proches réservent « Je m'en occupe » sans compte, les autres voient que c'est pris, le propriétaire ne voit jamais les réservations. Voir `docs/fonctionnalites/liste-envies.md`.
- « Déjà offert » : dans le formulaire d'un cadeau, ce qui a déjà été offert au proche choisi, et un avertissement si le cadeau ressemble à un ancien. Voir `docs/fonctionnalites/deja-offert.md`.
- Budget par personne et par occasion : barre « il reste » ou « dépassé de », total des budgets, proches avec un budget mais sans cadeau encore, reprise des budgets de l'an dernier. Voir `docs/fonctionnalites/budget-par-personne.md`.

### Ajouté (RGPD)
- Pages « Politique de confidentialité » et « Mentions légales », accessibles sans compte, liées depuis le pied de page, l'inscription, la page de cagnotte et l'extension.
- Page de cagnotte : information sur la visibilité du prénom et de la part de chaque participant.

### Ajouté (RGPD)
- Comptes inactifs : e-mail d'avertissement après près de 3 ans sans activité, puis suppression du compte et de toutes ses données 30 jours plus tard si l'utilisateur ne revient pas. Tâche quotidienne `api/bin/menage.php`, qui efface aussi les connexions expirées.

### Ajouté (RGPD)
- « Télécharger mes données » dans Mon compte : un fichier JSON avec le compte, les proches, les occasions, les cadeaux et les cagnottes avec leurs participations.

### Sécurité
- Une connexion inutilisée pendant 90 jours expire ; chaque visite la prolonge et note la dernière activité du compte.
- Lien de cagnotte protégé contre les abus : 10 parts par adresse IP et par quart d'heure, 100 parts au plus par cagnotte.
- Mise à jour automatique d'une base déjà en ligne (colonnes ajoutées au premier appel).

### Documentation
- Sécurité (`docs/securite.md`) : mesures en place, permissions de l'extension, points à traiter.
- RGPD (`docs/rgpd.md`) : registre des traitements (données, finalité, base légale, conservation, accès) et points à traiter.

### Ajouté
- Comptes : inscription, connexion, déconnexion, suppression du compte et de toutes ses données. Connexion bloquée 15 minutes après 5 essais ratés.
- Proches, avec date de naissance et note. Anniversaires des deux prochains mois sur l'accueil, avec un bouton « Préparer » qui crée l'occasion.
- Occasions (Noël, anniversaire, fête des mères, des pères, Saint-Valentin, mariage, naissance, autre), avec nom et date proposés. Cadeaux par personne : budget prévu, montant dépensé, statut (idée, prévu, acheté, offert), lien, note. Reprise des personnes et montants de la même occasion l'année précédente.
- Bilan de l'année : total, déjà dépensé, encore prévu, part des cagnottes ; détail par occasion et par personne ; comparaison avec l'année d'avant.
- Idées de cadeaux sans occasion, à rattacher plus tard.
- Cagnottes communes : parts égales au centime près ou parts libres, lien partagé sans compte, clé personnelle pour modifier ou retirer sa part, parts marquées payées par l'organisateur, « Je complète le reste », cagnotte terminée ou rouverte.
- Extension Chrome : lit le nom, le prix et la photo du produit de la page (données schema.org, Open Graph, microdonnées, fiches Amazon) et l'ajoute aux idées ou à une occasion.
- Déploiement continu sur o2switch (FTPS) avec tests de l'API et du site.
