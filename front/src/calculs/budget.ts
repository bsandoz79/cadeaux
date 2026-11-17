/** Budget d'une personne pour une occasion : ce qui reste, ou de combien il est dépassé. */
export interface EtatBudget {
  budget: number;
  utilise: number;
  reste: number;
  depasse: number;
  /** Part utilisée, de 0 à 100 (plafonnée). */
  pourcentage: number;
}

export function etatBudget(budget: number, utilise: number): EtatBudget {
  return {
    budget,
    utilise,
    reste: Math.max(0, budget - utilise),
    depasse: Math.max(0, utilise - budget),
    pourcentage: budget > 0 ? Math.min(100, Math.round((utilise / budget) * 100)) : 100,
  };
}
