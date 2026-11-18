import { useState } from 'react';
import type { Personne, TypeOccasion } from '../api/types';
import { aujourdhui, prochainsAnniversaires } from '../calculs/bilan';
import { feteDesMeres, feteDesPeres, prochaineFete } from '../calculs/occasions';
import { aller } from '../navigation';
import { useDonnees } from './contexte';

/**
 * Ajouter un cadeau pour un proche à une occasion : l'occasion est retrouvée ou créée, puis sa page s'ouvre avec le
 * formulaire d'ajout prêt pour ce proche.
 * - anniversaire : son prochain anniversaire (date de naissance nécessaire) ;
 * - noël : le prochain 25 décembre ;
 * - plaisir : une occasion « Pour le plaisir » par année ;
 * - réussite : « Réussite de Léa », datée d'aujourd'hui ;
 * - fêtes des mères et des pères : à leur date française (calculée).
 */
export function useOccasionPour() {
  const d = useDonnees();
  const [enCours, setEnCours] = useState<number | null>(null);

  const ouvrir = async (personne: Personne, type: TypeOccasion, titre: string, date: string, retrouver: (o: { type: string; titre: string; date: string }) => boolean) => {
    const existante = d.occasions.find((o) => o.type === type && retrouver(o));
    if (existante) return aller(`/occasions/${existante.id}?pour=${personne.id}`);
    setEnCours(personne.id);
    try {
      const o = await d.ajouter('occasions', { type, titre, date });
      aller(`/occasions/${o.id}?pour=${personne.id}`);
    } finally {
      setEnCours(null);
    }
  };

  const jour = aujourdhui();
  const annee = jour.slice(0, 4);

  const pour = async (personne: Personne, type: TypeOccasion, dateChoisie?: string) => {
    switch (type) {
      case 'anniversaire': {
        const prochain = prochainsAnniversaires([personne], jour, 366)[0];
        if (!prochain) return;
        return ouvrir(personne, type, `Anniversaire de ${personne.nom} (${prochain.age} ans)`, prochain.date,
          (o) => o.date === prochain.date && o.titre.startsWith(`Anniversaire de ${personne.nom}`));
      }
      case 'noel': {
        const date = `${annee}-12-25` >= jour ? `${annee}-12-25` : `${Number(annee) + 1}-12-25`;
        return ouvrir(personne, type, `Noël ${date.slice(0, 4)}`, date, (o) => o.date === date);
      }
      case 'plaisir':
        return ouvrir(personne, type, `Pour le plaisir ${annee}`, jour, (o) => o.date.startsWith(annee));
      case 'reussite':
        return ouvrir(personne, type, `Réussite de ${personne.nom}`, jour, (o) => o.date === jour && o.titre === `Réussite de ${personne.nom}`);
      case 'fete-des-meres':
      case 'fete-des-peres': {
        // Date calculée (règles françaises), sauf si une autre est donnée.
        const date = dateChoisie ?? prochaineFete(type === 'fete-des-meres' ? feteDesMeres : feteDesPeres, jour);
        const titre = `${type === 'fete-des-meres' ? 'Fête des mères' : 'Fête des pères'} ${date.slice(0, 4)}`;
        return ouvrir(personne, type, titre, date, (o) => o.date === date);
      }
      default:
        return aller(`/occasions?pour=${personne.id}`);
    }
  };

  /** Ancien nom : le prochain anniversaire. */
  const preparer = (personne: Personne) => pour(personne, 'anniversaire');

  return { pour, preparer, enCours };
}
