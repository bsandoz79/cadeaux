import { useState } from 'react';
import { api } from '../api/client';
import { Lien } from '../components/commun';
import { useDonnees } from '../donnees/contexte';
import { useChargement } from '../donnees/useChargement';
import styles from './pages.module.css';

/** Invitation reçue : « Baptiste vous a ajouté(e) à ses proches ». Accepter associe sa fiche à votre compte. */
export function Rejoindre({ jeton }: { jeton: string }) {
  const d = useDonnees();
  const { donnees, erreur } = useChargement(() => api<{ inviteur: string; nom: string }>('GET', `/invitations/${jeton}`), [jeton]);
  const [resultat, setResultat] = useState<{ ok: boolean; message: string } | null>(null);
  const repondre = async (accepter: boolean) => {
    try {
      await api('POST', `/invitations/${jeton}/${accepter ? 'accepter' : 'refuser'}`);
      setResultat({ ok: true, message: accepter ? `C’est fait : ${donnees?.inviteur} voit maintenant votre liste d’envies et votre date d’anniversaire (si vous l’avez indiquée), et peut vous inviter à ses cagnottes. Vous pouvez retirer l’association dans « Mon compte ».` : 'Invitation refusée.' });
    } catch (e) {
      setResultat({ ok: false, message: e instanceof Error ? e.message : 'Une erreur est survenue.' });
    }
  };

  return (
    <section className={`carte ${styles.pile}`} style={{ maxWidth: '36rem' }} aria-labelledby="titre-rejoindre">
      <h1 id="titre-rejoindre">Invitation</h1>
      {erreur ? <p className="erreur">{erreur instanceof Error ? erreur.message : 'Invitation introuvable.'}</p>
        : !donnees ? <p className={styles.discret}>Chargement…</p>
        : resultat ? <p role="status" className={resultat.ok ? undefined : 'erreur'} style={resultat.ok ? { color: 'var(--c-vert)', fontWeight: 600 } : undefined}>{resultat.message}</p>
        : (
          <>
            <p><strong>{donnees.inviteur}</strong> vous a ajouté(e) à ses proches (sous le nom « {donnees.nom} ») et propose d’associer cette fiche à votre compte.</p>
            <p className={styles.discret}>{donnees.inviteur} pourra alors voir votre liste d’envies (sans que vous sachiez qui réserve quoi), votre date d’anniversaire si vous l’avez indiquée, et vous inviter à ses cagnottes. Vous pourrez retirer l’association quand vous voulez.</p>
            {d.compte ? (
              <div className="actions">
                <button type="button" className="btn" onClick={() => repondre(true)}>Accepter</button>
                <button type="button" className="btn btn--contour" onClick={() => repondre(false)}>Refuser</button>
              </div>
            ) : (
              <p><Lien className="btn" href={`/?retour=${encodeURIComponent(`/rejoindre/${jeton}`)}`}>Me connecter ou créer mon compte</Lien></p>
            )}
          </>
        )}
    </section>
  );
}
