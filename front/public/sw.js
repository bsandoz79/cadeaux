// Service de l'appli installée : l'écran s'ouvre même sans réseau (dernière version connue du site),
// les données viennent toujours du serveur (rien n'est gardé hors ligne). Les appels à /api ne passent pas par ici.
const CACHE = 'cadeaux-v3';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c)))).then(() => self.clients.claim()));
});

/**
 * Nouvelle page d'accueil reçue : elle est gardée, et les fichiers de /assets/ qu'elle n'utilise plus (versions
 * précédentes du site) sont effacés, pour ne pas encombrer le téléphone.
 */
async function garderVersion(reponse) {
  const html = await reponse.clone().text();
  const cache = await caches.open(CACHE);
  const ancienne = await cache.match('/');
  const nouvelleVersion = !ancienne || (await ancienne.text()) !== html;
  await cache.put('/', reponse);
  if (!nouvelleVersion) return;
  // Nouvelle version du site : les fichiers de l'ancienne sont effacés. Ceux de la nouvelle (y compris les pages
  // chargées à la demande, qui ne sont pas citées dans la page d'accueil) se rangent ensuite au fil de l'usage.
  const utiles = new Set([...html.matchAll(/\/assets\/[^"'\s)]+/g)].map((m) => m[0]));
  for (const requete of await cache.keys()) {
    const chemin = new URL(requete.url).pathname;
    if (chemin.startsWith('/assets/') && !utiles.has(chemin)) await cache.delete(requete);
  }
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // Pages : le réseau d'abord, la dernière version gardée sinon.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok && url.pathname === '/') e.waitUntil(garderVersion(r.clone()));
      return r;
    }).catch(() => caches.match('/')));
    return;
  }
  // Fichiers du site (noms qui changent à chaque version) : gardés après le premier chargement.
  if (url.pathname.startsWith('/assets/') || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then((r) => r ?? fetch(e.request).then((rep) => { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put(e.request, copie)); return rep; })));
  }
});
