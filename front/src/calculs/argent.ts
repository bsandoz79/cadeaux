/** Montants en centimes : affichage en euros et lecture de ce qui est tapé (« 12 », « 12,5 », « 12.50 € »). */

const format = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const formatRond = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** « 12,50 € », ou « 12 € » pour un montant rond. */
export function euros(centimes: number): string {
  // Espaces fines insécables de Intl remplacées par des espaces insécables simples (lisibles partout).
  return (centimes % 100 === 0 ? formatRond : format).format(centimes / 100).replace(/ /g, ' ');
}

/** Centimes depuis une saisie, ou null si ce n'est pas un montant. */
export function lireMontant(saisie: string): number | null {
  const texte = saisie.replace(/[\s  €]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(texte)) return null;
  return Math.round(Number(texte) * 100);
}

/** Pour remplir un champ : « 12,5 » → « 12,50 », « 12 » reste « 12 ». */
export function saisieDepuis(centimes: number | null | undefined): string {
  if (centimes === null || centimes === undefined) return '';
  return centimes % 100 === 0 ? String(centimes / 100) : (centimes / 100).toFixed(2).replace('.', ',');
}
