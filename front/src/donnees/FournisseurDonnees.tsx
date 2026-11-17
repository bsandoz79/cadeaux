import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, jeton, quandDeconnecte } from '../api/client';
import type { Compte } from '../api/types';
import { ContexteDonnees, type Collections, type Donnees, type NomCollection } from './contexte';

const VIDE: Collections = { personnes: [], occasions: [], cadeaux: [], cagnottes: [] };

/** Charge le compte connecté et ses données, et garde la liste à jour après chaque changement. */
export function FournisseurDonnees({ children }: { children: ReactNode }) {
  const [compte, setCompte] = useState<Compte | null>(null);
  const [collections, setCollections] = useState<Collections>(VIDE);
  const [pret, setPret] = useState(() => !jeton.lire());

  const recharger = useCallback(async () => {
    const [moi, personnes, occasions, cadeaux, cagnottes] = await Promise.all([
      api<Compte>('GET', '/moi'),
      api<Collections['personnes']>('GET', '/personnes'),
      api<Collections['occasions']>('GET', '/occasions'),
      api<Collections['cadeaux']>('GET', '/cadeaux'),
      api<Collections['cagnottes']>('GET', '/cagnottes'),
    ]);
    setCompte(moi);
    setCollections({ personnes, occasions, cadeaux, cagnottes });
  }, []);

  useEffect(() => {
    quandDeconnecte(() => { setCompte(null); setCollections(VIDE); });
    if (jeton.lire()) recharger().catch(() => {}).finally(() => setPret(true));
  }, [recharger]);

  const valeur = useMemo<Donnees>(() => ({
    ...collections,
    compte,
    pret,
    connecter: (j, c) => {
      jeton.ecrire(j);
      setCompte(c);
      setPret(false);
      recharger().catch(() => {}).finally(() => setPret(true));
    },
    deconnecter: async () => {
      await api('POST', '/deconnexion').catch(() => {});
      jeton.ecrire(null);
      setCompte(null);
      setCollections(VIDE);
    },
    recharger,
    ajouter: async (nom, donnees) => {
      const cree = await api<never>('POST', `/${nom}`, donnees);
      // Les totaux des cagnottes sont calculés par le serveur : on relit la liste.
      if (nom === 'cagnottes') await recharger();
      else setCollections((c) => ({ ...c, [nom]: [cree, ...c[nom]] }));
      return cree;
    },
    modifier: async (nom, id, donnees) => {
      const modifie = await api<never>('PATCH', `/${nom}/${id}`, donnees);
      if (nom === 'cagnottes') await recharger();
      else setCollections((c) => ({ ...c, [nom]: (c[nom] as { id: number }[]).map((e) => (e.id === id ? modifie : e)) }));
      return modifie;
    },
    supprimer: async (nom: NomCollection, id: number) => {
      await api('DELETE', `/${nom}/${id}`);
      // Supprimer un proche ou une occasion détache leurs cadeaux : on relit tout.
      if (nom === 'personnes' || nom === 'occasions') await recharger();
      else setCollections((c) => ({ ...c, [nom]: (c[nom] as { id: number }[]).filter((e) => e.id !== id) }));
    },
  }), [collections, compte, pret, recharger]);

  return <ContexteDonnees.Provider value={valeur}>{children}</ContexteDonnees.Provider>;
}
