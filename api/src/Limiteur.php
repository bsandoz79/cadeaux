<?php

declare(strict_types=1);

namespace Cadeaux;

/**
 * Limite d'abus : pas plus de N actions par clé (adresse, IP…) sur une fenêtre de 15 minutes.
 * Les traces sont effacées au bout de 15 minutes (donnée personnelle gardée le moins longtemps possible).
 */
final class Limiteur
{
    public const FENETRE_MINUTES = 15;

    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge,
    ) {
    }

    public function depasse(string $cle, int $max): bool
    {
        $depuis = $this->debutFenetre();
        $this->pdo->prepare('DELETE FROM tentatives WHERE le < ?')->execute([$depuis]);
        $requete = $this->pdo->prepare('SELECT COUNT(*) FROM tentatives WHERE cle = ? AND le >= ?');
        $requete->execute([$cle, $depuis]);

        return (int) $requete->fetchColumn() >= $max;
    }

    public function noter(string $cle): void
    {
        $this->pdo->prepare('INSERT INTO tentatives (cle, le) VALUES (?, ?)')->execute([$cle, $this->horloge->texte()]);
    }

    private function debutFenetre(): string
    {
        return $this->horloge->maintenant()->modify(sprintf('-%d minutes', self::FENETRE_MINUTES))->format('Y-m-d H:i:s');
    }
}
