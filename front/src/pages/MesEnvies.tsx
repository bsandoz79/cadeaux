import { useState } from 'react';
import { useChargement } from '../donnees/useChargement';
import { api } from '../api/client';
import type { Envie, LienListe } from '../api/types';
import { euros, saisieDepuis } from '../calculs/argent';
import { Champ, ChampMontant, Depliable, EnTete } from '../components/commun';
import { erreurChamps, montantDuFormulaire, useEnvoi } from '../components/formulaire';
import { OngletsIdees } from '../components/OngletsIdees';
import { useDonnees } from '../donnees/contexte';
import styles from './pages.module.css';

function FormulaireEnvie({ envie, onFini }: { envie?: Envie; onFini: () => void }) {
  const d = useDonnees();
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f) => {
    const prix = montantDuFormulaire(f, 'prix');
    if (prix === undefined) throw erreurChamps({ prix: 'Prix invalide (ex. 25 ou 19,99).' });
    const donnees: Partial<Envie> = {
      titre: String(f.get('titre') ?? ''),
      prix,
      lien: String(f.get('lien') ?? '') || null,
      note: String(f.get('note') ?? '') || null,
      priorite: f.get('priorite') === 'on',
    };
    if (envie) await d.modifier('envies', envie.id, donnees);
    else await d.ajouter('envies', donnees);
    onFini();
  });
  return (
    <form className="formulaire" onSubmit={envoyer} noValidate>
      <div className="rangee">
        <Champ libelle="Ce qui me ferait plaisir" nom="titre" required defaultValue={envie?.titre} placeholder="Ex. un casque audio, un livre de Fred Vargas" erreur={champs.titre} />
        <ChampMontant libelle="Prix indicatif (€)" nom="prix" defaultValue={saisieDepuis(envie?.prix)} erreur={champs.prix} />
      </div>
      <Champ libelle="Lien vers le produit" nom="lien" type="url" inputMode="url" defaultValue={envie?.lien ?? ''} placeholder="https://" erreur={champs.lien} />
      <Champ libelle="Précision" nom="note" defaultValue={envie?.note ?? ''} placeholder="Taille, couleur, modèle…" erreur={champs.note} />
      <label className={styles.coche}><input type="checkbox" name="priorite" defaultChecked={envie?.priorite} /> Très envie (en tête de liste)</label>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="actions">
        <button className="btn" disabled={occupe}>{envie ? 'Enregistrer' : 'Ajouter'}</button>
        <button type="button" className="btn btn--contour" onClick={onFini}>Annuler</button>
      </div>
    </form>
  );
}

function CarteEnvie({ envie }: { envie: Envie }) {
  const d = useDonnees();
  const [edition, setEdition] = useState(false);
  if (edition) return <div className="carte"><FormulaireEnvie envie={envie} onFini={() => setEdition(false)} /></div>;
  const supprimer = async () => {
    if (window.confirm(`Retirer « ${envie.titre} » de votre liste ?`)) await d.supprimer('envies', envie.id);
  };
  return (
    <article className={styles.cadeau}>
      <div className={styles.vignette} aria-hidden="true">
        {envie.image ? <img src={envie.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : '✨'}
      </div>
      <div className={styles.cadeauTexte}>
        <strong>{envie.lien ? <a href={envie.lien} target="_blank" rel="noopener noreferrer">{envie.titre}</a> : envie.titre}</strong>
        {envie.note && <span className={styles.discret}>{envie.note}</span>}
        <div className="actions">
          <button type="button" className="btn btn--lien btn--petit" onClick={() => setEdition(true)}>Modifier</button>
          <button type="button" className="btn btn--lien btn--petit btn--danger" onClick={supprimer}>Retirer</button>
        </div>
      </div>
      <div className={styles.cadeauMontant}>
        <strong className="chiffre">{envie.prix ? euros(envie.prix) : '—'}</strong>
        {envie.priorite && <span className="pastille pastille--idee">Très envie</span>}
      </div>
    </article>
  );
}

/** Ma liste d'envies : ce qui me ferait plaisir, et le lien à donner à mes proches. */
export function MesEnvies() {
  const d = useDonnees();
  const { donnees: lien, recharger: charger, modifier: setLien } = useChargement(() => api<LienListe>('GET', '/liste'), []);
  const [copie, setCopie] = useState(false);

  const adresse = lien?.code ? `${window.location.origin}/l/${lien.code}` : null;
  const partager = useEnvoi(async (f) => {
    setLien(await api<LienListe>('POST', '/liste', { message: String(f.get('message') ?? '') }));
  });
  const arreter = async () => {
    if (!window.confirm('Couper le lien ? Ceux qui l’ont ne pourront plus voir votre liste. Un nouveau partage donnera une nouvelle adresse.')) return;
    await api('DELETE', '/liste');
    await charger();
  };
  const copier = async () => {
    if (!adresse) return;
    try { await navigator.clipboard.writeText(adresse); setCopie(true); setTimeout(() => setCopie(false), 2500); } catch { /* sélection à la main */ }
  };

  return (
    <div className={styles.pile}>
      <OngletsIdees actif="envies" />
      <EnTete titre="Ma liste d’envies" sousTitre="Ce qui vous ferait plaisir. Partagez le lien : vos proches réservent ce qu’ils vous offrent, sans doublon, et vous ne voyez pas qui a pris quoi." />

      <section className="carte formulaire" aria-labelledby="titre-lien-liste">
        <h2 id="titre-lien-liste">Partager ma liste</h2>
        <form className="formulaire" onSubmit={partager.envoyer} noValidate>
          <label className="champ">
            <span>Petit mot en haut de la liste (facultatif)</span>
            <textarea name="message" maxLength={500} defaultValue={lien?.message ?? ''} key={lien?.message ?? ''} placeholder="Ex. Pas de vêtements, j’ai tout ce qu’il faut !" />
            {partager.champs.message && <small className="erreur">{partager.champs.message}</small>}
          </label>
          <div className="actions">
            <button className="btn btn--petit" disabled={partager.occupe}>{adresse ? 'Enregistrer le mot' : 'Créer le lien de partage'}</button>
            {adresse && <button type="button" className="btn btn--petit btn--contour btn--danger" onClick={arreter}>Couper le lien</button>}
          </div>
        </form>
        {adresse && (
          <div className={styles.partage}>
            <input readOnly value={adresse} aria-label="Lien de ma liste d’envies" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn--petit" onClick={copier}>{copie ? 'Lien copié' : 'Copier le lien'}</button>
            {'share' in navigator && (
              <button type="button" className="btn btn--petit btn--contour"
                onClick={() => navigator.share({ title: 'Ma liste d’envies', text: `Ma liste d’envies (${d.compte?.nom})`, url: adresse }).catch(() => {})}>
                Partager…
              </button>
            )}
          </div>
        )}
      </section>

      <Depliable bouton="Ajouter une envie">{(fermer) => <FormulaireEnvie onFini={fermer} />}</Depliable>
      {d.envies.length === 0
        ? <p className="vide">Votre liste est vide. Ajoutez ce qui vous ferait plaisir, ou utilisez l’extension Chrome sur la page d’un produit.</p>
        : <div className={styles.pile} style={{ gap: '.6rem' }}>{d.envies.map((e) => <CarteEnvie key={e.id} envie={e} />)}</div>}
    </div>
  );
}
