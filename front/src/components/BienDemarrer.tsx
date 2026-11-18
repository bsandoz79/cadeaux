import { useState } from 'react';
import { useDonnees } from '../donnees/contexte';
import { Lien } from './commun';
import styles from './BienDemarrer.module.css';

const CLE = 'cadeaux.bien-demarrer.masque';
const masque = () => { try { return localStorage.getItem(CLE) === '1'; } catch { return false; } };

/**
 * Premiers pas d'un nouveau compte : trois étapes qui se cochent seules quand elles sont faites.
 * Disparaît quand tout est fait, ou quand l'utilisateur le masque.
 */
export function BienDemarrer() {
  const d = useDonnees();
  const [cache, setCache] = useState(masque);
  const etapes = [
    { fait: d.personnes.length > 0, titre: 'Ajoutez votre famille et vos proches', texte: 'Papa, Maman, Papi, Mamie… avec l’arbre de famille, en un clic par personne.', lien: '/proches', bouton: 'Ajouter mes proches' },
    { fait: Boolean(d.compte?.dateNaissance), titre: 'Indiquez votre date de naissance', texte: 'Facultatif : vos proches associés ne l’oublieront plus.', lien: '/compte', bouton: 'Mon compte' },
    { fait: d.occasions.length > 0, titre: 'Créez votre première occasion', texte: 'Noël, un anniversaire… puis notez qui reçoit quoi et pour combien.', lien: '/occasions', bouton: 'Créer une occasion' },
  ];
  const faites = etapes.filter((e) => e.fait).length;
  if (cache || faites === etapes.length) return null;
  const masquer = () => { try { localStorage.setItem(CLE, '1'); } catch { /* navigation privée */ } setCache(true); };

  return (
    <section className={`carte ${styles.guide}`} aria-labelledby="titre-bien-demarrer">
      <div className={styles.entete}>
        <h2 id="titre-bien-demarrer">Bien démarrer</h2>
        <span className={styles.compteur}>{faites} sur {etapes.length}</span>
      </div>
      <ol className={styles.etapes}>
        {etapes.map((e) => (
          <li key={e.titre} className={e.fait ? styles.faite : undefined}>
            <span className={styles.coche} aria-hidden="true">{e.fait ? '✓' : ''}</span>
            <div>
              <strong>{e.titre}</strong>{e.fait && <span className="sr-only"> (fait)</span>}
              <p>{e.texte}</p>
            </div>
            {!e.fait && <Lien className="btn btn--petit btn--contour" href={e.lien}>{e.bouton}</Lien>}
          </li>
        ))}
      </ol>
      <div><button type="button" className="btn btn--lien btn--petit" onClick={masquer}>Masquer</button></div>
    </section>
  );
}
