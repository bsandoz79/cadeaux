/**
 * Règles de l'aide après achat sur Amazon, sans accès au navigateur (testées dans front/src/extension.test.ts).
 */

/** Produits vus gardés : les 10 derniers, 7 jours au plus. Ils restent dans le navigateur (chrome.storage.local). */
export const VUS_MAX = 10;
export const VUS_JOURS = 7;

/**
 * Page de confirmation de commande ? Amazon change ses adresses : on reconnaît « thankyou » dans le chemin,
 * ou le message de confirmation affiché.
 */
export function estPageMerci(url, texte = '') {
  let chemin = '';
  try { chemin = new URL(url).pathname; } catch { return false; }
  if (/thank-?you/i.test(chemin)) return true;
  return /commande (a été )?(validée|passée|enregistrée)|merci, votre commande/i.test(texte.slice(0, 5000));
}

/** Fiche produit Amazon (adresse en /dp/ ou /gp/product/). */
export function estFicheProduit(url) {
  try { return /\/(dp|gp\/product)\/[A-Z0-9]{10}/i.test(new URL(url).pathname); } catch { return false; }
}

/** Ajoute (ou remonte) un produit vu, en gardant les plus récents. `maintenant` en millisecondes. */
export function ajouterVu(vus, produit, maintenant) {
  if (!produit?.titre) return vus;
  const autres = vus.filter((v) => v.lien !== produit.lien);
  return [{ ...produit, vuLe: maintenant }, ...autres].filter((v) => maintenant - v.vuLe <= VUS_JOURS * 86_400_000).slice(0, VUS_MAX);
}

/** Produits vus récemment, du plus récent au plus ancien (proposés après la commande). */
export function produitsRecents(vus, maintenant, heures = 48) {
  return vus.filter((v) => maintenant - v.vuLe <= heures * 3_600_000).sort((a, b) => b.vuLe - a.vuLe);
}

/** Liens pour envoyer la cagnotte : WhatsApp, Snapchat et SMS, message déjà écrit. */
export function liensPartage(url, beneficiaire, titre) {
  const texte = `On se cotise pour ${beneficiaire} (${titre}) ? Mets ta part ici : ${url}`;
  return {
    texte,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(texte)}`,
    snapchat: `https://www.snapchat.com/share?link=${encodeURIComponent(url)}`,
    sms: `sms:?&body=${encodeURIComponent(texte)}`,
  };
}
