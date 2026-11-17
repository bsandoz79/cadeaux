# Liste d'envies partagée

Inspirée de Giftster et Elfster.

## À quoi ça sert
Dire à ses proches ce qui ferait plaisir, et éviter que deux personnes offrent la même chose, sans gâcher la surprise.

## Comment ça marche
- **Idées → Ma liste d'envies** : ajouter, modifier, retirer des envies (titre, prix indicatif, lien, précision, « Très envie » pour la mettre en tête).
- **Partager ma liste** : crée un lien `/l/<code>` (copier ou menu de partage du téléphone), avec un petit mot facultatif en haut de la liste. « Couper le lien » le désactive ; un nouveau partage donne une nouvelle adresse.
- **Page du lien**, sans compte : « Je m'en occupe » + prénom réserve l'envie. Les autres voient « Déjà pris par Léa ». Celui qui a réservé peut annuler depuis le même navigateur (clé gardée dans le navigateur, prénom retenu pour la fois suivante).
- **Le propriétaire ne voit jamais les réservations**, ni sur sa page, ni en ouvrant son propre lien (il est reconnu s'il est connecté), ni dans l'export de ses données. Il ne peut pas réserver ses propres envies.

## Données
Tables `listes` (un lien par compte), `envies`, `reservations` (une par envie). Voir `docs/rgpd.md`.

## API
- Propriétaire : `GET|POST|DELETE /liste`, `GET|POST /envies`, `PATCH|DELETE /envies/{id}`.
- Lien : `GET /l/{code}`, `POST|DELETE /l/{code}/envies/{id}/reservation` (en-tête `X-Cle-Reservation` pour annuler).

## Tests
- `api/tests/EnviesTest.php` : partage et vue sans compte, réservation unique et annulation par clé, réservations cachées au propriétaire (page, liste, export), lien coupé puis nouveau code, envie d'une autre liste, suppression du compte.
- Parcours réel dans Chrome (390 px) : ajout d'envies, lien, réservation par un proche, vue du propriétaire sans réservation.
