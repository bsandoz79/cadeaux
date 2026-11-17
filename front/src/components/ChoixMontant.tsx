import { useId, useRef, useState } from 'react';
import { lireMontant, saisieDepuis } from '../calculs/argent';
import { montantsProposes } from '../calculs/cagnotte';
import { ChampMontant } from './commun';
import styles from './ChoixMontant.module.css';

/** Choix du montant d'une part : boutons rapides, et champ libre (« Autre »). */
export function ChoixMontant({ conseil, reste, depart, erreur }: { conseil: number | null; reste: number; depart: number | null; erreur?: string }) {
  const [saisie, setSaisie] = useState(saisieDepuis(depart));
  const champ = useRef<HTMLDivElement>(null);
  const idGroupe = useId();
  const choisi = lireMontant(saisie);
  return (
    <div className={styles.choix}>
      <div className={styles.boutons} role="group" aria-labelledby={idGroupe}>
        <span id={idGroupe} className={styles.legende}>Combien mettez-vous ?</span>
        {montantsProposes(conseil, reste).map((m) => (
          <button key={m.centimes} type="button" className={styles.puce} aria-pressed={choisi === m.centimes} onClick={() => setSaisie(saisieDepuis(m.centimes))}>
            {m.libelle}
          </button>
        ))}
        <button type="button" className={styles.puce} onClick={() => { setSaisie(''); champ.current?.querySelector('input')?.focus(); }}>Autre</button>
      </div>
      <div ref={champ}>
        <ChampMontant libelle="Votre part (€)" nom="montant" required value={saisie} onChange={(e) => setSaisie(e.target.value)} erreur={erreur} />
      </div>
    </div>
  );
}
