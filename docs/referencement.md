# Référencement (Google)

## Ce qui est en place

- **Pages de guide**, écrites en HTML à la construction (`front/src/seo/guides.ts`, script `front/scripts/pages-statiques.ts`) : lisibles par Google sans JavaScript, une recherche visée par page, lien vers l'inscription.
  - `/cagnotte-cadeau-commun` : cagnotte, cadeau commun, sans frais
  - `/liste-de-noel` : liste de Noël, liste d'envies, sans doublon
  - `/budget-cadeaux` : budget cadeaux de Noël et de l'année
  - `/rappel-anniversaires` : rappel d'anniversaire, fête des mères et des pères
- Liées depuis le pied de page de tout le site, et entre elles.
- **Plan du site** `/sitemap.xml` (accueil, guides, pages légales) et **`/robots.txt`** qui l'indique.
- Accueil : titre, description, aperçu pour les réseaux (`og:`), adresse de référence et fiche « application web gratuite » (`application/ld+json`) dans `front/index.html`.
- **Pages privées jamais dans Google** : en-tête `X-Robots-Tag: noindex` (`.htaccess` pour les pages de l'application, `api/partage.php` pour les cagnottes), et balise `robots` `noindex` posée par l'application hors de l'accueil et des pages légales.
- Règle : seulement ce que le site fait vraiment, aucun chiffre ni avis inventé.

## À faire une fois (Google Search Console)

1. Aller sur https://search.google.com/search-console et ajouter la propriété **Préfixe d'URL** `https://cadeaux.bsandoz.fr/`.
2. Valider avec la méthode **Enregistrement DNS** (ou « Fichier HTML » : déposer le fichier fourni dans `front/public/`, il sera mis en ligne au prochain envoi).
   - DNS : cPanel → « Éditeur de zone » → bsandoz.fr → ajouter un enregistrement **TXT** avec la valeur donnée par Google.
3. Menu **Sitemaps** : envoyer `sitemap.xml`.
4. Menu **Inspection de l'URL** : demander l'indexation de l'accueil et des 4 guides.

Google met en général quelques jours à quelques semaines pour afficher de nouvelles pages. La Search Console montre ensuite les recherches qui mènent au site : utile pour choisir les prochains guides.

## Ajouter un guide

Ajouter une entrée dans `GUIDES` (`front/src/seo/guides.ts`) et son lien dans `front/src/seo/liensGuides.ts` (un test vérifie qu'ils correspondent). Le plan du site se met à jour tout seul.
