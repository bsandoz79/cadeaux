import { useEffect, useRef } from 'react';
import { Lien } from './components/commun';
import { useDonnees } from './donnees/contexte';
import { lireRoute, useChemin, type Route } from './navigation';
import styles from './App.module.css';
import { Accueil } from './pages/Accueil';
import { Bilan } from './pages/Bilan';
import { CagnotteOrganisateur } from './pages/CagnotteOrganisateur';
import { CagnottePublique } from './pages/CagnottePublique';
import { Cagnottes } from './pages/Cagnottes';
import { MonCompte } from './pages/MonCompte';
import { Idees } from './pages/Idees';
import { ListeEnviesPublique } from './pages/ListeEnviesPublique';
import { MesEnvies } from './pages/MesEnvies';
import { Legal } from './pages/Legal';
import { ConfirmerEmail, ConfirmerMotDePasse, NouveauMotDePasse } from './pages/LiensEmail';
import { Securite } from './pages/Securite';
import { CONFIDENTIALITE, MENTIONS_LEGALES } from './donnees/legal';
import { OccasionDetail } from './pages/OccasionDetail';
import { Occasions } from './pages/Occasions';
import { Proches } from './pages/Proches';
import { TableauDeBord } from './pages/TableauDeBord';

const MENU: { href: string; libelle: string; pages: Route['page'][] }[] = [
  { href: '/', libelle: 'Accueil', pages: ['accueil'] },
  { href: '/occasions', libelle: 'Occasions', pages: ['occasions', 'occasion'] },
  { href: '/proches', libelle: 'Proches', pages: ['proches'] },
  { href: '/idees', libelle: 'Idées', pages: ['idees', 'envies'] },
  { href: '/cagnottes', libelle: 'Cagnottes', pages: ['cagnottes', 'cagnotte'] },
  { href: '/bilan', libelle: 'Bilan', pages: ['bilan'] },
];

const TITRES: Partial<Record<Route['page'], string>> = {
  occasions: 'Occasions', occasion: 'Occasion', proches: 'Proches', idees: 'Idées de cadeaux', cagnottes: 'Cagnottes',
  cagnotte: 'Cagnotte', bilan: 'Bilan de l’année', compte: 'Mon compte', publique: 'Cadeau commun',
  confidentialite: 'Politique de confidentialité', mentions: 'Mentions légales', motdepasse: 'Nouveau mot de passe', confirmer: 'Adresse e-mail', securite: 'Ce n’est pas vous ?', confirmerMdp: 'Nouveau mot de passe', envies: 'Ma liste d’envies', liste: 'Liste d’envies',
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
            <Lien href="/compte" className={styles.compte} aria-current={route.page === 'compte' ? 'page' : undefined}>
              {compte.nom}
            </Lien>
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
        {route.page === 'publique' ? <CagnottePublique code={route.code} />
          : route.page === 'liste' ? <ListeEnviesPublique code={route.code} />
          : legale ? <Legal page={route.page === 'mentions' ? MENTIONS_LEGALES : CONFIDENTIALITE} />
          : route.page === 'motdepasse' ? <NouveauMotDePasse jeton={route.jeton} />
          : route.page === 'confirmer' ? <ConfirmerEmail jeton={route.jeton} />
          : route.page === 'securite' ? <Securite jeton={route.jeton} />
          : route.page === 'confirmerMdp' ? <ConfirmerMotDePasse jeton={route.jeton} />
          : !pret ? <p className={styles.chargement}>Chargement…</p>
          : !connecte ? <Accueil />
          : <Page route={route} />}
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
    case 'idees': return <Idees />;
    case 'envies': return <MesEnvies />;
    case 'cagnottes': return <Cagnottes />;
    case 'cagnotte': return <CagnotteOrganisateur id={route.id} />;
    case 'bilan': return <Bilan />;
    case 'compte': return <MonCompte />;
    default: return (
      <div className="vide">
        <p>Cette page n’existe pas.</p>
        <p><Lien href="/">Retour à l’accueil</Lien></p>
      </div>
    );
  }
}
