<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

final class IdentiteTest extends ApiTestCase
{
    /** Le lien (64 caractères) contenu dans le dernier e-mail envoyé. */
    private function lienRecu(string $chemin): string
    {
        $dernier = end($this->courriels);
        self::assertIsArray($dernier);
        self::assertMatchesRegularExpression("#https://cadeaux\\.test/$chemin/([a-f0-9]{64})#", $dernier['texte']);
        preg_match("#/$chemin/([a-f0-9]{64})#", $dernier['texte'], $m);

        return $m[1];
    }

    public function testInscriptionEnvoieUneConfirmationEtRappelsAuChoix(): void
    {
        $r = $this->appel('POST', '/comptes', ['email' => 'lea@example.com', 'nom' => 'Léa', 'motDePasse' => 'un-bon-mot-de-passe']);
        self::assertSame(['rappels' => false, 'emailConfirme' => false], array_intersect_key($r->donnees['compte'], ['rappels' => 1, 'emailConfirme' => 1]));
        self::assertSame('lea@example.com', $this->courriels[0]['a']);
        self::assertSame('Confirmez votre adresse e-mail', $this->courriels[0]['sujet']);

        $confirme = $this->appel('POST', '/email/confirmer', ['jeton' => $this->lienRecu('confirmer')]);
        self::assertSame(['type' => 'confirmation', 'email' => 'lea@example.com'], $confirme->donnees);
        self::assertTrue($this->appel('GET', '/moi', [], $r->donnees['jeton'])->donnees['emailConfirme']);
        // Un lien ne sert qu'une fois.
        self::assertSame(410, $this->appel('POST', '/email/confirmer', ['jeton' => $this->lienRecu('confirmer')])->statut);

        $avec = $this->appel('POST', '/comptes', ['email' => 'tom@example.com', 'nom' => 'Tom', 'motDePasse' => 'un-bon-mot-de-passe', 'rappels' => true]);
        self::assertTrue($avec->donnees['compte']['rappels']);
    }

    public function testRenvoyerLaConfirmationAvecUneLimite(): void
    {
        $r = $this->appel('POST', '/comptes', ['email' => 'lea@example.com', 'nom' => 'Léa', 'motDePasse' => 'un-bon-mot-de-passe']);
        $jeton = $r->donnees['jeton'];
        self::assertSame(204, $this->appel('POST', '/email/renvoyer', [], $jeton)->statut);
        self::assertSame(204, $this->appel('POST', '/email/renvoyer', [], $jeton)->statut);
        self::assertSame(429, $this->appel('POST', '/email/renvoyer', [], $jeton)->statut);
        // L'ancien lien ne marche plus, seul le dernier compte.
        $dernier = $this->lienRecu('confirmer');
        self::assertSame(200, $this->appel('POST', '/email/confirmer', ['jeton' => $dernier])->statut);
    }

    public function testEmailDeTest(): void
    {
        $jeton = $this->inscrire();
        $this->courriels = [];
        $r = $this->appel('POST', '/moi/email-test', [], $jeton);
        self::assertSame('E-mail de test envoyé à baptiste@example.com.', $r->donnees['message']);
        self::assertSame(['baptiste@example.com', 'E-mail de test'], [$this->courriels[0]['a'], $this->courriels[0]['sujet']]);
        $this->appel('POST', '/moi/email-test', [], $jeton);
        $this->appel('POST', '/moi/email-test', [], $jeton);
        self::assertSame(429, $this->appel('POST', '/moi/email-test', [], $jeton)->statut);
        self::assertSame(401, $this->appel('POST', '/moi/email-test')->statut);
    }

    public function testMotDePasseOublie(): void
    {
        $ancien = $this->inscrire();
        $this->courriels = [];

        // Même réponse que le compte existe ou non ; aucun e-mail pour une adresse inconnue.
        $inconnu = $this->appel('POST', '/motdepasse/oubli', ['email' => 'personne@example.com']);
        $connu = $this->appel('POST', '/motdepasse/oubli', ['email' => 'BAPTISTE@example.com']);
        self::assertSame($inconnu->donnees, $connu->donnees);
        self::assertCount(1, $this->courriels);
        $lien = $this->lienRecu('motdepasse');

        self::assertSame(422, $this->appel('POST', '/motdepasse/nouveau', ['jeton' => $lien, 'motDePasse' => 'court'])->statut);
        $r = $this->appel('POST', '/motdepasse/nouveau', ['jeton' => $lien, 'motDePasse' => 'nouveau-mot-de-passe']);
        self::assertSame(200, $r->statut);
        self::assertSame(401, $this->appel('GET', '/moi', [], $ancien)->statut, 'les autres connexions sont fermées');
        self::assertSame(200, $this->appel('GET', '/moi', [], $r->donnees['jeton'])->statut);
        self::assertSame(200, $this->appel('POST', '/connexion', ['email' => 'baptiste@example.com', 'motDePasse' => 'nouveau-mot-de-passe'])->statut);
        self::assertSame(410, $this->appel('POST', '/motdepasse/nouveau', ['jeton' => $lien, 'motDePasse' => 'encore-un-autre'])->statut);
    }

    public function testLienDeMotDePasseExpireApresUneHeure(): void
    {
        $this->inscrire();
        $this->appel('POST', '/motdepasse/oubli', ['email' => 'baptiste@example.com']);
        $this->horloge->instant = '2026-11-17 11:01:00';
        self::assertSame(410, $this->appel('POST', '/motdepasse/nouveau', ['jeton' => $this->lienRecu('motdepasse'), 'motDePasse' => 'nouveau-mot-de-passe'])->statut);
    }

    public function testChangerSonMotDePasseSeConfirmeParEmail(): void
    {
        $ici = $this->inscrire();
        $ailleurs = $this->appel('POST', '/connexion', ['email' => 'baptiste@example.com', 'motDePasse' => 'un-bon-mot-de-passe'])->donnees['jeton'];
        $this->courriels = [];
        $faux = $this->appel('POST', '/moi/motdepasse', ['actuel' => 'faux', 'nouveau' => 'nouveau-mot-de-passe'], $ici);
        self::assertSame(['actuel'], array_keys($faux->donnees['champs']));

        self::assertSame(200, $this->appel('POST', '/moi/motdepasse', ['actuel' => 'un-bon-mot-de-passe', 'nouveau' => 'nouveau-mot-de-passe'], $ici)->statut);
        self::assertSame('Confirmez votre nouveau mot de passe', $this->courriels[0]['sujet']);
        self::assertStringContainsString('/securite/', $this->courriels[0]['texte']);
        // Rien ne change avant le lien.
        self::assertSame(200, $this->appel('POST', '/connexion', ['email' => 'baptiste@example.com', 'motDePasse' => 'un-bon-mot-de-passe'])->statut);
        self::assertStringNotContainsString('nouveau-mot-de-passe', json_encode($this->pdo->query('SELECT * FROM liens')->fetchAll()), 'mot de passe haché dans le lien');

        preg_match('#/motdepasse/confirmer/([a-f0-9]{64})#', $this->courriels[0]['texte'], $m);
        self::assertSame(200, $this->appel('POST', '/motdepasse/confirmer', ['jeton' => $m[1]])->statut);
        self::assertSame(401, $this->appel('GET', '/moi', [], $ici)->statut);
        self::assertSame(401, $this->appel('GET', '/moi', [], $ailleurs)->statut);
        self::assertSame(200, $this->appel('POST', '/connexion', ['email' => 'baptiste@example.com', 'motDePasse' => 'nouveau-mot-de-passe'])->statut);
        self::assertContains('Votre mot de passe a été changé', array_column($this->courriels, 'sujet'));
        self::assertSame(410, $this->appel('POST', '/motdepasse/confirmer', ['jeton' => $m[1]])->statut);
    }

    public function testChangerDAdresseParUnLienEnvoyeALaNouvelle(): void
    {
        $jeton = $this->inscrire();
        $this->inscrire('prise@example.com', 'Autre');
        $this->courriels = [];
        self::assertSame(422, $this->appel('POST', '/moi/email', ['email' => 'nouvelle@example.com', 'motDePasse' => 'faux'], $jeton)->statut);
        self::assertSame(['email'], array_keys($this->appel('POST', '/moi/email', ['email' => 'prise@example.com', 'motDePasse' => 'un-bon-mot-de-passe'], $jeton)->donnees['champs']));

        self::assertSame(200, $this->appel('POST', '/moi/email', ['email' => 'Nouvelle@example.com', 'motDePasse' => 'un-bon-mot-de-passe'], $jeton)->statut);
        self::assertSame(['nouvelle@example.com', 'baptiste@example.com'], array_column($this->courriels, 'a'), 'lien à la nouvelle, « Ce n’est pas moi » à l’ancienne');
        self::assertStringContainsString('https://cadeaux.test/securite/', $this->courriels[1]['texte']);

        preg_match('#/confirmer/([a-f0-9]{64})#', $this->courriels[0]['texte'], $m);
        $r = $this->appel('POST', '/email/confirmer', ['jeton' => $m[1]])->donnees;
        self::assertSame(['email', 'nouvelle@example.com', '2026-11-19 10:00:00'], [$r['type'], $r['email'], $r['le']]);
        self::assertSame('baptiste@example.com', $this->appel('GET', '/moi', [], $jeton)->donnees['email'], 'rien ne change avant 48 h');

        $this->horloge->instant = '2026-11-19 10:01:00';
        self::assertSame('nouvelle@example.com', $this->appel('GET', '/moi', [], $jeton)->donnees['email']);
        self::assertSame(200, $this->appel('POST', '/connexion', ['email' => 'nouvelle@example.com', 'motDePasse' => 'un-bon-mot-de-passe'])->statut);
    }
}
