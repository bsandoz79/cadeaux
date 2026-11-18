import { lazy, Suspense, useEffect, useRef } from 'react';
import { Lien } from './components/commun';
import { useDonnees } from './donnees/contexte';
import { lireRoute, useChemin, type Route } from './navigation';
import styles from './App.module.css';
import { Accueil } from './pages/Accueil';
import { TableauDeBord } from './pages/TableauDeBord';

/*
 * Pages chargées à la demande : seul l'essentiel (accueil, tableau de bord) part avec le premier chargement,
 * chaque autre page se télécharge quand on l'ouvre. Le site s'ouvre ainsi plus vite sur téléphone.
 */
function page<M, N extends keyof M>(charger: () => Promise<M>, nom: N): M[N] {
  return lazy(() => charger().then((m) => ({ default: m[nom] as unknown as React.ComponentType }))) as unknown as M[N];
}
const Bilan = page(() => import('./pages/Bilan'), 'Bilan');
const CagnotteOrganisateur = page(() => import('./pages/CagnotteOrganisateur'), 'CagnotteOrganisateur');
const CagnottePublique = page(() => import('./pages/CagnottePublique'), 'CagnottePublique');
const Cagnottes = page(() => import('./pages/Cagnottes'), 'Cagnottes');
const MonCompte = page(() => import('./pages/MonCompte'), 'MonCompte');
const Idees = page(() => import('./pages/Idees'), 'Idees');
const ListeEnviesPublique = page(() => import('./pages/ListeEnviesPublique'), 'ListeEnviesPublique');
const MesEnvies = page(() => import('./pages/MesEnvies'), 'MesEnvies');
const Securite = page(() => import('./pages/Securite'), 'Securite');
const Rejoindre = page(() => import('./pages/Rejoindre'), 'Rejoindre');
const OccasionDetail = page(() => import('./pages/OccasionDetail'), 'OccasionDetail');
const Occasions = page(() => import('./pages/Occasions'), 'Occasions');
const Proches = page(() => import('./pages/Proches'), 'Proches');
const Recherche = page(() => import('./pages/Recherche'), 'Recherche');
const FicheProche = page(() => import('./pages/FicheProche'), 'FicheProche');
const NouveauMotDePasse = page(() => import('./pages/LiensEmail'), 'NouveauMotDePasse');
const ConfirmerEmail = page(() => import('./pages/LiensEmail'), 'ConfirmerEmail');
const ConfirmerMotDePasse = page(() => import('./pages/LiensEmail'), 'ConfirmerMotDePasse');
const PageLegale = lazy(() => Promise.all([import('./pages/Legal'), import('./donnees/legal')]).then(([m, d]) => ({
  default: ({ mentions }: { mentions: boolean }) => <m.Legal page={mentions ? d.MENTIONS_LEGALES : d.CONFIDENTIALITE} />,
})));

const MENU: { href: string; libelle: string; pages: Route['page'][] }[] = [
  { href: '/', libelle: 'Accueil', pages: ['accueil'] },
  { href: '/occasions', libelle: 'Occasions', pages: ['occasions', 'occasion'] },
  { href: '/proches', libelle: 'Proches', pages: ['proches', 'proche'] },
  { href: '/idees', libelle: 'Idées', pages: ['idees', 'envies'] },
  { href: '/cagnottes', libelle: 'Cagnottes', pages: ['cagnottes', 'cagnotte'] },
  { href: '/bilan', libelle: 'Bilan', pages: ['bilan'] },
];

const TITRES: Partial<Record<Route['page'], string>> = {
  occasions: 'Occasions', occasion: 'Occasion', proches: 'Proches', proche: 'Proche', recherche: 'Rechercher', idees: 'Idées de cadeaux', cagnottes: 'Cagnottes',
  cagnotte: 'Cagnotte', bilan: 'Bilan de l’année', compte: 'Mon compte', publique: 'Cadeau commun',
  confidentialite: 'Politique de confidentialité', mentions: 'Mentions légales', motdepasse: 'Nouveau mot de passe', confirmer: 'Adresse e-mail', securite: 'Ce n’est pas vous ?', confirmerMdp: 'Nouveau mot de passe', rejoindre: 'Invitation', envies: 'Ma liste d’envies', liste: 'Liste d’envies',
};

export function App() {
  const chemin = useChemin();
  const route = lireRoute(chemin);
  const { compte, pret } = useDonnees();
  const principal = useRef<HTMLElement>(null);

  useEffect(() => {
    const titre = TITRES[route.page];
    document.title = titre ? `${titre} · Cadeaux` : 'Cadeaux : vos cadeaux, votre budget et vos cagnottes communes';
  }, [route.page]);

  // La page d'une cagnotte partagée et les pages légales s'ouvrent sans compte.
  const publique = route.page === 'publique' || route.page === 'liste';
  const legale = route.page === 'confidentialite' || route.page === 'mentions';
  const connecte = compte !== null;

  return (
    <div className={styles.app}>
      <a className={styles.evitement} href="#contenu">Aller au contenu</a>
      <header className={styles.entete}>
        <div className={styles.barre}>
          <Lien href="/" className={styles.logo} aria-label="Cadeaux, accueil">
            <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
              <rect x="8" y="26" width="48" height="32" rx="5" fill="var(--c-accent)" />
              <rect x="4" y="18" width="56" height="12" rx="4" fill="var(--c-accent-fonce)" />
              <rect x="28" y="18" width="8" height="40" fill="var(--c-or)" />
              <path d="M32 18c-6-12-20-10-16-2 2 3 9 2 16 2zm0 0c6-12 20-10 16-2-2 3-9 2-16 2z" fill="none" stroke="var(--c-or)" strokeWidth="4" strokeLinejoin="round" />
            </svg>
            <span>Cadeaux</span>
          </Lien>
          {connecte && (
            <div className={styles.droite}>
              <Lien href="/recherche" className={styles.loupe} aria-label="Rechercher" title="Rechercher" aria-current={route.page === 'recherche' ? 'page' : undefined}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="m20 20-4.2-4.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
              </Lien>
              <Lien href="/compte" className={styles.compte} aria-current={route.page === 'compte' ? 'page' : undefined}>
                {compte.nom}
              </Lien>
            </div>
          )}
        </div>
        {connecte && !publique && (
          <nav aria-label="Menu principal" className={styles.menu}>
            <ul>
              {MENU.map((m) => (
                <li key={m.href}>
                  <Lien href={m.href} aria-current={m.pages.includes(route.page) ? 'page' : undefined}>{m.libelle}</Lien>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main id="contenu" ref={principal} className={styles.contenu} tabIndex={-1}>
        <Suspense fallback={<p className={styles.chargement}>Chargement…</p>}>
        {route.page === 'publique' ? <CagnottePublique code={route.code} />
          : route.page === 'liste' ? <ListeEnviesPublique code={route.code} />
          : legale ? <PageLegale mentions={route.page === 'mentions'} />
          : route.page === 'motdepasse' ? <NouveauMotDePasse jeton={route.jeton} />
          : route.page === 'confirmer' ? <ConfirmerEmail jeton={route.jeton} />
          : route.page === 'securite' ? <Securite jeton={route.jeton} />
          : route.page === 'confirmerMdp' ? <ConfirmerMotDePasse jeton={route.jeton} />
          : route.page === 'rejoindre' ? <Rejoindre jeton={route.jeton} />
          : !pret ? <p className={styles.chargement}>Chargement…</p>
          : !connecte ? <Accueil />
          : <Page route={route} />}
        </Suspense>
      </main>

      <footer className={styles.pied}>
        <p>Cadeaux · les montants sont notés ici, l’argent ne passe pas par le site.</p>
        <p className={styles.liensPied}>
          <Lien href="/confidentialite">Confidentialité</Lien>
          <Lien href="/mentions-legales">Mentions légales</Lien>
        </p>
      </footer>
    </div>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case 'accueil': return <TableauDeBord />;
    case 'occasions': return <Occasions />;
    case 'occasion': return <OccasionDetail id={route.id} />;
    case 'proches': return <Proches />;
    case 'proche': return <FicheProche id={route.id} />;
    case 'idees': return <Idees />;
    case 'envies': return <MesEnvies />;
    case 'cagnottes': return <Cagnottes />;
    case 'cagnotte': return <CagnotteOrganisateur id={route.id} />;
    case 'bilan': return <Bilan />;
    case 'compte': return <MonCompte />;
    case 'recherche': return <Recherche />;
    default: return (
      <div className="vide">
        <p>Cette page n’existe pas.</p>
        <p><Lien href="/">Retour à l’accueil</Lien></p>
      </div>
    );
  }
}
