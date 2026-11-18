import { useState } from 'react';
import { api } from '../api/client';
import type { Personne } from '../api/types';
import { euros } from '../calculs/argent';
import { useDonnees } from '../donnees/contexte';
import { useChargement } from '../donnees/useChargement';
import { Partage } from './Partage';
import styles from '../pages/pages.module.css';

interface EnviesDuProche {
  proprietaire: string;
  envies: { id: number; titre: string; lien: string | null; prix: number | null; note: string | null; priorite: boolean;
    reservation: { id: number; nom: string; cagnotte: string | null; parMoi: boolean } | null }[];
}

/** Sa liste d'envies, depuis sa fiche : réserver ou annuler en un clic (la personne ne voit jamais qui a pris quoi). */
function SesEnvies({ personne }: { personne: Personne }) {
  const { donnees, erreur, recharger } = useChargement(() => api<EnviesDuProche>('GET', `/personnes/${personne.id}/envies`), [personne.id]);
  const [probleme, setProbleme] = useState<string | null>(null);
  const agir = async (methode: 'POST' | 'DELETE', envieId: number) => {
    setProbleme(null);
    try { await api(methode, `/personnes/${personne.id}/envies/${envieId}/reservation`); } catch (e) { setProbleme(e instanceof Error ? e.message : 'Une erreur est survenue.'); }
    await recharger();
  };
  if (erreur) return <p className="erreur">Liste indisponible.</p>;
  if (!donnees) return <p className={styles.discret}>Chargement…</p>;
  if (donnees.envies.length === 0) return <p className={styles.discret}>{donnees.proprietaire} n’a pas encore noté d’envies.</p>;
  return (
    <div className="formulaire" style={{ gap: '.5rem' }}>
      <p className={styles.discret}>Ce qui ferait plaisir à {donnees.proprietaire}. Il ou elle ne voit pas ce que vous réservez.</p>
      <ul className={styles.liste}>
        {donnees.envies.map((e) => (
          <li key={e.id} className={styles.ligneListe}>
            <div>
              <strong>{e.lien ? <a href={e.lien} target="_blank" rel="noopener noreferrer">{e.titre}</a> : e.titre}</strong>
              {e.priorite && <span className="pastille pastille--idee" style={{ marginLeft: '.4rem' }}>Très envie</span>}
              <div className={styles.discret}>
                {e.reservation?.parMoi ? 'Vous vous en occupez.' : e.reservation ? `Déjà pris par ${e.reservation.nom}` : e.note ?? ''}
              </div>
            </div>
            <div className="actions" style={{ justifyContent: 'flex-end' }}>
              {e.prix !== null && <strong className="chiffre">{euros(e.prix)}</strong>}
              {e.reservation?.parMoi ? (
                <button type="button" className="btn btn--lien btn--petit" onClick={() => agir('DELETE', e.id)}>Annuler</button>
              ) : !e.reservation && (
                <button type="button" className="btn btn--petit btn--contour" onClick={() => agir('POST', e.id)}>Je m’en occupe</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {probleme && <p className="erreur" role="alert">{probleme}</p>}
    </div>
  );
}

/** Sur la fiche d'un proche : l'associer à son compte (invitation), ou voir sa liste d'envies s'il l'est. */
export function AssociationProche({ personne }: { personne: Personne }) {
  const d = useDonnees();
  const [lien, setLien] = useState<string | null>(null);
  const [envies, setEnvies] = useState(false);
  const inviter = async () => setLien((await api<{ url: string }>('POST', `/personnes/${personne.id}/invitation`)).url);
  const dissocier = async () => {
    if (!window.confirm(`Dissocier la fiche « ${personne.nom} » de son compte ?`)) return;
    await api('DELETE', `/personnes/${personne.id}/association`);
    await d.recharger();
  };

  if (personne.compteLie) {
    return (
      <div className="formulaire" style={{ gap: '.4rem', marginTop: '.4rem' }}>
        <p className={styles.discret}>Associé au compte de {personne.compteLie.nom}.</p>
        <div className="actions">
          <button type="button" className="btn btn--petit btn--contour" aria-expanded={envies} onClick={() => setEnvies(!envies)}>Sa liste d’envies</button>
          <button type="button" className="btn btn--lien btn--petit" onClick={dissocier}>Dissocier</button>
        </div>
        {envies && <div className="carte"><SesEnvies personne={personne} /></div>}
      </div>
    );
  }
  return (
    <div className="formulaire" style={{ gap: '.4rem', marginTop: '.4rem' }}>
      {lien ? (
        <>
          <p className={styles.discret}>Envoyez ce lien à {personne.nom} : il ou elle l’ouvre, se connecte (ou crée son compte) et accepte. Valable 30 jours.</p>
          <Partage url={lien} titre="Cadeaux" message={`${d.compte?.nom} t’a ajouté(e) dans Cadeaux. Associe ton compte pour partager ta liste d’envies : ${lien}`} />
        </>
      ) : (
        <div><button type="button" className="btn btn--lien btn--petit" onClick={inviter}>Associer à son compte</button></div>
      )}
    </div>
  );
}
