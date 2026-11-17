import type { Cadeau } from '../api/types';
import { STATUTS } from '../api/types';
import { saisieDepuis } from '../calculs/argent';
import { useDonnees } from '../donnees/contexte';
import { Champ, ChampMontant, Choix } from './commun';
import { erreurChamps, montantDuFormulaire, useEnvoi } from './formulaire';

interface Props {
  /** Cadeau à modifier, ou valeurs de départ d'un nouveau cadeau. */
  cadeau?: Partial<Cadeau>;
  /** Choix de l'occasion (page des idées) ; sinon l'occasion du cadeau est gardée. */
  avecOccasion?: boolean;
  onFini: () => void;
}

/** Ajout ou modification d'un cadeau : pour qui, quoi, combien, où en est-il. */
export function FormulaireCadeau({ cadeau = {}, avecOccasion = false, onFini }: Props) {
  const d = useDonnees();
  const existant = cadeau.id !== undefined;
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f) => {
    const montantPrevu = montantDuFormulaire(f, 'montantPrevu');
    const montantDepense = montantDuFormulaire(f, 'montantDepense');
    const erreurs: Record<string, string> = {};
    if (montantPrevu === undefined) erreurs.montantPrevu = 'Montant invalide (ex. 25 ou 19,99).';
    if (montantDepense === undefined) erreurs.montantDepense = 'Montant invalide (ex. 25 ou 19,99).';
    if (Object.keys(erreurs).length) throw erreurChamps(erreurs);

    const idOu = (nom: string) => (f.get(nom) ? Number(f.get(nom)) : null);
    const donnees: Partial<Cadeau> = {
      titre: String(f.get('titre') ?? ''),
      personneId: idOu('personneId'),
      occasionId: avecOccasion ? idOu('occasionId') : (cadeau.occasionId ?? null),
      montantPrevu,
      montantDepense,
      statut: f.get('statut') as Cadeau['statut'],
      lien: String(f.get('lien') ?? '') || null,
      note: String(f.get('note') ?? '') || null,
    };
    if (existant) await d.modifier('cadeaux', cadeau.id!, donnees);
    else await d.ajouter('cadeaux', { ...donnees, image: cadeau.image ?? null });
    onFini();
  });

  return (
    <form className="formulaire" onSubmit={envoyer} noValidate>
      <div className="rangee">
        <Choix libelle="Pour qui" nom="personneId" defaultValue={cadeau.personneId ?? ''} erreur={champs.personneId}>
          <option value="">Personne en particulier</option>
          {d.personnes.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </Choix>
        <Champ libelle="Le cadeau" nom="titre" required defaultValue={cadeau.titre ?? ''} placeholder="Ex. une écharpe, un bon d’achat, de l’argent" erreur={champs.titre} />
      </div>
      {avecOccasion && (
        <Choix libelle="Pour quelle occasion" nom="occasionId" defaultValue={cadeau.occasionId ?? ''} erreur={champs.occasionId}>
          <option value="">Pas encore d’occasion (idée)</option>
          {d.occasions.map((o) => <option key={o.id} value={o.id}>{o.titre}</option>)}
        </Choix>
      )}
      <div className="rangee">
        <ChampMontant libelle="Budget prévu (€)" nom="montantPrevu" defaultValue={saisieDepuis(cadeau.montantPrevu)} erreur={champs.montantPrevu} />
        <ChampMontant libelle="Réellement dépensé (€)" nom="montantDepense" defaultValue={saisieDepuis(cadeau.montantDepense)} erreur={champs.montantDepense} aide="Une fois acheté." />
        <Choix libelle="Où en est-il" nom="statut" defaultValue={cadeau.statut ?? 'prevu'}>
          {STATUTS.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
        </Choix>
      </div>
      <details>
        <summary>Lien et note</summary>
        <div className="formulaire" style={{ marginTop: '.8rem' }}>
          <Champ libelle="Lien vers le produit" nom="lien" type="url" inputMode="url" defaultValue={cadeau.lien ?? ''} placeholder="https://" erreur={champs.lien} />
          <Champ libelle="Note" nom="note" defaultValue={cadeau.note ?? ''} placeholder="Taille, couleur, où l’acheter…" erreur={champs.note} />
        </div>
      </details>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="actions">
        <button className="btn" disabled={occupe}>{existant ? 'Enregistrer' : 'Ajouter'}</button>
        <button type="button" className="btn btn--contour" onClick={onFini}>Annuler</button>
      </div>
    </form>
  );
}
