// Tests d'écrans : le site complet, avec une fausse API, comme un utilisateur (clics et saisie).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { FournisseurDonnees } from './donnees/FournisseurDonnees';
import { CLE_PREUVE_GOOGLE, sortie } from './donnees/google';
import { etatVide, installerFausseApi, preparer, type EtatFaux } from './test/fausseApi';

const ouvrir = () => render(<FournisseurDonnees><App /></FournisseurDonnees>);

let etat: EtatFaux;
beforeEach(() => { etat = etatVide(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('compte', () => {
  it('un visiteur crée son compte et arrive sur son accueil', async () => {
    preparer('/', false);
    const { appels } = installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Prénom'), 'Baptiste');
    await u.type(screen.getByLabelText('Adresse e-mail'), 'baptiste@example.com');
    await u.type(screen.getByLabelText('Mot de passe'), 'motdepasse123');
    expect(screen.getByRole('link', { name: 'politique de confidentialité' })).toHaveAttribute('href', '/confidentialite');
    await u.click(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(await screen.findByRole('heading', { name: 'Bonjour Baptiste' })).toBeInTheDocument();
    expect(appels.find((a) => a.methode === 'POST')).toMatchObject({ methode: 'POST', chemin: '/comptes', corps: { nom: 'Baptiste', email: 'baptiste@example.com' } });
    expect(localStorage.getItem('cadeaux.jeton')).toBe('a'.repeat(64));
  });

  it('les pages légales s’ouvrent sans compte', async () => {
    preparer('/confidentialite', false);
    installerFausseApi(etat);
    ouvrir();
    expect(await screen.findByRole('heading', { name: 'Politique de confidentialité', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vos droits' })).toBeInTheDocument();
  });
});

describe('mot de passe et adresse', () => {
  it('mot de passe oublié : demande, puis nouveau mot de passe depuis le lien', async () => {
    preparer('/', false);
    const { appels } = installerFausseApi(etat);
    const { unmount } = ouvrir();
    const u = userEvent.setup();
    await u.click(screen.getByRole('tab', { name: 'Se connecter' }));
    await u.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }));
    await u.type(screen.getByLabelText('Adresse e-mail'), 'baptiste@example.com');
    await u.click(screen.getByRole('button', { name: 'Recevoir le lien' }));
    expect(await screen.findByText(/un e-mail vient de partir/)).toBeInTheDocument();
    unmount();

    preparer(`/motdepasse/${'f'.repeat(64)}`, false);
    ouvrir();
    await u.type(await screen.findByLabelText('Choisissez votre mot de passe'), 'nouveau-mot-de-passe');
    await u.click(screen.getByRole('button', { name: 'Enregistrer et me connecter' }));
    expect(await screen.findByRole('heading', { name: 'Bonjour Baptiste' })).toBeInTheDocument();
    expect(appels.find((a) => a.chemin === '/motdepasse/nouveau')?.corps).toEqual({ jeton: 'f'.repeat(64), motDePasse: 'nouveau-mot-de-passe' });
  });

  it('adresse pas confirmée : bandeau sur l’accueil, puis lien de confirmation', async () => {
    etat.compte.emailConfirme = false;
    preparer('/');
    installerFausseApi(etat);
    const { unmount } = ouvrir();
    expect(await screen.findByText(/Confirmez votre adresse avec le lien envoyé à/)).toBeInTheDocument();
    unmount();
    preparer(`/confirmer/${'e'.repeat(64)}`);
    ouvrir();
    expect(await screen.findByText('Merci, votre adresse baptiste@example.com est confirmée.')).toBeInTheDocument();
  });

  it('« Ce n’est pas moi » : rien ne se passe sans clic, puis le compte est bloqué', async () => {
    preparer(`/securite/${'d'.repeat(64)}`);
    const { appels } = installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Bloquer mon compte' }));
    expect(appels.filter((a) => a.chemin === '/securite/bloquer')).toHaveLength(1);
    expect(await screen.findByText(/Votre compte est bloqué/)).toBeInTheDocument();
    expect(localStorage.getItem('cadeaux.jeton')).toBeNull();
  });

  it('la connexion envoie l’identifiant de l’appareil', async () => {
    preparer('/', false);
    const { appels } = installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    await u.click(screen.getByRole('tab', { name: 'Se connecter' }));
    await u.type(screen.getByLabelText('Adresse e-mail'), 'baptiste@example.com');
    await u.type(screen.getByLabelText('Mot de passe'), 'motdepasse123');
    await u.click(screen.getByRole('button', { name: 'Me connecter' }));
    await screen.findByRole('heading', { name: 'Bonjour Baptiste' });
    expect(appels.find((a) => a.methode === 'POST')?.entetes['X-Appareil']).toBe(localStorage.getItem('cadeaux.appareil'));
  });

  it('les rappels ne sont pas cochés d’office à l’inscription', async () => {
    preparer('/', false);
    const { appels } = installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    expect(screen.getByRole('checkbox', { name: /M’envoyer un rappel par e-mail/ })).not.toBeChecked();
    await u.type(screen.getByLabelText('Prénom'), 'Léa');
    await u.type(screen.getByLabelText('Adresse e-mail'), 'lea@example.com');
    await u.type(screen.getByLabelText('Mot de passe'), 'motdepasse123');
    await u.click(screen.getByRole('button', { name: 'Créer mon compte' }));
    await screen.findByRole('heading', { name: 'Bonjour Baptiste' });
    expect(appels.find((a) => a.methode === 'POST')?.corps).toMatchObject({ rappels: false });
  });
});

describe('proches', () => {
  it('la liste mène à la fiche ; « Son anniversaire » crée l’occasion et ouvre le formulaire pour ce proche', async () => {
    etat.personnes = [{ id: 7, nom: 'Léa', dateNaissance: '1996-12-24', note: null, lien: null, groupeIds: [] }];
    preparer('/proches');
    const { appels } = installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('link', { name: 'Léa' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Léa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Déjà offert' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Son anniversaire (24 décembre)' }));
    const creation = appels.find((a) => a.methode === 'POST' && a.chemin === '/occasions');
    expect(creation?.corps).toMatchObject({ type: 'anniversaire', titre: expect.stringMatching(/^Anniversaire de Léa \(\d+ ans\)$/), date: expect.stringMatching(/-12-24$/) });
    expect((await screen.findAllByLabelText('Pour qui'))[0]).toHaveValue('7');
    expect(screen.getAllByRole('button', { name: 'Ajouter' }).length).toBeGreaterThan(0);
  });
});

describe('groupes', () => {
  it('filtrer ses proches par groupe, et ajouter un proche dans le groupe affiché', async () => {
    etat.groupes = [{ id: 1, nom: 'Famille' }, { id: 2, nom: 'Amis' }];
    etat.personnes = [
      { id: 7, nom: 'Maman', dateNaissance: null, note: null, lien: null, groupeIds: [1] },
      { id: 8, nom: 'Tom', dateNaissance: null, note: null, lien: null, groupeIds: [2] },
    ];
    preparer('/proches');
    const { appels } = installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Famille' }));
    expect(screen.getByText('Maman')).toBeInTheDocument();
    expect(screen.queryByText('Tom')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Ajouter un proche' }));
    expect(screen.getByRole('checkbox', { name: 'Famille' })).toBeChecked();
    await u.type(screen.getByLabelText('Prénom ou surnom'), 'Papi');
    await u.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(appels.find((a) => a.methode === 'POST' && a.chemin === '/personnes')?.corps).toMatchObject({ nom: 'Papi', groupeIds: [1] });
  });
});

describe('arbre de famille', () => {
  it('place la famille par génération, complète une place vide, et propose les occasions au clic', async () => {
    etat.groupes = [{ id: 1, nom: 'Famille' }];
    etat.personnes = [
      { id: 7, nom: 'Jo', dateNaissance: '1950-05-02', note: null, lien: 'grand-mere-maternelle', groupeIds: [1] },
      { id: 8, nom: 'Léa', dateNaissance: null, note: null, lien: 'soeur', groupeIds: [1] },
    ];
    preparer('/proches');
    const { appels } = installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Arbre de famille' }));
    const grandsParents = screen.getByRole('region', { name: 'Grands-parents' });
    expect(within(grandsParents).getByRole('button', { name: /Mamie \(côté maman\)\s*Jo/ })).toBeInTheDocument();
    expect(within(grandsParents).getByRole('button', { name: '+ Papi (côté papa)' })).toBeInTheDocument();

    // Place vide : formulaire avec le lien déjà choisi.
    await u.click(screen.getByRole('button', { name: '+ Papa' }));
    expect(screen.getByLabelText('Lien de parenté')).toHaveValue('pere');

    // Un clic sur Léa : Noël crée l'occasion et ouvre le cadeau pour elle.
    await u.click(screen.getByRole('button', { name: /Sœur\s*Léa/ }));
    expect(screen.getByText('Ajoutez sa date de naissance pour son anniversaire.')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Noël' }));
    expect(appels.find((a) => a.methode === 'POST' && a.chemin === '/occasions')?.corps).toMatchObject({ type: 'noel', titre: expect.stringMatching(/^Noël \d{4}$/) });
    expect((await screen.findAllByLabelText('Pour qui'))[0]).toHaveValue('8');
  });

  it('Mamie : fête des mères proposée', async () => {
    etat.personnes = [{ id: 7, nom: 'Jo', dateNaissance: null, note: null, lien: 'grand-mere-maternelle', groupeIds: [] }];
    preparer('/proches');
    installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Arbre de famille' }));
    await u.click(screen.getByRole('button', { name: /Jo/ }));
    const fete = screen.getByRole('button', { name: /^Fête des mères \(\d+ mai|^Fête des mères \(\d+ juin/ });
    expect(fete).toBeEnabled();
  });
});

describe('association de comptes', () => {
  it('inviter un proche : lien envoyé par WhatsApp avec un message', async () => {
    etat.personnes = [{ id: 7, nom: 'Léa', dateNaissance: null, note: null, lien: null, groupeIds: [] }];
    preparer('/proches/7');
    installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Associer à son compte' }));
    const whatsapp = await screen.findByRole('link', { name: 'Envoyer sur WhatsApp' });
    expect(decodeURIComponent(whatsapp.getAttribute('href')!)).toContain(`Baptiste t’a ajouté(e) dans Cadeaux. Associe ton compte pour partager ta liste d’envies : http://localhost:3000/rejoindre/${'9'.repeat(64)}`);
  });

  it('accepter une invitation', async () => {
    preparer(`/rejoindre/${'9'.repeat(64)}`);
    const { appels } = installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    expect(await screen.findByText(/vous a ajouté\(e\) à ses proches \(sous le nom « Mon frère »\)/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Accepter' }));
    expect(await screen.findByText(/C’est fait : Julie voit maintenant votre liste d’envies/)).toBeInTheDocument();
    expect(appels.some((a) => a.chemin.endsWith('/accepter'))).toBe(true);
  });

  it('sans compte : invité à se connecter, avec retour sur l’invitation', async () => {
    preparer(`/rejoindre/${'9'.repeat(64)}`, false);
    installerFausseApi(etat);
    ouvrir();
    expect(await screen.findByRole('link', { name: 'Me connecter ou créer mon compte' })).toHaveAttribute('href', `/?retour=${encodeURIComponent(`/rejoindre/${'9'.repeat(64)}`)}`);
  });
});

describe('bien démarrer', () => {
  it('nouveau compte : trois étapes, cochées au fur et à mesure, et masquables', async () => {
    etat.personnes = [{ id: 7, nom: 'Maman', dateNaissance: null, note: null, lien: 'mere', groupeIds: [] }];
    preparer('/');
    installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Bien démarrer' })).toBeInTheDocument();
    expect(screen.getByText('1 sur 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Créer une occasion' })).toHaveAttribute('href', '/occasions');
    expect(screen.queryByRole('link', { name: 'Ajouter mes proches' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Masquer' }));
    expect(screen.queryByRole('heading', { name: 'Bien démarrer' })).not.toBeInTheDocument();
  });
});

describe('occasion', () => {
  beforeEach(() => {
    etat.personnes = [{ id: 7, nom: 'Papa', dateNaissance: null, note: null, lien: null, groupeIds: [] }];
    etat.occasions = [
      { id: 1, type: 'noel', titre: 'Noël 2025', date: '2025-12-25' },
      { id: 2, type: 'noel', titre: 'Noël 2026', date: '2026-12-25' },
    ];
    etat.cadeaux = [{ id: 5, titre: 'Écharpe en laine', occasionId: 1, personneId: 7, montantPrevu: null, montantDepense: 3500, statut: 'offert', lien: null, image: null, note: null, cagnotteId: null, creeLe: '' }];
    etat.budgets = [{ id: 9, occasionId: 2, personneId: 7, montant: 5000 }];
  });

  it('prévient d’un cadeau déjà offert, puis signale le budget dépassé', async () => {
    preparer('/occasions/2');
    const { appels } = installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    expect(await screen.findByText('0 € sur 50 € de budget, il reste 50 €', { exact: false })).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Ajouter un cadeau' }));
    await u.selectOptions(screen.getByLabelText('Pour qui'), 'Papa');
    await u.type(screen.getByLabelText('Le cadeau'), 'Echarpe grise');
    expect(screen.getByText('Vous avez déjà offert « Écharpe en laine » à Papa (Noël 2025).')).toBeInTheDocument();
    await u.type(screen.getByLabelText('Budget prévu (€)'), '60');
    await u.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByText('Budget de 50 € dépassé de 10 €', { exact: false })).toBeInTheDocument();
    expect(appels.find((a) => a.methode === 'POST' && a.chemin === '/cadeaux')?.corps).toMatchObject({ titre: 'Echarpe grise', personneId: 7, occasionId: 2, montantPrevu: 6000 });
  });

  it('refuse un montant mal écrit sans appeler le serveur', async () => {
    preparer('/occasions/2');
    const { appels } = installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Ajouter un cadeau' }));
    await u.type(screen.getByLabelText('Le cadeau'), 'Livre');
    await u.type(screen.getByLabelText('Budget prévu (€)'), 'douze');
    await u.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(screen.getByText('Montant invalide (ex. 25 ou 19,99).')).toBeInTheDocument();
    expect(appels.some((a) => a.methode === 'POST' && a.chemin === '/cadeaux')).toBe(false);
  });
});

describe('liens partagés, sans compte', () => {
  it('cagnotte : un ami ajoute sa part, puis peut la modifier', async () => {
    etat.cagnottes = [{ id: 3, code: 'abcdefabcdefabcd', titre: 'Montre', beneficiaire: 'Julie', objectif: 15000, mode: 'libre', nombreParts: null, dateLimite: null, lien: null, message: null, close: false, creeLe: '' }];
    preparer('/c/abcdefabcdefabcd', false);
    installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Montre' })).toBeInTheDocument();
    await u.type(screen.getByLabelText('Votre prénom'), 'Tom');
    await u.click(screen.getByRole('button', { name: '20 €' }));
    expect(screen.getByLabelText('Votre part (€)')).toHaveValue('20');
    expect(screen.getByRole('button', { name: '20 €' })).toHaveAttribute('aria-pressed', 'true');
    await u.click(screen.getByRole('button', { name: 'Ajouter ma part' }));
    expect(await screen.findByText(/Merci, votre part est notée/)).toBeInTheDocument();
    expect(screen.getByText('Il manque 130 €.')).toBeInTheDocument();
    const ligne = screen.getByText('Tom').closest('li')!;
    expect(within(ligne).getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
    // La clé de la part est gardée dans ce navigateur, pour la modifier ou la retirer.
    expect(Object.values(JSON.parse(localStorage.getItem('cadeaux.parts.abcdefabcdefabcd')!))).toEqual(['b'.repeat(64)]);
  });

  it('liste d’envies : un proche réserve, le propriétaire ne voit rien', async () => {
    etat.listes.abcdefabcdefabcd = {
      proprietaire: 'Baptiste',
      message: null,
      envies: [{ id: 1, titre: 'Casque audio', lien: null, image: null, prix: 8990, note: null, priorite: true }],
    };
    preparer('/l/abcdefabcdefabcd', false);
    installerFausseApi(etat);
    const { unmount } = ouvrir();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Je m’en occupe' }));
    await u.type(screen.getByLabelText('Votre prénom'), 'Léa');
    await u.click(screen.getByRole('button', { name: 'Réserver' }));
    expect(await screen.findByText(/Vous vous en occupez/)).toBeInTheDocument();
    unmount();

    // Le propriétaire, connecté, ouvre son propre lien.
    preparer('/l/abcdefabcdefabcd', true);
    ouvrir();
    expect(await screen.findByText(/C’est votre liste : les réservations vous sont cachées/)).toBeInTheDocument();
    expect(screen.queryByText(/Léa/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Je m’en occupe' })).not.toBeInTheDocument();
  });

  it('liste d’envies : « On se cotise » lance une cagnotte et propose WhatsApp et SMS', async () => {
    etat.listes.abcdefabcdefabcd = {
      proprietaire: 'Julie',
      message: null,
      envies: [{ id: 1, titre: 'Montre', lien: null, image: null, prix: 15000, note: null, priorite: false }],
    };
    preparer('/l/abcdefabcdefabcd', false);
    installerFausseApi(etat);
    const { unmount } = ouvrir();
    const u = userEvent.setup();
    // Sans compte : invitation à se connecter, avec retour sur la liste.
    await u.click(await screen.findByRole('button', { name: 'On se cotise' }));
    expect(screen.getByRole('link', { name: 'Me connecter ou créer un compte' })).toHaveAttribute('href', '/?retour=%2Fl%2Fabcdefabcdefabcd');
    unmount();

    // Connecté (un proche qui a son compte, ici simulé par un jeton) : la cagnotte est lancée.
    preparer('/l/abcdefabcdefabcd', true);
    etat.listes.abcdefabcdefabcd.envies[0].reservation = null;
    ouvrir();
    await u.click(await screen.findByRole('button', { name: 'On se cotise' }));
    await u.click(screen.getByRole('button', { name: 'Lancer la cagnotte' }));
    expect(await screen.findByText('Cagnotte lancée ! Envoyez le lien aux autres :')).toBeInTheDocument();
    const whatsapp = screen.getByRole('link', { name: 'Envoyer sur WhatsApp' });
    expect(screen.getByRole('link', { name: 'Envoyer sur Snapchat' })).toHaveAttribute('href', `https://www.snapchat.com/share?link=${encodeURIComponent('http://localhost:3000/c/fedcbafedcbafedc')}`);
    expect(decodeURIComponent(whatsapp.getAttribute('href')!)).toContain('On se cotise pour Julie (Montre) ? Mets ta part ici : http://localhost:3000/c/fedcbafedcbafedc');
    expect(screen.getByRole('button', { name: 'Copier le lien' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Envoyer par SMS' }).getAttribute('href')).toMatch(/^sms:\?&body=/);
  });

  it('cagnotte : le RIB de l’organisateur s’affiche seulement sur demande', async () => {
    etat.cagnottes = [{ id: 3, code: 'abcdefabcdefabcd', titre: 'Montre', beneficiaire: 'Julie', objectif: 15000, mode: 'libre', nombreParts: null, dateLimite: null, lien: null, message: null, close: false, creeLe: '', rib: { titulaire: 'Baptiste Sandoz', recent: true } }];
    preparer('/c/abcdefabcdefabcd', false);
    const { appels } = installerFausseApi(etat);
    ouvrir();
    const u = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Payer par virement' })).toBeInTheDocument();
    expect(screen.getByText(/Ce RIB a été ajouté ou modifié il y a moins de 48 heures/)).toBeInTheDocument();
    expect(screen.queryByText(/FR76/)).not.toBeInTheDocument();
    expect(appels.some((a) => a.chemin.endsWith('/rib'))).toBe(false);
    await u.click(screen.getByRole('button', { name: 'Afficher le RIB' }));
    expect(await screen.findByText('FR76 3000 6000 0112 3456 7890 189')).toBeInTheDocument();
    expect(screen.getByText('Cadeau Julie')).toBeInTheDocument();
  });
});

describe('connexion avec Google', () => {
  it('le bouton n’apparaît que si Google est configuré, et part chez Google avec une preuve gardée dans l’onglet', async () => {
    preparer('/?retour=/l/0123456789abcdef', false);
    installerFausseApi(etat);
    const { unmount } = ouvrir();
    await screen.findByRole('button', { name: 'Créer mon compte' });
    expect(screen.queryByRole('button', { name: 'Continuer avec Google' })).not.toBeInTheDocument();
    unmount();

    etat.google = true;
    installerFausseApi(etat);
    const depart = vi.spyOn(sortie, 'vers').mockImplementation(() => {});
    ouvrir();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Continuer avec Google' }));
    const preuve = sessionStorage.getItem(CLE_PREUVE_GOOGLE) ?? '';
    expect(preuve).toMatch(/^[a-f0-9]{64}$/);
    expect(depart).toHaveBeenCalledWith(`/api/google/debut?preuve=${preuve}&retour=%2Fl%2F0123456789abcdef`);
  });

  it('au retour de Google, le code et la preuve ouvrent la session', async () => {
    sessionStorage.setItem(CLE_PREUVE_GOOGLE, 'b'.repeat(64));
    preparer(`/connexion/google?code=${'c'.repeat(64)}`, false);
    const { appels } = installerFausseApi(etat);
    ouvrir();
    await screen.findByRole('heading', { name: 'Bonjour Baptiste' });
    expect(appels.find((a) => a.chemin === '/google/session')?.corps).toEqual({ code: 'c'.repeat(64), preuve: 'b'.repeat(64) });
    expect(sessionStorage.getItem(CLE_PREUVE_GOOGLE)).toBeNull();
    expect(window.location.pathname).toBe('/');
  });

  it('sans la preuve de l’onglet, la connexion est refusée avec un message', async () => {
    sessionStorage.removeItem(CLE_PREUVE_GOOGLE);
    preparer(`/connexion/google?code=${'c'.repeat(64)}`, false);
    installerFausseApi(etat);
    ouvrir();
    expect(await screen.findByRole('alert')).toHaveTextContent('autre navigateur');
  });

  it('une invitation propose aussi Google, avec retour sur l’invitation', async () => {
    etat.google = true;
    preparer(`/rejoindre/${'9'.repeat(64)}`, false);
    installerFausseApi(etat);
    const depart = vi.spyOn(sortie, 'vers').mockImplementation(() => {});
    ouvrir();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Continuer avec Google' }));
    expect(depart.mock.calls[0][0]).toContain(`retour=%2Frejoindre%2F${'9'.repeat(64)}`);
  });

  it('« Mon compte » : relier Google part chez Google, puis la fin relie le compte', async () => {
    etat.google = true;
    preparer('/compte');
    const { appels } = installerFausseApi(etat);
    const depart = vi.spyOn(sortie, 'vers').mockImplementation(() => {});
    const { unmount } = ouvrir();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Relier mon compte Google' }));
    expect(depart).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=x');
    const preuve = sessionStorage.getItem(CLE_PREUVE_GOOGLE);
    expect(appels.find((a) => a.chemin === '/moi/google/relier')?.corps).toEqual({ preuve });
    unmount();

    preparer(`/connexion/google?code=${'c'.repeat(64)}&relier=1`);
    sessionStorage.setItem(CLE_PREUVE_GOOGLE, 'b'.repeat(64));
    installerFausseApi(etat);
    ouvrir();
    expect(await screen.findByText(/Votre compte Google est relié/)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/compte');
  });

  it('« Mon compte » : sans mot de passe, Google ne se délie pas et un lien permet d’en choisir un', async () => {
    etat.google = true;
    etat.compte = { ...etat.compte, google: true, motDePasse: false };
    preparer('/compte');
    const { appels } = installerFausseApi(etat);
    ouvrir();
    expect(await screen.findByText(/Pour délier Google, choisissez d’abord un mot de passe/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Délier Google' })).not.toBeInTheDocument();
    const u = userEvent.setup();
    await u.click(screen.getByText('Mot de passe'));
    await u.click(screen.getByRole('button', { name: 'Recevoir le lien' }));
    expect(appels.find((a) => a.chemin === '/motdepasse/oubli')?.corps).toEqual({ email: 'baptiste@example.com' });
  });

  it('explique un retour annulé', async () => {
    preparer('/?google=annule', false);
    installerFausseApi(etat);
    ouvrir();
    expect(await screen.findByRole('alert')).toHaveTextContent('Connexion avec Google annulée.');
  });
});
