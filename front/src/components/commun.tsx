import { useId, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { surLien } from '../navigation';
import styles from './commun.module.css';

/** Lien interne, sans rechargement de la page. */
export function Lien(props: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...props} onClick={(e) => { props.onClick?.(e); surLien(e); }} />;
}

interface ChampProps {
  libelle: string;
  nom: string;
  erreur?: string;
  aide?: string;
  children?: ReactNode;
}

/**
 * Champ texte (ou autre type d'input) : le libellé seul donne son nom au champ ; l'aide et l'erreur y sont reliées
 * par aria-describedby (lues après le nom, sans s'y mélanger).
 */
export function Champ({ libelle, nom, erreur, aide, ...input }: ChampProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="champ">
      <label htmlFor={id}>{libelle}</label>
      <input id={id} name={nom} aria-invalid={erreur ? true : undefined} aria-describedby={erreur || aide ? `${id}-d` : undefined} {...input} />
      {(erreur || aide) && <small id={`${id}-d`} className={erreur ? 'erreur' : undefined}>{erreur ?? aide}</small>}
    </div>
  );
}

/** Liste de choix avec libellé. */
export function Choix({ libelle, nom, erreur, children, ...select }: ChampProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className="champ">
      <label htmlFor={id}>{libelle}</label>
      <select id={id} name={nom} aria-invalid={erreur ? true : undefined} aria-describedby={erreur ? `${id}-d` : undefined} {...select}>{children}</select>
      {erreur && <small id={`${id}-d`} className="erreur">{erreur}</small>}
    </div>
  );
}

/** Champ de montant en euros (« 12,50 »). */
export function ChampMontant(props: ChampProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return <Champ inputMode="decimal" autoComplete="off" placeholder="0" pattern="[0-9 ]+([,.][0-9]{1,2})?" {...props} />;
}

/** Barre d'avancement (cagnotte). */
export function Jauge({ pourcentage, libelle }: { pourcentage: number; libelle: string }) {
  return (
    <div className={styles.jauge} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pourcentage} aria-label={libelle}>
      <div className={styles.jaugeRemplie} style={{ width: `${pourcentage}%` }} />
    </div>
  );
}

/** Titre de page, avec un lien retour et des actions à droite. */
export function EnTete({ titre, retour, children, sousTitre }: { titre: string; retour?: { href: string; libelle: string }; sousTitre?: ReactNode; children?: ReactNode }) {
  return (
    <header className={styles.entete}>
      {retour && <Lien className={styles.retour} href={retour.href}>← {retour.libelle}</Lien>}
      <div className={styles.enteteLigne}>
        <div>
          <h1>{titre}</h1>
          {sousTitre && <p className={styles.sousTitre}>{sousTitre}</p>}
        </div>
        {children && <div className="actions">{children}</div>}
      </div>
    </header>
  );
}

/** Chiffre clé : libellé et montant. */
export function Chiffre({ libelle, valeur, ton }: { libelle: string; valeur: string; ton?: 'accent' | 'vert' | 'or' }) {
  return (
    <div className={`${styles.chiffre} ${ton ? styles[ton] : ''}`}>
      <span>{libelle}</span>
      <strong className="chiffre">{valeur}</strong>
    </div>
  );
}

/** Bloc repliable avec un bouton (formulaire d'ajout, par exemple). */
export function Depliable({ bouton, children, ouvertAuDepart = false }: { bouton: string; children: (fermer: () => void) => ReactNode; ouvertAuDepart?: boolean }) {
  const [ouvert, setOuvert] = useState(ouvertAuDepart);
  if (!ouvert) return <button type="button" className="btn" onClick={() => setOuvert(true)}>{bouton}</button>;
  return <div className="carte">{children(() => setOuvert(false))}</div>;
}
