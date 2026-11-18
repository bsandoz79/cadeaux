<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * Connexion de l'extension Chrome par le site (utile avec Google, qui ne peut pas se faire dans la fenêtre de
 * l'extension) : sur cadeaux.bsandoz.fr/extension, le compte connecté demande un code à usage unique (2 minutes),
 * transmis à l'extension par son script sur le site ; l'extension l'échange contre sa propre connexion.
 */
final class ConnexionExtension
{
    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge,
        private readonly Comptes $comptes,
    ) {
    }

    public function code(int $compteId): string
    {
        $this->pdo->prepare("DELETE FROM liens WHERE compte_id = ? AND type = 'extension'")->execute([$compteId]);
        $code = bin2hex(random_bytes(32));
        $this->pdo->prepare('INSERT INTO liens (compte_id, type, empreinte, expire_le) VALUES (?, ?, ?, ?)')
            ->execute([$compteId, 'extension', hash('sha256', $code), $this->horloge->maintenant()->modify('+2 minutes')->format('Y-m-d H:i:s')]);

        return $code;
    }

    /** @return array{jeton: string, compte: array<string, mixed>} */
    public function session(string $code): array
    {
        $requete = $this->pdo->prepare("SELECT * FROM liens WHERE empreinte = ? AND type = 'extension'");
        $requete->execute([hash('sha256', $code)]);
        $lien = $requete->fetch(\PDO::FETCH_ASSOC);
        if ($lien === false || $lien['expire_le'] < $this->horloge->texte()) {
            throw new ErreurHttp(410, 'Ce code n’est plus valable. Recommencez depuis l’extension.');
        }
        $this->pdo->prepare('DELETE FROM liens WHERE id = ?')->execute([$lien['id']]);

        return $this->comptes->ouvrirSession((int) $lien['compte_id']);
    }
}
