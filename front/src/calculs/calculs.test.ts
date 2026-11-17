import type { Cadeau, Cagnotte, Occasion, Personne } from '../api/types';
import { euros, lireMontant, saisieDepuis } from './argent';
import { anneesDisponibles, aujourdhui, bilanAnnee, dateLisible, delai, prochainsAnniversaires } from './bilan';
import { etatBudget } from './budget';
import { etatCagnotte, partConseillee, partsEgales } from './cagnotte';

const cadeau = (c: Partial<Cadeau>): Cadeau => ({
  id: 1, titre: 'Cadeau', occasionId: null, personneId: null, montantPrevu: null, montantDepense: null,
  statut: 'prevu', lien: null, image: null, note: null, creeLe: '2026-01-01 00:00:00', ...c,
});
const cagnotte = (c: Partial<Cagnotte>): Cagnotte => ({
  id: 1, code: 'x', titre: 'Montre', beneficiaire: 'Julie', objectif: 15000, mode: 'libre', nombreParts: null,
  dateLimite: null, lien: null, message: null, close: false, creeLe: '2026-03-01 10:00:00', ...c,
});

describe('argent', () => {
  it('affiche en euros, sans centimes pour un montant rond', () => {
    expect(euros(15000)).toBe('150 €');
    expect(euros(2143)).toBe('21,43 €');
    expect(euros(123456)).toBe('1 234,56 €');
  });

  it('lit ce qui est tapé', () => {
    expect(lireMontant('12')).toBe(1200);
    expect(lireMontant('12,5')).toBe(1250);
    expect(lireMontant(' 12.50 € ')).toBe(1250);
    expect(lireMontant('19,99')).toBe(1999);
    expect(lireMontant('abc')).toBeNull();
    expect(lireMontant('1,234')).toBeNull();
    expect(lireMontant('')).toBeNull();
  });

  it('prépare un champ', () => {
    expect(saisieDepuis(1250)).toBe('12,50');
    expect(saisieDepuis(1200)).toBe('12');
    expect(saisieDepuis(null)).toBe('');
  });
});

describe('cagnotte', () => {
  it('partage au centime près, la somme fait toujours l’objectif', () => {
    expect(partsEgales(15000, 5)).toEqual([3000, 3000, 3000, 3000, 3000]);
    const sept = partsEgales(15000, 7);
    expect(sept).toEqual([2143, 2143, 2143, 2143, 2143, 2143, 2142]);
    expect(sept.reduce((a, b) => a + b, 0)).toBe(15000);
    expect(partsEgales(15000, 0)).toEqual([]);
    expect(partConseillee(15000, 7)).toBe(2143);
    expect(partConseillee(15000, null)).toBeNull();
  });

  it('calcule le reste à mettre, ce qui est payé et l’avancement', () => {
    const parts = [
      { id: 1, nom: 'Tom', montant: 2000, paye: true, organisateur: false },
      { id: 2, nom: 'Léa', montant: 3000, paye: false, organisateur: false },
    ];
    expect(etatCagnotte(15000, parts)).toEqual({ total: 5000, paye: 2000, reste: 10000, surplus: 0, pourcentage: 33, nombre: 2 });
    expect(etatCagnotte(4000, parts)).toMatchObject({ reste: 0, surplus: 1000, pourcentage: 100 });
  });
});

describe('bilan de l’année', () => {
  const personnes: Personne[] = [
    { id: 1, nom: 'Maman', dateNaissance: '1970-03-12', note: null },
    { id: 2, nom: 'Léa', dateNaissance: '2000-12-01', note: null },
  ];
  const occasions: Occasion[] = [
    { id: 10, type: 'noel', titre: 'Noël 2026', date: '2026-12-25' },
    { id: 11, type: 'anniversaire', titre: 'Anniversaire de Maman', date: '2026-03-12' },
    { id: 12, type: 'noel', titre: 'Noël 2025', date: '2025-12-25' },
  ];
  const cadeaux: Cadeau[] = [
    cadeau({ id: 1, occasionId: 10, personneId: 1, montantPrevu: 3000, statut: 'prevu' }),
    cadeau({ id: 2, occasionId: 10, personneId: 2, montantPrevu: 2000, montantDepense: 1800, statut: 'achete' }),
    cadeau({ id: 3, occasionId: 11, personneId: 1, montantDepense: 4500, statut: 'offert' }),
    cadeau({ id: 4, occasionId: 12, personneId: 1, montantDepense: 9900, statut: 'offert' }),
    cadeau({ id: 5, occasionId: null, montantPrevu: 15000, statut: 'idee' }),
  ];
  const cagnottes = [cagnotte({ maPart: 3000 }), cagnotte({ id: 2, dateLimite: '2025-06-01', maPart: 1000 })];

  it('additionne dépensé, prévu et ma part des cagnottes, sans compter les idées seules ni les autres années', () => {
    const b = bilanAnnee(2026, { cadeaux, occasions, personnes, cagnottes });
    expect([b.depense, b.prevu, b.cagnottes, b.total]).toEqual([6300, 3000, 3000, 12300]);
  });

  it('détaille par occasion et par personne, du plus cher au moins cher', () => {
    const b = bilanAnnee(2026, { cadeaux, occasions, personnes, cagnottes });
    expect(b.parOccasion.map((l) => [l.libelle, l.depense, l.prevu, l.nombre])).toEqual([
      ['Noël 2026', 1800, 3000, 2],
      ['Anniversaire de Maman', 4500, 0, 1],
    ]);
    expect(b.parPersonne.map((l) => [l.libelle, l.total])).toEqual([['Maman', 7500], ['Léa', 1800]]);
  });

  it('liste les années utiles', () => {
    expect(anneesDisponibles(occasions, cagnottes, 2027)).toEqual([2027, 2026, 2025]);
  });
});

describe('anniversaires', () => {
  const p = (id: number, nom: string, dateNaissance: string | null): Personne => ({ id, nom, dateNaissance, note: null });

  it('donne les prochains, avec l’âge, y compris l’an prochain', () => {
    const liste = prochainsAnniversaires([p(1, 'Léa', '2000-12-01'), p(2, 'Tom', '1990-01-05'), p(3, 'Sans date', null), p(4, 'Loin', '1980-06-01')], '2026-11-17');
    expect(liste.map((a) => [a.personne.nom, a.date, a.age, a.dans])).toEqual([
      ['Léa', '2026-12-01', 26, 14],
      ['Tom', '2027-01-05', 37, 49],
    ]);
  });

  it('aujourd’hui compte, et un 29 février est fêté le 28', () => {
    expect(prochainsAnniversaires([p(1, 'A', '1990-11-17')], '2026-11-17')[0].dans).toBe(0);
    expect(prochainsAnniversaires([p(1, 'B', '2000-02-29')], '2027-02-01')[0].date).toBe('2027-02-28');
  });

  it('formule le délai et les dates', () => {
    expect([delai(0), delai(1), delai(5)]).toEqual(['aujourd’hui', 'demain', 'dans 5 jours']);
    expect(dateLisible('2026-12-25')).toBe('25 décembre 2026');
    expect(dateLisible('2026-12-25', true)).toBe('25 décembre');
    expect(aujourdhui(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('budget par personne', () => {
  it('donne le reste, ou le dépassement', () => {
    expect(etatBudget(5000, 3000)).toEqual({ budget: 5000, utilise: 3000, reste: 2000, depasse: 0, pourcentage: 60 });
    expect(etatBudget(5000, 6250)).toMatchObject({ reste: 0, depasse: 1250, pourcentage: 100 });
    expect(etatBudget(5000, 0)).toMatchObject({ reste: 5000, pourcentage: 0 });
  });
});
