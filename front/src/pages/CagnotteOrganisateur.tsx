import { useState } from 'react';
import { api } from '../api/client';
import type { Cagnotte, Participation } from '../api/types';
import { euros, saisieDepuis } from '../calculs/argent';
import { dateLisible } from '../calculs/bilan';
import { etatCagnotte, partConseillee } from '../calculs/cagnotte';
import { Champ, ChampMontant, Chiffre, EnTete, Jauge, Lien } from '../components/commun';
import { FormulaireCagnotte } from '../components/FormulaireCagnotte';
import { Partage } from '../components/Partage';
import { RibOrganisateur } from '../components/Rib';
import { erreurChamps, montantDuFormulaire, useEnvoi } from '../components/formulaire';
import { useDonnees } from '../donnees/contexte';
import { useChargement } from '../donnees/useChargement';
import { aller } from '../navigation';
import styles from './pages.module.css';

/** Cagnotte vue par son organisateur : lien à partager, parts reçues, reste à compléter. */
export function CagnotteOrganisateur({ id }: { id: number }) {
  const d = useDonnees();
  const { donnees: cagnotte, erreur, recharger: charger } = useChargement(() => api<Cagnotte>('GET', `/cagnottes/${id}`), [id]);
  const introuvable = erreur !== undefined;
  const [edition, setEdition] = useState(false);

  /** Après un changement : la cagnotte et les totaux du compte (bilan, accueil). */
  const apres = async () => { await Promise.all([charger(), d.recharger()]); };

  if (introuvable) return <p className="vide">Cette cagnotte n’existe pas ou a été supprimée. <Lien href="/cagnottes">Toutes les cagnottes</Lien></p>;
  if (!cagnotte) return <p className={styles.discret}>Chargement…</p>;

  const participations = cagnotte.participations ?? [];
  const etat = etatCagnotte(cagnotte.objectif, participations);
  const lien = `${window.location.origin}/c/${cagnotte.code}`;
  const maPart = participations.filter((p) => p.organisateur).reduce((s, p) => s + p.montant, 0);


  const completer = async () => {
    await api('POST', `/cagnottes/${id}/participations`, { nom: d.compte?.nom ?? 'Moi', montant: etat.reste, paye: true, organisateur: true });
    await apres();
  };
  const basculerPaye = async (p: Participation) => {
    await api('PATCH', `/cagnottes/${id}/participations/${p.id}`, { paye: !p.paye });
    await apres();
  };
  const retirer = async (p: Participation) => {
    if (!window.confirm(`Retirer la part de ${p.nom} (${euros(p.montant)}) ?`)) return;
    await api('DELETE', `/cagnottes/${id}/participations/${p.id}`);
    await apres();
  };
  const cloturer = async () => {
    await d.modifier('cagnottes', id, { close: !cagnotte.close });
    await charger();
  };
  const supprimer = async () => {
    if (!window.confirm(`Supprimer la cagnotte « ${cagnotte.titre} » ? Le lien ne marchera plus.`)) return;
    await d.supprimer('cagnottes', id);
    aller('/cagnottes');
  };

  return (
    <div className={styles.pile}>
      <EnTete titre={cagnotte.titre} retour={{ href: '/cagnottes', libelle: 'Cagnottes' }}
        sousTitre={`Pour ${cagnotte.beneficiaire}${cagnotte.dateLimite ? ` · avant le ${dateLisible(cagnotte.dateLimite)}` : ''}${cagnotte.close ? ' · terminée' : ''}`}>
        <button type="button" className="btn btn--petit btn--contour" onClick={() => setEdition(!edition)}>Modifier</button>
        <button type="button" className="btn btn--petit btn--contour" onClick={cloturer}>{cagnotte.close ? 'Rouvrir' : 'Terminer'}</button>
        <button type="button" className="btn btn--petit btn--contour btn--danger" onClick={supprimer}>Supprimer</button>
      </EnTete>

      {edition && <div className="carte"><FormulaireCagnotte cagnotte={cagnotte} onFini={(c) => { setEdition(false); if (c) void charger(); }} /></div>}

      {!cagnotte.close && (
        <section className="carte formulaire" aria-labelledby="titre-partage">
          <h2 id="titre-partage">Envoyez ce lien aux participants</h2>
          <p className={styles.discret}>Ils voient le cadeau et ce qui a déjà été mis, et notent leur part. Pas besoin de compte.</p>
          <Partage url={lien} beneficiaire={cagnotte.beneficiaire} titre={cagnotte.titre} />
        </section>
      )}

      {!cagnotte.close && <InviterProches cagnotteId={cagnotte.id} />}

      {!cagnotte.close && <RibOrganisateur cagnotte={cagnotte} onChange={apres} />}

      <section className={`carte ${styles.objectif}`} aria-label="Avancement">
        <div className={styles.objectifChiffres}>
          <strong className="chiffre">{euros(etat.total)}</strong>
          <span>sur {euros(cagnotte.objectif)}</span>
        </div>
        <Jauge pourcentage={etat.pourcentage} libelle="Avancement de la cagnotte" />
        <div className={styles.chiffres}>
          {etat.reste > 0 ? <Chiffre libelle="Il manque" valeur={euros(etat.reste)} ton="or" />
            : <Chiffre libelle="Objectif" valeur={etat.surplus ? `Atteint, ${euros(etat.surplus)} en trop` : 'Atteint'} ton="vert" />}
          <Chiffre libelle="Déjà reçu" valeur={euros(etat.paye)} ton="vert" />
          <Chiffre libelle="Ma part" valeur={euros(maPart)} />
        </div>
        {cagnotte.mode === 'egal' && cagnotte.nombreParts && (
          <p className={styles.discret}>Parts égales : {euros(partConseillee(cagnotte.objectif, cagnotte.nombreParts) ?? 0)} chacun, pour {cagnotte.nombreParts} participants.</p>
        )}
        {etat.reste > 0 && !cagnotte.close && (
          <div className="actions">
            <button type="button" className="btn" onClick={completer}>Je complète les {euros(etat.reste)} qui restent</button>
          </div>
        )}
      </section>

      <section className="carte" aria-labelledby="titre-parts">
        <h2 id="titre-parts" style={{ marginBottom: '.5rem' }}>Participants ({participations.length})</h2>
        {participations.length === 0 ? <p className={styles.discret}>Personne n’a encore participé.</p> : (
          <table className={styles.tableau}>
            <thead><tr><th scope="col">Nom</th><th scope="col" className={styles.nombre}>Montant</th><th scope="col">Payé</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {participations.map((p) => (
                <tr key={p.id} className={p.organisateur ? styles.moi : undefined}>
                  <td>{p.nom}{p.organisateur ? ' (moi)' : ''}</td>
                  <td className={`${styles.nombre} chiffre`}>{euros(p.montant)}</td>
                  <td>
                    <label className={styles.coche}>
                      <input type="checkbox" checked={p.paye} onChange={() => basculerPaye(p)} />
                      <span className="sr-only">Part de {p.nom} payée</span>
                      <span aria-hidden="true">{p.paye ? 'Oui' : 'Non'}</span>
                    </label>
                  </td>
                  <td><button type="button" className="btn btn--lien btn--petit btn--danger" onClick={() => retirer(p)}>Retirer</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>Total</td><td className={`${styles.nombre} chiffre`}>{euros(etat.total)}</td><td colSpan={2} /></tr></tfoot>
          </table>
        )}
        <AjouterPart cagnotte={cagnotte} onAjout={apres} />
      </section>
    </div>
  );
}

/** L'organisateur note la part de quelqu'un qui ne passe pas par le lien (argent donné en main propre). */
function AjouterPart({ cagnotte, onAjout }: { cagnotte: Cagnotte; onAjout: () => Promise<void> }) {
  const [ouvert, setOuvert] = useState(false);
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f, form) => {
    const montant = montantDuFormulaire(f, 'montant');
    if (!montant) throw erreurChamps({ montant: 'Indiquez un montant (ex. 20).' });
    await api('POST', `/cagnottes/${cagnotte.id}/participations`, { nom: String(f.get('nom') ?? ''), montant, paye: f.get('paye') === 'on' });
    form.reset();
    setOuvert(false);
    await onAjout();
  });
  if (!ouvert) return <button type="button" className="btn btn--contour btn--petit" style={{ marginTop: '.8rem' }} onClick={() => setOuvert(true)}>Ajouter une part à la main</button>;
  return (
    <form className="formulaire" onSubmit={envoyer} noValidate style={{ marginTop: '1rem' }}>
      <div className="rangee">
        <Champ libelle="Prénom" nom="nom" required erreur={champs.nom} />
        <ChampMontant libelle="Montant (€)" nom="montant" defaultValue={saisieDepuis(partConseillee(cagnotte.objectif, cagnotte.nombreParts))} erreur={champs.montant} />
      </div>
      <label className={styles.coche}><input type="checkbox" name="paye" /> Déjà payé</label>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="actions">
        <button className="btn btn--petit" disabled={occupe}>Ajouter</button>
        <button type="button" className="btn btn--petit btn--contour" onClick={() => setOuvert(false)}>Annuler</button>
      </div>
    </form>
  );
}

/** Inviter des proches associés à leur compte : ils retrouvent la cagnotte chez eux et reçoivent un e-mail. */
function InviterProches({ cagnotteId }: { cagnotteId: number }) {
  const d = useDonnees();
  const associes = d.personnes.filter((p) => p.compteLie);
  const [message, setMessage] = useState<string | null>(null);
  const { envoyer, occupe, erreur } = useEnvoi(async (f) => {
    const r = await api<{ envoyees: number }>('POST', `/cagnottes/${cagnotteId}/invites`, { personneIds: f.getAll('proches').map(Number) });
    setMessage(r.envoyees ? `${r.envoyees} invitation(s) envoyée(s).` : 'Déjà invités.');
  });
  if (associes.length === 0) return null;
  return (
    <section className="carte formulaire" aria-labelledby="titre-inviter">
      <h2 id="titre-inviter">Inviter des proches</h2>
      <p className={styles.discret}>Ceux qui ont associé leur compte retrouvent la cagnotte chez eux et reçoivent un e-mail.</p>
      <form className="formulaire" onSubmit={envoyer}>
        <div className="actions">
          {associes.map((p) => <label key={p.id} className={styles.coche}><input type="checkbox" name="proches" value={p.id} /> {p.nom}</label>)}
        </div>
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        {message && <p role="status" style={{ color: 'var(--c-vert)', fontWeight: 600 }}>{message}</p>}
        <div><button className="btn btn--petit btn--contour" disabled={occupe}>Inviter</button></div>
      </form>
    </section>
  );
}
