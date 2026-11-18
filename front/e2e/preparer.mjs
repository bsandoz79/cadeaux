// Base SQLite neuve pour les parcours : api/config.local.php la désigne, l'ancienne et la marque de schéma sont effacées.
// Ne sert qu'aux tests (le déploiement réécrit config.local.php avec la base MySQL ensuite).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const api = resolve(import.meta.dirname, '../../api');
const config = join(api, 'config.local.php');
const MARQUE = 'Écrit par front/e2e/preparer.mjs';
// Une configuration écrite à la main (base locale, par exemple) n'est jamais écrasée.
if (existsSync(config) && !readFileSync(config, 'utf8').includes(MARQUE)) {
  console.error('api/config.local.php existe déjà : mettez-le de côté avant de lancer les parcours.');
  process.exit(1);
}
const dossier = join(tmpdir(), 'cadeaux-e2e');
mkdirSync(dossier, { recursive: true });
const base = join(dossier, 'base.sqlite').replaceAll('\\', '/');
rmSync(base, { force: true });
rmSync(join(api, 'var'), { recursive: true, force: true });
writeFileSync(config, `<?php\n// ${MARQUE} pour les tests de parcours.\nreturn ['dsn' => 'sqlite:${base}'];\n`);
console.log(`Base de test : ${base}`);
