import { useState } from 'react';
import { useChargement } from '../donnees/useChargement';
import { api } from '../api/client';
import type { CagnottePublique as Cagnotte, Participation } from '../api/types';
import { euros } from '../calculs/argent';
import { dateLisible } from '../calculs/bilan';
import { etatCagnotte, partConseillee } from '../calculs/cagnotte';
import { Champ, Jauge, Lien } from '../components/commun';
import { ChoixMontant } from '../components/ChoixMontant';
import { RibParticipant } from '../components/Rib';
import { erreurChamps, montantDuFormulaire, useEnvoi } from '../components/formulaire';
import styles from './pages.module.css';

/** Clés des parts ajoutées depuis ce navigateur : elles permettent de les modifier ou de les retirer. */
const cleStockage = (code: string) => `cadeaux.parts.${code}`;
function lireCles(code: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(cleStockage(code)) ?? '{}'); } catch { return {}; }
}
function ecrireCles(code: string, cles: Record<string, string>) {
  try { localStorage.setItem(cleStockage(code), JSON.stringify(cles)); } catch { /* navigation privée */ }
}

/** Page ouverte depuis le lien partagé : voir la cagnotte et ajouter sa part, sans compte. */
export function CagnottePublique({ code }: { code: string }) {
  const [cles, setCles] = useState(() => lireCles(code));
  const [edition, setEdition] = useState<Participation | null>(null);
  const [merci, setMerci] = useState(false);
  // Change après chaque envoi : le formulaire repart à vide.
  const [envois, setEnvois] = useState(0);

  const { donnees: cagnotte, erreur: erreurChargement, recharger: charger } = useChargement(() => api<Cagnotte>('GET', `/c/${code}`), [code]);
  const introuvable = erreurChargement !== undefined;

  const conseil = cagnotte ? partConseillee(cagnotte.objectif, cagnotte.nombreParts) : null;
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f, form) => {
    const montant = montantDuFormulaire(f, 'montant');
    if (!montant) throw erreurChamps({ montant: 'Indiquez votre part (ex. 20).' });
    const corps = { nom: String(f.get('nom') ?? ''), montant };
    if (edition) {
      await api('PATCH', `/c/${code}/participations/${edition.id}`, corps, { 'X-Cle-Participation': cles[edition.id] });
      setEdition(null);
    } else {
      const r = await api<{ participation: Participation; cle: string }>('POST', `/c/${code}/participations`, corps);
      const nouvelles = { ...cles, [r.participation.id]: r.cle };
      setCles(nouvelles);
      ecrireCles(code, nouvelles);
      setMerci(true);
    }
    form.reset();
    setEnvois((n) => n + 1);
    await charger();
  });

  if (introuvable) {
    return (
      <div className="vide">
        <h1>Cagnotte introuvable</h1>
        <p>Le lien est peut-être incomplet, ou la cagnotte a été supprimée. Demandez le lien à l’organisateur.</p>
      </div>
    );
  }
  if (!cagnotte) return <p className={styles.discret}>Chargement…</p>;

  const etat = etatCagnotte(cagnotte.objectif, cagnotte.participations);
  const retirer = async (p: Participation) => {
    if (!window.confirm(`Retirer votre part de ${euros(p.montant)} ?`)) return;
    await api('DELETE', `/c/${code}/participations/${p.id}`, undefined, { 'X-Cle-Participation': cles[p.id] });
    const { [p.id]: _, ...reste } = cles;
    setCles(reste);
    ecrireCles(code, reste);
    await charger();
  };

  return (
    <div className={styles.pile}>
      <header>
        <p className={styles.surtitre}>Cadeau commun pour {cagnotte.beneficiaire}</p>
        <h1>{cagnotte.titre}</h1>
        <p className={styles.chapo}>
          Organisé par {cagnotte.organisateur}{cagnotte.dateLimite ? `, à régler avant le ${dateLisible(cagnotte.dateLimite)}` : ''}.
        </p>
      </header>

      {cagnotte.message && <blockquote className="carte" style={{ margin: 0, whiteSpace: 'pre-line' }}>{cagnotte.message}</blockquote>}
      {cagnotte.lien && <p><a href={cagnotte.lien} target="_blank" rel="noopener noreferrer">Voir le cadeau</a></p>}

      <section className={`carte ${styles.objectif}`} aria-label="Avancement">
        <div className={styles.objectifChiffres}>
          <strong className="chiffre">{euros(etat.total)}</strong>
          <span>sur {euros(cagnotte.objectif)}</span>
        </div>
        <Jauge pourcentage={etat.pourcentage} libelle="Avancement de la cagnotte" />
        <p>{etat.reste > 0 ? `Il manque ${euros(etat.reste)}.` : 'L’objectif est atteint, merci à tous !'}</p>
        {cagnotte.mode === 'egal' && conseil && <p className={styles.discret}>Parts égales : {euros(conseil)} par personne ({cagnotte.nombreParts} participants).</p>}
      </section>

      {cagnotte.rib && !cagnotte.close && (
        <RibParticipant code={code} titulaire={cagnotte.rib.titulaire} organisateur={cagnotte.organisateur} beneficiaire={cagnotte.beneficiaire} recent={cagnotte.rib.recent} />
      )}

      {cagnotte.close ? (
        <p className="vide">Cette cagnotte est terminée : on ne peut plus y participer.</p>
      ) : (
        <section className="carte" aria-labelledby="titre-participer">
          <h2 id="titre-participer" style={{ marginBottom: '.8rem' }}>{edition ? 'Modifier ma part' : 'Je participe'}</h2>
          {merci && !edition && <p role="status" style={{ color: 'var(--c-vert)', fontWeight: 600, marginBottom: '.8rem' }}>Merci, votre part est notée. Pensez à la donner à {cagnotte.organisateur}.</p>}
          <form key={`${edition?.id ?? 'nouvelle'}-${envois}`} className="formulaire" onSubmit={envoyer} noValidate>
            <Champ libelle="Votre prénom" nom="nom" required autoComplete="given-name" defaultValue={edition?.nom} erreur={champs.nom} />
            <ChoixMontant conseil={conseil} reste={etat.reste + (edition?.montant ?? 0)} depart={edition?.montant ?? null} erreur={champs.montant} />
            {erreur && <p className="erreur" role="alert">{erreur}</p>}
            <div className="actions">
              <button className="btn" disabled={occupe}>{edition ? 'Enregistrer' : 'Ajouter ma part'}</button>
              {edition && <button type="button" className="btn btn--contour" onClick={() => setEdition(null)}>Annuler</button>}
            </div>
          </form>
          <p className={styles.note} style={{ marginTop: '.8rem' }}>
            Le site note seulement les montants : l’argent se donne directement à {cagnotte.organisateur}. Votre prénom et votre part sont visibles par toutes les personnes qui ont ce lien ; vous pouvez les modifier ou les retirer depuis ce navigateur.{' '}
            <Lien href="/confidentialite">Confidentialité</Lien>
          </p>
        </section>
      )}

      <section className="carte" aria-labelledby="titre-participants">
        <h2 id="titre-participants" style={{ marginBottom: '.5rem' }}>Participants ({cagnotte.participations.length})</h2>
        {cagnotte.participations.length === 0 ? <p className={styles.discret}>Soyez le premier !</p> : (
          <ul className={styles.liste}>
            {cagnotte.participations.map((p) => (
              <li key={p.id} className={styles.ligneListe}>
                <div>
                  <strong>{p.nom}</strong>{p.paye ? <span className="pastille pastille--offert" style={{ marginLeft: '.5rem' }}>Payé</span> : null}
                  {cles[p.id] && !cagnotte.close && (
                    <div className="actions">
                      <button type="button" className="btn btn--lien btn--petit" onClick={() => setEdition(p)}>Modifier</button>
                      <button type="button" className="btn btn--lien btn--petit btn--danger" onClick={() => retirer(p)}>Retirer</button>
                    </div>
                  )}
                </div>
                <strong className="chiffre">{euros(p.montant)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
