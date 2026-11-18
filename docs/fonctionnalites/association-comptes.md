# Associer un proche à son compte

## Principe
L'utilisateur crée des fiches pour ses proches, avec ou sans compte. Si un proche a (ou crée) un compte, la fiche peut y être associée, **avec son accord**.

## Parcours
1. Fiche du proche → « Associer à son compte » : lien `/rejoindre/<jeton>` (30 jours, empreinte seule gardée), envoyé par WhatsApp, Snapchat, SMS, partage ou copie, avec un message tout prêt.
2. La personne ouvre le lien : ce que l'association permet est expliqué ; sans compte, « Me connecter ou créer mon compte » ramène sur l'invitation après connexion.
3. « Accepter » associe la fiche à son compte ; « Refuser » efface l'invitation. On ne peut pas accepter sa propre invitation.
4. Retrait à tout moment : par la personne (« Mon compte » → « Comptes associés ») ou par l'utilisateur (« Dissocier »). Supprimer l'un des comptes retire l'association.

## Ce que ça apporte
- **Sa liste d'envies** sur la fiche : réserver « Je m'en occupe » ou annuler ; la personne ne voit jamais les réservations.
- **Sa date de naissance**, si elle l'a mise dans « Mon compte » et que la fiche n'en a pas.
- **Invitations aux cagnottes** : page d'une cagnotte → « Inviter des proches » ; la cagnotte apparaît dans « On vous invite », et un e-mail part si l'adresse est confirmée.

## Tests
`api/tests/AssociationsTest.php` ; `front/src/App.test.tsx` (« association de comptes »).
