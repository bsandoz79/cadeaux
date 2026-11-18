import type { TypeOccasion } from '../api/types';

const iso = (a: number, m: number, j: number) => `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
const jourSemaine = (a: number, m: number, j: number) => new Date(Date.UTC(a, m - 1, j)).getUTCDay(); // 0 = dimanche

/** Dimanche de Pâques (calcul grégorien de Meeus/Jones/Butcher). */
export function paques(a: number): string {
  const b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4;
  const g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3), i = (19 * b + c - e - h + 15) % 30;
  const k = Math.floor(d / 4), l = d % 4, m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451);
  const mois = Math.floor((i + m - 7 * n + 114) / 31), jour = ((i + m - 7 * n + 114) % 31) + 1;
  return iso(a, mois, jour);
}

const plusJours = (date: string, n: number) => {
  const [a, m, j] = date.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
};

/** Fête des mères en France : dernier dimanche de mai, ou premier dimanche de juin s'il tombe le jour de la Pentecôte. */
export function feteDesMeres(a: number): string {
  const date = iso(a, 5, 31 - jourSemaine(a, 5, 31));
  return date === plusJours(paques(a), 49) ? plusJours(date, 7) : date;
}

/** Fête des pères en France : troisième dimanche de juin. */
export function feteDesPeres(a: number): string {
  const premier = 1 + ((7 - jourSemaine(a, 6, 1)) % 7);
  return iso(a, 6, premier + 14);
}

/** Prochaine date (aujourd'hui compris) d'une fête calculée par année. */
export function prochaineFete(calcul: (a: number) => string, jour: string): string {
  const annee = Number(jour.slice(0, 4));
  const cette = calcul(annee);
  return cette >= jour ? cette : calcul(annee + 1);
}

/** Titre et date proposés pour un type d'occasion (modifiables). */
export function suggestion(type: TypeOccasion, jour: string): { titre: string; date: string } {
  const annee = Number(jour.slice(0, 4));
  const prochaine = (mmjj: string) => (`${annee}-${mmjj}` >= jour ? `${annee}-${mmjj}` : `${annee + 1}-${mmjj}`);
  switch (type) {
    case 'noel': { const date = prochaine('12-25'); return { titre: `Noël ${date.slice(0, 4)}`, date }; }
    case 'saint-valentin': { const date = prochaine('02-14'); return { titre: `Saint-Valentin ${date.slice(0, 4)}`, date }; }
    case 'fete-des-meres': { const date = prochaineFete(feteDesMeres, jour); return { titre: `Fête des mères ${date.slice(0, 4)}`, date }; }
    case 'fete-des-peres': { const date = prochaineFete(feteDesPeres, jour); return { titre: `Fête des pères ${date.slice(0, 4)}`, date }; }
    case 'anniversaire': return { titre: 'Anniversaire de ', date: '' };
    case 'plaisir': return { titre: `Pour le plaisir ${annee}`, date: jour };
    case 'reussite': return { titre: 'Réussite de ', date: jour };
    default: return { titre: '', date: '' };
  }
}
