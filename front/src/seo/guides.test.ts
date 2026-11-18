import { GUIDES, PAGES_PUBLIQUES, pageGuide, planDuSite } from './guides';
import { LIENS_GUIDES } from './liensGuides';

describe('pages de guide', () => {
  it('ont un titre et une description à la bonne longueur pour Google, et des adresses uniques', () => {
    for (const g of GUIDES) {
      expect(g.titre.length, g.titre).toBeLessThanOrEqual(65);
      expect(g.description.length, g.description).toBeGreaterThan(70);
      expect(g.description.length, g.description).toBeLessThanOrEqual(160);
      expect(g.chemin).toMatch(/^\/[a-z-]+$/);
    }
    expect(new Set(GUIDES.map((g) => g.chemin)).size).toBe(GUIDES.length);
  });

  it('sont toutes liées depuis le pied de page du site, avec le même texte', () => {
    expect(LIENS_GUIDES).toEqual(GUIDES.map((g) => ({ chemin: g.chemin, lien: g.lien })));
  });

  it('donnent une page complète : un seul h1, adresse de référence, lien vers l’inscription, rien à compléter', () => {
    for (const g of GUIDES) {
      const html = pageGuide(g, '/assets/guides.css');
      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html).toContain(`<link rel="canonical" href="https://cadeaux.bsandoz.fr${g.chemin}" />`);
      expect(html).toContain('<a class="btn" href="/">Créer mon compte gratuit</a>');
      expect(html).not.toContain('[à compléter]');
      expect(html).not.toMatch(/<script/);
      // Les autres guides sont liés, pas la page elle-même.
      expect(html).not.toContain(`<li><a href="${g.chemin}">`);
    }
  });

  it('échappent le texte', () => {
    const html = pageGuide({ ...GUIDES[0], h1: 'Un <b>test</b> & "guillemets"' }, '/x.css');
    expect(html).toContain('<h1>Un &lt;b&gt;test&lt;/b&gt; &amp; &quot;guillemets&quot;</h1>');
  });

  it('plan du site : les pages publiques seulement', () => {
    const plan = planDuSite();
    for (const chemin of PAGES_PUBLIQUES) expect(plan).toContain(`<loc>https://cadeaux.bsandoz.fr${chemin}</loc>`);
    expect(plan).not.toMatch(/\/(c|l|compte|bilan|proches|rejoindre)\b/);
  });
});
