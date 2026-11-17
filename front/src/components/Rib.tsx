import { useState } from 'react';
import { api } from '../api/client';
import type { Cagnotte } from '../api/types';
import { ibanValide, normaliserIban } from '../calculs/iban';
import { Champ } from './commun';
import { erreurChamps, useEnvoi } from './formulaire';
import styles from '../pages/pages.module.css';

const SUPPRESSION = 'Il est supprimé tout seul dès que vous terminez la cagnotte, dès que toutes les parts sont payées, et au plus tard 60 jours après.';

/** Organisateur : son RIB pour recevoir les parts par virement (chiffré, supprimé automatiquement). */
export function RibOrganisateur({ cagnotte, onChange }: { cagnotte: Cagnotte; onChange: () => Promise<void> }) {
  const [ouvert, setOuvert] = useState(false);
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f) => {
    const iban = normaliserIban(String(f.get('iban') ?? ''));
    if (!ibanValide(iban)) throw erreurChamps({ iban: 'IBAN invalide : vérifiez-le sur votre RIB (ex. FR76 3000 6000 0112 3456 7890 189).' });
    await api('PUT', `/cagnottes/${cagnotte.id}/rib`, { titulaire: String(f.get('titulaire') ?? ''), iban });
    setOuvert(false);
    await onChange();
  });
  const supprimer = async () => {
    if (!window.confirm('Supprimer votre RIB de cette cagnotte ?')) return;
    await api('DELETE', `/cagnottes/${cagnotte.id}/rib`);
    await onChange();
  };

  return (
    <section className="carte formulaire" aria-labelledby="titre-rib">
      <h2 id="titre-rib">Recevoir les parts par virement</h2>
      {cagnotte.rib ? (
        <>
          <p>Les participants voient « Payer par virement » et peuvent afficher votre RIB :</p>
          <p><strong>{cagnotte.rib.titulaire}</strong><br /><span className="chiffre">{cagnotte.rib.ibanMasque}</span></p>
          <p className={styles.discret}>{SUPPRESSION}</p>
          <div><button type="button" className="btn btn--petit btn--contour btn--danger" onClick={supprimer}>Supprimer mon RIB</button></div>
        </>
      ) : ouvert ? (
        <form className="formulaire" onSubmit={envoyer} noValidate>
          <Champ libelle="Titulaire du compte" nom="titulaire" required autoComplete="name" erreur={champs.titulaire} />
          <Champ libelle="IBAN" nom="iban" required autoComplete="off" spellCheck={false} placeholder="FR76 …" erreur={champs.iban} />
          <p className={styles.discret}>Votre RIB est enregistré chiffré et montré seulement aux personnes qui ont le lien et cliquent sur « Afficher le RIB ». {SUPPRESSION}</p>
          {erreur && !Object.keys(champs).length && <p className="erreur" role="alert">{erreur}</p>}
          <div className="actions">
            <button className="btn btn--petit" disabled={occupe}>Enregistrer mon RIB</button>
            <button type="button" className="btn btn--petit btn--contour" onClick={() => setOuvert(false)}>Annuler</button>
          </div>
        </form>
      ) : (
        <>
          <p className={styles.discret}>C’est vous qui achetez le cadeau ? Ajoutez votre RIB : les participants pourront vous virer leur part.</p>
          <div><button type="button" className="btn btn--petit btn--contour" onClick={() => setOuvert(true)}>Ajouter mon RIB</button></div>
        </>
      )}
    </section>
  );
}

/** Participant : afficher le RIB de l'organisateur, sur demande, et copier l'IBAN. */
export function RibParticipant({ code, titulaire, organisateur, beneficiaire }: { code: string; titulaire: string; organisateur: string; beneficiaire: string }) {
  const [rib, setRib] = useState<{ titulaire: string; iban: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const afficher = async () => {
    setErreur(null);
    try { setRib(await api('GET', `/c/${code}/rib`)); } catch (e) { setErreur(e instanceof Error ? e.message : 'Une erreur est survenue.'); }
  };
  const copier = async () => {
    if (!rib) return;
    try { await navigator.clipboard.writeText(rib.iban.replace(/\s/g, '')); setCopie(true); setTimeout(() => setCopie(false), 2500); } catch { /* IBAN affiché */ }
  };
  return (
    <section className="carte formulaire" aria-labelledby="titre-virement">
      <h2 id="titre-virement">Payer par virement</h2>
      {rib ? (
        <>
          <dl className={styles.rib}>
            <dt>Titulaire</dt><dd>{rib.titulaire}</dd>
            <dt>IBAN</dt><dd className="chiffre">{rib.iban}</dd>
            <dt>Libellé conseillé</dt><dd>Cadeau {beneficiaire}</dd>
          </dl>
          <div><button type="button" className="btn btn--petit" onClick={copier}>{copie ? 'IBAN copié' : 'Copier l’IBAN'}</button></div>
          <p className={styles.discret}>Le virement va directement à {organisateur} : le site ne touche pas à l’argent.</p>
        </>
      ) : (
        <>
          <p>{organisateur} a ajouté son RIB ({titulaire}) pour recevoir les parts.</p>
          <div><button type="button" className="btn btn--petit btn--contour" onClick={afficher}>Afficher le RIB</button></div>
          {erreur && <p className="erreur" role="alert">{erreur}</p>}
        </>
      )}
    </section>
  );
}
