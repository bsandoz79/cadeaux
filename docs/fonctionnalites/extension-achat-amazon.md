# Extension : « C'est un cadeau ? » après un achat Amazon

## À quoi ça sert
Noter un cadeau au moment où on l'achète, sans y repenser plus tard ; et proposer tout de suite une cagnotte si on veut partager le prix.

## Comment ça marche
1. **Activation** : dans la fenêtre de l'extension, case « Après mes achats sur Amazon, me demander « C'est un cadeau ? » ». Chrome demande l'autorisation pour amazon.fr ; le script `amazon.js` n'est ajouté qu'ensuite. Décocher (ou « Ne plus me demander » dans l'encadré) retire l'autorisation et efface les produits retenus.
2. **Fiches produit** (`/dp/…`, `/gp/product/…`) : le produit (nom, prix, photo, adresse) est retenu dans le navigateur ; 10 produits, 7 jours au plus. Rien n'est envoyé.
3. **Page de confirmation** (« thankyou » dans l'adresse, ou « Commande validée / passée » dans la page) : encadré en bas à droite avec les produits vus dans les 48 dernières heures (ou « Autre chose » à saisir), les proches à cocher et les occasions à venir. « Noter le cadeau » l'enregistre comme **acheté**, au prix payé.
4. **Cagnotte** : « Faire une cagnotte » crée une cagnotte en parts libres (pour qui, montant total), puis propose **WhatsApp**, **SMS**, « Autre… » (menu de partage) et « Copier le lien », message déjà écrit. Le cadeau est alors rattaché à la cagnotte (son prix retiré) : seule la part de l'organisateur dans la cagnotte entre dans son bilan, au nom du proche et de l'occasion.

La fenêtre de l'extension propose aussi « C'est pour : quelqu'un d'autre (idée) / moi (ma liste d'envies) ».

## Fichiers
`extension/amazon.js` (encadré, Shadow DOM fermé), `extension/amazon-logique.js` (règles testées), `extension/fond.js` (appels à l'API, activation), `extension/popup.js`.

## Tests
- `front/src/extension.test.ts` : reconnaissance des pages, produits retenus (10, 7 jours, sans doublon), produits proposés (48 h), messages WhatsApp et SMS.
- Essai dans Chrome headless avec des pages qui imitent une fiche et une confirmation Amazon, et `chrome.*` simulé : produit retenu, encadré, cadeau noté « acheté » pour Papa, cagnotte créée, liens de partage, prix retiré du cadeau.
- **Pas encore essayé** sur le vrai amazon.fr ni avec l'extension installée dans Chrome : à faire lors d'une vraie commande (les adresses de confirmation d'Amazon peuvent changer).
