import { useEffect, useState } from 'react';

/**
 * Installation de l'appli sur l'écran d'accueil.
 * - Android et Chrome : le navigateur propose l'installation (événement « beforeinstallprompt »), gardé ici pour le
 *   bouton « Installer l'appli ».
 * - iPhone : pas d'invitation automatique, on explique le geste (Partager, puis « Sur l'écran d'accueil »).
 */
interface Invitation extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let invitation: Invitation | null = null;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

export function ecouterInstallation() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); invitation = e as Invitation; prevenir(); });
  window.addEventListener('appinstalled', () => { invitation = null; prevenir(); });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

export const dejaInstallee = () => window.matchMedia?.('(display-mode: standalone)').matches ?? false;
export const surIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function useInstallation() {
  const [, rafraichir] = useState(0);
  useEffect(() => {
    const f = () => rafraichir((n) => n + 1);
    abonnes.add(f);
    return () => { abonnes.delete(f); };
  }, []);
  return {
    possible: invitation !== null,
    installer: async () => {
      if (!invitation) return;
      await invitation.prompt();
      await invitation.userChoice;
      invitation = null;
      prevenir();
    },
  };
}
