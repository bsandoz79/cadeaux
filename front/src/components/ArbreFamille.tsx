import { useState } from 'react';
import { dateLisible } from '../calculs/bilan';
import { arbre, type Case } from '../calculs/famille';
import { useDonnees } from '../donnees/contexte';
import { ChoixOccasion } from './ChoixOccasion';
import { Lien } from './commun';
import styles from './ArbreFamille.module.css';

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
      {personneChoisie && (
        <div className="formulaire" style={{ gap: '.4rem' }}>
          <ChoixOccasion personne={personneChoisie} onFermer={() => setChoisi(null)} />
          <Lien href={`/proches/${personneChoisie.id}`}>Voir la fiche de {personneChoisie.nom}</Lien>
        </div>
      )}
    </div>
  );
}
