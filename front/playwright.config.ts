import { defineConfig, devices } from '@playwright/test';

/**
 * Parcours dans un vrai navigateur (Chrome) : le site construit (dist) et l'API PHP sur une base SQLite jetable,
 * servis par le serveur intégré de PHP, arrêté à la fin des tests.
 * Avant : `npm run build`, et api/config.local.php pointant vers une base SQLite (voir e2e/preparer.mjs).
 */
const PORT = 8899;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    // Localement, le Chrome installé ; en intégration continue, le Chromium de Playwright.
    channel: process.env.CI ? undefined : 'chrome',
  },
  projects: [
    { name: 'téléphone', use: { ...devices['Pixel 7'] } },
    { name: 'ordinateur', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `node e2e/preparer.mjs && php -S 127.0.0.1:${PORT} -t dist e2e/routeur.php`,
    url: `http://127.0.0.1:${PORT}/manifest.webmanifest`,
    reuseExistingServer: false,
    timeout: 30_000,
    // Le serveur de PHP écrit chaque requête : seuls les résultats des tests s'affichent.
    stderr: 'ignore',
  },
});
