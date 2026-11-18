import { useState } from 'react';
import { rechercher, type Resultat } from '../calculs/recherche';
import { EnTete, Lien } from '../components/commun';
import { useDonnees } from '../donnees/contexte';
import styles from './pages.module.css';

const TITRES: Record<Resultat['type'], string> = { proche: 'Proches', cadeau: 'Cadeaux', occasion: 'Occasions', cagnotte: 'Cagnottes', envie: 'Mes envies' };

/** Rechercher un proche, un cadeau, une occasion, une cagnotte ou une envie. */
export function Recherche() {
  const d = useDonnees();
  const [terme, setTerme] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const resultats = rechercher(terme, d);
  const types = [...new Set(resultats.map((r) => r.type))];

  return (
    <div className={styles.pile}>
      <EnTete titre="Rechercher" />
      <label className="champ">
        <span className="sr-only">Rechercher</span>
        <input type="search" value={terme} onChange={(e) => {
          setTerme(e.target.value);
          window.history.replaceState(null, '', e.target.value ? `/recherche?q=${encodeURIComponent(e.target.value)}` : '/recherche');
        }} placeholder="Un prénom, un cadeau, Noël…" autoFocus autoComplete="off" />
      </label>
      <p className="sr-only" role="status">{terme.trim().length >= 2 ? `${resultats.length} résultat(s)` : ''}</p>
      {terme.trim().length >= 2 && resultats.length === 0 && <p className="vide">Rien trouvé pour « {terme} ».</p>}
      {types.map((t) => (
        <section key={t} className={styles.section} aria-labelledby={`r-${t}`}>
          <h2 id={`r-${t}`}>{TITRES[t]}</h2>
          <ul className={`carte ${styles.liste}`}>
            {resultats.filter((r) => r.type === t).map((r) => (
              <li key={`${r.type}-${r.id}`} className={styles.ligneListe}>
                <div>
                  <Lien href={r.lien}><strong>{r.titre}</strong></Lien>
                  <div className={styles.discret}>{r.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
