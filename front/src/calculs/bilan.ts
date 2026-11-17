import type { Cadeau, Cagnotte, Occasion, Personne } from '../api/types';

/**
 * Ce que coûtent les cadeaux.
 * - Un cadeau acheté ou offert compte pour ce qui a été dépensé (ou, à défaut, ce qui était prévu).
 * - Un cadeau prévu, ou une idée rattachée à une occasion, compte pour ce qui reste à dépenser.
 * - Une idée sans occasion ne compte pas : ce n'est qu'une idée.
 * - Dans une cagnotte, seule votre part compte. Un cadeau payé avec une cagnotte coûte votre part de cette cagnotte
 *   (et la cagnotte n'est pas comptée une deuxième fois à part).
 * L'année est celle de l'occasion (ou de la date limite de la cagnotte, sinon de sa création).
 */
export function coutCadeau(c: Cadeau, cagnottes: Cagnotte[] = []): number {
  if (c.cagnotteId !== null && c.cagnotteId !== undefined) return cagnottes.find((g) => g.id === c.cagnotteId)?.maPart ?? 0;
  return c.montantDepense ?? c.montantPrevu ?? 0;
}

export const estDepense = (c: Cadeau) => c.statut === 'achete' || c.statut === 'offert';

export interface Ligne { cle: string; libelle: string; depense: number; prevu: number; total: number; nombre: number }

export interface Bilan {
  annee: number;
  depense: number;
  prevu: number;
  cagnottes: number;
  total: number;
  parOccasion: Ligne[];
  parPersonne: Ligne[];
}

const anneeDe = (date: string) => Number(date.slice(0, 4));

export function anneeCagnotte(c: Cagnotte): number {
  return anneeDe(c.dateLimite ?? c.creeLe);
}

/** Cadeaux comptés dans une année : ceux d'une occasion de cette année. */
export function cadeauxDeLAnnee(cadeaux: Cadeau[], occasions: Occasion[], annee: number): Cadeau[] {
  const ids = new Set(occasions.filter((o) => anneeDe(o.date) === annee).map((o) => o.id));
  return cadeaux.filter((c) => c.occasionId !== null && ids.has(c.occasionId));
}

function ajouter(lignes: Map<string, Ligne>, cle: string, libelle: string, c: Cadeau, cagnottes: Cagnotte[]) {
  const l = lignes.get(cle) ?? { cle, libelle, depense: 0, prevu: 0, total: 0, nombre: 0 };
  if (estDepense(c)) l.depense += coutCadeau(c, cagnottes);
  else l.prevu += coutCadeau(c, cagnottes);
  l.total = l.depense + l.prevu;
  l.nombre += 1;
  lignes.set(cle, l);
}

const parTotal = (lignes: Map<string, Ligne>) => [...lignes.values()].sort((a, b) => b.total - a.total || a.libelle.localeCompare(b.libelle));

export function bilanAnnee(annee: number, donnees: { cadeaux: Cadeau[]; occasions: Occasion[]; personnes: Personne[]; cagnottes: Cagnotte[] }): Bilan {
  const { occasions, personnes, cagnottes } = donnees;
  const cadeaux = cadeauxDeLAnnee(donnees.cadeaux, occasions, annee);
  const occasionsParId = new Map(occasions.map((o) => [o.id, o]));
  const personnesParId = new Map(personnes.map((p) => [p.id, p]));

  const parOccasion = new Map<string, Ligne>();
  const parPersonne = new Map<string, Ligne>();
  for (const c of cadeaux) {
    const o = occasionsParId.get(c.occasionId!)!;
    ajouter(parOccasion, `o${o.id}`, o.titre, c, cagnottes);
    const p = c.personneId === null ? undefined : personnesParId.get(c.personneId);
    ajouter(parPersonne, p ? `p${p.id}` : 'sans', p ? p.nom : 'Sans destinataire', c, cagnottes);
  }

  const depense = cadeaux.filter(estDepense).reduce((s, c) => s + coutCadeau(c, cagnottes), 0);
  const prevu = cadeaux.filter((c) => !estDepense(c)).reduce((s, c) => s + coutCadeau(c, cagnottes), 0);
  // Cagnottes non rattachées à un cadeau : la part de l'organisateur compte à part.
  const rattachees = new Set(donnees.cadeaux.map((c) => c.cagnotteId).filter((id) => id !== null && id !== undefined));
  const parts = cagnottes.filter((c) => !rattachees.has(c.id) && anneeCagnotte(c) === annee).reduce((s, c) => s + (c.maPart ?? 0), 0);

  return { annee, depense, prevu, cagnottes: parts, total: depense + prevu + parts, parOccasion: parTotal(parOccasion), parPersonne: parTotal(parPersonne) };
}

/** Années où il y a quelque chose, de la plus récente à la plus ancienne, avec toujours l'année en cours. */
export function anneesDisponibles(occasions: Occasion[], cagnottes: Cagnotte[], anneeCourante: number): number[] {
  const annees = new Set([anneeCourante, ...occasions.map((o) => anneeDe(o.date)), ...cagnottes.map(anneeCagnotte)]);
  return [...annees].sort((a, b) => b - a);
}

export interface Anniversaire { personne: Personne; date: string; age: number; dans: number }

/** Prochains anniversaires dans les `jours` à venir (aujourd'hui compris), du plus proche au plus lointain. */
export function prochainsAnniversaires(personnes: Personne[], aujourdhui: string, jours = 60): Anniversaire[] {
  const [a, m, j] = aujourdhui.split('-').map(Number);
  const debut = Date.UTC(a, m - 1, j);
  const resultat: Anniversaire[] = [];
  for (const p of personnes) {
    if (!p.dateNaissance) continue;
    const [an, mn, jn] = p.dateNaissance.split('-').map(Number);
    for (const annee of [a, a + 1]) {
      // Né un 29 février : fêté le 28 les autres années.
      const jour = mn === 2 && jn === 29 && new Date(Date.UTC(annee, 1, 29)).getUTCMonth() !== 1 ? 28 : jn;
      const t = Date.UTC(annee, mn - 1, jour);
      if (t < debut) continue;
      const dans = Math.round((t - debut) / 86_400_000);
      if (dans <= jours) resultat.push({ personne: p, date: new Date(t).toISOString().slice(0, 10), age: annee - an, dans });
      break;
    }
  }
  return resultat.sort((x, y) => x.dans - y.dans || x.personne.nom.localeCompare(y.personne.nom));
}

/** « aujourd'hui », « demain », « dans 12 jours ». */
export function delai(jours: number): string {
  if (jours === 0) return 'aujourd’hui';
  if (jours === 1) return 'demain';
  return `dans ${jours} jours`;
}

/** Date du jour, « AAAA-MM-JJ », à l'heure locale. */
export function aujourdhui(maintenant = new Date()): string {
  const m = String(maintenant.getMonth() + 1).padStart(2, '0');
  const j = String(maintenant.getDate()).padStart(2, '0');
  return `${maintenant.getFullYear()}-${m}-${j}`;
}

const formatDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const formatDateCourte = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** « 25 décembre 2026 » (ou « 25 décembre » avec `sansAnnee`). */
export function dateLisible(date: string, sansAnnee = false): string {
  const [a, m, j] = date.split('-').map(Number);
  return (sansAnnee ? formatDateCourte : formatDate).format(new Date(Date.UTC(a, m - 1, j)));
}
