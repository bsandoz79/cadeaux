<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;
use Cadeaux\Http\Reponse;
use Cadeaux\Http\Requete;
use Cadeaux\Http\Routeur;

/**
 * Les routes de l'API (toutes sous /api) :
 *   POST   /comptes, /connexion, /deconnexion · GET /moi · DELETE /moi
 *   GET|POST /personnes · PATCH|DELETE /personnes/{id}       (idem /occasions, /cadeaux, /cagnottes)
 *   GET    /cagnottes/{id}  (avec les participations)
 *   POST   /cagnottes/{id}/participations · PATCH|DELETE /cagnottes/{id}/participations/{pid}   (organisateur)
 *   GET    /c/{code} · POST /c/{code}/participations · PATCH|DELETE /c/{code}/participations/{pid}  (lien partagé)
 */
final class Application
{
    public const TYPES_OCCASION = ['anniversaire', 'noel', 'fete-des-meres', 'fete-des-peres', 'mariage', 'naissance', 'saint-valentin', 'autre'];
    public const STATUTS_CADEAU = ['idee', 'prevu', 'achete', 'offert'];

    private readonly Routeur $routeur;
    private readonly Comptes $comptes;
    private readonly Cagnottes $cagnottes;
    /** @var array<string, Collection>|null */
    private ?array $collections = null;

    public function __construct(private readonly \PDO $pdo, private readonly Horloge $horloge = new Horloge())
    {
        $this->comptes = new Comptes($pdo, $horloge);
        $this->cagnottes = new Cagnottes($pdo, $horloge);
        $this->routeur = new Routeur();
        $this->routes();
    }

    /** Connexion à la base décrite dans config.local.php (non versionné), tables créées si besoin. */
    public static function depuisConfig(string $fichier): self
    {
        /** @var array{dsn: string, utilisateur?: string, motDePasse?: string} $config */
        $config = require $fichier;
        $pdo = new \PDO($config['dsn'], $config['utilisateur'] ?? null, $config['motDePasse'] ?? null, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $marque = dirname($fichier) . '/var/schema-' . Schema::VERSION;
        if (!is_file($marque)) {
            Schema::installer($pdo);
            @mkdir(dirname($marque), 0o750, true);
            touch($marque);
        }

        return new self($pdo);
    }

    public function traiter(Requete $requete): Reponse
    {
        try {
            return $this->routeur->traiter($requete);
        } catch (ErreurHttp $e) {
            return new Reponse($e->statut, ['message' => $e->getMessage()] + ($e->champs === [] ? [] : ['champs' => $e->champs]));
        } catch (\Throwable $e) {
            error_log((string) $e);

            return new Reponse(500, ['message' => 'Erreur du serveur. Réessayez dans un instant.']);
        }
    }

    private function routes(): void
    {
        $r = $this->routeur;

        // Comptes
        $r->ajouter('POST', '/comptes', fn (Requete $q) => Reponse::cree($this->comptes->inscrire($q->corps)));
        $r->ajouter('POST', '/connexion', fn (Requete $q) => Reponse::ok($this->comptes->connecter($q->corps, $q->ip)));
        $r->ajouter('POST', '/deconnexion', function (Requete $q) {
            $this->compte($q);
            $this->comptes->deconnecter((string) $q->jeton());

            return Reponse::vide();
        });
        $r->ajouter('GET', '/moi', fn (Requete $q) => Reponse::ok($this->comptes->compte($this->compte($q))));
        $r->ajouter('DELETE', '/moi', function (Requete $q) {
            $this->comptes->supprimer($this->compte($q));

            return Reponse::vide();
        });

        // Éléments du compte
        foreach ($this->collections() as $chemin => $collection) {
            $r->ajouter('GET', "/$chemin", fn (Requete $q) => Reponse::ok($chemin === 'cagnottes'
                ? array_map($this->avecTotaux(...), $collection->lister($this->compte($q)))
                : $collection->lister($this->compte($q))));
            $r->ajouter('POST', "/$chemin", fn (Requete $q) => Reponse::cree(
                $collection->ajouter($this->compte($q), $q->corps, $this->colonnesALaCreation($chemin)),
            ));
            $r->ajouter('PATCH', "/$chemin/{id}", fn (Requete $q, string $id) => Reponse::ok($collection->modifier($this->compte($q), (int) $id, $q->corps)));
            $r->ajouter('DELETE', "/$chemin/{id}", function (Requete $q, string $id) use ($collection) {
                $collection->supprimer($this->compte($q), (int) $id);

                return Reponse::vide();
            });
        }
        $cagnottes = $this->collections()['cagnottes'];
        $r->ajouter('GET', '/cagnottes/{id}', function (Requete $q, string $id) use ($cagnottes) {
            $compte = $this->compte($q);

            return Reponse::ok($cagnottes->lire($compte, (int) $id) + ['participations' => $this->cagnottes->participations((int) $id)]);
        });

        // Parts, côté organisateur
        $r->ajouter('POST', '/cagnottes/{id}/participations', fn (Requete $q, string $id) => Reponse::cree(
            $this->cagnottes->ajouterParOrganisateur($this->compte($q), (int) $id, $q->corps),
        ));
        $r->ajouter('PATCH', '/cagnottes/{id}/participations/{pid}', fn (Requete $q, string $id, string $pid) => Reponse::ok(
            $this->cagnottes->modifierParOrganisateur($this->compte($q), (int) $id, (int) $pid, $q->corps),
        ));
        $r->ajouter('DELETE', '/cagnottes/{id}/participations/{pid}', function (Requete $q, string $id, string $pid) {
            $this->cagnottes->retirerParOrganisateur($this->compte($q), (int) $id, (int) $pid);

            return Reponse::vide();
        });

        // Lien partagé, sans compte
        $r->ajouter('GET', '/c/{code}', fn (Requete $q, string $code) => Reponse::ok($this->cagnottes->publique($code)));
        $r->ajouter('POST', '/c/{code}/participations', fn (Requete $q, string $code) => Reponse::cree($this->cagnottes->participer($code, $q->corps, $q->ip)));
        $r->ajouter('PATCH', '/c/{code}/participations/{pid}', fn (Requete $q, string $code, string $pid) => Reponse::ok(
            $this->cagnottes->modifierSaPart($code, (int) $pid, $q->entete('x-cle-participation'), $q->corps),
        ));
        $r->ajouter('DELETE', '/c/{code}/participations/{pid}', function (Requete $q, string $code, string $pid) {
            $this->cagnottes->retirerSaPart($code, (int) $pid, $q->entete('x-cle-participation'));

            return Reponse::vide();
        });
    }

    /**
     * Cagnotte avec ce qui a été promis (total), payé, et la part de l'organisateur (comptée dans son bilan).
     *
     * @param array<string, mixed> $cagnotte
     *
     * @return array<string, mixed>
     */
    private function avecTotaux(array $cagnotte): array
    {
        $parts = $this->cagnottes->participations($cagnotte['id']);
        $somme = static fn (callable $filtre): int => array_sum(array_column(array_filter($parts, $filtre), 'montant'));

        return $cagnotte + [
            'total' => $somme(static fn (): bool => true),
            'totalPaye' => $somme(static fn (array $p): bool => $p['paye']),
            'maPart' => $somme(static fn (array $p): bool => $p['organisateur']),
            'nombreParticipations' => count($parts),
        ];
    }

    private function compte(Requete $requete): int
    {
        return $this->comptes->depuisJeton($requete->jeton()) ?? throw ErreurHttp::nonConnecte();
    }

    /** @return array<string, mixed> */
    private function colonnesALaCreation(string $chemin): array
    {
        return match ($chemin) {
            'cadeaux' => ['cree_le' => $this->horloge->texte()],
            'cagnottes' => ['cree_le' => $this->horloge->texte(), 'code' => Cagnottes::nouveauCode()],
            default => [],
        };
    }

    /** @return array<string, Collection> */
    private function collections(): array
    {
        if ($this->collections !== null) {
            return $this->collections;
        }
        $pdo = $this->pdo;

        return $this->collections = [
            'personnes' => new Collection($pdo, 'personnes', [
                'nom' => ['colonne' => 'nom', 'type' => 'texte', 'requis' => true, 'max' => 80],
                'dateNaissance' => ['colonne' => 'date_naissance', 'type' => 'date'],
                'note' => ['colonne' => 'note', 'type' => 'texte', 'max' => 500],
            ], 'nom'),
            'occasions' => new Collection($pdo, 'occasions', [
                'type' => ['colonne' => 'type', 'type' => 'choix', 'choix' => self::TYPES_OCCASION, 'requis' => true],
                'titre' => ['colonne' => 'titre', 'type' => 'texte', 'requis' => true, 'max' => 120],
                'date' => ['colonne' => 'date', 'type' => 'date', 'requis' => true],
            ], 'date DESC, id DESC'),
            'cadeaux' => new Collection($pdo, 'cadeaux', [
                'titre' => ['colonne' => 'titre', 'type' => 'texte', 'requis' => true, 'max' => 200],
                'occasionId' => ['colonne' => 'occasion_id', 'type' => 'ref', 'table' => 'occasions'],
                'personneId' => ['colonne' => 'personne_id', 'type' => 'ref', 'table' => 'personnes'],
                'montantPrevu' => ['colonne' => 'montant_prevu', 'type' => 'centimes'],
                'montantDepense' => ['colonne' => 'montant_depense', 'type' => 'centimes'],
                'statut' => ['colonne' => 'statut', 'type' => 'choix', 'choix' => self::STATUTS_CADEAU, 'requis' => true, 'defaut' => 'idee'],
                'lien' => ['colonne' => 'lien', 'type' => 'url'],
                'image' => ['colonne' => 'image', 'type' => 'url'],
                'note' => ['colonne' => 'note', 'type' => 'texte', 'max' => 500],
                'creeLe' => ['colonne' => 'cree_le', 'type' => 'lecture'],
            ], 'id DESC'),
            'cagnottes' => new Collection($pdo, 'cagnottes', [
                'code' => ['colonne' => 'code', 'type' => 'lecture'],
                'titre' => ['colonne' => 'titre', 'type' => 'texte', 'requis' => true, 'max' => 200],
                'beneficiaire' => ['colonne' => 'beneficiaire', 'type' => 'texte', 'requis' => true, 'max' => 80],
                'objectif' => ['colonne' => 'objectif', 'type' => 'centimes', 'requis' => true],
                'mode' => ['colonne' => 'mode', 'type' => 'choix', 'choix' => ['egal', 'libre'], 'requis' => true, 'defaut' => 'libre'],
                'nombreParts' => ['colonne' => 'nombre_parts', 'type' => 'entier'],
                'dateLimite' => ['colonne' => 'date_limite', 'type' => 'date'],
                'lien' => ['colonne' => 'lien', 'type' => 'url'],
                'message' => ['colonne' => 'message', 'type' => 'texte', 'max' => 1000],
                'close' => ['colonne' => 'close', 'type' => 'booleen', 'defaut' => false],
                'creeLe' => ['colonne' => 'cree_le', 'type' => 'lecture'],
            ], 'id DESC', static function (array $d): array {
                $erreurs = [];
                if (($d['mode'] ?? 'libre') === 'egal' && (!is_int($d['nombreParts'] ?? null) || $d['nombreParts'] < 2 || $d['nombreParts'] > 100)) {
                    $erreurs['nombreParts'] = 'Indiquez le nombre de participants (2 à 100).';
                }
                if (is_int($d['objectif'] ?? null) && $d['objectif'] <= 0) {
                    $erreurs['objectif'] = 'Indiquez le prix du cadeau.';
                }

                return $erreurs;
            }),
        ];
    }
}
