import { useState } from 'react';
import type { Groupe, Personne } from '../api/types';
import { euros } from '../calculs/argent';
import { aujourdhui, bilanAnnee, dateLisible } from '../calculs/bilan';
import { Champ, Depliable, EnTete } from '../components/commun';
import { useEnvoi } from '../components/formulaire';
import { useDonnees } from '../donnees/contexte';
import { usePreparerAnniversaire } from '../donnees/usePreparerAnniversaire';
import { FormulaireCadeau } from '../components/FormulaireCadeau';
import styles from './pages.module.css';

function FormulairePersonne({ personne, onFini, groupeParDefaut }: { personne?: Personne; onFini: () => void; groupeParDefaut?: number }) {
  const d = useDonnees();
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f) => {
    const donnees = {
      nom: String(f.get('nom') ?? ''),
      dateNaissance: String(f.get('dateNaissance') ?? '') || null,
      note: String(f.get('note') ?? '') || null,
      groupeIds: f.getAll('groupes').map(Number),
    };
    if (personne) await d.modifier('personnes', personne.id, donnees);
    else await d.ajouter('personnes', donnees);
    onFini();
  });
  const coches = personne?.groupeIds ?? (groupeParDefaut ? [groupeParDefaut] : []);
  return (
    <form className="formulaire" onSubmit={envoyer} noValidate>
      <div className="rangee">
        <Champ libelle="Prénom ou surnom" nom="nom" required defaultValue={personne?.nom} erreur={champs.nom} placeholder="Ex. Maman, Léa, Tonton Jo" />
        <Champ libelle="Date de naissance" nom="dateNaissance" type="date" defaultValue={personne?.dateNaissance ?? ''} erreur={champs.dateNaissance} aide="Pour vous rappeler son anniversaire." />
      </div>
      {d.groupes.length > 0 && (
        <fieldset className={styles.groupesCases}>
          <legend>Groupes</legend>
          {d.groupes.map((g) => (
            <label key={g.id} className={styles.coche}>
              <input type="checkbox" name="groupes" value={g.id} defaultChecked={coches.includes(g.id)} /> {g.nom}
            </label>
          ))}
          {champs.groupeIds && <small className="erreur">{champs.groupeIds}</small>}
        </fieldset>
      )}
      <Champ libelle="Note" nom="note" defaultValue={personne?.note ?? ''} erreur={champs.note} placeholder="Tailles, goûts, ce qu’il ou elle a déjà…" />
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="actions">
        <button className="btn" disabled={occupe}>{personne ? 'Enregistrer' : 'Ajouter'}</button>
        <button type="button" className="btn btn--contour" onClick={onFini}>Annuler</button>
      </div>
    </form>
  );
}

/** Créer, renommer et supprimer ses groupes. */
function GererGroupes() {
  const d = useDonnees();
  const [edition, setEdition] = useState<number | null>(null);
  const ajout = useEnvoi(async (f, form) => {
    await d.ajouter('groupes', { nom: String(f.get('nom') ?? '') });
    form.reset();
  });
  const renommer = useEnvoi(async (f) => {
    await d.modifier('groupes', edition!, { nom: String(f.get('nom') ?? '') });
    setEdition(null);
  });
  const supprimer = async (g: Groupe) => {
    if (window.confirm(`Supprimer le groupe « ${g.nom} » ? Ses proches restent dans votre liste.`)) await d.supprimer('groupes', g.id);
  };
  return (
    <details className="carte">
      <summary>Gérer mes groupes</summary>
      <div className="formulaire" style={{ marginTop: '.8rem' }}>
        {d.groupes.length > 0 && (
          <ul className={styles.liste}>
            {d.groupes.map((g) => (
              <li key={g.id} className={styles.ligneListe}>
                {edition === g.id ? (
                  <form className="actions" onSubmit={renommer.envoyer} noValidate style={{ flex: 1 }}>
                    <Champ libelle={`Nouveau nom pour « ${g.nom} »`} nom="nom" required defaultValue={g.nom} erreur={renommer.champs.nom} autoFocus />
                    <button className="btn btn--petit" disabled={renommer.occupe}>Enregistrer</button>
                    <button type="button" className="btn btn--petit btn--contour" onClick={() => setEdition(null)}>Annuler</button>
                  </form>
                ) : (
                  <>
                    <span>{g.nom} <span className={styles.discret}>· {d.personnes.filter((p) => p.groupeIds.includes(g.id)).length} proche(s)</span></span>
                    <span className="actions">
                      <button type="button" className="btn btn--lien btn--petit" onClick={() => setEdition(g.id)}>Renommer</button>
                      <button type="button" className="btn btn--lien btn--petit btn--danger" onClick={() => supprimer(g)}>Supprimer</button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <form className="rangee" onSubmit={ajout.envoyer} noValidate style={{ alignItems: 'end' }}>
          <Champ libelle="Nouveau groupe" nom="nom" required placeholder="Ex. Famille, Amis, Collègues" erreur={ajout.champs.nom} />
          <div><button className="btn btn--contour" disabled={ajout.occupe}>Créer le groupe</button></div>
        </form>
      </div>
    </details>
  );
}

/** Les proches à qui vous offrez des cadeaux, rangés par groupes, avec ce qu'ils représentent cette année. */
export function Proches() {
  const d = useDonnees();
  const [edition, setEdition] = useState<number | null>(null);
  const [ajout, setAjout] = useState<number | null>(null);
  const [filtre, setFiltre] = useState<number | 'tous' | 'sans'>('tous');
  const { preparer, enCours } = usePreparerAnniversaire();
  const annee = Number(aujourdhui().slice(0, 4));
  const parPersonne = new Map(bilanAnnee(annee, d).parPersonne.map((l) => [l.cle, l]));
  const filtrees = d.personnes.filter((p) => filtre === 'tous' || (filtre === 'sans' ? p.groupeIds.length === 0 : p.groupeIds.includes(filtre)));
  const nomsGroupes = new Map(d.groupes.map((g) => [g.id, g.nom]));

  const supprimer = async (p: Personne) => {
    if (window.confirm(`Retirer ${p.nom} de vos proches ? Ses cadeaux sont gardés, sans destinataire.`)) await d.supprimer('personnes', p.id);
  };

  return (
    <div className={styles.pile}>
      <EnTete titre="Proches" sousTitre={`Ceux à qui vous offrez des cadeaux, et ce qu’ils représentent en ${annee}.`} />
      <Depliable key={String(filtre)} bouton="Ajouter un proche">
        {(fermer) => <FormulairePersonne onFini={fermer} groupeParDefaut={typeof filtre === 'number' ? filtre : undefined} />}
      </Depliable>

      {d.groupes.length > 0 && (
        <div className={styles.annees} role="group" aria-label="Afficher">
          <button type="button" aria-pressed={filtre === 'tous'} onClick={() => setFiltre('tous')}>Tous</button>
          {d.groupes.map((g) => (
            <button key={g.id} type="button" aria-pressed={filtre === g.id} onClick={() => setFiltre(g.id)}>{g.nom}</button>
          ))}
          {d.personnes.some((p) => p.groupeIds.length === 0) && <button type="button" aria-pressed={filtre === 'sans'} onClick={() => setFiltre('sans')}>Sans groupe</button>}
        </div>
      )}

      {d.personnes.length === 0 ? (
        <p className="vide">Ajoutez les personnes à qui vous faites des cadeaux : famille, amis, collègues.</p>
      ) : filtrees.length === 0 ? (
        <p className="vide">Personne dans ce groupe pour l’instant.</p>
      ) : (
        <ul className={`carte ${styles.liste}`}>
          {filtrees.map((p) => {
            const l = parPersonne.get(`p${p.id}`);
            return (
              <li key={p.id} className={styles.ligneListe} style={edition === p.id ? { display: 'block' } : undefined}>
                {edition === p.id ? (
                  <FormulairePersonne personne={p} onFini={() => setEdition(null)} />
                ) : (
                  <>
                    <div>
                      <strong>{p.nom}</strong>
                      {p.groupeIds.length > 0 && <span className={styles.discret}> · {p.groupeIds.map((id) => nomsGroupes.get(id)).filter(Boolean).join(', ')}</span>}
                      <div className={styles.discret}>
                        {p.dateNaissance ? `Anniversaire le ${dateLisible(p.dateNaissance, true)}` : 'Pas de date d’anniversaire'}
                        {p.note ? ` · ${p.note}` : ''}
                      </div>
                      <div className="actions">
                        {p.dateNaissance ? (
                          <button type="button" className="btn btn--petit btn--contour" disabled={enCours === p.id} onClick={() => preparer(p)}>Cadeau d’anniversaire</button>
                        ) : (
                          <button type="button" className="btn btn--petit btn--contour" onClick={() => setAjout(p.id)}>Ajouter un cadeau</button>
                        )}
                        <button type="button" className="btn btn--lien btn--petit" onClick={() => setEdition(p.id)}>Modifier</button>
                        <button type="button" className="btn btn--lien btn--petit btn--danger" onClick={() => supprimer(p)}>Retirer</button>
                      </div>
                      {ajout === p.id && (
                        <div className="carte" style={{ marginTop: '.8rem' }}>
                          <FormulaireCadeau cadeau={{ personneId: p.id, statut: 'prevu' }} avecOccasion onFini={() => setAjout(null)} />
                        </div>
                      )}
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

      <GererGroupes />
    </div>
  );
}
