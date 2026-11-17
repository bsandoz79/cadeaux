import { useState } from 'react';
import type { Cadeau } from '../api/types';
import { libelleStatut } from '../api/types';
import { euros } from '../calculs/argent';
import { coutCadeau } from '../calculs/bilan';
import { useDonnees } from '../donnees/contexte';
import { FormulaireCadeau } from './FormulaireCadeau';
import { Lien } from './commun';
import styles from '../pages/pages.module.css';

/** Un cadeau dans une liste : image, titre, pour qui, montant et statut ; « Modifier » ouvre le formulaire. */
export function CarteCadeau({ cadeau, avecOccasion = false, sousTitre }: { cadeau: Cadeau; avecOccasion?: boolean; sousTitre?: string }) {
  const d = useDonnees();
  const [edition, setEdition] = useState(false);
  const personne = d.personnes.find((p) => p.id === cadeau.personneId);
  const cagnotte = cadeau.cagnotteId === null ? undefined : d.cagnottes.find((g) => g.id === cadeau.cagnotteId);
  const cout = coutCadeau(cadeau, d.cagnottes);

  if (edition) {
    return <div className="carte"><FormulaireCadeau cadeau={cadeau} avecOccasion={avecOccasion} onFini={() => setEdition(false)} /></div>;
  }

  const supprimer = async () => {
    if (window.confirm(`Supprimer « ${cadeau.titre} » ?`)) await d.supprimer('cadeaux', cadeau.id);
  };
  const ecart = cadeau.montantDepense !== null && cadeau.montantPrevu !== null ? cadeau.montantDepense - cadeau.montantPrevu : 0;

  return (
    <article className={styles.cadeau}>
      <div className={styles.vignette} aria-hidden="true">
        {cadeau.image ? <img src={cadeau.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : '🎁'}
      </div>
      <div className={styles.cadeauTexte}>
        <strong>{cadeau.lien ? <a href={cadeau.lien} target="_blank" rel="noopener noreferrer">{cadeau.titre}</a> : cadeau.titre}</strong>
        <span className={styles.discret}>{[personne?.nom, sousTitre].filter(Boolean).join(' · ') || 'Personne en particulier'}</span>
        {cadeau.note && <span className={styles.discret}>{cadeau.note}</span>}
        {cagnotte && (
          <span className={styles.discret}>
            Payé à plusieurs : <Lien href={`/cagnottes/${cagnotte.id}`}>cagnotte de {euros(cagnotte.objectif)}</Lien>, ma part {euros(cagnotte.maPart ?? 0)}
          </span>
        )}
        <div className="actions">
          <button type="button" className="btn btn--lien btn--petit" onClick={() => setEdition(true)}>Modifier</button>
          <button type="button" className="btn btn--lien btn--petit btn--danger" onClick={supprimer}>Supprimer</button>
        </div>
      </div>
      <div className={styles.cadeauMontant}>
        <strong className="chiffre">{cout ? euros(cout) : '—'}</strong>
        <span className={`pastille pastille--${cadeau.statut}`}>{libelleStatut(cadeau.statut)}</span>
        {ecart !== 0 && <span className={styles.discret}>{ecart > 0 ? '+' : '−'}{euros(Math.abs(ecart))} sur le budget</span>}
      </div>
    </article>
  );
}
