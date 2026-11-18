import { useState } from 'react';
import type { Personne, TypeOccasion } from '../api/types';
import { aujourdhui, dateLisible } from '../calculs/bilan';
import { feteDesMeres, feteDesPeres, prochaineFete } from '../calculs/occasions';
import { arbre, lien, type Case } from '../calculs/famille';
import { useDonnees } from '../donnees/contexte';
import { useOccasionPour } from '../donnees/useOccasionPour';
import styles from './ArbreFamille.module.css';

/** Choix de l'occasion pour un proche cliqué dans l'arbre. */
function ChoixOccasion({ personne, onFermer }: { personne: Personne; onFermer: () => void }) {
  const { pour, enCours } = useOccasionPour();
  const l = lien(personne.lien);
  const typeFete: TypeOccasion | null = l?.fete === 'meres' ? 'fete-des-meres' : l?.fete === 'peres' ? 'fete-des-peres' : null;
  const occupe = enCours === personne.id;
  const bouton = (type: TypeOccasion, texte: string) => (
    <button type="button" className="btn btn--petit btn--contour" disabled={occupe} onClick={() => pour(personne, type)}>{texte}</button>
  );
  return (
    <section className={`carte ${styles.choix}`} aria-labelledby="titre-choix-occasion">
      <h3 id="titre-choix-occasion">Un cadeau pour {personne.nom}{l ? ` · ${l.libelle}` : ''}</h3>
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
      <div><button type="button" className="btn btn--lien btn--petit" onClick={onFermer}>Fermer</button></div>
    </section>
  );
}

/**
 * Arbre de famille : une rangée par génération, côté papa à gauche, côté maman à droite, moi au centre.
 * Cliquer sur quelqu'un propose ses occasions ; cliquer sur une place vide l'ajoute.
 */
export function ArbreFamille({ onAjouter }: { onAjouter: (lien: string) => void }) {
  const d = useDonnees();
  const [choisi, setChoisi] = useState<number | null>(null);
  const rangees = arbre(d.personnes);
  const personneChoisie = d.personnes.find((p) => p.id === choisi);

  const caseVue = (c: Case, i: number) => c.personne ? (
    <li key={`${c.personne.id}`}>
      <button type="button" className={styles.membre} aria-pressed={choisi === c.personne.id} onClick={() => setChoisi(c.personne!.id)}>
        <span className={styles.lien}>{c.lien.libelle}</span>
        <strong>{c.personne.nom}</strong>
        {c.personne.dateNaissance && <span className={styles.date}>{dateLisible(c.personne.dateNaissance, true)}</span>}
      </button>
    </li>
  ) : (
    <li key={`vide-${c.lien.valeur}-${i}`}>
      <button type="button" className={styles.vide} onClick={() => onAjouter(c.lien.valeur)}>+ {c.lien.libelle}</button>
    </li>
  );

  return (
    <div className={styles.arbre}>
      {rangees.map((r) => (
        <section key={r.generation} className={styles.rangee} aria-label={r.titre}>
          <h3 className={styles.titre}>{r.titre}</h3>
          <div className={styles.cotes}>
            <ul className={styles.cote} aria-label="Côté papa">{r.cotes.papa.map(caseVue)}</ul>
            <ul className={`${styles.cote} ${styles.centre}`} aria-label="Au centre">
              {r.generation === 0 && (
                <li><span className={styles.moi}><span className={styles.lien}>Moi</span><strong>{d.compte?.nom}</strong></span></li>
              )}
              {r.cotes.centre.map(caseVue)}
            </ul>
            <ul className={styles.cote} aria-label="Côté maman">{r.cotes.maman.map(caseVue)}</ul>
            {r.cotes['belle-famille'].length > 0 && <ul className={styles.cote} aria-label="Belle-famille et autres">{r.cotes['belle-famille'].map(caseVue)}</ul>}
          </div>
        </section>
      ))}
      {personneChoisie && <ChoixOccasion personne={personneChoisie} onFermer={() => setChoisi(null)} />}
    </div>
  );
}
