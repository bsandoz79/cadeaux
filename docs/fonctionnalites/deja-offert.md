# Déjà offert

## À quoi ça sert
Ne pas offrir deux fois la même chose à la même personne.

## Comment ça marche
Dans le formulaire d'un cadeau, dès qu'un proche est choisi :
- « Déjà offert à Papa (n) » : ce qui lui a été acheté ou offert aux occasions passées, le plus récent d'abord (idées et cadeaux sans occasion exclus) ;
- si le cadeau saisi a un mot significatif (4 lettres ou plus, sans tenir compte des accents ni des majuscules) en commun avec un ancien cadeau, un avertissement : « Vous avez déjà offert « Écharpe en laine » à Papa (Noël 2024) ». Il n'empêche pas d'enregistrer.

## Données
Aucune nouvelle donnée : calcul fait dans le navigateur à partir des cadeaux du compte (`front/src/calculs/historique.ts`).

## Tests
`front/src/calculs/calculs.test.ts` : historique trié, exclusion du cadeau modifié, des idées et des cadeaux sans occasion ; ressemblance avec accents et majuscules.
