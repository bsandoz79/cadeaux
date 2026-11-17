# Journal des modifications

## [Non publié]

### Ajouté
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
