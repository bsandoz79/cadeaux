import { useState } from 'react';
import { nouvellePreuve, sortie, useGoogleActif } from '../donnees/google';
import { api, jeton } from '../api/client';
import { aujourdhui } from '../calculs/bilan';
import { dejaInstallee, surIphone, useInstallation } from '../installation';
import { Champ, EnTete } from '../components/commun';
import { useEnvoi } from '../components/formulaire';
import { useChargement } from '../donnees/useChargement';
import { useDonnees } from '../donnees/contexte';
import { aller } from '../navigation';
import styles from './pages.module.css';

/** Compte : déconnexion, extension Chrome, export des données, suppression du compte. */
export function MonCompte() {
  const d = useDonnees();
  const [export_, setExport] = useState<'pret' | 'en-cours' | 'erreur'>('pret');
  const [reglage, setReglage] = useState(false);
  const installation = useInstallation();
  const basculerRappels = async (rappels: boolean) => {
    setReglage(true);
    try { await api('PATCH', '/moi', { rappels }); await d.recharger(); } finally { setReglage(false); }
  };
  const deconnecter = async () => { await d.deconnecter(); aller('/'); };
  const telecharger = async () => {
    setExport('en-cours');
    try {
      const donnees = await api<unknown>('GET', '/moi/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `cadeaux-mes-donnees-${aujourdhui()}.json` });
      a.click();
      URL.revokeObjectURL(url);
      setExport('pret');
    } catch {
      setExport('erreur');
    }
  };
  const supprimer = async () => {
    if (!window.confirm('Supprimer votre compte et toutes vos données (proches, occasions, cadeaux, cagnottes) ? C’est définitif.')) return;
    await api('DELETE', '/moi');
    jeton.ecrire(null);
    window.location.assign('/');
  };

  return (
    <div className={styles.pile}>
      <EnTete titre="Mon compte" sousTitre={`${d.compte?.nom} · ${d.compte?.email}`}>
        <button type="button" className="btn btn--contour" onClick={deconnecter}>Me déconnecter</button>
      </EnTete>

      {!dejaInstallee() && (
        <section className="carte formulaire" aria-labelledby="titre-appli">
          <h2 id="titre-appli">L’appli sur votre téléphone</h2>
          {installation.possible ? (
            <>
              <p>Ajoutez Cadeaux à votre écran d’accueil : il s’ouvre en plein écran, comme une appli.</p>
              <div><button type="button" className="btn" onClick={installation.installer}>Installer l’appli</button></div>
            </>
          ) : surIphone() ? (
            <p>Sur iPhone : touchez le bouton Partager de Safari, puis « Sur l’écran d’accueil ».</p>
          ) : (
            <p>Sur votre téléphone, ouvrez cadeaux.bsandoz.fr dans Chrome, puis menu ⋮ → « Installer l’application » (ou, sur iPhone, Partager → « Sur l’écran d’accueil »).</p>
          )}
        </section>
      )}

      <ReglagesCompte />
      <ComptesAssocies />

      <ConnexionGoogleCompte />

      <AgendaCompte />

      <section className="carte formulaire" aria-labelledby="titre-rappels">
        <h2 id="titre-rappels">Rappels par e-mail</h2>
        <label className={styles.coche}>
          <input type="checkbox" checked={d.compte?.rappels ?? false} disabled={reglage} onChange={(e) => basculerRappels(e.target.checked)} />
          M’envoyer un e-mail 7 jours avant l’anniversaire d’un proche, et 2 jours avant la date limite d’une cagnotte qui n’est pas complète.
        </label>
        <EmailDeTest />
        <p className={styles.discret}>
          Au plus un e-mail par jour, à {d.compte?.email}.{d.compte && !d.compte.emailConfirme && ' Confirmez d’abord votre adresse (lien reçu par e-mail) : sinon, rien ne part.'}
        </p>
      </section>

      <section className="carte formulaire" aria-labelledby="titre-extension">
        <h2 id="titre-extension">Extension Chrome</h2>
        <p>Sur la page d’un produit (Amazon, Fnac, Decathlon…), un clic sur l’extension ajoute le produit à vos idées ou à votre liste d’envies, avec son prix et sa photo. En option, après une commande sur Amazon, elle vous demande si c’est un cadeau et pour qui, et propose d’en faire une cagnotte.</p>
        <ol style={{ listStyle: 'decimal', paddingLeft: '1.2rem', display: 'grid', gap: '.3rem' }}>
          <li><a href="/extension-cadeaux.zip" download>Téléchargez l’extension</a> et décompressez le fichier.</li>
          <li>Dans Chrome, ouvrez la page <code>chrome://extensions</code>, activez le « Mode développeur » (en haut à droite), puis cliquez sur « Charger l’extension non empaquetée » et choisissez le dossier décompressé.</li>
          <li>Cliquez sur l’icône du cadeau, puis connectez-vous avec la même adresse et le même mot de passe qu’ici.</li>
          <li>Sur un produit, cliquez sur l’icône, vérifiez le prix, choisissez pour qui, et ajoutez.</li>
        </ol>
      </section>

      <section className="carte formulaire" aria-labelledby="titre-export">
        <h2 id="titre-export">Mes données</h2>
        <p className={styles.discret}>Téléchargez tout ce que contient votre compte (proches, occasions, cadeaux, cagnottes et leurs participations), dans un fichier que vous pouvez garder ou importer ailleurs.</p>
        <div><button type="button" className="btn btn--contour" onClick={telecharger} disabled={export_ === 'en-cours'}>Télécharger mes données</button></div>
        {export_ === 'erreur' && <p className="erreur" role="alert">Le téléchargement n’a pas abouti. Réessayez.</p>}
      </section>

      <section className="carte formulaire" aria-labelledby="titre-supprimer">
        <h2 id="titre-supprimer">Supprimer mon compte</h2>
        <p className={styles.discret}>Toutes vos données sont effacées, et les liens de vos cagnottes ne marchent plus.</p>
        <div><button type="button" className="btn btn--contour btn--danger" onClick={supprimer}>Supprimer mon compte</button></div>
      </section>
    </div>
  );
}

/** Prénom, mot de passe et adresse e-mail. */
function ReglagesCompte() {
  const d = useDonnees();
  const [fait, setFait] = useState<string | null>(null);
  const prenom = useEnvoi(async (f) => {
    await api('PATCH', '/moi', { nom: String(f.get('nom') ?? '') });
    await d.recharger();
    setFait('Prénom enregistré.');
  });
  const naissance = useEnvoi(async (f) => {
    await api('PATCH', '/moi', { dateNaissance: String(f.get('dateNaissance') ?? '') || null });
    await d.recharger();
    setFait('Date de naissance enregistrée.');
  });
  const sansMotDePasse = d.compte?.motDePasse === false;
  const choisir = useEnvoi(async () => {
    // Même chemin que « Mot de passe oublié » : le lien part à l'adresse du compte (protège un compte dont la session serait volée).
    const r = await api<{ message: string }>('POST', '/motdepasse/oubli', { email: d.compte?.email });
    setFait(`${r.message} Ouvrez-le pour choisir votre mot de passe.`);
  });
  const motDePasse = useEnvoi(async (f, form) => {
    const r = await api<{ message: string }>('POST', '/moi/motdepasse', { actuel: f.get('actuel'), nouveau: f.get('nouveau') });
    form.reset();
    setFait(r.message);
  });
  const adresse = useEnvoi(async (f, form) => {
    const r = await api<{ message: string }>('POST', '/moi/email', { email: f.get('email'), motDePasse: f.get('motDePasse') });
    form.reset();
    setFait(`${r.message} Votre adresse changera quand vous l’aurez ouvert.`);
  });
  return (
    <section className="carte formulaire" aria-labelledby="titre-reglages">
      <h2 id="titre-reglages">Mes informations</h2>
      {fait && <p role="status" style={{ color: 'var(--c-vert)', fontWeight: 600 }}>{fait}</p>}
      <details>
        <summary>Prénom</summary>
        <form className="formulaire" onSubmit={prenom.envoyer} noValidate style={{ marginTop: '.8rem' }}>
          <Champ libelle="Prénom" nom="nom" required defaultValue={d.compte?.nom} autoComplete="given-name" erreur={prenom.champs.nom} />
          <div><button className="btn btn--petit" disabled={prenom.occupe}>Enregistrer</button></div>
        </form>
      </details>
      <details>
        <summary>Date de naissance</summary>
        <form className="formulaire" onSubmit={naissance.envoyer} noValidate style={{ marginTop: '.8rem' }}>
          <Champ libelle="Date de naissance" nom="dateNaissance" type="date" defaultValue={d.compte?.dateNaissance ?? ''} erreur={naissance.champs.dateNaissance}
            aide="Facultatif. Les proches qui ont associé votre compte la voient, pour ne pas oublier votre anniversaire." />
          <div><button className="btn btn--petit" disabled={naissance.occupe}>Enregistrer</button></div>
        </form>
      </details>
      <details>
        <summary>Mot de passe</summary>
        {sansMotDePasse ? (
          <form className="formulaire" onSubmit={choisir.envoyer} noValidate style={{ marginTop: '.8rem' }}>
            <p className={styles.discret}>Vous vous connectez avec Google. Pour pouvoir aussi vous connecter avec votre adresse et un mot de passe, recevez un lien par e-mail.</p>
            {choisir.erreur && <p className="erreur" role="alert">{choisir.erreur}</p>}
            <div><button className="btn btn--petit" disabled={choisir.occupe}>Recevoir le lien</button></div>
          </form>
        ) : (
        <form className="formulaire" onSubmit={motDePasse.envoyer} noValidate style={{ marginTop: '.8rem' }}>
          <Champ libelle="Mot de passe actuel" nom="actuel" type="password" autoComplete="current-password" required erreur={motDePasse.champs.actuel} />
          <Champ libelle="Nouveau mot de passe" nom="nouveau" type="password" autoComplete="new-password" required aide="Au moins 8 caractères." erreur={motDePasse.champs.nouveau} />
          {motDePasse.erreur && !Object.keys(motDePasse.champs).length && <p className="erreur" role="alert">{motDePasse.erreur}</p>}
          <div><button className="btn btn--petit" disabled={motDePasse.occupe}>Changer le mot de passe</button></div>
        </form>
        )}
      </details>
      <details>
        <summary>Adresse e-mail</summary>
        {sansMotDePasse ? (
          <p className={styles.discret} style={{ marginTop: '.8rem' }}>Pour changer d’adresse, choisissez d’abord un mot de passe (ci-dessus) : il sera demandé pour confirmer.</p>
        ) : (
        <form className="formulaire" onSubmit={adresse.envoyer} noValidate style={{ marginTop: '.8rem' }}>
          <Champ libelle="Nouvelle adresse" nom="email" type="email" autoComplete="email" required erreur={adresse.champs.email} />
          <Champ libelle="Mot de passe" nom="motDePasse" type="password" autoComplete="current-password" required erreur={adresse.champs.actuel} />
          {adresse.erreur && !Object.keys(adresse.champs).length && <p className="erreur" role="alert">{adresse.erreur}</p>}
          <p className={styles.discret}>Un lien part à la nouvelle adresse ; votre adresse actuelle est prévenue.</p>
          <div><button className="btn btn--petit" disabled={adresse.occupe}>Changer d’adresse</button></div>
        </form>
        )}
      </details>
    </section>
  );
}

/** S'envoyer un e-mail de test, pour vérifier qu'il arrive (et pas dans les indésirables). */
function EmailDeTest() {
  const [etat, setEtat] = useState<{ ok: boolean; texte: string } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const envoyer = async () => {
    setOccupe(true);
    try {
      const r = await api<{ message: string }>('POST', '/moi/email-test');
      setEtat({ ok: true, texte: `${r.message} Regardez aussi dans les indésirables.` });
    } catch (e) {
      setEtat({ ok: false, texte: e instanceof Error ? e.message : 'Une erreur est survenue.' });
    } finally {
      setOccupe(false);
    }
  };
  return (
    <div className="formulaire" style={{ gap: '.4rem' }}>
      <div><button type="button" className="btn btn--petit btn--contour" onClick={envoyer} disabled={occupe}>M’envoyer un e-mail de test</button></div>
      {etat && <p role="status" className={etat.ok ? undefined : 'erreur'} style={etat.ok ? { color: 'var(--c-vert)', fontWeight: 600 } : undefined}>{etat.texte}</p>}
    </div>
  );
}

/** Qui a associé ma fiche à mon compte, et le retirer. */
function ComptesAssocies() {
  const { donnees, recharger } = useChargement(() => api<{ personneId: number; inviteur: string; nom: string }[]>('GET', '/moi/associations'), []);
  if (!donnees || donnees.length === 0) return null;
  const retirer = async (id: number, inviteur: string) => {
    if (!window.confirm(`Retirer l’association avec ${inviteur} ? Il ou elle ne verra plus votre liste d’envies ni votre date d’anniversaire.`)) return;
    await api('DELETE', `/moi/associations/${id}`);
    await recharger();
  };
  return (
    <section className="carte formulaire" aria-labelledby="titre-associes">
      <h2 id="titre-associes">Comptes associés</h2>
      <p className={styles.discret}>Ces personnes voient votre liste d’envies et votre date d’anniversaire, et peuvent vous inviter à leurs cagnottes.</p>
      <ul className={styles.liste}>
        {donnees.map((a) => (
          <li key={a.personneId} className={styles.ligneListe}>
            <span><strong>{a.inviteur}</strong> <span className={styles.discret}>(vous a nommé « {a.nom} »)</span></span>
            <button type="button" className="btn btn--lien btn--petit btn--danger" onClick={() => retirer(a.personneId, a.inviteur)}>Retirer</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const MESSAGES_GOOGLE: Record<string, string> = {
  relie: 'Votre compte Google est relié : vous pouvez vous connecter avec « Continuer avec Google ».',
  deja: 'Ce compte Google est déjà relié à un autre compte Cadeaux.',
  erreur: 'Google n’a pas confirmé. Réessayez.',
  expire: 'La demande a pris trop de temps. Recommencez.',
  annule: 'Demande annulée.',
};

/** Relier ou délier son compte Google. Affiché si la connexion Google est configurée, ou si le compte est déjà relié. */
function ConnexionGoogleCompte() {
  const d = useDonnees();
  const actif = useGoogleActif();
  const motif = new URLSearchParams(window.location.search).get('google');
  const [message, setMessage] = useState<string | null>(motif ? MESSAGES_GOOGLE[motif] ?? null : null);
  const relier = useEnvoi(async () => {
    const r = await api<{ adresse: string }>('POST', '/moi/google/relier', { preuve: nouvellePreuve() });
    sortie.vers(r.adresse);
  });
  const delier = useEnvoi(async () => {
    await api('POST', '/moi/google/delier');
    await d.recharger();
    setMessage('Google n’est plus relié à votre compte.');
  });
  if (!actif && !d.compte?.google) return null;
  const relie = d.compte?.google === true;

  return (
    <section className="carte formulaire" aria-labelledby="titre-google">
      <h2 id="titre-google">Connexion avec Google</h2>
      {message && <p role="status" style={{ fontWeight: 600 }}>{message}</p>}
      {relie ? (
        <>
          <p>Votre compte est relié à Google : « Continuer avec Google » vous connecte directement.</p>
          {d.compte?.motDePasse === false ? (
            <p className={styles.discret}>Pour délier Google, choisissez d’abord un mot de passe (« Mes informations » → « Mot de passe »).</p>
          ) : (
            <form onSubmit={delier.envoyer} noValidate>
              {delier.erreur && <p className="erreur" role="alert">{delier.erreur}</p>}
              <button className="btn btn--petit btn--contour" disabled={delier.occupe}>Délier Google</button>
            </form>
          )}
        </>
      ) : (
        <form onSubmit={relier.envoyer} noValidate className="formulaire">
          <p>Reliez votre compte Google pour vous connecter en un clic, même si son adresse est différente.</p>
          {relier.erreur && <p className="erreur" role="alert">{relier.erreur}</p>}
          <div><button className="btn btn--petit" disabled={relier.occupe}>Relier mon compte Google</button></div>
        </form>
      )}
    </section>
  );
}

/** Anniversaires, occasions et cagnottes dans Google Agenda, l'agenda de l'iPhone ou Outlook (lien privé à s'abonner). */
function AgendaCompte() {
  const d = useDonnees();
  const [url, setUrl] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const agir = async (action: () => Promise<void>) => {
    setOccupe(true);
    setErreur(null);
    try { await action(); } catch { setErreur('Ça n’a pas marché. Réessayez.'); } finally { setOccupe(false); }
  };
  const creer = () => agir(async () => {
    if (d.compte?.agenda && !window.confirm('Créer un nouveau lien ? L’ancien ne marchera plus : il faudra ajouter le nouveau à votre agenda.')) return;
    const r = await api<{ url: string }>('POST', '/moi/agenda');
    setUrl(r.url);
    setCopie(false);
    await d.recharger();
  });
  const couper = () => agir(async () => {
    if (!window.confirm('Couper le lien ? Votre agenda ne recevra plus les dates de Cadeaux.')) return;
    await api('DELETE', '/moi/agenda');
    setUrl(null);
    await d.recharger();
  });
  const webcal = url?.replace(/^https:/, 'webcal:');
  const copier = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopie(true); } catch { /* le champ reste sélectionnable */ }
  };

  return (
    <section className="carte formulaire" aria-labelledby="titre-agenda">
      <h2 id="titre-agenda">Dans mon agenda</h2>
      <p>Les anniversaires de vos proches, vos occasions et la fin de vos cagnottes s’affichent dans votre agenda et se mettent à jour tout seuls.</p>
      {url && webcal ? (
        <>
          <div className="actions">
            <a className="btn btn--petit" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">Ajouter à Google Agenda</a>
            <a className="btn btn--petit btn--contour" href={webcal}>Ajouter à l’iPhone ou au Mac</a>
          </div>
          <div className="actions">
            <input readOnly value={url} aria-label="Lien de mon agenda" onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 0 }} />
            <button type="button" className="btn btn--petit btn--contour" onClick={copier}>{copie ? 'Lien copié' : 'Copier le lien'}</button>
          </div>
          <p className={styles.discret}>Autre agenda (Outlook…) : ajoutez un agenda « à partir d’une URL » et collez ce lien. Gardez-le pour vous : il montre les prénoms et les dates.</p>
        </>
      ) : d.compte?.agenda ? (
        <p className={styles.discret}>Votre lien d’agenda est actif. Il ne s’affiche qu’une fois : pour l’ajouter à un autre agenda, créez-en un nouveau.</p>
      ) : (
        <p className={styles.discret}>Le lien est privé : seule une personne qui l’a voit vos dates. Vous pourrez le couper à tout moment.</p>
      )}
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      <div className="actions">
        <button type="button" className={`btn btn--petit${d.compte?.agenda ? ' btn--contour' : ''}`} onClick={creer} disabled={occupe}>
          {d.compte?.agenda ? 'Nouveau lien' : 'Créer mon lien d’agenda'}
        </button>
        {d.compte?.agenda && <button type="button" className="btn btn--petit btn--lien btn--danger" onClick={couper} disabled={occupe}>Couper le lien</button>}
      </div>
    </section>
  );
}
