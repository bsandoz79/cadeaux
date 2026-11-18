import type { Cadeau, Cagnotte, Envie, Occasion, Personne } from '../api/types';

export interface Resultat { type: 'proche' | 'cadeau' | 'occasion' | 'cagnotte' | 'envie'; id: number; titre: string; detail: string; lien: string }

/** Minuscules, sans accents ni espaces en trop : « Léa » et « lea » se trouvent. */
export const normaliser = (texte: string) => texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Tous les mots cherchés doivent apparaître (dans l'ordre que l'on veut) : « noel mam » trouve « Noël, Maman ». */
function correspond(mots: string[], ...champs: (string | null | undefined)[]) {
  const texte = normaliser(champs.filter(Boolean).join(' '));
  return mots.every((m) => texte.includes(m));
}

/** Recherche dans tout le compte, 8 résultats au plus par type. */
export function rechercher(terme: string, d: { personnes: Personne[]; cadeaux: Cadeau[]; occasions: Occasion[]; cagnottes: Cagnotte[]; envies: Envie[] }): Resultat[] {
  const mots = normaliser(terme).split(' ').filter((m) => m.length > 0);
  if (mots.length === 0 || mots.join('').length < 2) return [];
  const personnes = new Map(d.personnes.map((p) => [p.id, p.nom]));
  const occasions = new Map(d.occasions.map((o) => [o.id, o.titre]));
  const huit = <T,>(liste: T[]) => liste.slice(0, 8);

  return [
    ...huit(d.personnes.filter((p) => correspond(mots, p.nom, p.note)))
      .map((p): Resultat => ({ type: 'proche', id: p.id, titre: p.nom, detail: p.note ?? 'Proche', lien: `/proches/${p.id}` })),
    ...huit(d.cadeaux.filter((c) => correspond(mots, c.titre, c.note, c.personneId ? personnes.get(c.personneId) : '', c.occasionId ? occasions.get(c.occasionId) : '')))
      .map((c): Resultat => ({
        type: 'cadeau', id: c.id, titre: c.titre,
        detail: [c.personneId ? personnes.get(c.personneId) : null, c.occasionId ? occasions.get(c.occasionId) : 'Idée'].filter(Boolean).join(' · '),
        lien: c.occasionId ? `/occasions/${c.occasionId}` : '/idees',
      })),
    ...huit(d.occasions.filter((o) => correspond(mots, o.titre)))
      .map((o): Resultat => ({ type: 'occasion', id: o.id, titre: o.titre, detail: 'Occasion', lien: `/occasions/${o.id}` })),
    ...huit(d.cagnottes.filter((g) => correspond(mots, g.titre, g.beneficiaire)))
      .map((g): Resultat => ({ type: 'cagnotte', id: g.id, titre: g.titre, detail: `Cagnotte pour ${g.beneficiaire}`, lien: `/cagnottes/${g.id}` })),
    ...huit(d.envies.filter((e) => correspond(mots, e.titre, e.note)))
      .map((e): Resultat => ({ type: 'envie', id: e.id, titre: e.titre, detail: 'Ma liste d’envies', lien: '/envies' })),
  ];
}
