import type { Personne, TypeOccasion } from '../api/types';
import { aujourdhui, dateLisible } from '../calculs/bilan';
import { lien } from '../calculs/famille';
import { feteDesMeres, feteDesPeres, prochaineFete } from '../calculs/occasions';
import { useOccasionPour } from '../donnees/useOccasionPour';
import styles from './ArbreFamille.module.css';

/** « Un cadeau pour Léa » : choix de l'occasion (anniversaire, Noël, plaisir, réussite, fêtes, autre). */
export function ChoixOccasion({ personne, onFermer }: { personne: Personne; onFermer?: () => void }) {
  const { pour, enCours } = useOccasionPour();
  const l = lien(personne.lien);
  const typeFete: TypeOccasion | null = l?.fete === 'meres' ? 'fete-des-meres' : l?.fete === 'peres' ? 'fete-des-peres' : null;
  const occupe = enCours === personne.id;
  const bouton = (type: TypeOccasion, texte: string) => (
    <button type="button" className="btn btn--petit btn--contour" disabled={occupe} onClick={() => pour(personne, type)}>{texte}</button>
  );
  return (
    <section className={`carte ${styles.choix}`} aria-labelledby="titre-choix-occasion">
      <h3 id="titre-choix-occasion">Un cadeau pour {personne.nom}{l && l.libelle !== personne.nom ? ` · ${l.libelle}` : ''}</h3>
      <p>Pour quelle occasion ?</p>
      <div className="actions">
        {personne.dateNaissance
          ? bouton('anniversaire', `Son anniversaire (${dateLisible(personne.dateNaissance, true)})`)
          : <span className={styles.discret}>Ajoutez sa date de naissance pour son anniversaire.</span>}
        {bouton('noel', 'Noël')}
        {bouton('plaisir', 'Pour le plaisir')}
        {bouton('reussite', 'Réussite (promotion, diplôme…)')}
        <button type="button" className="btn btn--petit btn--lien" disabled={occupe} onClick={() => pour(personne, 'autre')}>Autre occasion…</button>
      </div>
      {typeFete && (
        <div className="actions">
          {bouton(typeFete, `${typeFete === 'fete-des-meres' ? 'Fête des mères' : 'Fête des pères'} (${dateLisible(prochaineFete(typeFete === 'fete-des-meres' ? feteDesMeres : feteDesPeres, aujourdhui()), true)})`)}
        </div>
      )}
      {onFermer && <div><button type="button" className="btn btn--lien btn--petit" onClick={onFermer}>Fermer</button></div>}
    </section>
  );
}
