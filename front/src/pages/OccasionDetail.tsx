import { useState } from 'react';
import { TYPES_OCCASION, libelleType, type Occasion, type TypeOccasion } from '../api/types';
import { euros } from '../calculs/argent';
import { coutCadeau, dateLisible, estDepense } from '../calculs/bilan';
import { etatBudget } from '../calculs/budget';
import { CarteCadeau } from '../components/CarteCadeau';
import { Champ, ChampMontant, Chiffre, Choix, Depliable, EnTete, Lien } from '../components/commun';
import { FormulaireCadeau } from '../components/FormulaireCadeau';
import { erreurChamps, montantDuFormulaire, useEnvoi } from '../components/formulaire';
import { saisieDepuis } from '../calculs/argent';
import type { Budget } from '../api/types';
import { useDonnees } from '../donnees/contexte';
import { aller } from '../navigation';
import styles from './pages.module.css';

/** Une occasion : qui reçoit quoi, combien, et le total. */
export function OccasionDetail({ id }: { id: number }) {
  const d = useDonnees();
  const [edition, setEdition] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const occasion = d.occasions.find((o) => o.id === id);
  if (!occasion) return <p className="vide">Cette occasion n’existe pas ou a été supprimée. <Lien href="/occasions">Toutes les occasions</Lien></p>;

  const cadeaux = d.cadeaux.filter((c) => c.occasionId === id);
  const depense = cadeaux.filter(estDepense).reduce((s, c) => s + coutCadeau(c), 0);
  const prevu = cadeaux.filter((c) => !estDepense(c)).reduce((s, c) => s + coutCadeau(c), 0);
  const pour = Number(new URLSearchParams(window.location.search).get('pour')) || undefined;

  // La même occasion l'an dernier (ou la plus récente avant celle-ci), pour reprendre les mêmes personnes et montants.
  const precedente = d.occasions
    .filter((o) => o.type === occasion.type && o.date < occasion.date && o.type !== 'anniversaire' && d.cadeaux.some((c) => c.occasionId === o.id))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const idees = d.cadeaux.filter((c) => c.occasionId === null);

  const reprendre = async () => {
    if (!precedente) return;
    setOccupe(true);
    try {
      for (const c of d.cadeaux.filter((x) => x.occasionId === precedente.id)) {
        await d.ajouter('cadeaux', { titre: c.titre, personneId: c.personneId, occasionId: id, montantPrevu: coutCadeau(c) || null, statut: 'prevu' });
      }
      for (const b of d.budgets.filter((x) => x.occasionId === precedente.id)) {
        await d.ajouter('budgets', { occasionId: id, personneId: b.personneId, montant: b.montant });
      }
    } finally {
      setOccupe(false);
    }
  };

  const supprimer = async () => {
    if (!window.confirm(`Supprimer « ${occasion.titre} » ? Ses cadeaux sont gardés dans vos idées.`)) return;
    await d.supprimer('occasions', id);
    aller('/occasions');
  };

  // Regroupés par personne (celles qui ont un cadeau ou un budget), dans l'ordre alphabétique ; « sans destinataire » à la fin.
  const budgets = d.budgets.filter((b) => b.occasionId === id);
  const groupes = [...new Set([...cadeaux.map((c) => c.personneId), ...budgets.map((b) => b.personneId)])]
    .map((pid) => ({
      pid,
      nom: d.personnes.find((p) => p.id === pid)?.nom ?? 'Sans destinataire',
      cadeaux: cadeaux.filter((c) => c.personneId === pid),
      budget: budgets.find((b) => b.personneId === pid),
    }))
    .sort((a, b) => (a.pid === null ? 1 : b.pid === null ? -1 : a.nom.localeCompare(b.nom)));
  const totalBudgets = budgets.reduce((s, b) => s + b.montant, 0);

  return (
    <div className={styles.pile}>
      <EnTete titre={occasion.titre} retour={{ href: '/occasions', libelle: 'Occasions' }} sousTitre={`${libelleType(occasion.type)} · ${dateLisible(occasion.date)}`}>
        <button type="button" className="btn btn--petit btn--contour" onClick={() => setEdition(!edition)}>Modifier</button>
        <button type="button" className="btn btn--petit btn--contour btn--danger" onClick={supprimer}>Supprimer</button>
      </EnTete>

      {edition && <div className="carte"><ModifierOccasion occasion={occasion} onFini={() => setEdition(false)} /></div>}

      <div className={styles.chiffres}>
        <Chiffre libelle="Total" valeur={euros(depense + prevu)} ton="accent" />
        <Chiffre libelle="Déjà dépensé" valeur={euros(depense)} ton="vert" />
        <Chiffre libelle="Encore prévu" valeur={euros(prevu)} ton="or" />
        {totalBudgets > 0 && <Chiffre libelle="Budget total" valeur={euros(totalBudgets)} />}
      </div>

      <Depliable key={pour} bouton="Ajouter un cadeau" ouvertAuDepart={pour !== undefined}>
        {(fermer) => <FormulaireCadeau cadeau={{ occasionId: id, personneId: pour ?? null, statut: 'prevu' }} onFini={fermer} />}
      </Depliable>

      {cadeaux.length === 0 && (
        <div className="vide">
          <p>Aucun cadeau pour l’instant. Ajoutez chaque personne et ce que vous lui offrez.</p>
          {precedente && (
            <p style={{ marginTop: '.8rem' }}>
              <button type="button" className="btn btn--contour" disabled={occupe} onClick={reprendre}>
                Reprendre les personnes et montants de « {precedente.titre} »
              </button>
            </p>
          )}
        </div>
      )}

      {groupes.map((g) => (
        <section key={g.pid ?? 'sans'} className={styles.groupe} aria-label={g.nom}>
          <h3>{g.nom} · {euros(g.cadeaux.reduce((s, c) => s + coutCadeau(c), 0))}</h3>
          {g.pid !== null && (
            <LigneBudget occasionId={id} personneId={g.pid} nom={g.nom} budget={g.budget} utilise={g.cadeaux.reduce((s, c) => s + coutCadeau(c), 0)} />
          )}
          {g.cadeaux.map((c) => <CarteCadeau key={c.id} cadeau={c} />)}
          {g.cadeaux.length === 0 && <p className={styles.discret}>Pas encore de cadeau pour {g.nom}.</p>}
        </section>
      ))}

      {d.personnes.some((p) => !groupes.some((g) => g.pid === p.id)) && <AjouterBudget occasionId={id} exclus={groupes.map((g) => g.pid)} />}

      {idees.length > 0 && <AjouterUneIdee occasionId={id} />}
    </div>
  );
}

/** Budget d'une personne : barre, reste ou dépassement ; « Budget » pour le fixer ou le changer. */
function LigneBudget({ occasionId, personneId, nom, budget, utilise }: { occasionId: number; personneId: number; nom: string; budget?: Budget; utilise: number }) {
  const [edition, setEdition] = useState(false);
  if (edition) return <FormulaireBudget occasionId={occasionId} personneId={personneId} nom={nom} budget={budget} onFini={() => setEdition(false)} />;
  if (!budget) {
    return <p><button type="button" className="btn btn--lien btn--petit" onClick={() => setEdition(true)}>Fixer un budget pour {nom}</button></p>;
  }
  const e = etatBudget(budget.montant, utilise);
  return (
    <div className={styles.budget}>
      <div className={styles.barreHorizontale} aria-hidden="true">
        <span style={{ width: `${e.pourcentage}%`, background: e.depasse ? 'var(--c-erreur)' : undefined }} />
      </div>
      <p className={e.depasse ? 'erreur' : styles.discret}>
        {e.depasse
          ? `Budget de ${euros(e.budget)} dépassé de ${euros(e.depasse)}`
          : `${euros(e.utilise)} sur ${euros(e.budget)} de budget, il reste ${euros(e.reste)}`}
        {' '}<button type="button" className="btn btn--lien btn--petit" onClick={() => setEdition(true)}>Changer</button>
      </p>
    </div>
  );
}

function FormulaireBudget({ occasionId, personneId, nom, budget, onFini }: { occasionId: number; personneId: number; nom: string; budget?: Budget; onFini: () => void }) {
  const d = useDonnees();
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f) => {
    const montant = montantDuFormulaire(f, 'montant');
    if (montant === undefined) throw erreurChamps({ montant: 'Montant invalide (ex. 50).' });
    if (montant === null || montant === 0) {
      if (budget) await d.supprimer('budgets', budget.id);
    } else if (budget) {
      await d.modifier('budgets', budget.id, { montant });
    } else {
      await d.ajouter('budgets', { occasionId, personneId, montant });
    }
    onFini();
  });
  return (
    <form className="formulaire carte" onSubmit={envoyer} noValidate>
      <ChampMontant libelle={`Budget pour ${nom} (€)`} nom="montant" defaultValue={saisieDepuis(budget?.montant)} erreur={champs.montant}
        aide={budget ? 'Videz le champ pour retirer le budget.' : undefined} autoFocus />
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="actions">
        <button className="btn btn--petit" disabled={occupe}>Enregistrer</button>
        <button type="button" className="btn btn--petit btn--contour" onClick={onFini}>Annuler</button>
      </div>
    </form>
  );
}

/** Fixer le budget d'un proche qui n'a encore rien pour cette occasion. */
function AjouterBudget({ occasionId, exclus }: { occasionId: number; exclus: (number | null)[] }) {
  const d = useDonnees();
  const libres = d.personnes.filter((p) => !exclus.includes(p.id));
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f, form) => {
    const montant = montantDuFormulaire(f, 'montant');
    if (!montant) throw erreurChamps({ montant: 'Indiquez un budget (ex. 50).' });
    await d.ajouter('budgets', { occasionId, personneId: Number(f.get('personneId')), montant });
    form.reset();
  });
  return (
    <form className="carte formulaire" onSubmit={envoyer} noValidate>
      <h3>Prévoir un budget pour un proche</h3>
      <div className="rangee" style={{ alignItems: 'end' }}>
        <Choix libelle="Pour qui" nom="personneId" defaultValue={libres[0]?.id}>
          {libres.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </Choix>
        <ChampMontant libelle="Budget (€)" nom="montant" erreur={champs.montant} />
        <div><button className="btn btn--contour" disabled={occupe}>Ajouter</button></div>
      </div>
      {erreur && !champs.montant && <p className="erreur" role="alert">{erreur}</p>}
    </form>
  );
}

function ModifierOccasion({ occasion, onFini }: { occasion: Occasion; onFini: () => void }) {
  const d = useDonnees();
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f) => {
    await d.modifier('occasions', occasion.id, { type: f.get('type') as TypeOccasion, titre: String(f.get('titre')), date: String(f.get('date')) });
    onFini();
  });
  return (
    <form className="formulaire" onSubmit={envoyer} noValidate>
      <div className="rangee">
        <Choix libelle="Type" nom="type" defaultValue={occasion.type}>
          {TYPES_OCCASION.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
        </Choix>
        <Champ libelle="Nom" nom="titre" required defaultValue={occasion.titre} erreur={champs.titre} />
        <Champ libelle="Date" nom="date" type="date" required defaultValue={occasion.date} erreur={champs.date} />
      </div>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="actions">
        <button className="btn" disabled={occupe}>Enregistrer</button>
        <button type="button" className="btn btn--contour" onClick={onFini}>Annuler</button>
      </div>
    </form>
  );
}

/** Rattacher une idée déjà notée (depuis l'extension, par exemple) à cette occasion. */
function AjouterUneIdee({ occasionId }: { occasionId: number }) {
  const d = useDonnees();
  const idees = d.cadeaux.filter((c) => c.occasionId === null);
  const { envoyer, occupe } = useEnvoi(async (f, form) => {
    const idee = Number(f.get('idee'));
    if (idee) await d.modifier('cadeaux', idee, { occasionId, statut: 'prevu' });
    form.reset();
  });
  return (
    <form className={`carte formulaire`} onSubmit={envoyer}>
      <div className="rangee" style={{ alignItems: 'end' }}>
        <Choix libelle="Ajouter une de mes idées" nom="idee" defaultValue="">
          <option value="" disabled>Choisir une idée</option>
          {idees.map((c) => <option key={c.id} value={c.id}>{c.titre}{c.montantPrevu ? ` (${euros(c.montantPrevu)})` : ''}</option>)}
        </Choix>
        <div><button className="btn btn--contour" disabled={occupe}>Ajouter à l’occasion</button></div>
      </div>
    </form>
  );
}
