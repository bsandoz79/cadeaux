import { CONFIDENTIALITE, MENTIONS_LEGALES } from './donnees/legal';
import { lireRoute } from './navigation';

describe('adresses du site', () => {
  it('reconnaît chaque page', () => {
    expect(lireRoute('/')).toEqual({ page: 'accueil' });
    expect(lireRoute('/occasions/12/')).toEqual({ page: 'occasion', id: 12 });
    expect(lireRoute('/c/0123456789abcdef')).toEqual({ page: 'publique', code: '0123456789abcdef' });
    expect(lireRoute('/c/pas-un-code')).toEqual({ page: 'introuvable' });
    expect(lireRoute('/confidentialite')).toEqual({ page: 'confidentialite' });
    expect(lireRoute('/mentions-legales')).toEqual({ page: 'mentions' });
  });
});

describe('pages légales', () => {
  it('la politique de confidentialité est complète et reprend les durées de conservation', () => {
    const texte = CONFIDENTIALITE.sections.flatMap((s) => s.paragraphes).join(' ');
    expect(texte).not.toContain('[à compléter]');
    expect(texte).toContain('90 jours');
    expect(texte).toContain('3 ans');
    expect(texte).toContain('15 minutes');
    expect(texte).toContain('Télécharger mes données');
  });

  it('les mentions légales nomment l’éditeur et l’hébergeur', () => {
    const texte = MENTIONS_LEGALES.sections.flatMap((s) => s.paragraphes).join(' ');
    expect(texte).toContain('Baptiste Sandoz');
    expect(texte).toContain('o2switch');
  });
});
