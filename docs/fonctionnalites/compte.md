# Compte : adresse, mot de passe, rappels

## Inscription
Prénom, adresse, mot de passe, et une case **non cochée** « M'envoyer un rappel par e-mail… ». Un e-mail de confirmation part tout de suite (lien `/confirmer/<lien>`, valable 7 jours). Tant que l'adresse n'est pas confirmée, l'accueil affiche un bandeau avec « Renvoyer l'e-mail » (3 fois par quart d'heure) et aucun rappel ne part.

## Mot de passe oublié
« Se connecter » → « Mot de passe oublié ? » → adresse. La réponse est la même que le compte existe ou non. Le lien `/motdepasse/<lien>` vaut 1 heure ; le nouveau mot de passe ferme toutes les connexions puis connecte l'utilisateur (et confirme son adresse, puisqu'il l'a reçue).

## Mon compte → Mes informations
- **Prénom**.
- **Mot de passe** : l'actuel est demandé ; le nouveau ne s'applique qu'après un clic sur le lien envoyé à l'adresse du compte (page `/motdepasse/confirmer/<lien>`, bouton « Confirmer », 1 heure) ; toutes les connexions sont alors fermées.
- **Adresse e-mail** : mot de passe demandé ; lien envoyé à la nouvelle adresse (24 heures), l'ancienne est prévenue ; l'adresse ne change qu'à l'ouverture du lien.

## API
`POST /email/confirmer`, `/email/renvoyer`, `/motdepasse/oubli`, `/motdepasse/nouveau`, `/moi/motdepasse`, `/moi/email` ; `GET /moi` renvoie `emailConfirme`.

## Tests
`api/tests/IdentiteTest.php` ; `front/src/App.test.tsx` (« mot de passe et adresse »).
