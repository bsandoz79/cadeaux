/**
 * Lit le produit affiché dans la page : nom, prix (en centimes), photo et adresse.
 * Exécutée dans la page par l'extension (chrome.scripting) : la fonction doit tout contenir, sans rien importer.
 * Ordre de recherche : données structurées schema.org (Product), balises Open Graph et microdonnées, puis Amazon.
 *
 * @returns {{ titre: string, prix: number | null, image: string | null, lien: string }}
 */
export function lireProduit() {
  const texte = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const meta = (nom) => document.querySelector(`meta[property="${nom}"], meta[name="${nom}"]`)?.getAttribute('content')?.trim() || null;
  const absolue = (url) => {
    if (!url) return null;
    try { const u = new URL(url, location.href); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; }
  };
  /** « 1 299,99 € », « 29.90 », « EUR 15 » → centimes. */
  const centimes = (valeur) => {
    if (valeur === null || valeur === undefined) return null;
    let s = String(valeur).replace(/[^\d.,]/g, '');
    if (!s) return null;
    const dernier = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    // Un séparateur suivi de 1 ou 2 chiffres est la virgule des centimes ; les autres séparent les milliers.
    if (dernier >= 0 && s.length - dernier - 1 <= 2) s = s.slice(0, dernier).replace(/[.,]/g, '') + '.' + s.slice(dernier + 1);
    else s = s.replace(/[.,]/g, '');
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  };

  // 1. Données structurées
  const produits = [];
  const parcourir = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(parcourir);
    const types = [].concat(x['@type'] ?? []);
    if (types.includes('Product')) produits.push(x);
    if (x['@graph']) parcourir(x['@graph']);
  };
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { parcourir(JSON.parse(s.textContent)); } catch { /* bloc mal formé : ignoré */ }
  }
  const p = produits[0];
  const offre = p ? [].concat(p.offers ?? [])[0] : undefined;
  const offrePrix = offre ? (offre.price ?? offre.lowPrice ?? [].concat(offre.priceSpecification ?? [])[0]?.price) : undefined;
  const imageLd = p ? [].concat(p.image ?? [])[0] : undefined;

  // 2. Amazon (pas de données structurées sur les fiches)
  const amazonTitre = texte(document.querySelector('#productTitle'));
  const amazonPrix = texte(document.querySelector('#corePrice_feature_div .a-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen, .a-price .a-offscreen'));
  const amazonImage = document.querySelector('#landingImage, #imgBlkFront');

  const titre = (p?.name && String(p.name).trim()) || amazonTitre || meta('og:title') || texte(document.querySelector('h1')) || document.title;
  const prix = centimes(offrePrix)
    ?? centimes(meta('product:price:amount') ?? meta('og:price:amount'))
    ?? centimes(document.querySelector('[itemprop="price"]')?.getAttribute('content') ?? texte(document.querySelector('[itemprop="price"]')))
    ?? centimes(amazonPrix);
  const image = absolue(typeof imageLd === 'string' ? imageLd : imageLd?.url)
    ?? absolue(meta('og:image'))
    ?? absolue(amazonImage?.getAttribute('data-old-hires') || amazonImage?.getAttribute('src'));
  const lien = absolue(document.querySelector('link[rel="canonical"]')?.getAttribute('href')) ?? location.href;

  return { titre: titre.slice(0, 200), prix, image, lien };
}
