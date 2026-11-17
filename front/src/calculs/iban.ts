/** IBAN : nettoyage et contrôle de la clé (modulo 97), comme le serveur, pour signaler une faute avant l'envoi. */
export const normaliserIban = (saisie: string) => saisie.replace(/[\s\-.]/g, '').toUpperCase();

export function ibanValide(iban: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const chiffres = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let reste = 0;
  for (let i = 0; i < chiffres.length; i += 7) reste = Number(`${reste}${chiffres.slice(i, i + 7)}`) % 97;
  return reste === 1;
}
