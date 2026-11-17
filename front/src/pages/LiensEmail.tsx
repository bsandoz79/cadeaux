import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Compte } from '../api/types';
import { Champ, Lien } from '../components/commun';
import { useEnvoi } from '../components/formulaire';
import { useDonnees } from '../donnees/contexte';
import { aller } from '../navigation';
import styles from './pages.module.css';

/** Lien « mot de passe oublié » reçu par e-mail : choisir le nouveau, puis connexion directe. */
export function NouveauMotDePasse({ jeton }: { jeton: string }) {
  const { connecter } = useDonnees();
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f) => {
    const r = await api<{ jeton: string; compte: Compte }>('POST', '/motdepasse/nouveau', { jeton, motDePasse: f.get('motDePasse') });
    connecter(r.jeton, r.compte);
    aller('/');
  });
  return (
    <section className={`carte ${styles.pile}`} style={{ maxWidth: '28rem' }} aria-labelledby="titre-mdp">
      <h1 id="titre-mdp">Nouveau mot de passe</h1>
      <form className="formulaire" onSubmit={envoyer} noValidate>
        <Champ libelle="Choisissez votre mot de passe" nom="motDePasse" type="password" autoComplete="new-password" required aide="Au moins 8 caractères." erreur={champs.motDePasse} />
        {erreur && !champs.motDePasse && <p className="erreur" role="alert">{erreur} {erreur.includes('plus valable') && <Lien href="/">Refaire une demande</Lien>}</p>}
        <div><button className="btn" disabled={occupe}>Enregistrer et me connecter</button></div>
      </form>
      <p className={styles.discret}>Vos autres appareils seront déconnectés.</p>
    </section>
  );
}

/** Lien de confirmation d'adresse (inscription ou changement d'adresse). */
export function ConfirmerEmail({ jeton }: { jeton: string }) {
  const d = useDonnees();
  const [etat, setEtat] = useState<{ ok: true; email: string; type: string } | { ok: false; message: string } | null>(null);
  const deja = useRef(false); // un lien ne sert qu'une fois : pas de deuxième appel (mode strict de React)
  useEffect(() => {
    if (deja.current) return;
    deja.current = true;
    api<{ type: string; email: string }>('POST', '/email/confirmer', { jeton }).then(
      (r) => { setEtat({ ok: true, ...r }); if (d.compte) void d.recharger(); },
      (e: Error) => setEtat({ ok: false, message: e.message }),
    );
  }, [jeton, d]);

  return (
    <section className={`carte ${styles.pile}`} style={{ maxWidth: '32rem' }} aria-live="polite">
      <h1>Adresse e-mail</h1>
      {!etat ? <p className={styles.discret}>Vérification…</p>
        : etat.ok ? (
          <p style={{ color: 'var(--c-vert)', fontWeight: 600 }}>
            {etat.type === 'email' ? `C’est fait : votre adresse est maintenant ${etat.email}.` : `Merci, votre adresse ${etat.email} est confirmée.`}
          </p>
        ) : <p className="erreur">{etat.message}</p>}
      <p><Lien href="/">Aller à l’accueil</Lien></p>
    </section>
  );
}
