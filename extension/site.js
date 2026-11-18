/**
 * Script de l'extension sur cadeaux.bsandoz.fr, seulement pour la page « Connecter l'extension » :
 * il répond à la page qu'il est là, puis transmet au service de fond le code à usage unique qu'elle lui donne.
 * Il ne lit rien d'autre de la page.
 */
const SITE = 'https://cadeaux.bsandoz.fr';

window.addEventListener('message', (e) => {
  if (e.source !== window || e.origin !== SITE || typeof e.data !== 'object' || e.data === null) return;
  if (e.data.type === 'cadeaux-extension-ping') {
    window.postMessage({ type: 'cadeaux-extension-presente' }, SITE);
    return;
  }
  if (e.data.type === 'cadeaux-extension-code' && typeof e.data.code === 'string' && /^[a-f0-9]{64}$/.test(e.data.code)) {
    chrome.runtime.sendMessage({ type: 'code-site', code: e.data.code }, (r) => {
      window.postMessage({ type: r && r.ok ? 'cadeaux-extension-ok' : 'cadeaux-extension-erreur', message: r && r.message }, SITE);
    });
  }
});
