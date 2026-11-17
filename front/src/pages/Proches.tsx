import { useState } from 'react';
import type { Personne } from '../api/types';
import { euros } from '../calculs/argent';
import { aujourdhui, bilanAnnee, dateLisible } from '../calculs/bilan';
import { Champ, Depliable, EnTete } from '../components/commun';
import { useEnvoi } from '../components/formulaire';
import { useDonnees } from '../donnees/contexte';
import styles from './pages.module.css';

function FormulairePersonne({ personne, onFini }: { personne?: Personne; onFini: () => void }) {
  const d = useDonnees();
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f) => {
    const donnees = { nom: String(f.get('nom') ?? ''), dateNaissance: String(f.get('dateNaissance') ?? '') || null, note: String(f.get('note') ?? '') || null };
    if (personne) await d.modifier('personnes', personne.id, donnees);
    else await d.ajouter('personnes', donnees);
    onFini();
  });
  return (
    <form className="formulaire" onSubmit={envoyer} noValidate>
      <div className="rangee">
        <Champ libelle="Prénom ou surnom" nom="nom" required defaultValue={personne?.nom} erreur={champs.nom} placeholder="Ex. Maman, Léa, Tonton Jo" />
        <Champ libelle="Date de naissance" nom="dateNaissance" type="date" defaultValue={personne?.dateNaissance ?? ''} erreur={champs.dateNaissance} aide="Pour vous rappeler son anniversaire." />
      </div>
      <Champ libelle="Note" nom="note" defaultValue={personne?.note ?? ''} erreur={champs.note} placeholder="Tailles, goûts, ce qu’il ou elle a déjà…" />
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="actions">
        <button className="btn" disabled={occupe}>{personne ? 'Enregistrer' : 'Ajouter'}</button>
        <button type="button" className="btn btn--contour" onClick={onFini}>Annuler</button>
      </div>
    </form>
  );
}

/** Les proches à qui vous offrez des cadeaux, avec ce que vous leur offrez cette année. */
export function Proches() {
  const d = useDonnees();
  const [edition, setEdition] = useState<number | null>(null);
  const annee = Number(aujourdhui().slice(0, 4));
  const parPersonne = new Map(bilanAnnee(annee, d).parPersonne.map((l) => [l.cle, l]));

  const supprimer = async (p: Personne) => {
    if (window.confirm(`Retirer ${p.nom} de vos proches ? Ses cadeaux sont gardés, sans destinataire.`)) await d.supprimer('personnes', p.id);
  };

  return (
    <div className={styles.pile}>
      <EnTete titre="Proches" sousTitre={`Ceux à qui vous offrez des cadeaux, et ce qu’ils représentent en ${annee}.`} />
      <Depliable bouton="Ajouter un proche">{(fermer) => <FormulairePersonne onFini={fermer} />}</Depliable>
      {d.personnes.length === 0 ? (
        <p className="vide">Ajoutez les personnes à qui vous faites des cadeaux : famille, amis, collègues.</p>
      ) : (
        <ul className={`carte ${styles.liste}`}>
          {d.personnes.map((p) => {
            const l = parPersonne.get(`p${p.id}`);
            return (
              <li key={p.id} className={styles.ligneListe} style={edition === p.id ? { display: 'block' } : undefined}>
                {edition === p.id ? (
                  <FormulairePersonne personne={p} onFini={() => setEdition(null)} />
                ) : (
                  <>
                    <div>
                      <strong>{p.nom}</strong>
                      <div className={styles.discret}>
                        {p.dateNaissance ? `Anniversaire le ${dateLisible(p.dateNaissance, true)}` : 'Pas de date d’anniversaire'}
                        {p.note ? ` · ${p.note}` : ''}
                      </div>
                      <div className="actions">
                        <button type="button" className="btn btn--lien btn--petit" onClick={() => setEdition(p.id)}>Modifier</button>
                        <button type="button" className="btn btn--lien btn--petit btn--danger" onClick={() => supprimer(p)}>Retirer</button>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong className="chiffre">{euros(l?.total ?? 0)}</strong>
                      <div className={styles.discret}>en {annee}</div>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
