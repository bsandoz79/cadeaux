import { useState } from 'react';
import { liensPartage } from '../calculs/partage';
import styles from './Partage.module.css';

/** Icônes dessinées pour le site (simples, sans reprendre les logos officiels). */
const ICONES = {
  whatsapp: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" /></svg>
  ),
  snapchat: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="currentColor" strokeWidth=".6" strokeLinejoin="round" d="M12 2.5c2.9 0 5 2.2 5 5v2.4l1.4-.5c.6-.2 1.1.5.7 1l-1.6 1c-.3.2-.4.5-.3.8.7 1.8 2 3 3.6 3.4.4.1.5.6.1.8-.8.4-1.8.6-2.2.8-.2.4-.2 1-.6 1.1-.8.2-1.8-.2-2.8.3-1 .6-1.8 1.7-3.3 1.7s-2.3-1.1-3.3-1.7c-1-.5-2-.1-2.8-.3-.4-.1-.4-.7-.6-1.1-.4-.2-1.4-.4-2.2-.8-.4-.2-.3-.7.1-.8 1.6-.4 2.9-1.6 3.6-3.4.1-.3 0-.6-.3-.8l-1.6-1c-.4-.5.1-1.2.7-1l1.4.5V7.5c0-2.8 2.1-5 5-5Z" /></svg>
  ),
  sms: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" d="M4 5h16v11H9l-5 4V5Z" /><path fill="currentColor" d="M8 10h2v2H8zm3 0h2v2h-2zm3 0h2v2h-2z" /></svg>
  ),
  partager: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
  ),
  copier: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path fill="none" stroke="currentColor" strokeWidth="2" d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
  ),
  copie: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L20 7" /></svg>
  ),
};

/** Envoyer le lien d'une cagnotte : logos seuls (WhatsApp, Snapchat, SMS, partager, copier), nommés pour les lecteurs d'écran. */
export function Partage({ url, beneficiaire, titre }: { url: string; beneficiaire: string; titre: string }) {
  const [copie, setCopie] = useState(false);
  const l = liensPartage(url, beneficiaire, titre);
  const copier = async () => {
    try { await navigator.clipboard.writeText(url); setCopie(true); setTimeout(() => setCopie(false), 2500); } catch { /* le lien reste affiché */ }
  };
  return (
    <div className={styles.partage}>
      <a className={`${styles.logo} ${styles.whatsapp}`} href={l.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Envoyer sur WhatsApp" title="WhatsApp">{ICONES.whatsapp}</a>
      <a className={`${styles.logo} ${styles.snapchat}`} href={l.snapchat} target="_blank" rel="noopener noreferrer" aria-label="Envoyer sur Snapchat" title="Snapchat">{ICONES.snapchat}</a>
      <a className={`${styles.logo} ${styles.sms}`} href={l.sms} aria-label="Envoyer par SMS" title="SMS">{ICONES.sms}</a>
      {'share' in navigator && (
        <button type="button" className={styles.logo} onClick={() => navigator.share({ title: titre, text: l.texte, url }).catch(() => {})} aria-label="Partager avec une autre appli" title="Partager">{ICONES.partager}</button>
      )}
      <button type="button" className={`${styles.logo} ${copie ? styles.fait : ''}`} onClick={copier} aria-label={copie ? 'Lien copié' : 'Copier le lien'} title={copie ? 'Lien copié' : 'Copier le lien'}>
        {copie ? ICONES.copie : ICONES.copier}
      </button>
      <span className="sr-only" role="status">{copie ? 'Lien copié' : ''}</span>
    </div>
  );
}
