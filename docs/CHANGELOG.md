# Journal des modifications

## [Non publié]

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
