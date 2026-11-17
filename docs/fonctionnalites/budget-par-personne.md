# Budget par personne

## À quoi ça sert
Fixer combien on veut dépenser pour chacun à une occasion (Papa : 50 € à Noël) et voir tout de suite ce qui reste, ou de combien on dépasse.

## Comment ça marche
- Page d'une occasion : sous le nom de chaque proche, une barre « 30 € sur 50 € de budget, il reste 20 € », en rouge si le budget est dépassé. « Fixer un budget » ou « Changer » ; vider le champ retire le budget.
- « Prévoir un budget pour un proche » : ajoute un proche qui n'a encore rien pour cette occasion ; il apparaît avec « Pas encore de cadeau », pour voir qui il reste à gâter.
- Le total des budgets de l'occasion s'affiche avec les autres chiffres.
- « Reprendre les personnes et montants » de l'an dernier reprend aussi les budgets.
- Ce qui compte dans le budget : le montant dépensé d'un cadeau, sinon son budget prévu (comme le bilan).

## Données
Table `budgets` : occasion, proche, montant (centimes). Un seul budget par proche et par occasion (contrainte d'unicité, 409 sinon). Supprimé avec l'occasion, le proche ou le compte. Inclus dans l'export du compte.

## API
`GET|POST /budgets`, `PATCH|DELETE /budgets/{id}`.

## Tests
- `api/tests/BudgetsTest.php` : création, doublon refusé, champs obligatoires, proche d'un autre compte refusé, suppression avec l'occasion.
- `front/src/calculs/calculs.test.ts` : reste, dépassement, pourcentage.
