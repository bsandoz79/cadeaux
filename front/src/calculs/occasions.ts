import type { TypeOccasion } from '../api/types';

/** Titre et date proposés pour un type d'occasion (modifiables). */
export function suggestion(type: TypeOccasion, jour: string): { titre: string; date: string } {
  const annee = Number(jour.slice(0, 4));
  const prochaine = (mmjj: string) => (`${annee}-${mmjj}` >= jour ? `${annee}-${mmjj}` : `${annee + 1}-${mmjj}`);
  switch (type) {
    case 'noel': { const date = prochaine('12-25'); return { titre: `Noël ${date.slice(0, 4)}`, date }; }
    case 'saint-valentin': { const date = prochaine('02-14'); return { titre: `Saint-Valentin ${date.slice(0, 4)}`, date }; }
    case 'fete-des-meres': return { titre: `Fête des mères ${annee}`, date: '' };
    case 'fete-des-peres': return { titre: `Fête des pères ${annee}`, date: '' };
    case 'anniversaire': return { titre: 'Anniversaire de ', date: '' };
    case 'plaisir': return { titre: `Pour le plaisir ${annee}`, date: jour };
    case 'reussite': return { titre: 'Réussite de ', date: jour };
    default: return { titre: '', date: '' };
  }
}
