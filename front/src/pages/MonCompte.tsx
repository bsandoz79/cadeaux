import { useState } from 'react';
import { api, jeton } from '../api/client';
import { aujourdhui } from '../calculs/bilan';
import { dejaInstallee, surIphone, useInstallation } from '../installation';
import { Champ, EnTete } from '../components/commun';
import { useEnvoi } from '../components/formulaire';
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

      <section className="carte formulaire" aria-labelledby="titre-rappels">
        <h2 id="titre-rappels">Rappels par e-mail</h2>
        <label className={styles.coche}>
          <input type="checkbox" checked={d.compte?.rappels ?? false} disabled={reglage} onChange={(e) => basculerRappels(e.target.checked)} />
          M’envoyer un e-mail 7 jours avant l’anniversaire d’un proche, et 2 jours avant la date limite d’une cagnotte qui n’est pas complète.
        </label>
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
  const motDePasse = useEnvoi(async (f, form) => {
    await api('POST', '/moi/motdepasse', { actuel: f.get('actuel'), nouveau: f.get('nouveau') });
    form.reset();
    setFait('Mot de passe changé. Vos autres appareils ont été déconnectés.');
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
        <summary>Mot de passe</summary>
        <form className="formulaire" onSubmit={motDePasse.envoyer} noValidate style={{ marginTop: '.8rem' }}>
          <Champ libelle="Mot de passe actuel" nom="actuel" type="password" autoComplete="current-password" required erreur={motDePasse.champs.actuel} />
          <Champ libelle="Nouveau mot de passe" nom="nouveau" type="password" autoComplete="new-password" required aide="Au moins 8 caractères." erreur={motDePasse.champs.nouveau} />
          {motDePasse.erreur && !Object.keys(motDePasse.champs).length && <p className="erreur" role="alert">{motDePasse.erreur}</p>}
          <div><button className="btn btn--petit" disabled={motDePasse.occupe}>Changer le mot de passe</button></div>
        </form>
      </details>
      <details>
        <summary>Adresse e-mail</summary>
        <form className="formulaire" onSubmit={adresse.envoyer} noValidate style={{ marginTop: '.8rem' }}>
          <Champ libelle="Nouvelle adresse" nom="email" type="email" autoComplete="email" required erreur={adresse.champs.email} />
          <Champ libelle="Mot de passe" nom="motDePasse" type="password" autoComplete="current-password" required erreur={adresse.champs.actuel} />
          {adresse.erreur && !Object.keys(adresse.champs).length && <p className="erreur" role="alert">{adresse.erreur}</p>}
          <p className={styles.discret}>Un lien part à la nouvelle adresse ; votre adresse actuelle est prévenue.</p>
          <div><button className="btn btn--petit" disabled={adresse.occupe}>Changer d’adresse</button></div>
        </form>
      </details>
    </section>
  );
}
