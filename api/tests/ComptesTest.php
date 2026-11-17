<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

final class ComptesTest extends ApiTestCase
{
    public function testInscriptionPuisConnexion(): void
    {
        $jeton = $this->inscrire();
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $jeton);
        self::assertSame('Baptiste', $this->appel('GET', '/moi', [], $jeton)->donnees['nom']);

        $connexion = $this->appel('POST', '/connexion', ['email' => 'BAPTISTE@example.com ', 'motDePasse' => 'un-bon-mot-de-passe']);
        self::assertSame(200, $connexion->statut);
        self::assertNotSame($jeton, $connexion->donnees['jeton']);
    }

    public function testLeMotDePasseEstHacheEtLeJetonNEstPasGardeEnClair(): void
    {
        $jeton = $this->inscrire();
        $hash = $this->pdo->query('SELECT mot_de_passe FROM comptes')->fetchColumn();
        self::assertTrue(password_verify('un-bon-mot-de-passe', $hash));
        self::assertSame(hash('sha256', $jeton), $this->pdo->query('SELECT empreinte FROM jetons')->fetchColumn());
    }

    public function testInscriptionInvalideOuEnDouble(): void
    {
        $reponse = $this->appel('POST', '/comptes', ['email' => 'pas-un-email', 'nom' => '', 'motDePasse' => 'court']);
        self::assertSame(422, $reponse->statut);
        self::assertSame(['email', 'nom', 'motDePasse'], array_keys($reponse->donnees['champs']));

        $this->inscrire();
        $double = $this->appel('POST', '/comptes', ['email' => 'baptiste@example.com', 'nom' => 'B', 'motDePasse' => 'un-autre-mot-de-passe']);
        self::assertSame(422, $double->statut);
        self::assertArrayHasKey('email', $double->donnees['champs']);
    }

    public function testMauvaisMotDePasseEtBlocageApresCinqEssais(): void
    {
        $this->inscrire();
        for ($i = 0; $i < 5; ++$i) {
            self::assertSame(401, $this->appel('POST', '/connexion', ['email' => 'baptiste@example.com', 'motDePasse' => 'faux'])->statut);
        }
        self::assertSame(429, $this->appel('POST', '/connexion', ['email' => 'baptiste@example.com', 'motDePasse' => 'un-bon-mot-de-passe'])->statut);
    }

    public function testSansJetonOuApresDeconnexionOnEstRefuse(): void
    {
        self::assertSame(401, $this->appel('GET', '/personnes')->statut);
        $jeton = $this->inscrire();
        self::assertSame(204, $this->appel('POST', '/deconnexion', [], $jeton)->statut);
        self::assertSame(401, $this->appel('GET', '/moi', [], $jeton)->statut);
    }

    public function testSuppressionDuCompteEfface(): void
    {
        $jeton = $this->inscrire();
        $this->appel('POST', '/personnes', ['nom' => 'Maman'], $jeton);
        self::assertSame(204, $this->appel('DELETE', '/moi', [], $jeton)->statut);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM personnes')->fetchColumn());
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM comptes')->fetchColumn());
    }

    public function testRouteInconnueEtMethodeNonPrevue(): void
    {
        self::assertSame(404, $this->appel('GET', '/rien')->statut);
        self::assertSame(405, $this->appel('PUT', '/comptes')->statut);
    }
}
