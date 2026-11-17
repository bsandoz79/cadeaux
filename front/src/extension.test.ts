// Lecture du produit par l'extension Chrome (extension/produit.js), sur des pages types.
import { ajouterVu, estFicheProduit, estPageMerci, liensPartage, produitsRecents, VUS_MAX } from '../../extension/amazon-logique.js';
import { lireProduit } from '../../extension/produit.js';

const page = (html: string, url = 'https://boutique.example/produit') => {
  document.head.innerHTML = '';
  document.body.innerHTML = html;
  window.history.replaceState(null, '', new URL(url).pathname);
};

describe('extension : lecture du produit', () => {
  it('lit les données structurées schema.org', () => {
    page(`<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'WebPage' }, { '@type': 'Product', name: 'Montre automatique', image: ['/img/montre.jpg'], offers: { '@type': 'Offer', price: '149.90', priceCurrency: 'EUR' } }],
    })}</script><h1>Autre titre</h1>`);
    expect(lireProduit()).toEqual({ titre: 'Montre automatique', prix: 14990, image: `${location.origin}/img/montre.jpg`, lien: location.href });
  });

  it('se rabat sur Open Graph et les microdonnées', () => {
    page(`<meta property="og:title" content="Écharpe en laine"><meta property="og:image" content="https://cdn.example/e.jpg">
      <link rel="canonical" href="https://boutique.example/echarpe"><span itemprop="price" content="29,99"></span>`);
    expect(lireProduit()).toEqual({ titre: 'Écharpe en laine', prix: 2999, image: 'https://cdn.example/e.jpg', lien: 'https://boutique.example/echarpe' });
  });

  it('lit une fiche Amazon', () => {
    page(`<span id="productTitle">  Casque audio sans fil  </span>
      <div id="corePriceDisplay_desktop_feature_div"><span class="a-price"><span class="a-offscreen">1 299,00 €</span></span></div>
      <img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/casque.jpg" src="https://m.media-amazon.com/petit.jpg">`);
    expect(lireProduit()).toMatchObject({ titre: 'Casque audio sans fil', prix: 129900, image: 'https://m.media-amazon.com/images/I/casque.jpg' });
  });

  it('sans prix ni image : le titre de la page et rien d’inventé', () => {
    page('<p>Rien</p>');
    document.title = 'Une page';
    expect(lireProduit()).toMatchObject({ titre: 'Une page', prix: null, image: null });
  });

  it('refuse les images en javascript: et lit les prix à milliers', () => {
    page('<meta property="og:image" content="javascript:alert(1)"><meta property="product:price:amount" content="1,299.50">');
    expect(lireProduit()).toMatchObject({ image: null, prix: 129950 });
  });
});

describe('extension : aide après achat sur Amazon', () => {
  const H = 3_600_000;
  const produit = (n: number) => ({ titre: `Produit ${n}`, prix: n * 100, image: null, lien: `https://www.amazon.fr/dp/B00000000${n}` });

  it('reconnaît la page de confirmation de commande et les fiches produit', () => {
    expect(estPageMerci('https://www.amazon.fr/gp/buy/thankyou/handlers/display.html?purchaseId=1')).toBe(true);
    expect(estPageMerci('https://www.amazon.fr/checkout/p/p-123/thankyou?pipelineType=Chewbacca')).toBe(true);
    expect(estPageMerci('https://www.amazon.fr/autre', 'Merci, votre commande a été passée.')).toBe(true);
    expect(estPageMerci('https://www.amazon.fr/dp/B0CHX1W1XY', 'Ajouter au panier')).toBe(false);
    expect(estFicheProduit('https://www.amazon.fr/Montre-Casio/dp/B000GAYQKY/ref=sr_1_1')).toBe(true);
    expect(estFicheProduit('https://www.amazon.fr/gp/product/B000GAYQKY')).toBe(true);
    expect(estFicheProduit('https://www.amazon.fr/s?k=montre')).toBe(false);
  });

  it('retient les 10 derniers produits vus pendant 7 jours, sans doublon', () => {
    let vus = ajouterVu([], produit(1), 0);
    vus = ajouterVu(vus, produit(2), H);
    vus = ajouterVu(vus, produit(1), 2 * H);
    expect(vus.map((v) => v.titre)).toEqual(['Produit 1', 'Produit 2']);
    for (let i = 3; i <= 14; i++) vus = ajouterVu(vus, produit(i), i * H);
    expect(vus).toHaveLength(VUS_MAX);
    expect(ajouterVu(vus, produit(99), 9 * 24 * H).map((v) => v.titre)).toEqual(['Produit 99']);
    expect(ajouterVu(vus, null, 0)).toBe(vus);
  });

  it('propose après la commande les produits vus dans les 48 dernières heures', () => {
    const vus = [{ ...produit(1), vuLe: 0 }, { ...produit(2), vuLe: 47 * H }];
    expect(produitsRecents(vus, 50 * H).map((v) => v.titre)).toEqual(['Produit 2']);
  });

  it('prépare les messages WhatsApp et SMS', () => {
    const l = liensPartage('https://cadeaux.bsandoz.fr/c/0123456789abcdef', 'Papa', 'Montre');
    expect(l.texte).toBe('On se cotise pour Papa (Montre) ? Mets ta part ici : https://cadeaux.bsandoz.fr/c/0123456789abcdef');
    expect(l.whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent(l.texte)}`);
    expect(l.sms.startsWith('sms:?&body=On%20se%20cotise')).toBe(true);
  });
});
