import { nouvellePreuve, sortie, useGoogleActif } from '../donnees/google';
import styles from './BoutonGoogle.module.css';

const MESSAGES: Record<string, string> = {
  annule: 'Connexion avec Google annulée.',
  expire: 'La connexion avec Google a pris trop de temps. Recommencez.',
  bloque: 'Ce compte est bloqué par sécurité : choisissez un nouveau mot de passe avec le lien reçu par e-mail (ou « Mot de passe oublié ? »).',
  erreur: 'Google n’a pas confirmé la connexion. Réessayez, ou utilisez votre e-mail et votre mot de passe.',
};

/**
 * « Continuer avec Google » : le navigateur part sur la page de Google, puis revient sur /connexion/google.
 * Aucun script de Google n'est chargé sur le site. Le bouton n'apparaît que si la connexion Google est configurée.
 */
export function BoutonGoogle({ retour }: { retour?: string | null }) {
  const actif = useGoogleActif();
  const motif = new URLSearchParams(window.location.search).get('google');

  function partir() {
    const preuve = nouvellePreuve();
    const parametres = new URLSearchParams({ preuve, ...(retour ? { retour } : {}) });
    sortie.vers(`/api/google/debut?${parametres}`);
  }

  return (
    <>
      {motif && MESSAGES[motif] && <p className="erreur" role="alert">{MESSAGES[motif]}</p>}
      {actif && (
        <>
          <button type="button" className={styles.bouton} onClick={partir}>
            <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Continuer avec Google
          </button>
          <p className={styles.ou}><span>ou</span></p>
        </>
      )}
    </>
  );
}
