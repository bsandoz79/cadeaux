# RGPD : registre des traitements

Responsable du traitement : Baptiste Sandoz, éditeur de cadeaux.bsandoz.fr. Contact : contact@bsandoz.fr.
Textes publiés : `front/src/donnees/legal.ts` (pages /confidentialite et /mentions-legales), à mettre à jour avec ce registre.
Hébergement : o2switch (France).

## Données traitées

| Donnée | Personnes concernées | Finalité | Base légale | Conservation | Qui y accède |
|---|---|---|---|---|---|
| E-mail, prénom, mot de passe haché | Utilisateur | Compte et connexion | Contrat (conditions d'utilisation) | Jusqu'à la suppression du compte, au plus 3 ans sans activité | L'utilisateur |
| Liens envoyés par e-mail (confirmation d'adresse, nouveau mot de passe, changement d'adresse) : empreinte, nouvelle adresse demandée ; adresse confirmée ou non | Utilisateur | Vérifier l'adresse, retrouver l'accès au compte | Contrat | Jusqu'à leur utilisation, au plus 7 jours (1 heure pour le mot de passe, 24 heures pour l'adresse) | Personne (empreinte seulement) |
| Empreinte d'un identifiant d'appareil (tiré au hasard par le navigateur), date de dernière connexion | Utilisateur | Prévenir d'une connexion depuis un nouvel appareil | Intérêt légitime (sécurité du compte) | Jusqu'au blocage ou à la suppression du compte | Personne (empreinte seulement). Le navigateur décrit (« Chrome sur Windows ») n'est écrit que dans l'e-mail, jamais gardé |
| Changement d'adresse en attente (nouvelle adresse, date de la demande) | Utilisateur | Laisser 48 h au vrai propriétaire pour refuser | Intérêt légitime (sécurité) | Jusqu'au changement ou à l'annulation | Personne |
| Empreinte des jetons de connexion, date de dernière utilisation | Utilisateur | Rester connecté | Contrat | 90 jours sans utilisation, ou jusqu'à la déconnexion | Personne (empreinte seulement) |
| Réglage des rappels ; rappels déjà envoyés (clé, date) | Utilisateur | Rappels par e-mail (anniversaire à J-7, cagnotte incomplète à J-2), seulement à une adresse confirmée | Consentement (case à cocher à l'inscription, non cochée ; modifiable dans « Mon compte ») | Comme le compte | Personne |
| Date de dernière activité du compte | Utilisateur | Supprimer les comptes inactifs | Intérêt légitime (minimisation) | Comme le compte | Personne |
| Adresse IP et adresse e-mail des essais de connexion ratés ; adresse IP des parts et réservations ajoutées par lien | Utilisateur, tiers | Sécurité (force brute, abus) | Intérêt légitime | 15 minutes | Personne |
| Proches : prénom ou surnom, date de naissance, note, groupes (Famille, Amis…), lien de parenté | Tiers (famille, amis) | Organiser ses cadeaux | Intérêt légitime de l'utilisateur, usage privé | Jusqu'à la suppression du proche ou du compte | L'utilisateur seul |
| Occasions, cadeaux et budgets par proche (montants, liens, notes) | Utilisateur, tiers | Suivre ses cadeaux et son budget | Contrat | Jusqu'à la suppression ou celle du compte | L'utilisateur seul |
| Cagnotte : titre, bénéficiaire, objectif, message | Utilisateur, bénéficiaire | Cadeau commun | Contrat | Jusqu'à la suppression ou celle du compte | L'organisateur, et quiconque a le lien |
| RIB de l'organisateur : titulaire, IBAN (chiffré) | Utilisateur | Recevoir les parts par virement | Consentement (ajout volontaire) | Effacé à la fin de la cagnotte, quand toutes les parts sont payées, et au plus tard 60 jours après l'ajout (tâche quotidienne) ; supprimable à tout moment | Ceux qui ont le lien et le demandent (« Afficher le RIB »), avec une limite par IP ; l'organisateur ne revoit qu'une version masquée |
| Participation : prénom saisi, montant | Participants (sans compte) | Cadeau commun | Consentement (saisie volontaire) | Jusqu'à son retrait ou la suppression de la cagnotte | L'organisateur, et quiconque a le lien |
| Association d'une fiche de proche au compte de la personne : lien entre les deux, invitations (empreinte, 30 jours), invitations aux cagnottes, réservations faites depuis une fiche | Utilisateur, proche ayant un compte | Partager la liste d'envies, la date d'anniversaire et les cagnottes entre proches | Consentement de la personne associée (elle accepte l'invitation, peut retirer l'association à tout moment) | Jusqu'au retrait de l'association ou la suppression de l'un des comptes | L'utilisateur et la personne associée |
| Date de naissance du compte (facultative) | Utilisateur | Rappeler son anniversaire aux proches associés | Consentement (saisie volontaire) | Jusqu'à son effacement ou la suppression du compte | Les proches associés |
| Liste d'envies : envies (titre, prix, lien, photo, précision), lien de partage, petit mot | Utilisateur | Partager ce qui lui ferait plaisir | Contrat | Jusqu'à la suppression ou celle du compte ; le lien jusqu'à ce qu'il soit coupé | Quiconque a le lien |
| Réservation d'une envie : prénom saisi (ou prénom du compte et code de la cagnotte pour « On se cotise ») | Proches (sans compte) | Éviter les doublons de cadeaux | Consentement (saisie volontaire) | Jusqu'à son annulation, ou la suppression de l'envie, de la liste ou du compte | Ceux qui ont le lien, **jamais le propriétaire** (ni à l'écran, ni dans son export) |
| Produit lu par l'extension (nom, prix, photo, adresse) | Utilisateur | Noter une idée de cadeau ou une envie | Action volontaire | Comme les cadeaux | L'utilisateur seul |
| Connexion avec Google (si choisie) : identifiant Google du compte ; pendant la connexion, empreintes de l'état et de la preuve, vérificateur PKCE | Utilisateur | Se connecter sans mot de passe | Contrat (choix de l'utilisateur) | Identifiant : comme le compte ; données de connexion : 10 minutes au plus | Personne. Google ne reçoit rien du site hors du moment où l'utilisateur clique : aucun script Google n'est chargé |
| Copies quotidiennes de toute la base (RIB toujours chiffrés) | Tous | Retrouver les données après une panne ou une erreur | Intérêt légitime (sécurité et disponibilité) | 14 jours : une donnée supprimée disparaît des copies au plus tard 14 jours après | Personne : dossier hors du site, lisible par le seul compte d'hébergement ; restauration décrite dans `docs/sauvegardes.md` |
| Derniers produits regardés sur amazon.fr (nom, prix, photo, adresse) | Utilisateur | Les proposer après une commande (« C'est un cadeau ? ») | Consentement (option à activer, autorisation Chrome) | Dans le navigateur seulement : 10 produits, 7 jours au plus ; effacés à la désactivation. Jamais envoyés sans clic sur « Noter le cadeau » | L'utilisateur seul |

## Ce qui est en place
- Pages « Politique de confidentialité » et « Mentions légales », visibles sans compte, liées depuis le pied de page, l'inscription, la page de cagnotte et l'extension.
- Page de cagnotte : les participants sont informés que leur prénom et leur part sont visibles par ceux qui ont le lien, et comment les retirer.
- Aucun cookie, aucun traceur, aucune mesure d'audience, aucun service tiers : rien qui demande un bandeau de consentement. Le jeton de connexion est gardé dans le navigateur (strictement nécessaire).
- Suppression du compte par l'utilisateur, qui efface toutes ses données et ses cagnottes.
- Comptes inactifs : e-mail d'avertissement après près de 3 ans sans activité, suppression complète 30 jours plus tard si l'utilisateur ne revient pas (tâche quotidienne `api/bin/menage.php`).
- Export de toutes les données du compte en un fichier JSON (« Mon compte », droit d'accès et de portabilité).
- Participants à une cagnotte : prénom seulement, pas de compte, part modifiable et retirable par eux.
- Pas de paiement : aucune donnée bancaire.

## Points à traiter
- Aucun pour l'instant. (Adresse de l'hébergeur complétée le 18/11/2026 d'après les conditions générales de vente d'o2switch.)
