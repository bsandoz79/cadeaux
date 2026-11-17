import { useState } from 'react';
import type { Personne } from '../api/types';
import { aujourdhui, prochainsAnniversaires } from '../calculs/bilan';
import { aller } from '../navigation';
import { useDonnees } from './contexte';

/**
 * « Cadeau d'anniversaire » pour un proche : ouvre l'occasion « Anniversaire de Léa (30 ans) » de son prochain
 * anniversaire (créée si besoin), avec le formulaire d'ajout ouvert et Léa déjà choisie.
 */
export function usePreparerAnniversaire() {
  const d = useDonnees();
  const [enCours, setEnCours] = useState<number | null>(null);

  const preparer = async (personne: Personne) => {
    const prochain = prochainsAnniversaires([personne], aujourdhui(), 366)[0];
    if (!prochain) return;
    const existante = d.occasions.find((o) => o.type === 'anniversaire' && o.date === prochain.date && o.titre.startsWith(`Anniversaire de ${personne.nom}`));
    if (existante) return aller(`/occasions/${existante.id}?pour=${personne.id}`);
    setEnCours(personne.id);
    try {
      const o = await d.ajouter('occasions', { type: 'anniversaire', titre: `Anniversaire de ${personne.nom} (${prochain.age} ans)`, date: prochain.date });
      aller(`/occasions/${o.id}?pour=${personne.id}`);
    } finally {
      setEnCours(null);
    }
  };

  return { preparer, enCours };
}
