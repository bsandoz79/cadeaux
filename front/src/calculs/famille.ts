import type { Personne } from '../api/types';

/**
 * Liens de parenté et place dans l'arbre : génération (−2 grands-parents … +2 petits-enfants) et côté
 * (papa à gauche, moi au centre, maman à droite, belle-famille tout à droite).
 * Doit rester identique à la liste de l'API (Application::LIENS).
 */
export type Cote = 'papa' | 'centre' | 'maman' | 'belle-famille';
export interface Lien { valeur: string; libelle: string; generation: -2 | -1 | 0 | 1 | 2; cote: Cote; fete?: 'meres' | 'peres' }

export const LIENS: Lien[] = [
  { valeur: 'grand-pere-paternel', libelle: 'Papi (côté papa)', generation: -2, cote: 'papa', fete: 'peres' },
  { valeur: 'grand-mere-paternelle', libelle: 'Mamie (côté papa)', generation: -2, cote: 'papa', fete: 'meres' },
  { valeur: 'grand-pere-maternel', libelle: 'Papi (côté maman)', generation: -2, cote: 'maman', fete: 'peres' },
  { valeur: 'grand-mere-maternelle', libelle: 'Mamie (côté maman)', generation: -2, cote: 'maman', fete: 'meres' },
  { valeur: 'oncle-paternel', libelle: 'Tonton (côté papa)', generation: -1, cote: 'papa' },
  { valeur: 'tante-paternelle', libelle: 'Tata (côté papa)', generation: -1, cote: 'papa' },
  { valeur: 'pere', libelle: 'Papa', generation: -1, cote: 'papa', fete: 'peres' },
  { valeur: 'mere', libelle: 'Maman', generation: -1, cote: 'maman', fete: 'meres' },
  { valeur: 'oncle-maternel', libelle: 'Tonton (côté maman)', generation: -1, cote: 'maman' },
  { valeur: 'tante-maternelle', libelle: 'Tata (côté maman)', generation: -1, cote: 'maman' },
  { valeur: 'parrain', libelle: 'Parrain', generation: -1, cote: 'centre' },
  { valeur: 'marraine', libelle: 'Marraine', generation: -1, cote: 'centre' },
  { valeur: 'beau-pere', libelle: 'Beau-père', generation: -1, cote: 'belle-famille', fete: 'peres' },
  { valeur: 'belle-mere', libelle: 'Belle-mère', generation: -1, cote: 'belle-famille', fete: 'meres' },
  { valeur: 'cousin-paternel', libelle: 'Cousin (côté papa)', generation: 0, cote: 'papa' },
  { valeur: 'cousine-paternelle', libelle: 'Cousine (côté papa)', generation: 0, cote: 'papa' },
  { valeur: 'frere', libelle: 'Frère', generation: 0, cote: 'centre' },
  { valeur: 'soeur', libelle: 'Sœur', generation: 0, cote: 'centre' },
  { valeur: 'conjoint', libelle: 'Conjoint(e)', generation: 0, cote: 'centre' },
  { valeur: 'cousin-maternel', libelle: 'Cousin (côté maman)', generation: 0, cote: 'maman' },
  { valeur: 'cousine-maternelle', libelle: 'Cousine (côté maman)', generation: 0, cote: 'maman' },
  { valeur: 'beau-frere', libelle: 'Beau-frère', generation: 0, cote: 'belle-famille' },
  { valeur: 'belle-soeur', libelle: 'Belle-sœur', generation: 0, cote: 'belle-famille' },
  { valeur: 'fils', libelle: 'Fils', generation: 1, cote: 'centre', fete: undefined },
  { valeur: 'fille', libelle: 'Fille', generation: 1, cote: 'centre' },
  { valeur: 'neveu', libelle: 'Neveu', generation: 1, cote: 'centre' },
  { valeur: 'niece', libelle: 'Nièce', generation: 1, cote: 'centre' },
  { valeur: 'filleul', libelle: 'Filleul', generation: 1, cote: 'centre' },
  { valeur: 'filleule', libelle: 'Filleule', generation: 1, cote: 'centre' },
  { valeur: 'petit-fils', libelle: 'Petit-fils', generation: 2, cote: 'centre' },
  { valeur: 'petite-fille', libelle: 'Petite-fille', generation: 2, cote: 'centre' },
  { valeur: 'autre-famille', libelle: 'Autre (famille)', generation: 0, cote: 'belle-famille' },
];

const PAR_VALEUR = new Map(LIENS.map((l) => [l.valeur, l]));
export const lien = (valeur: string | null | undefined) => (valeur ? PAR_VALEUR.get(valeur) : undefined);

/** Un groupe « Famille » (nom qui contient « famille ») : ses membres ont un lien de parenté. */
export const estGroupeFamille = (nom: string) => /famille/i.test(nom);

/** Places toujours montrées dans l'arbre, vides si personne n'y est encore : pour compléter en un clic. */
export const PLACES_DE_BASE = ['grand-pere-paternel', 'grand-mere-paternelle', 'grand-pere-maternel', 'grand-mere-maternelle', 'pere', 'mere'];

export interface Case { lien: Lien; personne?: Personne }
export interface Rangee { generation: number; titre: string; cotes: Record<Cote, Case[]> }

const TITRES: Record<number, string> = { [-2]: 'Grands-parents', [-1]: 'Parents, oncles et tantes', 0: 'Ma génération', 1: 'Enfants, neveux et nièces', 2: 'Petits-enfants' };

/**
 * L'arbre : une rangée par génération (des grands-parents aux petits-enfants), chaque rangée en quatre côtés.
 * Les places de base vides restent visibles ; les rangées sans personne ni place de base sont omises, sauf la mienne.
 */
export function arbre(personnes: Personne[]): Rangee[] {
  const avecLien = personnes.filter((p) => lien(p.lien));
  return ([-2, -1, 0, 1, 2] as const).map((generation) => {
    const cotes: Record<Cote, Case[]> = { papa: [], centre: [], maman: [], 'belle-famille': [] };
    for (const l of LIENS.filter((x) => x.generation === generation)) {
      const membres = avecLien.filter((p) => p.lien === l.valeur).sort((a, b) => a.nom.localeCompare(b.nom));
      if (membres.length) membres.forEach((personne) => cotes[l.cote].push({ lien: l, personne }));
      else if (PLACES_DE_BASE.includes(l.valeur)) cotes[l.cote].push({ lien: l });
    }
    return { generation, titre: TITRES[generation], cotes };
  }).filter((r) => r.generation === 0 || Object.values(r.cotes).some((c) => c.length > 0));
}
