// Service de l'appli installée : l'écran s'ouvre même sans réseau (dernière version connue du site),
// les données viennent toujours du serveur (rien n'est gardé hors ligne). Les appels à /api ne passent pas par ici.
const CACHE = 'cadeaux-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // Pages : le réseau d'abord, la dernière version gardée sinon.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { const copie = r.clone(); caches.open(CACHE).then((c) => c.put('/', copie)); return r; }).catch(() => caches.match('/')));
    return;
  }
  // Fichiers du site (noms qui changent à chaque version) : gardés après le premier chargement.
  if (url.pathname.startsWith('/assets/') || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then((r) => r ?? fetch(e.request).then((rep) => { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put(e.request, copie)); return rep; })));
  }
});
