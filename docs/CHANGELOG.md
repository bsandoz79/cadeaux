# Journal des modifications

## [Non publié]

### Ajouté (connexion avec Google)
- « Continuer avec Google » sur l'écran d'accueil : création de compte ou connexion en un clic, compte existant de la même adresse relié sans doublon, retour à la liste d'envies, la cagnotte ou l'invitation de départ. Sans script de Google sur le site (OAuth côté serveur, PKCE). Activé quand les secrets `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` sont posés.

### Ajouté (référencement)
- Quatre pages de guide lisibles par Google sans JavaScript : cagnotte pour un cadeau commun, liste de Noël à partager, budget cadeaux, rappels d'anniversaire ; liées depuis le pied de page.
- Plan du site (`/sitemap.xml`), `robots.txt`, aperçu et fiche « application web gratuite » sur l'accueil.
- Pages privées (compte, cagnottes, listes d'envies, liens reçus par e-mail) exclues de Google (`noindex`). Procédure Search Console dans `docs/referencement.md`.

### Corrigé
- Mentions légales : identité et adresse complètes de l'hébergeur o2switch (relevées sur o2switch.fr/cgv).

### Ajouté (sauvegardes)
- Copie de toute la base chaque nuit, avant le ménage, dans `sauvegardes-cadeaux` hors du dossier du site ; les 14 dernières sont gardées. Une copie coupée en route ne remplace jamais celle de la veille.
- `api/bin/restaurer.php` : recharge une copie dans une base vide (MySQL ou SQLite, pour vérifier une copie sur son ordinateur). Procédure dans `docs/sauvegardes.md`.

### Tests
- Parcours dans un vrai navigateur (Playwright), sur téléphone et sur ordinateur, à chaque envoi avant la mise en ligne : famille et Noël jusqu'au bilan, cagnotte (part d'un ami, aperçu du lien, « Je complète »), liste d'envies (réservation cachée au propriétaire), association de comptes depuis une invitation, pages publiques. Un parcours qui échoue bloque la mise en ligne. En local : `npm run e2e` après `npm run build`.

### Performances
- Pages chargées à la demande : le premier chargement passe de 361 à 243 Ko (106 à 77 Ko compressés), chaque autre page se télécharge quand on l'ouvre (3 à 9 Ko).
- Appli installée : les fichiers sont nettoyés seulement à l'arrivée d'une nouvelle version, pour garder hors ligne les pages déjà ouvertes.

### Ajouté
- « Bien démarrer » sur l'accueil d'un nouveau compte : ajouter sa famille, sa date de naissance, sa première occasion ; les étapes se cochent seules et l'encadré peut être masqué.

### Ajouté
- Recherche (loupe dans l'en-tête, page `/recherche`) : proches, cadeaux, occasions, cagnottes et envies, sans tenir compte des accents ni des majuscules ; plusieurs mots possibles (« noël maman »).

### Modifié (proches)
- Une page par proche (`/proches/<id>`) : chiffres de l'année et de tout ce qui lui a été offert, « Un cadeau pour… » avec le choix de l'occasion, cadeaux prévus, cadeaux déjà offerts, son compte associé et sa liste d'envies, modification et retrait. La liste des proches ne garde que l'essentiel (lien de parenté, groupes, anniversaire, montant de l'année) et mène à la fiche ; depuis l'arbre, lien « Voir la fiche ».

### Ajouté
- Dates de la fête des mères (dernier dimanche de mai, premier de juin si c'est la Pentecôte) et de la fête des pères (troisième dimanche de juin) calculées : proposées à la création d'une occasion et dans l'arbre de famille.

### Ajouté (association de comptes)
- Associer la fiche d'un proche à son vrai compte, avec son accord : lien d'invitation (30 jours) envoyé par WhatsApp, Snap ou SMS ; la personne accepte ou refuse, et peut retirer l'association dans « Mon compte ».
- Une fois associé : sa liste d'envies sur sa fiche, réservable en un clic (il ou elle ne voit jamais qui réserve) ; sa date de naissance (facultative, dans « Mon compte ») reprise par la fiche ; invitation directe aux cagnottes (« On vous invite » dans Cagnottes, e-mail).

### Ajouté (famille)
- Arbre de famille : lien de parenté pour les membres d'un groupe « Famille » (Papa, Maman, Papi et Mamie de chaque côté, Tonton, Tata, Frère, Sœur, Cousin, Fils, Neveu, Parrain…), vue « Arbre » par génération (côté papa à gauche, côté maman à droite), places vides à compléter en un clic.
- Un clic sur un membre propose l'occasion : son anniversaire, Noël, pour le plaisir, une réussite (promotion, diplôme…), la fête des mères ou des pères (parents, grands-parents), ou une autre ; l'occasion est créée ou retrouvée et le cadeau s'ajoute pour lui.
- Nouveaux types d'occasion : « Pour le plaisir » et « Réussite (promotion, diplôme…) ».

### Ajouté (groupes)
- Groupes de proches (Famille, Amis, Collègues…) : un proche peut être dans plusieurs groupes. Proches filtrés par groupe, gestion des groupes (créer, renommer, supprimer), bilan de l'année par groupe.

### Ajouté (proches)
- Proches : « Cadeau d'anniversaire » pour chaque proche qui a une date de naissance (occasion de son prochain anniversaire créée ou retrouvée, formulaire ouvert pour lui) ; « Ajouter un cadeau » pour les autres.

### Sécurité
- Changement de mot de passe depuis « Mon compte » appliqué seulement après un clic sur le lien envoyé à l'adresse du compte (1 heure) ; toutes les connexions sont ensuite fermées.

### Sécurité (vol de compte)
- Changement d'adresse appliqué 48 heures après la demande ; l'ancienne adresse reçoit « Ce n'est pas moi ».
- « Ce n'est pas moi » (changement d'adresse, mot de passe changé, RIB ajouté, connexion depuis un nouvel appareil) : connexions fermées, compte bloqué jusqu'à un nouveau mot de passe, RIB effacés, changement d'adresse annulé.
- RIB : mot de passe demandé, refusé 48 heures après un changement de mot de passe ou d'adresse, e-mail à chaque ajout ; avertissement aux participants si le RIB a moins de 48 heures.
- E-mail à chaque connexion depuis un nouvel appareil (navigateur et heure).

### Corrigé (e-mails)
- Expéditeur technique des e-mails (enveloppe) aligné sur `cadeaux@bsandoz.fr`, en-têtes `Reply-To` et `Date` : SPF et DMARC vérifient le même domaine, les e-mails ne sont plus refusés ou classés en indésirables pour cette raison.

### Corrigé
- Un envoi d'e-mail en échec n'ajoute plus d'avertissement PHP dans la réponse de l'API (l'inscription restait cassée côté navigateur).

### Ajouté
- « M'envoyer un e-mail de test » dans Mon compte (3 par quart d'heure).

### Modifié (appli)
- L'appli installée efface d'elle-même les fichiers des anciennes versions du site à chaque mise à jour.

### Ajouté (compte)
- Confirmation de l'adresse e-mail à l'inscription (lien valable 7 jours, « Renvoyer l'e-mail » sur l'accueil) ; les rappels ne partent qu'à une adresse confirmée.
- Mot de passe oublié : lien valable 1 heure, toutes les connexions fermées après le changement.
- Mon compte : changer de prénom, de mot de passe (autres appareils déconnectés) et d'adresse (lien envoyé à la nouvelle, ancienne prévenue).
- Rappels par e-mail choisis à l'inscription (case non cochée par défaut).

### Ajouté (cagnottes)
- RIB de l'organisateur pour recevoir les parts par virement : IBAN vérifié et chiffré, affiché aux participants seulement sur demande (« Afficher le RIB », IBAN à copier, libellé conseillé), supprimé dès que la cagnotte est terminée ou que toutes les parts sont payées, et au plus tard 60 jours après.

### Ajouté (cagnottes)
- Aperçu du lien d'une cagnotte dans Snapchat, WhatsApp, Messenger… : titre « Cagnotte pour Julie : Montre », « 100 € sur 150 € · il manque 50 € », et une image avec le pourcentage, la barre d'avancement et les montants (dessinée en PHP, sans extension graphique). Les participants n'y figurent pas.

### Ajouté (cagnottes)
- Page d'une cagnotte : montants en un geste (part égale, 10, 20, 30 €, « Tout le reste », « Autre »).

### Modifié (partage)
- Partage d'une cagnotte en logos seuls (WhatsApp, Snapchat, SMS, Partager, Copier), nommés pour les lecteurs d'écran ; Snapchat ajouté (lien de partage officiel `snapchat.com/share?link=`), sur le site et dans l'extension.

### Ajouté (appli)
- Le site s'installe comme une appli sur le téléphone (manifeste, icônes, plein écran) : bouton « Installer l'appli » dans Mon compte sur Android et Chrome, explication pour iPhone. L'écran s'ouvre même sans réseau (dernière version connue), les données restent sur le serveur.

### Ajouté (cagnottes)
- « On se cotise » sur une liste d'envies : un proche connecté lance une cagnotte pour l'envie (prix repris, ou demandé), l'envie est réservée au nom du groupe, les autres voient « Cagnotte lancée par Léa · Participer » ; le propriétaire ne voit toujours rien. Sans compte, invitation à se connecter puis retour sur la liste.
- Envoi du lien d'une cagnotte par WhatsApp, SMS, menu de partage ou copie, sur la page de la cagnotte et après « On se cotise ».

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
