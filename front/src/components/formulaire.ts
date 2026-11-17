import { useState, type FormEvent } from 'react';
import { ErreurApi } from '../api/client';
import { lireMontant } from '../calculs/argent';

/** Lit un montant de formulaire : centimes, null si vide, ou undefined si invalide. */
export function montantDuFormulaire(f: FormData, nom: string): number | null | undefined {
  const brut = String(f.get(nom) ?? '').trim();
  if (brut === '') return null;
  return lireMontant(brut) ?? undefined;
}

/**
 * Envoi d'un formulaire : bouton occupé, message d'erreur général et erreurs par champ venant du serveur.
 * `action` peut lever `new ErreurApi(422, …, { champ: 'message' })` pour une erreur vérifiée côté navigateur.
 */
export function useEnvoi(action: (f: FormData, form: HTMLFormElement) => Promise<void>) {
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const envoyer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setOccupe(true);
    setErreur(null);
    setChamps({});
    try {
      await action(new FormData(form), form);
    } catch (x) {
      if (x instanceof ErreurApi) {
        setErreur(x.message);
        setChamps(x.champs);
      } else {
        setErreur('Une erreur est survenue.');
      }
    } finally {
      setOccupe(false);
    }
  };
  return { envoyer, occupe, erreur, champs };
}

export const erreurChamps = (champs: Record<string, string>) => new ErreurApi(422, 'Certains champs sont à corriger.', champs);
