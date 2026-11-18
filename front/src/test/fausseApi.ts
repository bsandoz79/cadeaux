/**
 * Fausse API en mémoire pour les tests d'écrans : mêmes routes et mêmes réponses que l'API PHP (pour ce qui sert ici).
 * Remplace `fetch` ; `appels` garde la trace des requêtes reçues.
 */
import { vi } from 'vitest';

type Element = { id: number } & Record<string, unknown>;

export interface EtatFaux {
  compte: { id: number; email: string; nom: string; rappels: boolean; emailConfirme: boolean };
  groupes: Element[];
  personnes: Element[];
  occasions: Element[];
  cadeaux: Element[];
  budgets: Element[];
  envies: Element[];
  cagnottes: Element[];
  participations: Record<string, Element[]>;
  listes: Record<string, { proprietaire: string; message: string | null; envies: Element[] }>;
}

export function etatVide(): EtatFaux {
  return {
    compte: { id: 1, email: 'baptiste@example.com', nom: 'Baptiste', rappels: true, emailConfirme: true },
    groupes: [], personnes: [], occasions: [], cadeaux: [], budgets: [], envies: [], cagnottes: [], participations: {}, listes: {},
  };
}

const COLLECTIONS = ['groupes', 'personnes', 'occasions', 'cadeaux', 'budgets', 'envies', 'cagnottes'] as const;
const DEFAUTS: Record<string, Record<string, unknown>> = {
  personnes: { dateNaissance: null, note: null, groupeIds: [] },
  cadeaux: { occasionId: null, personneId: null, montantPrevu: null, montantDepense: null, statut: 'idee', lien: null, image: null, note: null, cagnotteId: null, creeLe: '2026-11-17 10:00:00' },
  envies: { lien: null, image: null, prix: null, note: null, priorite: false, creeLe: '2026-11-17 10:00:00' },
  cagnottes: { code: 'abcdefabcdefabcd', mode: 'libre', nombreParts: null, dateLimite: null, lien: null, message: null, close: false, creeLe: '2026-11-17 10:00:00', total: 0, totalPaye: 0, maPart: 0, nombreParticipations: 0 },
};

export function installerFausseApi(etat: EtatFaux) {
  const appels: { methode: string; chemin: string; corps?: unknown; entetes: Record<string, string> }[] = [];
  let suivant = 1000;
  const json = (statut: number, donnees?: unknown) =>
    new Response(statut === 204 ? null : JSON.stringify(donnees), { status: statut, headers: { 'Content-Type': 'application/json' } });

  const fetchFaux = vi.fn(async (url: string, init: RequestInit = {}) => {
    const methode = (init.method ?? 'GET').toUpperCase();
    const chemin = url.replace(/^\/api/, '');
    const corps = init.body ? JSON.parse(String(init.body)) : undefined;
    const entetes = (init.headers ?? {}) as Record<string, string>;
    appels.push({ methode, chemin, corps, entetes });
    let m: RegExpExecArray | null;

    if (methode === 'POST' && (chemin === '/comptes' || chemin === '/connexion')) return json(chemin === '/comptes' ? 201 : 200, { jeton: 'a'.repeat(64), compte: etat.compte });
    if (chemin === '/moi') return json(200, etat.compte);
    if (chemin === '/motdepasse/oubli') return json(200, { message: 'Si un compte existe avec cette adresse, un e-mail vient de partir.' });
    if (chemin === '/motdepasse/nouveau') return corps.jeton === 'f'.repeat(64) ? json(200, { jeton: 'a'.repeat(64), compte: etat.compte }) : json(410, { message: 'Ce lien n’est plus valable. Refaites une demande.' });
    if (chemin === '/email/confirmer') { etat.compte.emailConfirme = true; return json(200, { type: 'confirmation', email: etat.compte.email }); }
    if (chemin === '/email/renvoyer') return json(204);
    if (chemin === '/securite/bloquer') return json(200, { message: 'Votre compte est bloqué. Un e-mail vient de partir pour choisir un nouveau mot de passe.' });
    if (chemin === '/liste') return json(200, { code: null, message: null });

    for (const nom of COLLECTIONS) {
      if (chemin === `/${nom}` && methode === 'GET') return json(200, etat[nom]);
      if (chemin === `/${nom}` && methode === 'POST') {
        const cree = { id: suivant++, ...DEFAUTS[nom], ...corps };
        etat[nom].unshift(cree);
        return json(201, cree);
      }
      if ((m = new RegExp(`^/${nom}/(\\d+)$`).exec(chemin))) {
        const i = etat[nom].findIndex((e) => e.id === Number(m![1]));
        if (i < 0) return json(404, { message: 'Introuvable.' });
        if (methode === 'PATCH') { etat[nom][i] = { ...etat[nom][i], ...corps }; return json(200, etat[nom][i]); }
        if (methode === 'DELETE') { etat[nom].splice(i, 1); return json(204); }
      }
    }

    if ((m = /^\/c\/([a-f0-9]{16})\/rib$/.exec(chemin))) {
      return json(200, { titulaire: 'Baptiste Sandoz', iban: 'FR76 3000 6000 0112 3456 7890 189', recent: true });
    }
    if ((m = /^\/c\/([a-f0-9]{16})$/.exec(chemin))) {
      const c = etat.cagnottes.find((g) => g.code === m![1]);
      return c ? json(200, { rib: null, ...c, organisateur: etat.compte.nom, participations: etat.participations[m[1]] ?? [] }) : json(404, { message: 'Introuvable.' });
    }
    if ((m = /^\/c\/([a-f0-9]{16})\/participations$/.exec(chemin)) && methode === 'POST') {
      if (!corps.nom) return json(422, { message: 'Certains champs sont à corriger.', champs: { nom: 'Indiquez votre prénom (80 caractères au plus).' } });
      const p = { id: suivant++, nom: corps.nom, montant: corps.montant, paye: false, organisateur: false };
      (etat.participations[m[1]] ??= []).push(p);
      return json(201, { participation: p, cle: 'b'.repeat(64) });
    }
    if ((m = /^\/l\/([a-f0-9]{16})$/.exec(chemin))) {
      const l = etat.listes[m[1]];
      if (!l) return json(404, { message: 'Introuvable.' });
      const proprio = Boolean(entetes.Authorization) && l.proprietaire === etat.compte.nom;
      return json(200, { proprietaire: l.proprietaire, message: l.message, estProprietaire: proprio, envies: l.envies.map((e) => ({ ...e, reservation: proprio ? null : e.reservation ?? null })) });
    }
    if ((m = /^\/l\/([a-f0-9]{16})\/envies\/(\d+)\/reservation$/.exec(chemin)) && methode === 'POST') {
      const e = etat.listes[m[1]]?.envies.find((x) => x.id === Number(m![2]));
      if (!e) return json(404, { message: 'Introuvable.' });
      if (e.reservation) return json(409, { message: 'Quelqu’un s’en occupe déjà.' });
      e.reservation = { id: suivant++, nom: corps.nom };
      return json(201, { reservation: e.reservation, cle: 'c'.repeat(64) });
    }
    if ((m = /^\/l\/([a-f0-9]{16})\/envies\/(\d+)\/cagnotte$/.exec(chemin)) && methode === 'POST') {
      const l = etat.listes[m[1]];
      const e = l?.envies.find((x) => x.id === Number(m![2]));
      if (!e) return json(404, { message: 'Introuvable.' });
      const cagnotte = { id: suivant++, ...DEFAUTS.cagnottes, code: 'fedcbafedcbafedc', titre: e.titre, beneficiaire: l.proprietaire, objectif: corps?.objectif ?? e.prix };
      etat.cagnottes.unshift(cagnotte);
      e.reservation = { id: suivant++, nom: `${etat.compte.nom} et d’autres`, cagnotte: cagnotte.code };
      return json(201, { cagnotte, reservation: e.reservation, cle: 'd'.repeat(64) });
    }
    return json(404, { message: `Route inconnue du faux serveur : ${methode} ${chemin}` });
  });
  vi.stubGlobal('fetch', fetchFaux);
  return { appels };
}

/** Ouvre le site à une adresse, connecté ou non. */
export function preparer(chemin: string, connecte = true) {
  window.history.replaceState(null, '', chemin);
  localStorage.clear();
  if (connecte) localStorage.setItem('cadeaux.jeton', 'a'.repeat(64));
}
