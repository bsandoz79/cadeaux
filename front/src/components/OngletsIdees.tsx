import { Lien } from './commun';
import styles from '../pages/pages.module.css';

/** Deux onglets : les idées pour les autres, et ma propre liste d'envies. */
export function OngletsIdees({ actif }: { actif: 'idees' | 'envies' }) {
  return (
    <nav className={styles.ongletsPage} aria-label="Idées et envies">
      <Lien href="/idees" aria-current={actif === 'idees' ? 'page' : undefined}>Idées pour les autres</Lien>
      <Lien href="/envies" aria-current={actif === 'envies' ? 'page' : undefined}>Ma liste d’envies</Lien>
    </nav>
  );
}
