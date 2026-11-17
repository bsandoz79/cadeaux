import { useState } from 'react';
import { api, jeton as jetonLocal } from '../api/client';
import { Lien } from '../components/commun';
import styles from './pages.module.css';

/**
 * « Ce n'est pas moi » (lien reçu par e-mail) : un bouton à cliquer, et non une action à l'ouverture du lien,
 * pour que les antivirus des messageries, qui ouvrent les liens, ne bloquent pas le compte par erreur.
 */
export function Securite({ jeton }: { jeton: string }) {
  const [etat, setEtat] = useState<'pret' | 'occupe' | { ok: boolean; message: string }>('pret');
  const bloquer = async () => {
    setEtat('occupe');
    try {
      const r = await api<{ message: string }>('POST', '/securite/bloquer', { jeton });
      jetonLocal.ecrire(null);
      setEtat({ ok: true, message: r.message });
    } catch (e) {
      setEtat({ ok: false, message: e instanceof Error ? e.message : 'Une erreur est survenue.' });
    }
  };
  return (
    <section className={`carte ${styles.pile}`} style={{ maxWidth: '34rem' }} aria-labelledby="titre-securite">
      <h1 id="titre-securite">Ce n’est pas vous ?</h1>
      {typeof etat === 'object' ? (
        <p role="status" className={etat.ok ? undefined : 'erreur'} style={etat.ok ? { color: 'var(--c-vert)', fontWeight: 600 } : undefined}>{etat.message}</p>
      ) : (
        <>
          <p>Si quelqu’un d’autre utilise votre compte, bloquez-le :</p>
          <ul style={{ listStyle: 'disc', paddingLeft: '1.2rem', display: 'grid', gap: '.25rem' }}>
            <li>toutes les connexions sont fermées, sur tous les appareils ;</li>
            <li>un changement d’adresse e-mail en cours est annulé ;</li>
            <li>les RIB de vos cagnottes sont effacés ;</li>
            <li>vous recevez un lien pour choisir un nouveau mot de passe.</li>
          </ul>
          <div><button type="button" className="btn" onClick={bloquer} disabled={etat === 'occupe'}>Bloquer mon compte</button></div>
        </>
      )}
      <p><Lien href="/">Aller à l’accueil</Lien></p>
    </section>
  );
}
