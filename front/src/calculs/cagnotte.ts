import type { Participation } from '../api/types';

/**
 * Parts égales au centime près : 150 € pour 7 donne six parts de 21,43 € et une de 21,42 €.
 * La somme des parts est toujours égale à l'objectif.
 */
export function partsEgales(objectif: number, nombre: number): number[] {
  if (nombre < 1 || objectif <= 0) return [];
  const base = Math.floor(objectif / nombre);
  const reste = objectif - base * nombre;
  return Array.from({ length: nombre }, (_, i) => base + (i < reste ? 1 : 0));
}

/** Part conseillée à un nouveau participant (mode parts égales) : la plus grande, pour ne jamais manquer. */
export function partConseillee(objectif: number, nombre: number | null): number | null {
  return nombre ? (partsEgales(objectif, nombre)[0] ?? null) : null;
}

export interface EtatCagnotte {
  /** Total promis. */
  total: number;
  /** Déjà reçu (parts marquées payées). */
  paye: number;
  /** Ce qu'il manque pour atteindre l'objectif (0 si atteint). */
  reste: number;
  /** Au-delà de l'objectif. */
  surplus: number;
  /** Avancement, de 0 à 100. */
  pourcentage: number;
  nombre: number;
}

export function etatCagnotte(objectif: number, participations: Participation[]): EtatCagnotte {
  const total = participations.reduce((s, p) => s + p.montant, 0);
  const paye = participations.filter((p) => p.paye).reduce((s, p) => s + p.montant, 0);
  return {
    total,
    paye,
    reste: Math.max(0, objectif - total),
    surplus: Math.max(0, total - objectif),
    pourcentage: objectif > 0 ? Math.min(100, Math.round((total / objectif) * 100)) : 0,
    nombre: participations.length,
  };
}
