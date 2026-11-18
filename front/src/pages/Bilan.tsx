import { useState } from 'react';
import { euros } from '../calculs/argent';
import { anneesDisponibles, aujourdhui, bilanAnnee, bilanParGroupe, type Ligne } from '../calculs/bilan';
import { Chiffre, EnTete } from '../components/commun';
import { useDonnees } from '../donnees/contexte';
import styles from './pages.module.css';

function Tableau({ titre, lignes, total }: { titre: string; lignes: Ligne[]; total: number | null }) {
  const max = Math.max(1, ...lignes.map((l) => l.total));
  return (
    <section className="carte" aria-labelledby={`t-${titre}`}>
      <h2 id={`t-${titre}`} style={{ marginBottom: '.6rem' }}>{titre}</h2>
      {lignes.length === 0 ? <p className={styles.discret}>Rien pour cette année.</p> : (
        <table className={styles.tableau}>
          <thead>
            <tr><th scope="col">Nom</th><th scope="col" className={styles.nombre}>Dépensé</th><th scope="col" className={styles.nombre}>Prévu</th><th scope="col" className={styles.nombre}>Total</th></tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.cle}>
                <td>
                  {l.libelle}
                  <div className={styles.barreHorizontale} aria-hidden="true"><span style={{ width: `${(l.total / max) * 100}%` }} /></div>
                </td>
                <td className={`${styles.nombre} chiffre`}>{euros(l.depense)}</td>
                <td className={`${styles.nombre} chiffre`}>{euros(l.prevu)}</td>
                <td className={`${styles.nombre} chiffre`}><strong>{euros(l.total)}</strong></td>
              </tr>
            ))}
          </tbody>
          {total !== null && (
            <tfoot>
              <tr><td colSpan={3}>Total</td><td className={`${styles.nombre} chiffre`}>{euros(total)}</td></tr>
            </tfoot>
          )}
        </table>
      )}
    </section>
  );
}

/** Combien coûtent les cadeaux dans l'année : total, par occasion, par personne, et comparaison avec l'année d'avant. */
export function Bilan() {
  const d = useDonnees();
  const courante = Number(aujourdhui().slice(0, 4));
  const [annee, setAnnee] = useState(courante);
  const b = bilanAnnee(annee, d);
  const avant = bilanAnnee(annee - 1, d);
  const ecart = b.total - avant.total;
  const totalCadeaux = b.depense + b.prevu;

  return (
    <div className={styles.pile}>
      <EnTete titre={`Bilan ${annee}`} sousTitre="Ce que vous avez dépensé, ce qui est encore prévu, et vos parts de cagnottes." />
      <div className={styles.annees} role="group" aria-label="Année">
        {anneesDisponibles(d.occasions, d.cagnottes, courante).map((a) => (
          <button key={a} type="button" aria-pressed={a === annee} onClick={() => setAnnee(a)}>{a}</button>
        ))}
      </div>
      <div className={styles.chiffres}>
        <Chiffre libelle={`Total ${annee}`} valeur={euros(b.total)} ton="accent" />
        <Chiffre libelle="Déjà dépensé" valeur={euros(b.depense)} ton="vert" />
        <Chiffre libelle="Encore prévu" valeur={euros(b.prevu)} ton="or" />
        <Chiffre libelle="Mes parts de cagnottes" valeur={euros(b.cagnottes)} />
      </div>
      {avant.total > 0 && (
        <p className={styles.discret}>
          {annee - 1} : {euros(avant.total)}, soit {ecart === 0 ? 'autant' : `${euros(Math.abs(ecart))} de ${ecart > 0 ? 'plus' : 'moins'}`} cette année.
        </p>
      )}
      <Tableau titre="Par occasion" lignes={b.parOccasion} total={totalCadeaux} />
      <Tableau titre="Par personne" lignes={b.parPersonne} total={totalCadeaux} />
      {d.groupes.length > 0 && (
        <>
          <Tableau titre="Par groupe" lignes={bilanParGroupe(b.parPersonne, d.personnes, d.groupes)} total={null} />
          <p className={styles.discret}>Un proche qui est dans plusieurs groupes compte dans chacun d’eux.</p>
        </>
      )}
      {b.cagnottes > 0 && <p className={styles.discret}>Vos parts de cagnottes ({euros(b.cagnottes)}) s’ajoutent à ces tableaux dans le total de l’année.</p>}
    </div>
  );
}
