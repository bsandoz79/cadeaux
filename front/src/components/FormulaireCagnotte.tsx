import { useState } from 'react';
import type { Cagnotte, ModeCagnotte } from '../api/types';
import { euros, lireMontant, saisieDepuis } from '../calculs/argent';
import { partsEgales } from '../calculs/cagnotte';
import { useDonnees } from '../donnees/contexte';
import { Champ, ChampMontant } from './commun';
import { erreurChamps, montantDuFormulaire, useEnvoi } from './formulaire';
import styles from '../pages/pages.module.css';

/** Création ou modification d'une cagnotte : le cadeau, pour qui, le prix, et comment partager. */
export function FormulaireCagnotte({ cagnotte, onFini }: { cagnotte?: Cagnotte; onFini: (c?: Cagnotte) => void }) {
  const d = useDonnees();
  const [mode, setMode] = useState<ModeCagnotte>(cagnotte?.mode ?? 'libre');
  const [prix, setPrix] = useState(saisieDepuis(cagnotte?.objectif));
  const [nombre, setNombre] = useState(String(cagnotte?.nombreParts ?? 5));
  const objectif = lireMontant(prix);
  const parts = objectif && Number(nombre) >= 2 ? partsEgales(objectif, Number(nombre)) : [];

  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f) => {
    const objectifSaisi = montantDuFormulaire(f, 'objectif');
    if (!objectifSaisi) throw erreurChamps({ objectif: 'Indiquez le prix du cadeau (ex. 150).' });
    const donnees: Partial<Cagnotte> = {
      titre: String(f.get('titre') ?? ''),
      beneficiaire: String(f.get('beneficiaire') ?? ''),
      objectif: objectifSaisi,
      mode,
      nombreParts: mode === 'egal' ? Number(f.get('nombreParts')) || null : null,
      dateLimite: String(f.get('dateLimite') ?? '') || null,
      lien: String(f.get('lien') ?? '') || null,
      message: String(f.get('message') ?? '') || null,
    };
    const c = cagnotte ? await d.modifier('cagnottes', cagnotte.id, donnees) : await d.ajouter('cagnottes', donnees);
    onFini(c);
  });

  return (
    <form className="formulaire" onSubmit={envoyer} noValidate>
      <div className="rangee">
        <Champ libelle="Le cadeau" nom="titre" required defaultValue={cagnotte?.titre} placeholder="Ex. une montre pour ses 30 ans" erreur={champs.titre} />
        <Champ libelle="Pour qui" nom="beneficiaire" required defaultValue={cagnotte?.beneficiaire} placeholder="Ex. Julie" erreur={champs.beneficiaire} />
        <ChampMontant libelle="Prix du cadeau (€)" nom="objectif" required value={prix} onChange={(e) => setPrix(e.target.value)} erreur={champs.objectif} />
      </div>

      <fieldset className="formulaire" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: '.4rem' }}>Comment partager</legend>
        <label className={styles.coche}>
          <input type="radio" name="mode" value="libre" checked={mode === 'libre'} onChange={() => setMode('libre')} />
          Chacun met ce qu’il veut, je complète le reste
        </label>
        <label className={styles.coche}>
          <input type="radio" name="mode" value="egal" checked={mode === 'egal'} onChange={() => setMode('egal')} />
          Parts égales
        </label>
        {mode === 'egal' && (
          <div className="rangee" style={{ alignItems: 'end' }}>
            <Champ libelle="Nombre de participants (vous compris)" nom="nombreParts" type="number" min={2} max={100} inputMode="numeric"
              value={nombre} onChange={(e) => setNombre(e.target.value)} erreur={champs.nombreParts} />
            {parts.length > 0 && (
              <p aria-live="polite">
                <strong className="chiffre">{euros(parts[0])}</strong> par personne
                {parts[0] !== parts[parts.length - 1] ? ` (certains ${euros(parts[parts.length - 1])}, pour tomber juste)` : ''}
              </p>
            )}
          </div>
        )}
      </fieldset>

      <details open={Boolean(cagnotte?.lien || cagnotte?.message || cagnotte?.dateLimite)}>
        <summary>Date limite, lien et message</summary>
        <div className="formulaire" style={{ marginTop: '.8rem' }}>
          <Champ libelle="Date limite" nom="dateLimite" type="date" defaultValue={cagnotte?.dateLimite ?? ''} erreur={champs.dateLimite} />
          <Champ libelle="Lien vers le cadeau" nom="lien" type="url" inputMode="url" defaultValue={cagnotte?.lien ?? ''} placeholder="https://" erreur={champs.lien} />
          <label className="champ">
            <span>Message aux participants</span>
            <textarea name="message" defaultValue={cagnotte?.message ?? ''} maxLength={1000} placeholder="Ex. On lui offre samedi, donnez-moi votre part avant (Lydia, espèces ou virement)." />
            {champs.message && <small className="erreur">{champs.message}</small>}
          </label>
        </div>
      </details>

      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="actions">
        <button className="btn" disabled={occupe}>{cagnotte ? 'Enregistrer' : 'Créer la cagnotte'}</button>
        <button type="button" className="btn btn--contour" onClick={() => onFini()}>Annuler</button>
      </div>
    </form>
  );
}
