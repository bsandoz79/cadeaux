# RGPD : registre des traitements

Responsable du traitement : Baptiste Sandoz, éditeur de cadeaux.bsandoz.fr. Contact : contact@bsandoz.fr.
Textes publiés : `front/src/donnees/legal.ts` (pages /confidentialite et /mentions-legales), à mettre à jour avec ce registre.
Hébergement : o2switch (France).

## Données traitées

| Donnée | Personnes concernées | Finalité | Base légale | Conservation | Qui y accède |
|---|---|---|---|---|---|
| E-mail, prénom, mot de passe haché | Utilisateur | Compte et connexion | Contrat (conditions d'utilisation) | Jusqu'à la suppression du compte, au plus 3 ans sans activité | L'utilisateur |
| Empreinte des jetons de connexion, date de dernière utilisation | Utilisateur | Rester connecté | Contrat | 90 jours sans utilisation, ou jusqu'à la déconnexion | Personne (empreinte seulement) |
| Date de dernière activité du compte | Utilisateur | Supprimer les comptes inactifs | Intérêt légitime (minimisation) | Comme le compte | Personne |
| Adresse IP et adresse e-mail des essais de connexion ratés ; adresse IP des parts et réservations ajoutées par lien | Utilisateur, tiers | Sécurité (force brute, abus) | Intérêt légitime | 15 minutes | Personne |
| Proches : prénom ou surnom, date de naissance, note | Tiers (famille, amis) | Organiser ses cadeaux | Intérêt légitime de l'utilisateur, usage privé | Jusqu'à la suppression du proche ou du compte | L'utilisateur seul |
| Occasions, cadeaux et budgets par proche (montants, liens, notes) | Utilisateur, tiers | Suivre ses cadeaux et son budget | Contrat | Jusqu'à la suppression ou celle du compte | L'utilisateur seul |
| Cagnotte : titre, bénéficiaire, objectif, message | Utilisateur, bénéficiaire | Cadeau commun | Contrat | Jusqu'à la suppression ou celle du compte | L'organisateur, et quiconque a le lien |
| Participation : prénom saisi, montant | Participants (sans compte) | Cadeau commun | Consentement (saisie volontaire) | Jusqu'à son retrait ou la suppression de la cagnotte | L'organisateur, et quiconque a le lien |
| Liste d'envies : envies (titre, prix, lien, photo, précision), lien de partage, petit mot | Utilisateur | Partager ce qui lui ferait plaisir | Contrat | Jusqu'à la suppression ou celle du compte ; le lien jusqu'à ce qu'il soit coupé | Quiconque a le lien |
| Réservation d'une envie : prénom saisi | Proches (sans compte) | Éviter les doublons de cadeaux | Consentement (saisie volontaire) | Jusqu'à son annulation, ou la suppression de l'envie, de la liste ou du compte | Ceux qui ont le lien, **jamais le propriétaire** (ni à l'écran, ni dans son export) |
| Produit lu par l'extension (nom, prix, photo, adresse) | Utilisateur | Noter une idée de cadeau | Action volontaire | Comme les cadeaux | L'utilisateur seul |

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
- Mentions légales : adresse postale de l'hébergeur à vérifier sur le site d'o2switch.
