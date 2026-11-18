import { useEffect, useState } from 'react';
import { api } from '../api/client';

/** Connexion avec Google : preuve gardée dans l'onglet, départ vers Google, configuration du serveur. */
/** Clé de l'onglet où est gardée la preuve tirée au départ (vérifiée au retour : un lien volé ne connecte personne). */
export const CLE_PREUVE_GOOGLE = 'cadeaux.google';

/** Départ vers Google (remplaçable dans les tests, où le navigateur ne quitte pas la page). */
export const sortie = { vers: (adresse: string) => window.location.assign(adresse) };

/** Tire la preuve de cet onglet et la garde jusqu'au retour de Google. */
export function nouvellePreuve(): string {
  const octets = crypto.getRandomValues(new Uint8Array(32));
  const preuve = Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem(CLE_PREUVE_GOOGLE, preuve); } catch { /* navigation privée stricte : le retour échouera proprement */ }
  return preuve;
}

/** La connexion Google est-elle configurée sur le serveur ? */
export function useGoogleActif(): boolean {
  const [actif, setActif] = useState(false);
  useEffect(() => {
    let vivant = true;
    api<{ actif: boolean }>('GET', '/google').then((r) => vivant && setActif(r.actif)).catch(() => {});
    return () => { vivant = false; };
  }, []);
  return actif;
}
