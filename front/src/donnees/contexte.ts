import { createContext, useContext } from 'react';
import type { Budget, Cadeau, Cagnotte, Compte, Occasion, Personne } from '../api/types';

export interface Collections {
  personnes: Personne[];
  occasions: Occasion[];
  cadeaux: Cadeau[];
  budgets: Budget[];
  cagnottes: Cagnotte[];
}

export type NomCollection = keyof Collections;
type Element<N extends NomCollection> = Collections[N][number];

export interface Donnees extends Collections {
  compte: Compte | null;
  /** Les données du compte sont arrivées. */
  pret: boolean;
  connecter: (jeton: string, compte: Compte) => void;
  deconnecter: () => Promise<void>;
  recharger: () => Promise<void>;
  ajouter: <N extends NomCollection>(nom: N, donnees: Partial<Element<N>>) => Promise<Element<N>>;
  modifier: <N extends NomCollection>(nom: N, id: number, donnees: Partial<Element<N>>) => Promise<Element<N>>;
  supprimer: (nom: NomCollection, id: number) => Promise<void>;
}

export const ContexteDonnees = createContext<Donnees | null>(null);

export function useDonnees(): Donnees {
  const d = useContext(ContexteDonnees);
  if (!d) throw new Error('useDonnees en dehors de <FournisseurDonnees>');
  return d;
}
