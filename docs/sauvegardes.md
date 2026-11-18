# Sauvegardes de la base

## Ce qui est fait tout seul

Chaque nuit, la tâche planifiée `api/bin/menage.php` commence par une copie complète de la base, **avant** le ménage (un compte supprimé cette nuit-là reste donc récupérable).

- Dossier : `/home/<compte>/sauvegardes-cadeaux/`, hors du dossier du site : jamais accessible depuis le web, jamais touché par un déploiement. Un autre dossier peut être choisi avec `'sauvegardes' => '…'` dans `api/config.local.php`.
- Un fichier par jour : `cadeaux-AAAA-MM-JJ.jsonl.gz` (compressé, lisible par le seul compte o2switch).
- Les **14 dernières** copies sont gardées, les plus anciennes sont supprimées.
- Un fichier n'apparaît qu'une fois complet : une copie coupée en route (serveur arrêté, disque plein) ne remplace jamais celle de la veille.
- La ligne écrite par la tâche indique le fichier créé (`"sauvegarde":"cadeaux-…"`). cPanel envoie cette ligne par e-mail si une adresse est renseignée dans « Tâches Cron ».

Les RIB des cagnottes restent chiffrés dans les copies. La clé est le fichier `api/var/cle-coffre` : sans lui, ces RIB sont illisibles. C'est voulu (ils sont de toute façon effacés à la fin des cagnottes) ; les organisateurs concernés n'auraient qu'à le saisir à nouveau.

## Vérifier qu'une copie est bonne (sans toucher au site)

Sur son ordinateur, dans le dossier du projet :

1. Télécharger un fichier `cadeaux-AAAA-MM-JJ.jsonl.gz` (cPanel → « Gestionnaire de fichiers » → `sauvegardes-cadeaux`).
2. Créer `api/config.local.php` avec une base SQLite neuve :
   ```php
   <?php
   return ['dsn' => 'sqlite:C:/temp/verification.sqlite'];
   ```
3. `cd api && composer install && php bin/restaurer.php C:/chemin/cadeaux-AAAA-MM-JJ.jsonl.gz`
4. Le nombre d'enregistrements restaurés s'affiche. Supprimer ensuite `api/config.local.php`, la base de vérification et le fichier téléchargé (ils contiennent des données personnelles).

## Restaurer en ligne (après une perte de données)

1. Mettre le site en pause si besoin, pour que personne n'écrive pendant l'opération.
2. cPanel → « Bases de données MySQL » : créer une **base vide** (et lui donner l'utilisateur existant, tous les droits).
3. cPanel → « Terminal » :
   ```sh
   cd ~/cadeaux.bsandoz.fr/api
   cp config.local.php config.local.php.avant
   # Dans config.local.php, remplacer le nom de la base (dbname=…) par celui de la base vide.
   php bin/restaurer.php ~/sauvegardes-cadeaux/cadeaux-AAAA-MM-JJ.jsonl.gz
   ```
4. Si tout s'est bien passé, mettre le nom de la nouvelle base dans le secret GitHub `DB_NAME` (sinon le prochain déploiement repointe vers l'ancienne).
5. Supprimer `api/var/schema-*` (les tables seront vérifiées au prochain appel).

La restauration refuse une base qui contient déjà des comptes, une copie incomplète et une copie faite par une version plus récente du site : dans ces cas, rien n'est écrit.

## En plus

o2switch garde aussi ses propres copies du compte (cPanel → « JetBackup »), utiles si tout le dossier du site était perdu. Pour une copie hors d'o2switch, télécharger de temps en temps un fichier du dossier `sauvegardes-cadeaux` et le ranger dans un endroit sûr (il contient des données personnelles).
