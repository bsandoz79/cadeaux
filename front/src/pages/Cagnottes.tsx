import { euros } from '../calculs/argent';
import { dateLisible } from '../calculs/bilan';
import { Depliable, EnTete, Jauge, Lien } from '../components/commun';
import { FormulaireCagnotte } from '../components/FormulaireCagnotte';
import { useDonnees } from '../donnees/contexte';
import { useChargement } from '../donnees/useChargement';
import { api } from '../api/client';
import { aller } from '../navigation';
import styles from './pages.module.css';

/** Les cagnottes que vous organisez. */
export function Cagnottes() {
  const d = useDonnees();
  const enCours = d.cagnottes.filter((c) => !c.close);
  const closes = d.cagnottes.filter((c) => c.close);

  const liste = (cagnottes: typeof d.cagnottes) => (
    <ul className={styles.grille}>
      {cagnottes.map((c) => {
        const total = c.total ?? 0;
        const pourcentage = c.objectif > 0 ? Math.min(100, Math.round((total / c.objectif) * 100)) : 0;
        return (
          <li key={c.id} className="carte">
            <Lien href={`/cagnottes/${c.id}`}><strong>{c.titre}</strong></Lien>
            <p className={styles.discret}>
              Pour {c.beneficiaire}{c.dateLimite ? ` · avant le ${dateLisible(c.dateLimite)}` : ''}
            </p>
            <Jauge pourcentage={pourcentage} libelle={`Cagnotte ${c.titre}`} />
            <p className="chiffre">
              {euros(total)} sur {euros(c.objectif)} · {c.nombreParticipations ?? 0} participant{(c.nombreParticipations ?? 0) > 1 ? 's' : ''}
            </p>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={styles.pile}>
      <EnTete titre="Cagnottes" sousTitre="Un cadeau à plusieurs : vous choisissez le cadeau, vous envoyez le lien, chacun note sa part." />
      <Depliable bouton="Nouvelle cagnotte">
        {(fermer) => <FormulaireCagnotte onFini={(c) => { fermer(); if (c) aller(`/cagnottes/${c.id}`); }} />}
      </Depliable>
      <MesInvitations />
      {d.cagnottes.length === 0 && <p className="vide">Aucune cagnotte pour l’instant.</p>}
      {enCours.length > 0 && liste(enCours)}
      {closes.length > 0 && (
        <section className={styles.pile} aria-labelledby="titre-closes">
          <h2 id="titre-closes">Terminées</h2>
          {liste(closes)}
        </section>
      )}
    </div>
  );
}

/** Cagnottes où des proches associés m'ont invité. */
function MesInvitations() {
  const { donnees } = useChargement(() => api<{ code: string; titre: string; beneficiaire: string; organisateur: string; objectif: number; total: number }[]>('GET', '/moi/cagnottes-invite'), []);
  if (!donnees || donnees.length === 0) return null;
  return (
    <section className={styles.pile} aria-labelledby="titre-invite">
      <h2 id="titre-invite">On vous invite</h2>
      <ul className={styles.grille}>
        {donnees.map((g) => (
          <li key={g.code} className="carte">
            <Lien href={`/c/${g.code}`}><strong>{g.titre}</strong></Lien>
            <p className={styles.discret}>Pour {g.beneficiaire} · organisée par {g.organisateur}</p>
            <Jauge pourcentage={g.objectif > 0 ? Math.min(100, Math.round((g.total / g.objectif) * 100)) : 0} libelle={`Cagnotte ${g.titre}`} />
            <p className="chiffre">{euros(g.total)} sur {euros(g.objectif)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
