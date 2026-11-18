import { useEffect, useRef, useState } from 'react';
import { api, ErreurApi } from '../api/client';
import type { Compte } from '../api/types';
import { Lien } from '../components/commun';
import { CLE_PREUVE_GOOGLE } from '../donnees/google';
import { useDonnees } from '../donnees/contexte';
import { aller } from '../navigation';

/** Retour de Google : le code de l'adresse et la preuve gardée dans l'onglet ouvrent la session. */
export function ConnexionGoogle() {
  const { connecter, recharger } = useDonnees();
  const [erreur, setErreur] = useState<string | null>(null);
  const fait = useRef(false);

  useEffect(() => {
    // Une seule tentative (le code ne sert qu'une fois), même si l'écran s'affiche deux fois en développement.
    if (fait.current) return;
    fait.current = true;
    const parametres = new URLSearchParams(window.location.search);
    const code = parametres.get('code') ?? '';
    let preuve = '';
    try {
      preuve = sessionStorage.getItem(CLE_PREUVE_GOOGLE) ?? '';
      sessionStorage.removeItem(CLE_PREUVE_GOOGLE);
    } catch { /* rien de gardé : l'API refusera */ }
    if (parametres.get('relier') === '1') {
      api<Compte>('POST', '/moi/google/relier/fin', { code, preuve })
        .then(async () => { await recharger(); aller('/compte?google=relie', true); })
        .catch((e: unknown) => setErreur(e instanceof ErreurApi ? e.message : 'Google n’a pas pu être relié.'));
      return;
    }
    api<{ jeton: string; compte: Compte; retour: string | null }>('POST', '/google/session', { code, preuve })
      .then((r) => {
        connecter(r.jeton, r.compte);
        aller(r.retour ?? '/', true);
      })
      .catch((e: unknown) => setErreur(e instanceof ErreurApi ? e.message : 'La connexion n’a pas abouti.'));
  }, [connecter, recharger]);

  return (
    <section className="carte formulaire" aria-labelledby="titre-google">
      <h1 id="titre-google">Connexion avec Google</h1>
      {erreur ? (
        <>
          <p className="erreur" role="alert">{erreur}</p>
          <p><Lien href={new URLSearchParams(window.location.search).get('relier') === '1' ? '/compte' : '/'}>Revenir</Lien></p>
        </>
      ) : (
        <p role="status">Connexion en cours…</p>
      )}
    </section>
  );
}
