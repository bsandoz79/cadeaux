<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

use Cadeaux\Identite;

/** Vol de compte : « Ce n'est pas moi », changement d'adresse retardé, RIB protégé, nouvel appareil. */
final class AntivolTest extends ApiTestCase
{
    private const IBAN = 'FR7630006000011234567890189';

    private function lien(string $chemin, ?string $texte = null): string
    {
        $texte ??= (string) end($this->courriels)['texte'];
        self::assertSame(1, preg_match("#/$chemin/([a-f0-9]{64})#", $texte, $m), $texte);

        return $m[1];
    }

    public function testLeVoleurChangeLAdresseEtLeVraiProprietaireBloqueTout(): void
    {
        $jeton = $this->inscrire();
        $g = $this->appel('POST', '/cagnottes', ['titre' => 'Montre', 'beneficiaire' => 'Julie', 'objectif' => 15000], $jeton)->donnees;
        $this->horloge->instant = '2026-11-20 10:00:00'; // compte ancien : plus de délai de sécurité
        $this->appel('PUT', '/cagnottes/' . $g['id'] . '/rib', ['titulaire' => 'Baptiste', 'iban' => self::IBAN, 'motDePasse' => 'un-bon-mot-de-passe'], $jeton);
        $this->courriels = [];

        // Le voleur, avec le mot de passe, demande à changer l'adresse et confirme depuis sa boîte.
        $this->appel('POST', '/moi/email', ['email' => 'voleur@example.com', 'motDePasse' => 'un-bon-mot-de-passe'], $jeton);
        $this->appel('POST', '/email/confirmer', ['jeton' => $this->lien('confirmer', $this->courriels[0]['texte'])]);

        // Le vrai propriétaire clique « Ce n'est pas moi » dans l'e-mail reçu à son adresse.
        $alerte = $this->lien('securite', $this->courriels[1]['texte']);
        self::assertSame(200, $this->appel('POST', '/securite/bloquer', ['jeton' => $alerte])->statut);

        self::assertSame(401, $this->appel('GET', '/moi', [], $jeton)->statut, 'toutes les connexions fermées');
        self::assertSame(403, $this->appel('POST', '/connexion', ['email' => 'baptiste@example.com', 'motDePasse' => 'un-bon-mot-de-passe'])->statut, 'compte bloqué');
        self::assertNull($this->pdo->query('SELECT rib_iban FROM cagnottes')->fetchColumn(), 'RIB effacé');
        $this->horloge->instant = '2026-11-25 10:00:00';
        self::assertSame('baptiste@example.com', $this->pdo->query('SELECT email FROM comptes WHERE id = 1')->fetchColumn(), 'changement d’adresse annulé');

        // Débloquer : le lien de nouveau mot de passe est parti à la vraie adresse.
        $dernier = end($this->courriels);
        self::assertSame('baptiste@example.com', $dernier['a']);
        $this->horloge->instant = '2026-11-20 10:30:00';
        $r = $this->appel('POST', '/motdepasse/nouveau', ['jeton' => $this->lien('motdepasse'), 'motDePasse' => 'tout-nouveau-mot-de-passe']);
        self::assertSame(200, $r->statut);
        self::assertSame(200, $this->appel('POST', '/connexion', ['email' => 'baptiste@example.com', 'motDePasse' => 'tout-nouveau-mot-de-passe'])->statut);
        // Un lien d'alerte ne sert qu'une fois.
        self::assertSame(410, $this->appel('POST', '/securite/bloquer', ['jeton' => $alerte])->statut);
    }

    public function testRibProtege(): void
    {
        $jeton = $this->inscrire();
        $g = $this->appel('POST', '/cagnottes', ['titre' => 'Montre', 'beneficiaire' => 'Julie', 'objectif' => 15000], $jeton)->donnees;
        $chemin = '/cagnottes/' . $g['id'] . '/rib';

        $r = $this->appel('PUT', $chemin, ['titulaire' => 'B', 'iban' => self::IBAN, 'motDePasse' => 'faux'], $jeton);
        self::assertSame(['motDePasse'], array_keys($r->donnees['champs']));

        // Juste après un changement de mot de passe : refusé pendant 48 h.
        $this->appel('POST', '/moi/motdepasse', ['actuel' => 'un-bon-mot-de-passe', 'nouveau' => 'nouveau-mot-de-passe'], $jeton);
        self::assertStringContainsString('/securite/', (string) end($this->courriels)['texte'], 'e-mail « mot de passe changé » avec « Ce n’est pas moi »');
        self::assertSame(423, $this->appel('PUT', $chemin, ['titulaire' => 'B', 'iban' => self::IBAN, 'motDePasse' => 'nouveau-mot-de-passe'], $jeton)->statut);

        $this->horloge->instant = '2026-11-19 10:01:00';
        $this->courriels = [];
        self::assertSame(200, $this->appel('PUT', $chemin, ['titulaire' => 'B', 'iban' => self::IBAN, 'motDePasse' => 'nouveau-mot-de-passe'], $jeton)->statut);
        self::assertSame('Un RIB a été ajouté à votre cagnotte', $this->courriels[0]['sujet']);
        self::assertStringContainsString('FR76 •••• •••• •••• •••• •••0 189', $this->courriels[0]['texte']);

        // Les participants voient que le RIB est récent… pendant 48 h.
        self::assertTrue($this->appel('GET', '/c/' . $g['code'])->donnees['rib']['recent']);
        $this->horloge->instant = '2026-11-21 10:02:00';
        self::assertFalse($this->appel('GET', '/c/' . $g['code'])->donnees['rib']['recent']);
    }

    public function testEmailANouvelAppareilSeulement(): void
    {
        $this->appel('POST', '/comptes', ['email' => 'lea@example.com', 'nom' => 'Léa', 'motDePasse' => 'un-bon-mot-de-passe'], null, ['x-appareil' => 'telephone-de-lea-1234']);
        $this->courriels = [];
        $connexion = fn (string $appareil) => $this->appel('POST', '/connexion', ['email' => 'lea@example.com', 'motDePasse' => 'un-bon-mot-de-passe'], null, ['x-appareil' => $appareil, 'user-agent' => 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36']);

        $connexion('telephone-de-lea-1234');
        self::assertSame([], $this->courriels, 'appareil de l’inscription : connu');
        $connexion('ordinateur-inconnu-9876');
        self::assertSame('Nouvelle connexion à votre compte', $this->courriels[0]['sujet']);
        self::assertStringContainsString('Chrome sur Windows', $this->courriels[0]['texte']);
        self::assertStringContainsString('/securite/', $this->courriels[0]['texte']);
        $connexion('ordinateur-inconnu-9876');
        self::assertCount(1, $this->courriels, 'déjà connu ensuite');
        self::assertSame('Safari sur iPhone', Identite::navigateurLisible('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'));
    }
}
