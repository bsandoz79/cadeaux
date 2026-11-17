import { useState } from 'react';
import { api } from '../api/client';
import type { Compte } from '../api/types';
import { Champ, Lien } from '../components/commun';
import { useEnvoi } from '../components/formulaire';
import { useDonnees } from '../donnees/contexte';
import { aller } from '../navigation';
import styles from './pages.module.css';

const POINTS = [
  { titre: 'Chaque fête, chaque personne', texte: 'Noël, anniversaires, fête des mères… Vous notez qui reçoit quoi et combien vous mettez.' },
  { titre: 'Combien ça coûte dans l’année', texte: 'Le total de l’année, par occasion et par personne, déjà dépensé et encore prévu.' },
  { titre: 'Les cadeaux communs', texte: 'Une cagnotte partagée par lien : chacun note sa part, vous voyez ce qu’il reste à mettre.' },
];

/** Présentation et connexion (visiteur non connecté). */
export function Accueil() {
  const { connecter } = useDonnees();
  const [mode, setMode] = useState<'inscription' | 'connexion'>('inscription');
  const { envoyer, occupe, erreur, champs } = useEnvoi(async (f) => {
    const corps = { email: f.get('email'), motDePasse: f.get('motDePasse'), ...(mode === 'inscription' ? { nom: f.get('nom') } : {}) };
    const r = await api<{ jeton: string; compte: Compte }>('POST', mode === 'inscription' ? '/comptes' : '/connexion', corps);
    connecter(r.jeton, r.compte);
    // Venu d'une liste d'envies ou d'une cagnotte : on y retourne.
    const retour = new URLSearchParams(window.location.search).get('retour');
    if (retour && /^\/(l|c)\/[a-f0-9]{16}$/.test(retour)) aller(retour);
  });

  return (
    <div className={styles.accueil}>
      <section className={styles.presentation}>
        <p className={styles.surtitre}>Noël, anniversaires, cadeaux communs</p>
        <h1>Vos cadeaux et ce qu’ils vous coûtent, au même endroit.</h1>
        <p className={styles.chapo}>Notez ce que vous offrez à chacun, suivez votre budget de l’année et organisez un cadeau à plusieurs sans calculs ni messages à rallonge.</p>
        <ul className={styles.points}>
          {POINTS.map((p) => (
            <li key={p.titre}>
              <h2>{p.titre}</h2>
              <p>{p.texte}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={`carte ${styles.connexion}`} aria-labelledby="titre-connexion">
        <div className={styles.onglets} role="tablist" aria-label="Compte">
          <button type="button" role="tab" aria-selected={mode === 'inscription'} onClick={() => setMode('inscription')}>Créer un compte</button>
          <button type="button" role="tab" aria-selected={mode === 'connexion'} onClick={() => setMode('connexion')}>Se connecter</button>
        </div>
        <h2 id="titre-connexion" className="sr-only">{mode === 'inscription' ? 'Créer un compte' : 'Se connecter'}</h2>
        <form className="formulaire" onSubmit={envoyer} noValidate>
          {mode === 'inscription' && <Champ libelle="Prénom" nom="nom" autoComplete="given-name" required erreur={champs.nom} />}
          <Champ libelle="Adresse e-mail" nom="email" type="email" autoComplete="email" required erreur={champs.email} />
          <Champ
            libelle="Mot de passe"
            nom="motDePasse"
            type="password"
            autoComplete={mode === 'inscription' ? 'new-password' : 'current-password'}
            required
            erreur={champs.motDePasse}
            aide={mode === 'inscription' ? 'Au moins 8 caractères.' : undefined}
          />
          {erreur && !Object.keys(champs).length && <p className="erreur" role="alert">{erreur}</p>}
          <button className="btn" disabled={occupe}>{mode === 'inscription' ? 'Créer mon compte' : 'Me connecter'}</button>
        </form>
        <p className={styles.note}>
          Vos listes ne sont visibles que par vous ; une cagnotte n’est visible que par ceux qui ont son lien.
          {mode === 'inscription' && <> En créant un compte, vous acceptez la <Lien href="/confidentialite">politique de confidentialité</Lien>.</>}
        </p>
      </section>
    </div>
  );
}
