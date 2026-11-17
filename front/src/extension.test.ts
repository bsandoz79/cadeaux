// Lecture du produit par l'extension Chrome (extension/produit.js), sur des pages types.
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
