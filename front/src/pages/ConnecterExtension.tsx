import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EnTete, Lien } from '../components/commun';
import styles from './pages.module.css';

const SITE = window.location.origin;

/**
 * « Connecter l'extension » : ouverte par le bouton Google de l'extension. Le compte connecté demande un code à usage
 * unique et le donne au script de l'extension présent sur cette page (extension/site.js), qui ouvre sa connexion.
 */
export function ConnecterExtension() {
  const [presente, setPresente] = useState<boolean | null>(null);
  const [etat, setEtat] = useState<'pret' | 'envoi' | 'fait' | 'erreur'>('pret');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const ecouter = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== SITE || typeof e.data !== 'object' || e.data === null) return;
      if (e.data.type === 'cadeaux-extension-presente') setPresente(true);
      if (e.data.type === 'cadeaux-extension-ok') setEtat('fait');
      if (e.data.type === 'cadeaux-extension-erreur') { setEtat('erreur'); setMessage(String(e.data.message ?? '')); }
    };
    window.addEventListener('message', ecouter);
    window.postMessage({ type: 'cadeaux-extension-ping' }, SITE);
    const attente = window.setTimeout(() => setPresente((p) => p ?? false), 1500);
    return () => { window.removeEventListener('message', ecouter); window.clearTimeout(attente); };
  }, []);

  async function connecter() {
    setEtat('envoi');
    try {
      const { code } = await api<{ code: string }>('POST', '/moi/extension/code');
      window.postMessage({ type: 'cadeaux-extension-code', code }, SITE);
    } catch {
      setEtat('erreur');
      setMessage('Le code n’a pas pu être créé. Réessayez.');
    }
  }

  return (
    <div className={styles.pile}>
      <EnTete titre="Connecter l’extension" sousTitre="L’extension Chrome Cadeaux utilisera ce compte." />
      <section className="carte formulaire" aria-labelledby="titre-extension-connexion">
        <h2 id="titre-extension-connexion" className="sr-only">Connexion de l’extension</h2>
        {etat === 'fait' ? (
          <p role="status" style={{ color: 'var(--c-vert)', fontWeight: 600 }}>C’est fait ! L’extension est connectée : vous pouvez fermer cet onglet et rouvrir l’extension.</p>
        ) : presente === false ? (
          <p>L’extension Cadeaux n’est pas détectée dans ce navigateur. Vous pouvez l’installer depuis <Lien href="/compte">Mon compte</Lien>.</p>
        ) : (
          <>
            <p>Cliquez pour connecter l’extension Chrome à votre compte. Elle aura sa propre connexion, que vous pouvez fermer depuis l’extension.</p>
            {etat === 'erreur' && <p className="erreur" role="alert">{message || 'La connexion n’a pas abouti. Réessayez.'}</p>}
            <div><button type="button" className="btn" onClick={connecter} disabled={presente !== true || etat === 'envoi'}>Connecter l’extension</button></div>
          </>
        )}
      </section>
    </div>
  );
}
