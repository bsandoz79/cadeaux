import { useState } from 'react';
import { liensPartage } from '../calculs/partage';
import styles from '../pages/pages.module.css';

/** Envoyer le lien d'une cagnotte : WhatsApp, SMS, menu de partage du téléphone, ou copie. */
export function Partage({ url, beneficiaire, titre }: { url: string; beneficiaire: string; titre: string }) {
  const [copie, setCopie] = useState(false);
  const l = liensPartage(url, beneficiaire, titre);
  const copier = async () => {
    try { await navigator.clipboard.writeText(url); setCopie(true); setTimeout(() => setCopie(false), 2500); } catch { /* le champ reste sélectionnable */ }
  };
  return (
    <div className="formulaire" style={{ gap: '.6rem' }}>
      <div className="actions">
        <a className="btn btn--petit" href={l.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <a className="btn btn--petit btn--contour" href={l.sms}>SMS</a>
        {'share' in navigator && (
          <button type="button" className="btn btn--petit btn--contour" onClick={() => navigator.share({ title: titre, text: l.texte, url }).catch(() => {})}>Autre…</button>
        )}
        <button type="button" className="btn btn--petit btn--contour" onClick={copier}>{copie ? 'Lien copié' : 'Copier le lien'}</button>
      </div>
      <div className={styles.partage}>
        <input readOnly value={url} aria-label="Lien de la cagnotte" onFocus={(e) => e.currentTarget.select()} />
      </div>
    </div>
  );
}
