<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

use Cadeaux\Google;
use Cadeaux\Http\Requete;

final class GoogleTest extends ApiTestCase
{
    private const CLIENT = 'client-test.apps.googleusercontent.com';

    /** Identité que le faux Google renverra (sur la base de ce qu'envoie Google : sub, email, email_verified…). */
    public array $identite = [];
    /** @var list<array{string, string, string}> échanges demandés : code, vérificateur, adresse de retour */
    public array $echanges = [];

    protected function setUp(): void
    {
        $test = $this;
        $this->google = new class($test) implements Google {
            public function __construct(private readonly GoogleTest $test)
            {
            }

            public function identifiantClient(): string
            {
                return 'client-test.apps.googleusercontent.com';
            }

            public function echanger(string $code, string $verificateur, string $redirection): array
            {
                $this->test->echanges[] = [$code, $verificateur, $redirection];

                return $this->test->identite;
            }
        };
        parent::setUp();
        $this->identite = [
            'iss' => 'https://accounts.google.com',
            'aud' => self::CLIENT,
            'exp' => $this->horloge->maintenant()->getTimestamp() + 3600,
            'sub' => '110248495921238986420',
            'email' => 'Lea.Martin@gmail.com',
            'email_verified' => true,
            'given_name' => 'Léa',
        ];
    }

    private function get(string $chemin, array $parametres = []): \Cadeaux\Http\Reponse
    {
        return $this->app->traiter(new Requete('GET', $chemin, [], [], '203.0.113.7', $parametres));
    }

    /** Parcours complet : départ, retour de Google, session. Renvoie la réponse de la dernière étape. */
    private function connecter(string $preuve = '', string $retour = '', ?string $preuveSession = null): \Cadeaux\Http\Reponse
    {
        $preuve = $preuve !== '' ? $preuve : str_repeat('ab', 32);
        $depart = $this->get('/google/debut', ['preuve' => $preuve, 'retour' => $retour]);
        parse_str((string) parse_url((string) $depart->redirection, PHP_URL_QUERY), $chezGoogle);
        $retourGoogle = $this->get('/google/retour', ['code' => 'code-de-google', 'state' => $chezGoogle['state']]);
        self::assertStringStartsWith('https://cadeaux.test/connexion/google?code=', (string) $retourGoogle->redirection);
        parse_str((string) parse_url((string) $retourGoogle->redirection, PHP_URL_QUERY), $surLeSite);

        return $this->appel('POST', '/google/session', ['code' => $surLeSite['code'], 'preuve' => $preuveSession ?? $preuve], null, ['x-appareil' => 'appareil-de-test-123456']);
    }

    public function testLeSiteSaitSiLaConnexionGoogleEstActive(): void
    {
        self::assertSame(['actif' => true], $this->get('/google')->donnees);
    }

    public function testLeDepartEnvoieChezGoogleAvecEtatEtPkce(): void
    {
        $depart = $this->get('/google/debut', ['preuve' => str_repeat('ab', 32), 'retour' => '/l/0123456789abcdef']);

        self::assertSame(302, $depart->statut);
        self::assertStringStartsWith('https://accounts.google.com/o/oauth2/v2/auth?', (string) $depart->redirection);
        parse_str((string) parse_url((string) $depart->redirection, PHP_URL_QUERY), $p);
        self::assertSame(self::CLIENT, $p['client_id']);
        self::assertSame('https://cadeaux.test/api/google/retour', $p['redirect_uri']);
        self::assertSame('openid email profile', $p['scope']);
        self::assertSame('S256', $p['code_challenge_method']);
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $p['state']);
        // Rien de secret n'est gardé en clair : l'état et la preuve sont des empreintes.
        $ligne = $this->pdo->query('SELECT * FROM google_etats')->fetch(\PDO::FETCH_ASSOC);
        self::assertSame(hash('sha256', $p['state']), $ligne['empreinte']);
        self::assertSame(hash('sha256', str_repeat('ab', 32)), $ligne['preuve']);
    }

    public function testLesDepartsSontLimitesParAdresseIp(): void
    {
        for ($i = 0; $i < 20; ++$i) {
            self::assertSame(302, $this->get('/google/debut', ['preuve' => str_repeat('ab', 32)])->statut);
        }
        self::assertSame(429, $this->get('/google/debut', ['preuve' => str_repeat('ab', 32)])->statut);
    }

    public function testUnePreuveMalFormeeEstRefusee(): void
    {
        self::assertSame(400, $this->get('/google/debut', ['preuve' => 'court'])->statut);
    }

    public function testPremiereConnexionCreeUnCompteConfirmeSansMotDePasseConnu(): void
    {
        $session = $this->connecter();

        self::assertSame(200, $session->statut);
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $session->donnees['jeton']);
        self::assertSame('lea.martin@gmail.com', $session->donnees['compte']['email']);
        self::assertSame('Léa', $session->donnees['compte']['nom']);
        self::assertTrue($session->donnees['compte']['emailConfirme']);
        self::assertTrue($session->donnees['compte']['google']);
        self::assertTrue($session->donnees['nouveau']);
        self::assertSame([], $this->courriels, 'pas d’e-mail « nouvelle connexion » pour un compte qui vient d’être créé');
        // Le vérificateur PKCE et l'adresse de retour exacte ont été transmis à Google.
        self::assertSame('https://cadeaux.test/api/google/retour', $this->echanges[0][2]);
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $this->echanges[0][1]);
        // Le jeton donne bien accès au compte.
        self::assertSame(200, $this->appel('GET', '/moi', [], $session->donnees['jeton'])->statut);
    }

    public function testLaMemeAdresseRelieLeCompteExistantAuLieuDeLeDoubler(): void
    {
        $this->inscrire('lea.martin@gmail.com', 'Léa M.');
        $this->courriels = [];

        $session = $this->connecter();

        self::assertFalse($session->donnees['nouveau']);
        self::assertSame('Léa M.', $session->donnees['compte']['nom']);
        self::assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM comptes')->fetchColumn());
        self::assertSame('110248495921238986420', $this->pdo->query('SELECT google_sub FROM comptes')->fetchColumn());
        // Connexion depuis un nouvel appareil : le titulaire est prévenu.
        self::assertSame('Nouvelle connexion à votre compte', $this->courriels[0]['sujet'] ?? null);
    }

    public function testLaConnexionSuivanteRetrouveLeCompteParSonIdentifiantGoogle(): void
    {
        $this->connecter();
        $this->identite['email'] = 'nouvelle.adresse@gmail.com';

        $session = $this->connecter();

        self::assertFalse($session->donnees['nouveau']);
        self::assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM comptes')->fetchColumn());
    }

    public function testRetourVersLaPageDeDepart(): void
    {
        self::assertSame('/l/0123456789abcdef', $this->connecter('', '/l/0123456789abcdef')->donnees['retour']);
        self::assertNull($this->connecter('', 'https://ailleurs.example/piege')->donnees['retour'], 'aucune redirection vers un autre site');
    }

    public function testUnLienDeRetourVoleNeConnectePasDansUnAutreNavigateur(): void
    {
        $session = $this->connecter(str_repeat('ab', 32), '', str_repeat('cd', 32));

        self::assertSame(403, $session->statut);
    }

    public function testLeCodeDuSiteNeSertQuUneFoisEtExpire(): void
    {
        $preuve = str_repeat('ab', 32);
        $depart = $this->get('/google/debut', ['preuve' => $preuve]);
        parse_str((string) parse_url((string) $depart->redirection, PHP_URL_QUERY), $g);
        parse_str((string) parse_url((string) $this->get('/google/retour', ['code' => 'x', 'state' => $g['state']])->redirection, PHP_URL_QUERY), $s);

        self::assertSame(200, $this->appel('POST', '/google/session', ['code' => $s['code'], 'preuve' => $preuve])->statut);
        self::assertSame(410, $this->appel('POST', '/google/session', ['code' => $s['code'], 'preuve' => $preuve])->statut);

        $depart = $this->get('/google/debut', ['preuve' => $preuve]);
        parse_str((string) parse_url((string) $depart->redirection, PHP_URL_QUERY), $g);
        parse_str((string) parse_url((string) $this->get('/google/retour', ['code' => 'x', 'state' => $g['state']])->redirection, PHP_URL_QUERY), $s);
        $this->horloge->instant = $this->horloge->maintenant()->modify('+3 minutes')->format('Y-m-d H:i:s');
        self::assertSame(410, $this->appel('POST', '/google/session', ['code' => $s['code'], 'preuve' => $preuve])->statut);
    }

    public function testUnEtatInconnuOuExpireRenvoieSurLeSiteSansRienCreer(): void
    {
        self::assertSame('https://cadeaux.test/?google=expire', $this->get('/google/retour', ['code' => 'x', 'state' => 'inconnu'])->redirection);

        $depart = $this->get('/google/debut', ['preuve' => str_repeat('ab', 32)]);
        parse_str((string) parse_url((string) $depart->redirection, PHP_URL_QUERY), $g);
        $this->horloge->instant = $this->horloge->maintenant()->modify('+11 minutes')->format('Y-m-d H:i:s');
        self::assertSame('https://cadeaux.test/?google=expire', $this->get('/google/retour', ['code' => 'x', 'state' => $g['state']])->redirection);
        self::assertSame([], $this->echanges);
    }

    public function testAnnulationChezGoogle(): void
    {
        $depart = $this->get('/google/debut', ['preuve' => str_repeat('ab', 32)]);
        parse_str((string) parse_url((string) $depart->redirection, PHP_URL_QUERY), $g);

        self::assertSame('https://cadeaux.test/?google=annule', $this->get('/google/retour', ['error' => 'access_denied', 'state' => $g['state']])->redirection);
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function identitesRefusees(): iterable
    {
        yield 'pour un autre site' => [['aud' => 'autre-client']];
        yield 'autre émetteur' => [['iss' => 'https://pirate.example']];
        yield 'expirée' => [['exp' => 1]];
        yield 'adresse non vérifiée' => [['email_verified' => false]];
        yield 'identifiant absent' => [['sub' => '']];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('identitesRefusees')]
    public function testIdentiteGoogleRefusee(array $modification): void
    {
        $this->identite = $modification + $this->identite;
        $depart = $this->get('/google/debut', ['preuve' => str_repeat('ab', 32)]);
        parse_str((string) parse_url((string) $depart->redirection, PHP_URL_QUERY), $g);

        self::assertSame('https://cadeaux.test/?google=erreur', $this->get('/google/retour', ['code' => 'x', 'state' => $g['state']])->redirection);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM comptes')->fetchColumn());
    }

    public function testUnCompteBloqueNeSeConnectePasAvecGoogle(): void
    {
        $this->inscrire('lea.martin@gmail.com');
        $this->pdo->exec('UPDATE comptes SET bloque = 1');
        $depart = $this->get('/google/debut', ['preuve' => str_repeat('ab', 32)]);
        parse_str((string) parse_url((string) $depart->redirection, PHP_URL_QUERY), $g);

        self::assertSame('https://cadeaux.test/?google=bloque', $this->get('/google/retour', ['code' => 'x', 'state' => $g['state']])->redirection);
        self::assertNull($this->pdo->query('SELECT google_sub FROM comptes')->fetchColumn(), 'un compte bloqué n’est pas relié');
    }

    /** « Relier mon compte Google » depuis « Mon compte » : départ, retour de Google, fin. Renvoie [réponse de fin, adresse de retour]. */
    private function relier(string $jeton, string $preuve = '', ?string $preuveFin = null): array
    {
        $preuve = $preuve !== '' ? $preuve : str_repeat('ab', 32);
        $depart = $this->appel('POST', '/moi/google/relier', ['preuve' => $preuve], $jeton);
        parse_str((string) parse_url($depart->donnees['adresse'], PHP_URL_QUERY), $g);
        $retour = (string) $this->get('/google/retour', ['code' => 'x', 'state' => $g['state']])->redirection;
        if (!str_contains($retour, '/connexion/google?code=')) {
            return [null, $retour];
        }
        parse_str((string) parse_url($retour, PHP_URL_QUERY), $s);
        self::assertSame('1', $s['relier']);

        return [$this->appel('POST', '/moi/google/relier/fin', ['code' => $s['code'], 'preuve' => $preuveFin ?? $preuve], $jeton), $retour];
    }

    public function testRelierGoogleAUnCompteDAdresseDifferente(): void
    {
        $jeton = $this->inscrire('baptiste@example.com');
        [$fin] = $this->relier($jeton);

        self::assertSame(200, $fin->statut);
        self::assertTrue($fin->donnees['google']);
        self::assertTrue($fin->donnees['motDePasse']);
        // La connexion avec Google ouvre maintenant ce compte, sans en créer un autre.
        self::assertSame('baptiste@example.com', $this->connecter()->donnees['compte']['email']);
        self::assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM comptes')->fetchColumn());
    }

    public function testRelierDepuisUnAutreNavigateurOuUnAutreCompteEstRefuse(): void
    {
        $jeton = $this->inscrire('baptiste@example.com');
        self::assertSame(403, $this->relier($jeton, str_repeat('ab', 32), str_repeat('cd', 32))[0]->statut);

        $autre = $this->inscrire('autre@example.com', 'Autre');
        $depart = $this->appel('POST', '/moi/google/relier', ['preuve' => str_repeat('ab', 32)], $jeton);
        parse_str((string) parse_url($depart->donnees['adresse'], PHP_URL_QUERY), $g);
        parse_str((string) parse_url((string) $this->get('/google/retour', ['code' => 'x', 'state' => $g['state']])->redirection, PHP_URL_QUERY), $s);
        self::assertSame(410, $this->appel('POST', '/moi/google/relier/fin', ['code' => $s['code'], 'preuve' => str_repeat('ab', 32)], $autre)->statut);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM comptes WHERE google_sub IS NOT NULL')->fetchColumn());
    }

    public function testUnCompteGoogleDejaUtiliseNeSeRelieePasAUnSecond(): void
    {
        $this->connecter();
        $jeton = $this->inscrire('baptiste@example.com');

        self::assertSame('https://cadeaux.test/compte?google=deja', $this->relier($jeton)[1]);
    }

    public function testDelierDemandeUnMotDePasse(): void
    {
        $jeton = $this->connecter()->donnees['jeton'];
        self::assertFalse($this->appel('GET', '/moi', [], $jeton)->donnees['motDePasse']);
        self::assertSame(409, $this->appel('POST', '/moi/google/delier', [], $jeton)->statut);

        // Mot de passe choisi par le lien « oublié » : il compte comme défini, Google peut être délié.
        $this->appel('POST', '/motdepasse/oubli', ['email' => 'lea.martin@gmail.com']);
        preg_match('#/motdepasse/([a-f0-9]{64})#', end($this->courriels)['texte'], $m);
        self::assertSame(200, $this->appel('POST', '/motdepasse/nouveau', ['jeton' => $m[1], 'motDePasse' => 'un-mot-de-passe-solide'])->statut);
        $jeton = $this->appel('POST', '/connexion', ['email' => 'lea.martin@gmail.com', 'motDePasse' => 'un-mot-de-passe-solide'])->donnees['jeton'];

        $delie = $this->appel('POST', '/moi/google/delier', [], $jeton);
        self::assertSame(200, $delie->statut);
        self::assertFalse($delie->donnees['google']);
        self::assertTrue($delie->donnees['motDePasse']);
    }
}
