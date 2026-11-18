import { useEffect, useState } from 'react';

/**
 * Navigation sans rechargement : les liens internes changent l'adresse, l'application affiche la bonne page.
 *   /  /occasions  /occasions/<id>  /proches  /bilan  /idees  /cagnottes  /cagnottes/<id>  /c/<code>
 *   /envies  /l/<code>  /compte  /confidentialite  /mentions-legales
 */
export type Route =
  | { page: 'accueil' }
  | { page: 'occasions' }
  | { page: 'occasion'; id: number }
  | { page: 'proches' }
  | { page: 'bilan' }
  | { page: 'idees' }
  | { page: 'envies' }
  | { page: 'liste'; code: string }
  | { page: 'cagnottes' }
  | { page: 'cagnotte'; id: number }
  | { page: 'publique'; code: string }
  | { page: 'compte' }
  | { page: 'confidentialite' }
  | { page: 'mentions' }
  | { page: 'motdepasse'; jeton: string }
  | { page: 'confirmer'; jeton: string }
  | { page: 'securite'; jeton: string }
  | { page: 'confirmerMdp'; jeton: string }
  | { page: 'rejoindre'; jeton: string }
  | { page: 'introuvable' };

export function lireRoute(chemin: string): Route {
  const c = chemin.replace(/\/+$/, '') || '/';
  let m: RegExpExecArray | null;
  if (c === '/') return { page: 'accueil' };
  if (c === '/occasions') return { page: 'occasions' };
  if ((m = /^\/occasions\/(\d+)$/.exec(c))) return { page: 'occasion', id: Number(m[1]) };
  if (c === '/proches') return { page: 'proches' };
  if (c === '/bilan') return { page: 'bilan' };
  if (c === '/idees') return { page: 'idees' };
  if (c === '/envies') return { page: 'envies' };
  if ((m = /^\/l\/([a-f0-9]{16})$/.exec(c))) return { page: 'liste', code: m[1] };
  if (c === '/cagnottes') return { page: 'cagnottes' };
  if ((m = /^\/cagnottes\/(\d+)$/.exec(c))) return { page: 'cagnotte', id: Number(m[1]) };
  if ((m = /^\/c\/([a-f0-9]{16})$/.exec(c))) return { page: 'publique', code: m[1] };
  if (c === '/compte') return { page: 'compte' };
  if (c === '/confidentialite') return { page: 'confidentialite' };
  if (c === '/mentions-legales') return { page: 'mentions' };
  if ((m = /^\/motdepasse\/([a-f0-9]{64})$/.exec(c))) return { page: 'motdepasse', jeton: m[1] };
  if ((m = /^\/confirmer\/([a-f0-9]{64})$/.exec(c))) return { page: 'confirmer', jeton: m[1] };
  if ((m = /^\/securite\/([a-f0-9]{64})$/.exec(c))) return { page: 'securite', jeton: m[1] };
  if ((m = /^\/motdepasse\/confirmer\/([a-f0-9]{64})$/.exec(c))) return { page: 'confirmerMdp', jeton: m[1] };
  if ((m = /^\/rejoindre\/([a-f0-9]{64})$/.exec(c))) return { page: 'rejoindre', jeton: m[1] };
  return { page: 'introuvable' };
}

const EVENEMENT = 'cadeaux:navigation';

export function aller(chemin: string) {
  if (chemin === window.location.pathname) return;
  window.history.pushState(null, '', chemin);
  window.dispatchEvent(new Event(EVENEMENT));
  window.scrollTo?.({ top: 0 });
}

export function useChemin(): string {
  const [chemin, setChemin] = useState(() => window.location.pathname);
  useEffect(() => {
    const maj = () => setChemin(window.location.pathname);
    window.addEventListener('popstate', maj);
    window.addEventListener(EVENEMENT, maj);
    return () => {
      window.removeEventListener('popstate', maj);
      window.removeEventListener(EVENEMENT, maj);
    };
  }, []);
  return chemin;
}

/** Clic sur un lien interne : navigation sans rechargement (sauf Ctrl/Cmd-clic, nouvel onglet). */
export function surLien(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = e.currentTarget.getAttribute('href');
  if (!href?.startsWith('/')) return;
  e.preventDefault();
  aller(href);
}
