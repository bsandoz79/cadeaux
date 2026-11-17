import { useCallback, useEffect, useRef, useState } from 'react';

interface Etat<T> { donnees?: T; erreur?: unknown }

/**
 * Charge une donnée au montage (et quand `cles` change), et donne de quoi la recharger après une modification.
 * Une réponse arrivée après un changement de page est ignorée.
 */
export function useChargement<T>(source: () => Promise<T>, cles: readonly unknown[]) {
  const [etat, setEtat] = useState<Etat<T>>({});
  // `source` est recréée à chaque rendu : on garde la dernière, et seules les `cles` déclenchent un chargement.
  const derniereSource = useRef(source);
  useEffect(() => { derniereSource.current = source; });
  const cle = JSON.stringify(cles);

  useEffect(() => {
    let actif = true;
    derniereSource.current().then(
      (donnees) => { if (actif) setEtat({ donnees }); },
      (erreur) => { if (actif) setEtat({ erreur }); },
    );
    return () => { actif = false; };
  }, [cle]);

  const recharger = useCallback(async () => {
    try { setEtat({ donnees: await derniereSource.current() }); } catch (erreur) { setEtat({ erreur }); }
  }, []);
  const modifier = useCallback((donnees: T) => setEtat({ donnees }), []);

  return { donnees: etat.donnees, erreur: etat.erreur, recharger, modifier };
}
