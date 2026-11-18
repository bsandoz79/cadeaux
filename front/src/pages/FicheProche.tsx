import { useState } from 'react';
import type { Cadeau } from '../api/types';
import { euros } from '../calculs/argent';
import { aujourdhui, bilanAnnee, coutCadeau, dateLisible } from '../calculs/bilan';
import { dejaOffert } from '../calculs/historique';
import { lien as lienDe } from '../calculs/famille';
import { AssociationProche } from '../components/Association';
import { CarteCadeau } from '../components/CarteCadeau';
import { ChoixOccasion } from '../components/ChoixOccasion';
import { Chiffre, EnTete, Lien } from '../components/commun';
import { FormulairePersonne } from '../components/FormulairePersonne';
import { useDonnees } from '../donnees/contexte';
import { aller } from '../navigation';
import styles from './pages.module.css';

/** Fiche d'un proche : offrir un cadeau, ce qui est prévu, ce qui a déjà été offert, sa liste d'envies, ses informations. */
export function FicheProche({ id }: { id: number }) {
  const d = useDonnees();
  const [edition, setEdition] = useState(false);
  const p = d.personnes.find((x) => x.id === id);
  if (!p) return <p className="vide">Ce proche n’existe pas ou a été retiré. <Lien href="/proches">Tous les proches</Lien></p>;

  const jour = aujourdhui();
  const annee = Number(jour.slice(0, 4));
  const ligne = bilanAnnee(annee, d).parPersonne.find((l) => l.cle === `p${p.id}`);
  const occasions = new Map(d.occasions.map((o) => [o.id, o]));
  const aVenir: Cadeau[] = d.cadeaux.filter((c) => c.personneId === p.id && c.statut !== 'offert' && (c.occasionId === null || (occasions.get(c.occasionId)?.date ?? '') >= jour));
  const offerts = dejaOffert(p.id, d.cadeaux, d.occasions);
  const totalOffert = offerts.reduce((s, x) => s + coutCadeau(x.cadeau, d.cagnottes), 0);
  // « Maman » nommée « Maman » : le lien de parenté ne se répète pas.
  const lien = lienDe(p.lien)?.libelle === p.nom ? undefined : lienDe(p.lien);
  const groupes = d.groupes.filter((g) => p.groupeIds.includes(g.id)).map((g) => g.nom);

  const supprimer = async () => {
    if (!window.confirm(`Retirer ${p.nom} de vos proches ? Ses cadeaux sont gardés, sans destinataire.`)) return;
    await d.supprimer('personnes', p.id);
    aller('/proches');
  };

  return (
    <div className={styles.pile}>
      <EnTete titre={p.nom} retour={{ href: '/proches', libelle: 'Proches' }}
        sousTitre={[lien?.libelle, ...groupes, p.dateNaissance && `anniversaire le ${dateLisible(p.dateNaissance, true)}${p.dateDuCompte ? ' (de son compte)' : ''}`].filter(Boolean).join(' · ') || undefined}>
        <button type="button" className="btn btn--petit btn--contour" onClick={() => setEdition(!edition)}>Modifier</button>
        <button type="button" className="btn btn--petit btn--contour btn--danger" onClick={supprimer}>Retirer</button>
      </EnTete>

      {edition && <div className="carte"><FormulairePersonne personne={p} onFini={() => setEdition(false)} /></div>}
      {p.note && <p className="carte">{p.note}</p>}

      <div className={styles.chiffres}>
        <Chiffre libelle={`En ${annee}`} valeur={euros(ligne?.total ?? 0)} ton="accent" />
        <Chiffre libelle="Déjà offert (tout compris)" valeur={euros(totalOffert)} />
        <Chiffre libelle="Cadeaux offerts" valeur={String(offerts.length)} />
      </div>

      <ChoixOccasion personne={p} />

      <section className={styles.section} aria-labelledby="titre-a-venir">
        <h2 id="titre-a-venir">Prévu pour {p.nom}</h2>
        {aVenir.length === 0 ? <p className={styles.discret}>Rien de prévu pour l’instant.</p>
          : aVenir.map((c) => <CarteCadeau key={c.id} cadeau={c} sousTitre={c.occasionId ? occasions.get(c.occasionId)?.titre : 'Idée'} />)}
      </section>

      <section className="carte" aria-labelledby="titre-association">
        <h2 id="titre-association">Son compte</h2>
        <AssociationProche personne={p} />
      </section>

      <section className={styles.section} aria-labelledby="titre-offerts">
        <h2 id="titre-offerts">Déjà offert</h2>
        {offerts.length === 0 ? <p className={styles.discret}>Rien encore.</p>
          : offerts.map((x) => <CarteCadeau key={x.cadeau.id} cadeau={x.cadeau} sousTitre={x.occasion.titre} />)}
      </section>
    </div>
  );
}
