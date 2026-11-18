<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * Groupes de proches (Famille, Amis, Collègues…) : un proche peut être dans plusieurs groupes.
 * Les groupes eux-mêmes sont une Collection ; ici, l'appartenance des proches.
 */
final class Groupes
{
    public function __construct(private readonly \PDO $pdo)
    {
    }

    /** @return array<int, list<int>> groupes de chaque proche du compte */
    public function membres(int $compteId): array
    {
        $requete = $this->pdo->prepare(
            'SELECT pg.personne_id, pg.groupe_id FROM personnes_groupes pg JOIN personnes p ON p.id = pg.personne_id
             WHERE p.compte_id = ? ORDER BY pg.groupe_id',
        );
        $requete->execute([$compteId]);
        $membres = [];
        foreach ($requete->fetchAll(\PDO::FETCH_ASSOC) as $l) {
            $membres[(int) $l['personne_id']][] = (int) $l['groupe_id'];
        }

        return $membres;
    }

    /**
     * Remplace les groupes d'un proche.
     *
     * @param mixed $ids liste d'identifiants de groupes du compte
     */
    public function definir(int $compteId, int $personneId, mixed $ids): void
    {
        if (!is_array($ids) || array_filter($ids, static fn ($id): bool => !is_int($id)) !== []) {
            throw ErreurHttp::invalide(['groupeIds' => 'Liste de groupes invalide.']);
        }
        $ids = array_values(array_unique($ids));
        if ($ids !== []) {
            $marques = implode(',', array_fill(0, count($ids), '?'));
            $requete = $this->pdo->prepare("SELECT COUNT(*) FROM groupes WHERE compte_id = ? AND id IN ($marques)");
            $requete->execute([$compteId, ...$ids]);
            if ((int) $requete->fetchColumn() !== count($ids)) {
                throw ErreurHttp::invalide(['groupeIds' => 'Groupe introuvable.']);
            }
        }
        $this->pdo->prepare('DELETE FROM personnes_groupes WHERE personne_id = ?')->execute([$personneId]);
        $ajout = $this->pdo->prepare('INSERT INTO personnes_groupes (personne_id, groupe_id) VALUES (?, ?)');
        foreach ($ids as $id) {
            $ajout->execute([$personneId, $id]);
        }
    }

    /**
     * Proche (ou liste de proches) avec ses groupes.
     *
     * @param array<string, mixed> $personne
     * @param array<int, list<int>> $membres
     *
     * @return array<string, mixed>
     */
    public static function avecGroupes(array $personne, array $membres): array
    {
        return $personne + ['groupeIds' => $membres[$personne['id']] ?? []];
    }

    /** Un groupe supprimé : ses proches restent, seulement sans ce groupe. */
    public function apresSuppression(int $groupeId): void
    {
        $this->pdo->prepare('DELETE FROM personnes_groupes WHERE groupe_id = ?')->execute([$groupeId]);
    }
}
