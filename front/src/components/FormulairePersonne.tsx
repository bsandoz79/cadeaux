import { useState } from 'react';
import type { Personne } from '../api/types';
import { dateLisible } from '../calculs/bilan';
import { estGroupeFamille, LIENS } from '../calculs/famille';
import { useDonnees } from '../donnees/contexte';
import { Champ, Choix } from './commun';
import { useEnvoi } from './formulaire';
import styles from '../pages/pages.module.css';

/** Ajout ou modification d'un proche : prénom, date de naissance, groupes, lien de parenté (famille), note. */
export function FormulairePersonne({ personne, onFini, groupeParDefaut, lienParDefaut }: { personne?: Personne; onFini: () => void; groupeParDefaut?: number; lienParDefaut?: string }) {
  const d = useDonnees();
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f) => {
    const donnees = {
      nom: String(f.get('nom') ?? ''),
      dateNaissance: String(f.get('dateNaissance') ?? '') || null,
      note: String(f.get('note') ?? '') || null,
      groupeIds: f.getAll('groupes').map(Number),
      lien: famille ? String(f.get('lien') ?? '') || null : null,
    };
    if (personne) await d.modifier('personnes', personne.id, donnees);
    else await d.ajouter('personnes', donnees);
    onFini();
  });
  const [coches, setCoches] = useState<number[]>(personne?.groupeIds ?? (groupeParDefaut ? [groupeParDefaut] : []));
  // Lien de parenté proposé quand un groupe « Famille » est coché (ou déjà renseigné).
  const famille = Boolean(personne?.lien || lienParDefaut) || d.groupes.some((g) => coches.includes(g.id) && estGroupeFamille(g.nom));
  return (
    <form className="formulaire" onSubmit={envoyer} noValidate>
      <div className="rangee">
        <Champ libelle="Prénom ou surnom" nom="nom" required defaultValue={personne?.nom} erreur={champs.nom} placeholder="Ex. Maman, Léa, Tonton Jo" />
        <Champ libelle="Date de naissance" nom="dateNaissance" type="date" defaultValue={personne?.dateDuCompte ? '' : personne?.dateNaissance ?? ''} erreur={champs.dateNaissance}
          aide={personne?.dateDuCompte ? `Laissez vide : celle de son compte est utilisée (${dateLisible(personne.dateNaissance!, true)}).` : 'Pour vous rappeler son anniversaire.'} />
      </div>
      {d.groupes.length > 0 && (
        <fieldset className={styles.groupesCases}>
          <legend>Groupes</legend>
          {d.groupes.map((g) => (
            <label key={g.id} className={styles.coche}>
              <input type="checkbox" name="groupes" value={g.id} checked={coches.includes(g.id)}
                onChange={(e) => setCoches((c) => (e.target.checked ? [...c, g.id] : c.filter((x) => x !== g.id)))} /> {g.nom}
            </label>
          ))}
          {champs.groupeIds && <small className="erreur">{champs.groupeIds}</small>}
        </fieldset>
      )}
      {famille && (
        <Choix libelle="Lien de parenté" nom="lien" defaultValue={personne?.lien ?? lienParDefaut ?? ''} erreur={champs.lien}>
          <option value="">Pas précisé</option>
          {LIENS.map((l) => <option key={l.valeur} value={l.valeur}>{l.libelle}</option>)}
        </Choix>
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
