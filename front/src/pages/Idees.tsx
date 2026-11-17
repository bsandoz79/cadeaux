import { CarteCadeau } from '../components/CarteCadeau';
import { Depliable, EnTete, Lien } from '../components/commun';
import { FormulaireCadeau } from '../components/FormulaireCadeau';
import { useDonnees } from '../donnees/contexte';
import { OngletsIdees } from '../components/OngletsIdees';
import styles from './pages.module.css';

/** Idées de cadeaux pas encore rattachées à une occasion (notées ici ou avec l'extension Chrome). */
export function Idees() {
  const d = useDonnees();
  const idees = d.cadeaux.filter((c) => c.occasionId === null);

  return (
    <div className={styles.pile}>
      <OngletsIdees actif="idees" />
      <EnTete titre="Idées de cadeaux" sousTitre="Notez une idée dès qu’elle vous vient. Vous la rattacherez à Noël ou à un anniversaire plus tard." />
      <Depliable bouton="Noter une idée">{(fermer) => <FormulaireCadeau cadeau={{ statut: 'idee' }} avecOccasion onFini={fermer} />}</Depliable>
      {idees.length === 0 ? (
        <div className="vide">
          <p>Aucune idée pour l’instant.</p>
          <p>Avec l’extension Chrome, un clic sur la page d’un produit l’ajoute ici, avec son prix et sa photo. <Lien href="/compte">Installer l’extension</Lien></p>
        </div>
      ) : (
        <div className={styles.pile} style={{ gap: '.6rem' }}>
          {idees.map((c) => <CarteCadeau key={c.id} cadeau={c} avecOccasion />)}
        </div>
      )}
    </div>
  );
}
