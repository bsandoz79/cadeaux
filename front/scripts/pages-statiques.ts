/**
 * Après `vite build` : pages de guide (dist/<chemin>.html) et plan du site (dist/sitemap.xml), lisibles sans JavaScript.
 * Construit par Vite en mode serveur (vite build --ssr), puis lancé par node : voir `npm run build`.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GUIDES, pageGuide, planDuSite } from '../src/seo/guides.ts';

const racine = process.cwd();
const DIST = join(racine, 'dist');
const lire = (f: string) => readFileSync(join(racine, 'src', f), 'utf8').replace(/^@import .*$/gm, '');

// Une seule feuille : couleurs du site, styles de base (boutons…), mise en page des guides.
const css = lire('styles/tokens.css') + lire('styles/base.css') + lire('seo/guides.css');
const feuille = `/assets/guides-${createHash('sha256').update(css).digest('hex').slice(0, 8)}.css`;
mkdirSync(join(DIST, 'assets'), { recursive: true });
writeFileSync(join(DIST, feuille), css);

for (const guide of GUIDES) writeFileSync(join(DIST, `${guide.chemin.slice(1)}.html`), pageGuide(guide, feuille));
writeFileSync(join(DIST, 'sitemap.xml'), planDuSite());

console.log(`Pages de guide : ${GUIDES.length}, plan du site écrit.`);
