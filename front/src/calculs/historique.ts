import type { Cadeau, Occasion } from '../api/types';

export interface CadeauPasse { cadeau: Cadeau; occasion: Occasion }

/**
 * Ce qui a déjà été offert (ou acheté) à une personne, de l'occasion la plus récente à la plus ancienne.
 * Les idées et les cadeaux sans occasion ne comptent pas ; `sauf` exclut le cadeau en cours de modification.
 */
export function dejaOffert(personneId: number, cadeaux: Cadeau[], occasions: Occasion[], sauf?: number): CadeauPasse[] {
  const parId = new Map(occasions.map((o) => [o.id, o]));
  return cadeaux
    .filter((c) => c.personneId === personneId && c.id !== sauf && (c.statut === 'achete' || c.statut === 'offert') && c.occasionId !== null)
    .map((cadeau) => ({ cadeau, occasion: parId.get(cadeau.occasionId!)! }))
    .filter((x) => x.occasion)
    .sort((a, b) => b.occasion.date.localeCompare(a.occasion.date));
}

/** Mots significatifs : minuscules, sans accents, 4 lettres ou plus (« Écharpe en laine » → écharpe, laine). */
function mots(titre: string): Set<string> {
  return new Set(
    titre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((m) => m.length >= 4),
  );
}

/** Cadeau passé qui ressemble au titre saisi (un mot significatif en commun), pour éviter d'offrir deux fois la même chose. */
export function ressemblance(titre: string, passes: CadeauPasse[]): CadeauPasse | undefined {
  const cherches = mots(titre);
  if (cherches.size === 0) return undefined;
  return passes.find((p) => [...mots(p.cadeau.titre)].some((m) => cherches.has(m)));
}
