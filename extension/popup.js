/**
 * Fenêtre de l'extension : connexion au compte, puis ajout du produit de l'onglet ouvert aux idées de cadeaux.
 * Le jeton de connexion est gardé par Chrome (chrome.storage.local), jamais dans la page visitée.
 */
import { lireProduit } from './produit.js';

const API = 'https://cadeaux.bsandoz.fr/api';
const $ = (id) => document.getElementById(id);

const montrer = (id) => {
  for (const e of ['connexion', 'ajout', 'fait', 'chargement']) $(e).hidden = e !== id;
  $('deconnexion').hidden = id === 'connexion' || id === 'chargement';
  $('reglages').hidden = id === 'connexion' || id === 'chargement';
};

// Aide après achat sur Amazon : permission demandée au moment où l'utilisateur l'active, script ajouté ensuite.
const AMAZON = ['https://www.amazon.fr/*'];
const ID_SCRIPT = 'cadeaux-amazon';
async function etatAmazon() {
  const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [ID_SCRIPT] }).catch(() => []);
  $('amazon').checked = scripts.length > 0 && (await chrome.permissions.contains({ origins: AMAZON }));
}
$('amazon').addEventListener('change', async (e) => {
  if (e.target.checked) {
    const accorde = await chrome.permissions.request({ origins: AMAZON });
    if (accorde) await chrome.scripting.registerContentScripts([{ id: ID_SCRIPT, matches: AMAZON, js: ['amazon.js'], runAt: 'document_idle' }]).catch(() => {});
  } else {
    await chrome.runtime.sendMessage({ type: 'desactiver-amazon' });
  }
  await etatAmazon();
});
void etatAmazon();

// « Pour moi » : la liste d'envies, sans destinataire ni occasion.
$('ajout').addEventListener('change', () => {
  const moi = $('ajout').pour.value === 'moi';
  for (const el of document.querySelectorAll('[data-autre]')) el.hidden = moi;
});

/** Identifiant de cette extension, envoyé à la connexion : un appareil inconnu déclenche un e-mail. */
async function appareil() {
  let { appareil: id } = await chrome.storage.local.get('appareil');
  if (!id) { id = crypto.randomUUID(); await chrome.storage.local.set({ appareil: id }); }
  return id;
}

async function jeton() {
  return (await chrome.storage.local.get('jeton')).jeton ?? null;
}

async function api(methode, chemin, corps) {
  const j = await jeton();
  const r = await fetch(API + chemin, {
    method: methode,
    headers: { Accept: 'application/json', ...(corps ? { 'Content-Type': 'application/json' } : {}), ...(j ? { Authorization: `Bearer ${j}` } : {}), ...(chemin === '/connexion' ? { 'X-Appareil': await appareil() } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  if (r.status === 204) return null;
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && j) {
    await chrome.storage.local.remove('jeton');
  }
  if (!r.ok) {
    const e = new Error(d.message ?? 'Une erreur est survenue.');
    e.statut = r.status;
    e.champs = d.champs ?? {};
    throw e;
  }
  return d;
}

/** « 12 », « 12,5 », « 12.50 € » → centimes ; null si vide ; NaN si invalide. */
function lireMontant(saisie) {
  const t = saisie.replace(/[\s €]/g, '').replace(',', '.');
  if (t === '') return null;
  return /^\d+(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : NaN;
}
const versSaisie = (c) => (c === null ? '' : c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', ','));

let produit = null;
$('image').addEventListener('error', () => { $('image').hidden = true; });

async function preparerAjout() {
  montrer('chargement');
  const [onglet] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const [resultat] = await chrome.scripting.executeScript({ target: { tabId: onglet.id }, func: lireProduit });
    produit = resultat.result;
  } catch {
    // Pages où Chrome interdit les extensions (chrome://, boutique Chrome…) : on garde le titre de l'onglet.
    produit = { titre: onglet.title ?? '', prix: null, image: null, lien: /^https?:/.test(onglet.url ?? '') ? onglet.url : null };
  }

  const [personnes, occasions] = await Promise.all([api('GET', '/personnes'), api('GET', '/occasions')]);
  const form = $('ajout');
  form.titre.value = produit.titre;
  form.prix.value = versSaisie(produit.prix);
  if (produit.image) { $('image').src = produit.image; $('image').hidden = false; }
  for (const p of personnes) form.personneId.add(new Option(p.nom, p.id));
  const aujourdhui = new Date().toISOString().slice(0, 10);
  // Occasions à venir d'abord.
  for (const o of occasions.filter((o) => o.date >= aujourdhui).sort((a, b) => a.date.localeCompare(b.date))) form.occasionId.add(new Option(o.titre, o.id));
  montrer('ajout');
  form.titre.focus();
}

$('connexion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const bouton = form.querySelector('button');
  bouton.disabled = true;
  form.querySelector('.erreur').textContent = '';
  try {
    const r = await api('POST', '/connexion', { email: form.email.value, motDePasse: form.motDePasse.value });
    await chrome.storage.local.set({ jeton: r.jeton });
    await preparerAjout();
  } catch (x) {
    form.querySelector('.erreur').textContent = x.message;
  } finally {
    bouton.disabled = false;
  }
});

$('ajout').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const erreur = form.querySelector('.erreur');
  const montant = lireMontant(form.prix.value);
  if (Number.isNaN(montant)) { erreur.textContent = 'Prix invalide (ex. 25 ou 19,99).'; return; }
  const bouton = form.querySelector('button');
  bouton.disabled = true;
  erreur.textContent = '';
  try {
    if (form.pour.value === 'moi') {
      await api('POST', '/envies', { titre: form.titre.value.trim(), prix: montant, lien: produit?.lien ?? null, image: produit?.image ?? null });
      $('voir').href = 'https://cadeaux.bsandoz.fr/envies';
      $('voir').textContent = 'Voir ma liste d’envies';
    } else {
      await api('POST', '/cadeaux', {
        titre: form.titre.value.trim(),
        montantPrevu: montant,
        personneId: form.personneId.value ? Number(form.personneId.value) : null,
        occasionId: form.occasionId.value ? Number(form.occasionId.value) : null,
        statut: form.occasionId.value ? 'prevu' : 'idee',
        lien: produit?.lien ?? null,
        image: produit?.image ?? null,
      });
    }
    montrer('fait');
  } catch (x) {
    if (x.statut === 401) return montrer('connexion');
    erreur.textContent = Object.values(x.champs ?? {})[0] ?? x.message;
  } finally {
    bouton.disabled = false;
  }
});

// Google (ou tout compte) : connexion sur le site, qui transmet un code à usage unique à l'extension.
$('par-le-site').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://cadeaux.bsandoz.fr/extension' });
  window.close();
});

$('deconnexion').addEventListener('click', async () => {
  await api('POST', '/deconnexion').catch(() => {});
  await chrome.storage.local.remove('jeton');
  montrer('connexion');
});

(async () => {
  if (!(await jeton())) return montrer('connexion');
  try {
    await preparerAjout();
  } catch (x) {
    if (x.statut === 401) montrer('connexion');
    else { montrer('connexion'); $('connexion').querySelector('.erreur').textContent = x.message; }
  }
})();
