/**
 * Appels à l'API (même domaine, /api). Le jeton de connexion est gardé dans le navigateur.
 * Les erreurs arrivent avec un message en français et, pour les formulaires, l'erreur de chaque champ.
 */
const CLE_JETON = 'cadeaux.jeton';
const BASE = '/api';

export class ErreurApi extends Error {
  readonly statut: number;
  readonly champs: Record<string, string>;

  constructor(statut: number, message: string, champs: Record<string, string> = {}) {
    super(message);
    this.statut = statut;
    this.champs = champs;
  }
}

export const jeton = {
  lire: (): string | null => {
    try { return localStorage.getItem(CLE_JETON); } catch { return null; }
  },
  ecrire: (valeur: string | null) => {
    try {
      if (valeur) localStorage.setItem(CLE_JETON, valeur);
      else localStorage.removeItem(CLE_JETON);
    } catch { /* navigation privée : la connexion dure le temps de la page */ }
  },
};

/** Prévenu quand le jeton n'est plus valable (déconnexion depuis un autre appareil, compte supprimé). */
let surDeconnexion: () => void = () => {};
export const quandDeconnecte = (f: () => void) => { surDeconnexion = f; };

export async function api<T>(methode: string, chemin: string, corps?: unknown, entetes: Record<string, string> = {}): Promise<T> {
  const j = jeton.lire();
  let reponse: Response;
  try {
    reponse = await fetch(BASE + chemin, {
      method: methode,
      headers: {
        Accept: 'application/json',
        ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(j ? { Authorization: `Bearer ${j}` } : {}),
        ...entetes,
      },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
  } catch {
    throw new ErreurApi(0, 'Pas de connexion. Vérifiez votre réseau et réessayez.');
  }
  if (reponse.status === 204) return undefined as T;
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    if (reponse.status === 401 && j) {
      jeton.ecrire(null);
      surDeconnexion();
    }
    throw new ErreurApi(reponse.status, donnees.message ?? 'Une erreur est survenue.', donnees.champs ?? {});
  }
  return donnees as T;
}
