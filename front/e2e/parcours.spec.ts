import { expect, test, type Browser, type Page } from '@playwright/test';

/** Adresse unique par test et par appareil (téléphone, ordinateur) : la base est partagée pendant la série. */
const adresse = (nom: string) => `${nom}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

async function inscrire(page: Page, nom: string, email = adresse(nom.toLowerCase())) {
  await page.goto('/');
  await page.getByLabel('Prénom').fill(nom);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('motdepasse123');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('heading', { name: `Bonjour ${nom}` })).toBeVisible();
  return email;
}

/** Page d'un autre navigateur, sans compte (un ami qui reçoit un lien). */
async function autreNavigateur(browser: Browser) {
  const contexte = await browser.newContext({ locale: 'fr-FR' });
  return contexte.newPage();
}

/** Clic sur un lien du menu (barre du bas sur téléphone, en haut sur ordinateur). */
const menu = (page: Page, nom: string) => page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: nom }).click();

test('famille, Noël et bilan de l’année', async ({ page }) => {
  await inscrire(page, 'Baptiste');
  await menu(page, 'Proches');
  await page.getByRole('button', { name: 'Arbre de famille' }).click();
  await page.getByRole('button', { name: '+ Maman' }).click();
  await page.getByLabel('Prénom ou surnom').fill('Maman');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();

  await page.getByRole('button', { name: /Maman\s*Maman/ }).click();
  await page.getByRole('button', { name: 'Noël', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Noël \d{4}$/ })).toBeVisible();
  const formulaire = page.locator('form').filter({ has: page.getByRole('textbox', { name: 'Le cadeau', exact: true }) });
  await formulaire.getByRole('textbox', { name: 'Le cadeau', exact: true }).fill('Coffret de thés');
  await formulaire.getByLabel('Budget prévu (€)').fill('42');
  await formulaire.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByText('Coffret de thés')).toBeVisible();

  await menu(page, 'Bilan');
  await expect(page.getByText('42 €').first()).toBeVisible();
});

test('cagnotte partagée : un ami met sa part, l’organisateur complète', async ({ page, browser }) => {
  await inscrire(page, 'Baptiste');
  await menu(page, 'Cagnottes');
  await page.getByRole('button', { name: 'Nouvelle cagnotte' }).click();
  await page.getByRole('textbox', { name: 'Le cadeau', exact: true }).fill('Une montre');
  await page.getByLabel('Pour qui').fill('Julie');
  await page.getByLabel('Prix du cadeau (€)').fill('150');
  await page.getByRole('button', { name: 'Créer la cagnotte' }).click();
  const whatsapp = await page.getByRole('link', { name: 'Envoyer sur WhatsApp' }).getAttribute('href');
  const lien = decodeURIComponent(whatsapp!).match(/\/c\/[a-f0-9]{16}/)![0];

  // L'aperçu du lien (Snapchat, WhatsApp) : balises lues sans JavaScript.
  const html = await (await page.request.get(lien)).text();
  expect(html).toContain('<meta property="og:title" content="Cagnotte pour Julie : Une montre" />');

  const ami = await autreNavigateur(browser);
  await ami.goto(lien);
  await ami.getByLabel('Votre prénom').fill('Tom');
  await ami.getByRole('button', { name: '30 €' }).click();
  await ami.getByRole('button', { name: 'Ajouter ma part' }).click();
  await expect(ami.getByText(/Merci, votre part est notée/)).toBeVisible();
  await expect(ami.getByText('Il manque 120 €.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('cell', { name: 'Tom', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Je complète les 120/ }).click();
  await expect(page.getByText('Atteint')).toBeVisible();
  await ami.context().close();
});

test('liste d’envies : un proche réserve, le propriétaire ne voit rien', async ({ page, browser }) => {
  await inscrire(page, 'Baptiste');
  await page.goto('/envies');
  await page.getByRole('button', { name: 'Ajouter une envie' }).click();
  await page.getByLabel('Ce qui me ferait plaisir').fill('Platine vinyle');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.getByRole('button', { name: 'Créer le lien de partage' }).click();
  const champLien = page.getByRole('textbox', { name: 'Lien de ma liste d’envies' });
  await expect(champLien).toHaveValue(/\/l\/[a-f0-9]{16}$/);
  const adresseListe = new URL(await champLien.inputValue()).pathname;

  const ami = await autreNavigateur(browser);
  await ami.goto(adresseListe);
  await ami.getByRole('button', { name: 'Je m’en occupe' }).click();
  await ami.getByLabel('Votre prénom').fill('Léa');
  await ami.getByRole('button', { name: 'Réserver' }).click();
  await expect(ami.getByText('Vous vous en occupez.')).toBeVisible();

  await page.goto(adresseListe);
  await expect(page.getByText(/C’est votre liste : les réservations vous sont cachées/)).toBeVisible();
  await expect(page.getByText('Léa')).toHaveCount(0);
  await ami.context().close();
});

test('associer un proche à son compte, puis voir sa liste d’envies', async ({ page, browser }) => {
  await inscrire(page, 'Baptiste');
  await menu(page, 'Proches');
  await page.getByRole('button', { name: 'Ajouter un proche' }).click();
  await page.getByLabel('Prénom ou surnom').fill('Léa');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.getByRole('link', { name: 'Léa' }).click();
  await page.getByRole('button', { name: 'Associer à son compte' }).click();
  const whatsapp = await page.getByRole('link', { name: 'Envoyer sur WhatsApp' }).getAttribute('href');
  const invitation = new URL(decodeURIComponent(whatsapp!).match(/https?:\/\/\S+\/rejoindre\/[a-f0-9]{64}/)![0]).pathname;

  // Léa n'a pas de compte : elle le crée depuis l'invitation, revient dessus et accepte.
  const lea = await autreNavigateur(browser);
  await lea.goto(invitation);
  await lea.getByRole('link', { name: 'Me connecter ou créer mon compte' }).click();
  await lea.getByLabel('Prénom').fill('Léa');
  await lea.getByLabel('Adresse e-mail').fill(adresse('lea'));
  await lea.getByLabel('Mot de passe').fill('motdepasse123');
  await lea.getByRole('button', { name: 'Créer mon compte' }).click();
  await lea.getByRole('button', { name: 'Accepter' }).click();
  await expect(lea.getByText(/C’est fait : Baptiste voit maintenant votre liste d’envies/)).toBeVisible();
  await lea.goto('/envies');
  await lea.getByRole('button', { name: 'Ajouter une envie' }).click();
  await lea.getByLabel('Ce qui me ferait plaisir').fill('Roman policier');
  await lea.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(lea.getByText('Roman policier')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Sa liste d’envies' }).click();
  await page.getByRole('button', { name: 'Je m’en occupe' }).click();
  await expect(page.getByText('Vous vous en occupez.')).toBeVisible();
  await lea.context().close();
});

test('pages légales et page inconnue, sans compte', async ({ page }) => {
  await page.goto('/confidentialite');
  await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité' })).toBeVisible();
  await page.goto('/mentions-legales');
  await expect(page.getByRole('heading', { level: 1, name: 'Mentions légales' })).toBeVisible();
  await page.goto('/c/0000000000000000');
  await expect(page.getByRole('heading', { name: 'Cagnotte introuvable' })).toBeVisible();
});
