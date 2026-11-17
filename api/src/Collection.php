<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * Lecture, ajout, modification et suppression des éléments d'un compte (proches, occasions, cadeaux, cagnottes).
 * Chaque champ est décrit une fois : nom dans le JSON, colonne, type et contraintes. Tout ce qui n'est pas décrit
 * est ignoré, et un compte ne voit jamais les éléments d'un autre.
 *
 * Types : lecture (fixé par le serveur), texte, centimes (entier ≥ 0), entier, date (AAAA-MM-JJ), choix, url (http/https), ref (élément du compte).
 *
 * @phpstan-type Champ array{colonne: string, type: string, requis?: bool, max?: int, choix?: list<string>, table?: string, defaut?: mixed}
 */
final class Collection
{
    /** @param array<string, Champ> $champs */
    public function __construct(
        private readonly \PDO $pdo,
        private readonly string $table,
        private readonly array $champs,
        private readonly string $tri = 'id',
        /** Règles qui croisent plusieurs champs : reçoit les données complètes (JSON), renvoie les erreurs par champ. */
        private readonly ?\Closure $avantEcriture = null,
    ) {
    }

    /** @return list<array<string, mixed>> */
    public function lister(int $compteId): array
    {
        $requete = $this->pdo->prepare("SELECT * FROM {$this->table} WHERE compte_id = ? ORDER BY {$this->tri}");
        $requete->execute([$compteId]);

        return array_map($this->versJson(...), $requete->fetchAll(\PDO::FETCH_ASSOC));
    }

    /** @return array<string, mixed> */
    public function lire(int $compteId, int $id): array
    {
        return $this->versJson($this->ligne($compteId, $id));
    }

    /**
     * @param array<string, mixed> $donnees
     * @param array<string, mixed> $colonnesEnPlus colonnes fixées par le serveur (date de création, code…)
     *
     * @return array<string, mixed>
     */
    public function ajouter(int $compteId, array $donnees, array $colonnesEnPlus = []): array
    {
        $valeurs = $this->valider($compteId, $donnees, true);
        $valeurs = ['compte_id' => $compteId] + $valeurs + $colonnesEnPlus;
        $colonnes = array_keys($valeurs);
        $this->pdo->prepare(sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $this->table,
            implode(', ', $colonnes),
            implode(', ', array_fill(0, count($colonnes), '?')),
        ))->execute(array_values($valeurs));

        return $this->lire($compteId, (int) $this->pdo->lastInsertId());
    }

    /**
     * Modification partielle : seuls les champs envoyés changent.
     *
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function modifier(int $compteId, int $id, array $donnees): array
    {
        $actuel = $this->lire($compteId, $id);
        $valeurs = $this->valider($compteId, $donnees + $actuel, false, array_keys($donnees));
        if ($valeurs !== []) {
            $affectations = implode(', ', array_map(static fn (string $c): string => "$c = ?", array_keys($valeurs)));
            $this->pdo->prepare("UPDATE {$this->table} SET $affectations WHERE id = ? AND compte_id = ?")
                ->execute([...array_values($valeurs), $id, $compteId]);
        }

        return $this->lire($compteId, $id);
    }

    public function supprimer(int $compteId, int $id): void
    {
        $this->ligne($compteId, $id);
        $this->pdo->prepare("DELETE FROM {$this->table} WHERE id = ? AND compte_id = ?")->execute([$id, $compteId]);
    }

    /** @return array<string, mixed> */
    private function ligne(int $compteId, int $id): array
    {
        $requete = $this->pdo->prepare("SELECT * FROM {$this->table} WHERE id = ? AND compte_id = ?");
        $requete->execute([$id, $compteId]);

        return $requete->fetch(\PDO::FETCH_ASSOC) ?: throw ErreurHttp::introuvable();
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function versJson(array $ligne): array
    {
        $json = ['id' => (int) $ligne['id']];
        foreach ($this->champs as $nom => $champ) {
            $valeur = $ligne[$champ['colonne']] ?? null;
            $json[$nom] = match (true) {
                $valeur === null => null,
                in_array($champ['type'], ['centimes', 'entier', 'ref'], true) => (int) $valeur,
                $champ['type'] === 'booleen' => (bool) $valeur,
                default => (string) $valeur,
            };
        }

        return $json;
    }

    /**
     * @param array<string, mixed> $donnees
     * @param list<string>|null    $seulement champs à écrire (modification partielle)
     *
     * @return array<string, mixed> valeurs par colonne
     */
    private function valider(int $compteId, array $donnees, bool $creation, ?array $seulement = null): array
    {
        $valeurs = [];
        $erreurs = [];
        foreach ($this->champs as $nom => $champ) {
            if ($champ['type'] === 'lecture') {
                continue;
            }
            $brut = $donnees[$nom] ?? ($creation ? ($champ['defaut'] ?? null) : null);
            if (is_string($brut)) {
                $brut = trim($brut);
            }
            if ($brut === '' || $brut === null) {
                if ($champ['requis'] ?? false) {
                    $erreurs[$nom] = 'Champ obligatoire.';
                }
                $valeur = null;
            } else {
                $valeur = $this->convertir($compteId, $champ, $brut);
                if ($valeur instanceof \Stringable) {
                    $erreurs[$nom] = (string) $valeur;
                    continue;
                }
            }
            if ($seulement === null || in_array($nom, $seulement, true)) {
                $valeurs[$champ['colonne']] = $valeur;
            }
        }
        if ($erreurs === [] && $this->avantEcriture !== null) {
            $erreurs = ($this->avantEcriture)($donnees);
        }
        if ($erreurs !== []) {
            throw ErreurHttp::invalide($erreurs);
        }

        return $valeurs;
    }

    /**
     * Valeur prête pour la base, ou message d'erreur (objet Stringable).
     *
     * @param Champ $champ
     */
    private function convertir(int $compteId, array $champ, mixed $brut): mixed
    {
        $erreur = static fn (string $m): \Stringable => new class($m) implements \Stringable {
            public function __construct(private readonly string $m)
            {
            }

            public function __toString(): string
            {
                return $this->m;
            }
        };

        switch ($champ['type']) {
            case 'texte':
                $texte = (string) $brut;
                $max = $champ['max'] ?? 255;

                return mb_strlen($texte) > $max ? $erreur("$max caractères au plus.") : $texte;
            case 'centimes':
            case 'entier':
                if (!is_int($brut) && !(is_string($brut) && ctype_digit($brut))) {
                    return $erreur('Nombre entier attendu.');
                }
                $n = (int) $brut;

                return ($n < 0 || $n > 100_000_000) ? $erreur('Montant hors limites.') : $n;
            case 'booleen':
                return $brut ? 1 : 0;
            case 'date':
                $d = \DateTimeImmutable::createFromFormat('!Y-m-d', (string) $brut);

                return ($d === false || $d->format('Y-m-d') !== $brut) ? $erreur('Date invalide.') : (string) $brut;
            case 'choix':
                return in_array($brut, $champ['choix'] ?? [], true) ? $brut : $erreur('Valeur non prévue.');
            case 'url':
                $url = (string) $brut;

                return (mb_strlen($url) > 1000 || preg_match('#^https?://[^\s]+$#i', $url) !== 1) ? $erreur('Adresse web invalide.') : $url;
            case 'ref':
                $requete = $this->pdo->prepare("SELECT 1 FROM {$champ['table']} WHERE id = ? AND compte_id = ?");
                $requete->execute([(int) $brut, $compteId]);

                return $requete->fetchColumn() === false ? $erreur('Élément introuvable.') : (int) $brut;
        }

        throw new \LogicException("Type de champ inconnu : {$champ['type']}");
    }
}
