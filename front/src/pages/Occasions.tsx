import { useState } from 'react';
import { TYPES_OCCASION, libelleType, type TypeOccasion } from '../api/types';
import { euros } from '../calculs/argent';
import { aujourdhui, coutCadeau, dateLisible } from '../calculs/bilan';
import { Champ, Choix, Depliable, EnTete, Lien } from '../components/commun';
import { useEnvoi } from '../components/formulaire';
import { useDonnees } from '../donnees/contexte';
import { aller } from '../navigation';
import { suggestion } from '../calculs/occasions';
import styles from './pages.module.css';

function FormulaireOccasion({ onFini, pour }: { onFini: () => void; pour?: number }) {
  const d = useDonnees();
  const jour = aujourdhui();
  const [type, setType] = useState<TypeOccasion>('noel');
  const [valeurs, setValeurs] = useState(() => suggestion('noel', jour));
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f) => {
    const o = await d.ajouter('occasions', { type, titre: String(f.get('titre') ?? ''), date: String(f.get('date') ?? '') });
    onFini();
    aller(`/occasions/${o.id}${pour ? `?pour=${pour}` : ''}`);
  });

  return (
    <form className="formulaire" onSubmit={envoyer} noValidate>
      <h2>Nouvelle occasion</h2>
      <div className="rangee">
        <Choix libelle="Type" nom="type" value={type} onChange={(e) => { const t = e.target.value as TypeOccasion; setType(t); setValeurs(suggestion(t, jour)); }}>
          {TYPES_OCCASION.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
        </Choix>
        <Champ libelle="Nom" nom="titre" required value={valeurs.titre} onChange={(e) => setValeurs({ ...valeurs, titre: e.target.value })} erreur={champs.titre} />
        <Champ libelle="Date" nom="date" type="date" required value={valeurs.date} onChange={(e) => setValeurs({ ...valeurs, date: e.target.value })} erreur={champs.date} />
      </div>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="actions">
        <button className="btn" disabled={occupe}>Créer</button>
        <button type="button" className="btn btn--contour" onClick={onFini}>Annuler</button>
      </div>
    </form>
  );
}

/** Toutes les occasions, par année, avec ce que chacune coûte. */
export function Occasions() {
  const d = useDonnees();
  const pour = Number(new URLSearchParams(window.location.search).get('pour')) || undefined;
  const parAnnee = new Map<string, typeof d.occasions>();
  for (const o of d.occasions) parAnnee.set(o.date.slice(0, 4), [...(parAnnee.get(o.date.slice(0, 4)) ?? []), o]);

  return (
    <div className={styles.pile}>
      <EnTete titre="Occasions" sousTitre="Noël, anniversaires, fêtes : une occasion regroupe les cadeaux que vous faites ce jour-là." />
      <Depliable bouton="Nouvelle occasion" ouvertAuDepart={pour !== undefined}>{(fermer) => <FormulaireOccasion onFini={fermer} pour={pour} />}</Depliable>
      {pour !== undefined && <p className={styles.discret}>Créez l’occasion : le formulaire du cadeau s’ouvrira ensuite pour {d.personnes.find((p) => p.id === pour)?.nom ?? 'ce proche'}.</p>}
      {d.occasions.length === 0 && <p className="vide">Pas encore d’occasion. Commencez par Noël ou le prochain anniversaire.</p>}
      {[...parAnnee].map(([annee, occasions]) => {
        const totalAnnee = occasions.reduce((s, o) => s + d.cadeaux.filter((c) => c.occasionId === o.id).reduce((t, c) => t + coutCadeau(c, d.cagnottes), 0), 0);
        return (
          <section key={annee} className={`carte ${styles.section}`} aria-labelledby={`annee-${annee}`}>
            <div className={styles.titreAvecAction}>
              <h2 id={`annee-${annee}`}>{annee}</h2>
              <strong className="chiffre">{euros(totalAnnee)}</strong>
            </div>
            <ul className={styles.liste}>
              {occasions.map((o) => {
                const cadeaux = d.cadeaux.filter((c) => c.occasionId === o.id);
                return (
                  <li key={o.id} className={styles.ligneListe}>
                    <div>
                      <Lien href={`/occasions/${o.id}`}><strong>{o.titre}</strong></Lien>
                      <div className={styles.discret}>{libelleType(o.type)} · {dateLisible(o.date)} · {cadeaux.length} cadeau{cadeaux.length > 1 ? 'x' : ''}</div>
                    </div>
                    <strong className="chiffre">{euros(cadeaux.reduce((s, c) => s + coutCadeau(c, d.cagnottes), 0))}</strong>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
