import { useState } from 'react';
import { useChargement } from '../donnees/useChargement';
import { api } from '../api/client';
import type { ListePublique } from '../api/types';
import { euros } from '../calculs/argent';
import { Champ, Lien } from '../components/commun';
import { useEnvoi } from '../components/formulaire';
import styles from './pages.module.css';

/** Réservations faites depuis ce navigateur (clé pour annuler) et prénom déjà saisi. */
const CLE = (code: string) => `cadeaux.reservations.${code}`;
const lire = (code: string): Record<string, string> => { try { return JSON.parse(localStorage.getItem(CLE(code)) ?? '{}'); } catch { return {}; } };
const ecrire = (code: string, v: Record<string, string>) => { try { localStorage.setItem(CLE(code), JSON.stringify(v)); } catch { /* navigation privée */ } };
const lirePrenom = () => { try { return localStorage.getItem('cadeaux.prenom') ?? ''; } catch { return ''; } };
const ecrirePrenom = (p: string) => { try { localStorage.setItem('cadeaux.prenom', p); } catch { /* navigation privée */ } };

/** Liste d'envies ouverte depuis son lien : chacun réserve ce qu'il offre, sans compte. */
export function ListeEnviesPublique({ code }: { code: string }) {
  const [cles, setCles] = useState(() => lire(code));
  const [choix, setChoix] = useState<number | null>(null);

  const { donnees: liste, erreur, recharger: charger } = useChargement(() => api<ListePublique>('GET', `/l/${code}`), [code]);
  const introuvable = erreur !== undefined;

  const reserver = useEnvoi(async (f) => {
    const nom = String(f.get('nom') ?? '').trim();
    const r = await api<{ reservation: { id: number }; cle: string }>('POST', `/l/${code}/envies/${choix}/reservation`, { nom });
    const nouvelles = { ...cles, [String(choix)]: r.cle };
    setCles(nouvelles);
    ecrire(code, nouvelles);
    ecrirePrenom(nom);
    setChoix(null);
    await charger();
  });
  const annuler = async (envieId: number) => {
    if (!window.confirm('Annuler votre réservation ? D’autres pourront la prendre.')) return;
    await api('DELETE', `/l/${code}/envies/${envieId}/reservation`, undefined, { 'X-Cle-Reservation': cles[envieId] });
    const { [envieId]: _, ...reste } = cles;
    setCles(reste);
    ecrire(code, reste);
    await charger();
  };

  if (introuvable) {
    return (
      <div className="vide">
        <h1>Liste introuvable</h1>
        <p>Le lien est peut-être incomplet, ou la personne a coupé le partage. Demandez-lui le nouveau lien.</p>
      </div>
    );
  }
  if (!liste) return <p className={styles.discret}>Chargement…</p>;

  return (
    <div className={styles.pile}>
      <header>
        <p className={styles.surtitre}>Liste d’envies</p>
        <h1>Ce qui ferait plaisir à {liste.proprietaire}</h1>
        {!liste.estProprietaire && (
          <p className={styles.chapo}>Vous lui offrez quelque chose ? Cliquez sur « Je m’en occupe » : les autres verront que c’est pris, et {liste.proprietaire} ne le saura pas.</p>
        )}
      </header>

      {liste.estProprietaire && (
        <p className="carte" role="status">C’est votre liste : les réservations vous sont cachées pour garder la surprise. <Lien href="/envies">Modifier ma liste</Lien></p>
      )}
      {liste.message && <blockquote className="carte" style={{ margin: 0, whiteSpace: 'pre-line' }}>{liste.message}</blockquote>}
      {liste.envies.length === 0 && <p className="vide">La liste est vide pour l’instant.</p>}

      <div className={styles.pile} style={{ gap: '.6rem' }}>
        {liste.envies.map((e) => {
          const parMoi = cles[e.id] !== undefined && e.reservation !== null;
          return (
            <article key={e.id} className={styles.cadeau} style={e.reservation && !parMoi ? { opacity: .65 } : undefined}>
              <div className={styles.vignette} aria-hidden="true">
                {e.image ? <img src={e.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : '✨'}
              </div>
              <div className={styles.cadeauTexte}>
                <strong>{e.lien ? <a href={e.lien} target="_blank" rel="noopener noreferrer">{e.titre}</a> : e.titre}</strong>
                {e.note && <span className={styles.discret}>{e.note}</span>}
                {!liste.estProprietaire && (
                  parMoi ? (
                    <p style={{ color: 'var(--c-vert)', fontWeight: 600 }}>
                      Vous vous en occupez. <button type="button" className="btn btn--lien btn--petit" onClick={() => annuler(e.id)}>Annuler</button>
                    </p>
                  ) : e.reservation ? (
                    <p className={styles.discret}>Déjà pris par {e.reservation.nom}</p>
                  ) : choix === e.id ? (
                    <form className="formulaire" onSubmit={reserver.envoyer} noValidate style={{ marginTop: '.4rem' }}>
                      <Champ libelle="Votre prénom" nom="nom" required autoComplete="given-name" defaultValue={lirePrenom()} erreur={reserver.champs.nom} autoFocus />
                      {reserver.erreur && !reserver.champs.nom && <p className="erreur" role="alert">{reserver.erreur}</p>}
                      <div className="actions">
                        <button className="btn btn--petit" disabled={reserver.occupe}>Réserver</button>
                        <button type="button" className="btn btn--petit btn--contour" onClick={() => setChoix(null)}>Annuler</button>
                      </div>
                    </form>
                  ) : (
                    <div><button type="button" className="btn btn--petit btn--contour" onClick={() => setChoix(e.id)}>Je m’en occupe</button></div>
                  )
                )}
              </div>
              <div className={styles.cadeauMontant}>
                <strong className="chiffre">{e.prix ? euros(e.prix) : '—'}</strong>
                {e.priorite && <span className="pastille pastille--idee">Très envie</span>}
              </div>
            </article>
          );
        })}
      </div>

      {!liste.estProprietaire && (
        <p className={styles.note}>
          Votre prénom est visible par ceux qui ont ce lien, mais pas par {liste.proprietaire}. Vous pouvez annuler depuis ce navigateur.{' '}
          <Lien href="/confidentialite">Confidentialité</Lien>
        </p>
      )}
    </div>
  );
}
