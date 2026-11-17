/** Données échangées avec l'API. Montants en centimes, dates « AAAA-MM-JJ ». */

export interface Compte { id: number; email: string; nom: string }

export interface Personne { id: number; nom: string; dateNaissance: string | null; note: string | null }

export type TypeOccasion = 'anniversaire' | 'noel' | 'fete-des-meres' | 'fete-des-peres' | 'mariage' | 'naissance' | 'saint-valentin' | 'autre';

export interface Occasion { id: number; type: TypeOccasion; titre: string; date: string }

/** idee : simple idée · prevu : on sait qu'on l'offrira · achete : payé · offert : donné. */
export type StatutCadeau = 'idee' | 'prevu' | 'achete' | 'offert';

export interface Cadeau {
  id: number;
  titre: string;
  occasionId: number | null;
  personneId: number | null;
  montantPrevu: number | null;
  montantDepense: number | null;
  statut: StatutCadeau;
  lien: string | null;
  image: string | null;
  note: string | null;
  /** Payé à plusieurs : seule ma part de cette cagnotte compte. */
  cagnotteId: number | null;
  creeLe: string;
}

/** Budget prévu pour une personne à une occasion (ex. Papa, 50 € à Noël). */
export interface Budget { id: number; occasionId: number; personneId: number; montant: number }

/** Une envie de ma liste (je la partage par lien ; les autres la réservent). */
export interface Envie {
  id: number;
  titre: string;
  lien: string | null;
  image: string | null;
  prix: number | null;
  note: string | null;
  /** « Très envie » : en tête de liste. */
  priorite: boolean;
  creeLe: string;
}

export interface LienListe { code: string | null; message: string | null }

/** Liste d'envies vue depuis son lien. `reservation` est toujours null pour le propriétaire. */
export interface ListePublique {
  proprietaire: string;
  message: string | null;
  estProprietaire: boolean;
  envies: (Omit<Envie, 'creeLe'> & { reservation: { id: number; nom: string } | null })[];
}

export type ModeCagnotte = 'egal' | 'libre';

export interface Participation { id: number; nom: string; montant: number; paye: boolean; organisateur: boolean }

export interface Cagnotte {
  id: number;
  code: string;
  titre: string;
  beneficiaire: string;
  objectif: number;
  mode: ModeCagnotte;
  nombreParts: number | null;
  dateLimite: string | null;
  lien: string | null;
  message: string | null;
  close: boolean;
  creeLe: string;
  /** Dans la liste seulement. */
  total?: number;
  totalPaye?: number;
  maPart?: number;
  nombreParticipations?: number;
  /** Dans le détail seulement. */
  participations?: Participation[];
}

/** Cagnotte vue depuis le lien partagé. */
export interface CagnottePublique {
  code: string;
  titre: string;
  beneficiaire: string;
  objectif: number;
  mode: ModeCagnotte;
  nombreParts: number | null;
  dateLimite: string | null;
  lien: string | null;
  message: string | null;
  close: boolean;
  organisateur: string;
  participations: Participation[];
}

export const TYPES_OCCASION: { valeur: TypeOccasion; libelle: string }[] = [
  { valeur: 'anniversaire', libelle: 'Anniversaire' },
  { valeur: 'noel', libelle: 'Noël' },
  { valeur: 'fete-des-meres', libelle: 'Fête des mères' },
  { valeur: 'fete-des-peres', libelle: 'Fête des pères' },
  { valeur: 'saint-valentin', libelle: 'Saint-Valentin' },
  { valeur: 'mariage', libelle: 'Mariage' },
  { valeur: 'naissance', libelle: 'Naissance' },
  { valeur: 'autre', libelle: 'Autre' },
];

export const STATUTS: { valeur: StatutCadeau; libelle: string }[] = [
  { valeur: 'idee', libelle: 'Idée' },
  { valeur: 'prevu', libelle: 'Prévu' },
  { valeur: 'achete', libelle: 'Acheté' },
  { valeur: 'offert', libelle: 'Offert' },
];

export const libelleType = (t: TypeOccasion) => TYPES_OCCASION.find((x) => x.valeur === t)?.libelle ?? t;
export const libelleStatut = (s: StatutCadeau) => STATUTS.find((x) => x.valeur === s)?.libelle ?? s;
