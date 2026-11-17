/**
 * Service de fond de l'extension :
 * - appels à l'API pour l'encadré affiché sur Amazon (une page ne peut pas appeler l'API elle-même) ;
 * - activation et désactivation de l'aide après achat (script ajouté à amazon.fr seulement si l'utilisateur l'a autorisé).
 */
const API = 'https://cadeaux.bsandoz.fr/api';
export const ID_SCRIPT = 'cadeaux-amazon';
const AMAZON = ['https://www.amazon.fr/*'];

async function appelApi(methode, chemin, corps) {
  const { jeton } = await chrome.storage.local.get('jeton');
  if (!jeton) return { statut: 401, donnees: { message: 'Connectez-vous dans l’extension Cadeaux.' } };
  const r = await fetch(API + chemin, {
    method: methode,
    headers: { Accept: 'application/json', Authorization: `Bearer ${jeton}`, ...(corps ? { 'Content-Type': 'application/json' } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  if (r.status === 401) await chrome.storage.local.remove('jeton');
  return { statut: r.status, donnees: r.status === 204 ? null : await r.json().catch(() => ({})) };
}

/** Seules ces routes sont accessibles depuis l'encadré d'Amazon. */
const AUTORISEES = [/^GET \/personnes$/, /^GET \/occasions$/, /^POST \/cadeaux$/, /^PATCH \/cadeaux\/\d+$/, /^POST \/cagnottes$/];

async function activer() {
  await chrome.scripting.registerContentScripts([{ id: ID_SCRIPT, matches: AMAZON, js: ['amazon.js'], runAt: 'document_idle' }]).catch(() => {});
}

async function desactiver() {
  await chrome.scripting.unregisterContentScripts({ ids: [ID_SCRIPT] }).catch(() => {});
  await chrome.permissions.remove({ origins: AMAZON }).catch(() => {});
  await chrome.storage.local.remove('vus');
}

chrome.runtime.onMessage.addListener((message, expediteur, repondre) => {
  // Messages venant de l'extension elle-même uniquement (fenêtre ou script qu'elle a ajouté à Amazon).
  if (expediteur.id !== chrome.runtime.id) return false;
  (async () => {
    if (message.type === 'api') {
      if (!AUTORISEES.some((r) => r.test(`${message.methode} ${message.chemin}`))) return { statut: 403, donnees: { message: 'Action non prévue.' } };
      return appelApi(message.methode, message.chemin, message.corps);
    }
    if (message.type === 'activer-amazon') { await activer(); return { ok: true }; }
    if (message.type === 'desactiver-amazon') { await desactiver(); return { ok: true }; }
    return { statut: 400 };
  })().then(repondre, () => repondre({ statut: 0, donnees: { message: 'Pas de connexion. Réessayez.' } }));
  return true; // réponse asynchrone
});
