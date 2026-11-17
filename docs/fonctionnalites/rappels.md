# Rappels par e-mail

## À quoi ça sert
Ne pas être pris de court : un anniversaire qui approche, une cagnotte qui n'est pas complète avant la date limite.

## Comment ça marche
Chaque jour, la tâche planifiée `api/bin/menage.php` lance `Rappels::envoyer()` pour les comptes qui ont les rappels activés (activés par défaut, case dans « Mon compte ») :
- **anniversaire dans 7 jours** d'un proche qui a une date de naissance : « Léa a 30 ans le samedi 28 novembre. » puis le budget et les cadeaux prévus à l'occasion « anniversaire » de ce jour-là, ou « Rien de prévu pour l'instant. » (né un 29 février : rappel pour le 28 les années non bissextiles) ;
- **cagnotte non terminée** dont la date limite tombe dans 2 jours et à laquelle il manque de l'argent : montant manquant et lien.

Tous les rappels du jour d'un compte partent dans **un seul e-mail**. Chaque rappel n'est envoyé qu'une fois (table `rappels_envoyes`) ; si l'envoi échoue, il est retenté le lendemain.

## API
`PATCH /moi` `{ "rappels": false }` (et `nom`). `GET /moi` renvoie `rappels`.

## Tests
`api/tests/RappelsTest.php` : anniversaire à J-7 avec budget et cadeau prévu, rien de prévu, cagnotte incomplète à J-2, cagnotte complète ignorée, un seul e-mail, pas de doublon le lendemain, rappels coupés, 29 février.
