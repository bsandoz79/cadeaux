<?php

declare(strict_types=1);

namespace Cadeaux\Tests;

final class ExtensionTest extends ApiTestCase
{
    public function testLeSiteDonneUnCodeQueLExtensionEchangeUneSeuleFois(): void
    {
        $jeton = $this->inscrire();
        $code = $this->appel('POST', '/moi/extension/code', [], $jeton)->donnees['code'];
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $code);

        $session = $this->appel('POST', '/extension/session', ['code' => $code], null, ['x-appareil' => 'extension-chrome-123456']);
        self::assertSame(200, $session->statut);
        self::assertNotSame($jeton, $session->donnees['jeton'], 'l’extension a sa propre connexion');
        self::assertSame('baptiste@example.com', $session->donnees['compte']['email']);
        self::assertSame('Nouvelle connexion à votre compte', end($this->courriels)['sujet']);

        self::assertSame(410, $this->appel('POST', '/extension/session', ['code' => $code])->statut);
    }

    public function testLeCodeExpireEtExigeUnCompteConnecte(): void
    {
        self::assertSame(401, $this->appel('POST', '/moi/extension/code')->statut);
        $code = $this->appel('POST', '/moi/extension/code', [], $this->inscrire())->donnees['code'];
        $this->horloge->instant = $this->horloge->maintenant()->modify('+3 minutes')->format('Y-m-d H:i:s');

        self::assertSame(410, $this->appel('POST', '/extension/session', ['code' => $code])->statut);
    }
}
