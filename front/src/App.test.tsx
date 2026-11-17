// Tests d'écrans : le site complet, avec une fausse API, comme un utilisateur (clics et saisie).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { FournisseurDonnees } from './donnees/FournisseurDonnees';
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
    expect(appels[0]).toMatchObject({ methode: 'POST', chemin: '/comptes', corps: { nom: 'Baptiste', email: 'baptiste@example.com' } });
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

describe('occasion', () => {
  beforeEach(() => {
    etat.personnes = [{ id: 7, nom: 'Papa', dateNaissance: null, note: null }];
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
});
