import { dateLisible } from '../calculs/bilan';
import { EnTete } from '../components/commun';
import type { PageLegale } from '../donnees/legal';
import styles from './pages.module.css';

/** Page légale (mentions légales, confidentialité), lisible sans compte. */
export function Legal({ page }: { page: PageLegale }) {
  return (
    <article className={styles.pile} style={{ maxWidth: '70ch' }}>
      <EnTete titre={page.titre} sousTitre={`${page.intro} Mise à jour le ${dateLisible(page.miseAJour)}.`} />
      {page.sections.map((s) => (
        <section key={s.titre} className={styles.section}>
          <h2>{s.titre}</h2>
          {s.paragraphes.map((p) => <p key={p}>{p}</p>)}
        </section>
      ))}
    </article>
  );
}
