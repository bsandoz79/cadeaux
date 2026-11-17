<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;
use Cadeaux\Http\Reponse;
use Cadeaux\Http\Requete;
use Cadeaux\Http\Routeur;

/**
 * Les routes de l'API (toutes sous /api) :
 *   POST   /comptes, /connexion, /deconnexion · GET|PATCH|DELETE /moi (PATCH : prénom, rappels)
 *   POST   /email/confirmer, /email/renvoyer, /motdepasse/oubli, /motdepasse/nouveau, /moi/motdepasse, /moi/email
 *   POST   /securite/bloquer (« Ce n'est pas moi », depuis un lien reçu par e-mail) · GET /moi/export (toutes les données du compte)
 *   GET|POST /personnes · PATCH|DELETE /personnes/{id}       (idem /occasions, /cadeaux, /budgets, /cagnottes)
 *   GET    /cagnottes/{id}  (avec les participations)
 *   POST   /cagnottes/{id}/participations · PATCH|DELETE /cagnottes/{id}/participations/{pid}   (organisateur)
 *   PUT|DELETE /cagnottes/{id}/rib (RIB de l'organisateur) · GET /c/{code}/rib (RIB complet, sur demande)
 *   GET    /c/{code} · POST /c/{code}/participations · PATCH|DELETE /c/{code}/participations/{pid}  (lien partagé)
 *   GET|POST|DELETE /liste (lien de ma liste d'envies) · GET|POST /envies · PATCH|DELETE /envies/{id}
 *   GET    /l/{code} · POST|DELETE /l/{code}/envies/{id}/reservation  (liste d'envies partagée, sans compte)
 *   POST   /l/{code}/envies/{id}/cagnotte  (« On se cotise », proche connecté)
 */
final class Application
{
    public const TYPES_OCCASION = ['anniversaire', 'noel', 'fete-des-meres', 'fete-des-peres', 'mariage', 'naissance', 'saint-valentin', 'autre'];
    public const STATUTS_CADEAU = ['idee', 'prevu', 'achete', 'offert'];

    private readonly Routeur $routeur;
    private readonly Comptes $comptes;
    private readonly Cagnottes $cagnottes;
    private readonly Envies $envies;
    private readonly Ribs $ribs;
    private readonly Identite $identite;
    /** @var array<string, Collection>|null */
    private ?array $collections = null;

    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge = new Horloge(),
        ?Coffre $coffre = null,
        ?Courrier $courrier = null,
        string $site = 'https://cadeaux.bsandoz.fr',
    ) {
        $this->ribs = new Ribs($pdo, $horloge, $coffre ?? new Coffre(dirname(__DIR__) . '/var/cle-coffre'));
        $this->comptes = new Comptes($pdo, $horloge);
        $this->identite = new Identite($pdo, $horloge, $courrier ?? new CourrierPhp('Cadeaux <cadeaux@bsandoz.fr>'), $this->comptes, $site);
        $this->cagnottes = new Cagnottes($pdo, $horloge);
        $this->envies = new Envies($pdo, $horloge);
        $this->routeur = new Routeur();
        $this->routes();
    }

    /** Connexion à la base décrite dans config.local.php (non versionné), tables créées si besoin. */
    public static function depuisConfig(string $fichier): self
    {
        /** @var array{expediteur?: string, site?: string} $config */
        $config = require $fichier;

        return new self(self::base($fichier), new Horloge(), null, new CourrierPhp($config['expediteur'] ?? 'Cadeaux <cadeaux@bsandoz.fr>'), $config['site'] ?? 'https://cadeaux.bsandoz.fr');
    }

    /** Connexion seule (page d'aperçu des cagnottes, tâche quotidienne). */
    public static function base(string $fichier): \PDO
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

        return $pdo;
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
        $r->ajouter('POST', '/comptes', function (Requete $q) {
            $session = $this->comptes->inscrire($q->corps);
            $this->identite->envoyerConfirmation($session['compte']['id']);
            $this->identite->nouvelleConnexion($session['compte']['id'], $q->entete('x-appareil'), '', false);

            return Reponse::cree($session);
        });
        $r->ajouter('POST', '/email/confirmer', fn (Requete $q) => Reponse::ok($this->identite->confirmer((string) ($q->corps['jeton'] ?? ''))));
        $r->ajouter('POST', '/email/renvoyer', function (Requete $q) {
            $this->identite->envoyerConfirmation($this->compte($q));

            return Reponse::vide();
        });
        $r->ajouter('POST', '/motdepasse/oubli', function (Requete $q) {
            $this->identite->demanderReinitialisation((string) ($q->corps['email'] ?? ''), $q->ip);

            return Reponse::ok(['message' => 'Si un compte existe avec cette adresse, un e-mail vient de partir.']);
        });
        $r->ajouter('POST', '/motdepasse/nouveau', fn (Requete $q) => Reponse::ok(
            $this->identite->reinitialiser((string) ($q->corps['jeton'] ?? ''), (string) ($q->corps['motDePasse'] ?? '')),
        ));
        $r->ajouter('POST', '/moi/email-test', fn (Requete $q) => Reponse::ok(['message' => 'E-mail de test envoyé à ' . $this->identite->envoyerTest($this->compte($q)) . '.']));
        $r->ajouter('POST', '/moi/motdepasse', function (Requete $q) {
            $this->identite->changerMotDePasse($this->compte($q), (string) ($q->corps['actuel'] ?? ''), (string) ($q->corps['nouveau'] ?? ''), $q->jeton());

            return Reponse::vide();
        });
        $r->ajouter('POST', '/moi/email', function (Requete $q) {
            $this->identite->demanderChangementEmail($this->compte($q), (string) ($q->corps['email'] ?? ''), (string) ($q->corps['motDePasse'] ?? ''));

            return Reponse::ok(['message' => sprintf('Un lien vient de partir à la nouvelle adresse. Par sécurité, l’adresse changera %d heures après votre demande.', Identite::DELAI_SECURITE_HEURES)]);
        });
        $r->ajouter('POST', '/connexion', function (Requete $q) {
            $session = $this->comptes->connecter($q->corps, $q->ip);
            $this->identite->nouvelleConnexion($session['compte']['id'], $q->entete('x-appareil'), (string) $q->entete('user-agent'));

            return Reponse::ok($session);
        });
        $r->ajouter('POST', '/securite/bloquer', function (Requete $q) {
            $this->identite->bloquer((string) ($q->corps['jeton'] ?? ''));

            return Reponse::ok(['message' => 'Votre compte est bloqué. Un e-mail vient de partir pour choisir un nouveau mot de passe.']);
        });
        $r->ajouter('POST', '/deconnexion', function (Requete $q) {
            $this->compte($q);
            $this->comptes->deconnecter((string) $q->jeton());

            return Reponse::vide();
        });
        $r->ajouter('GET', '/moi', function (Requete $q) {
            $compte = $this->compte($q);
            $this->identite->appliquerChangementsEchus($compte);

            return Reponse::ok($this->comptes->compte($compte));
        });
        $r->ajouter('PATCH', '/moi', fn (Requete $q) => Reponse::ok($this->comptes->regler($this->compte($q), $q->corps)));
        $r->ajouter('GET', '/moi/export', fn (Requete $q) => Reponse::ok($this->export($this->compte($q))));
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
            $r->ajouter('PATCH', "/$chemin/{id}", function (Requete $q, string $id) use ($collection, $chemin) {
                $modifie = $collection->modifier($this->compte($q), (int) $id, $q->corps);
                if ($chemin === 'cagnottes' && $modifie['close']) {
                    $this->ribs->effacer((int) $id); // cagnotte terminée : le RIB n'a plus à être gardé
                }

                return Reponse::ok($chemin === 'cagnottes' ? $this->avecTotaux($modifie) : $modifie);
            });
            $r->ajouter('DELETE', "/$chemin/{id}", function (Requete $q, string $id) use ($collection, $chemin) {
                $collection->supprimer($this->compte($q), (int) $id);
                if ($chemin === 'envies') {
                    $this->envies->apresSuppression((int) $id);
                }
                if ($chemin === 'cagnottes') {
                    // Le cadeau reste, sans cagnotte (MySQL le ferait seul pour une clé étrangère ; la colonne ajoutée en v5 n'en a pas).
                    $this->pdo->prepare('UPDATE cadeaux SET cagnotte_id = NULL WHERE cagnotte_id = ?')->execute([(int) $id]);
                }

                return Reponse::vide();
            });
        }
        $cagnottes = $this->collections()['cagnottes'];
        $r->ajouter('GET', '/cagnottes/{id}', function (Requete $q, string $id) use ($cagnottes) {
            $compte = $this->compte($q);

            return Reponse::ok($cagnottes->lire($compte, (int) $id) + ['participations' => $this->cagnottes->participations((int) $id), 'rib' => $this->ribs->resume((int) $id)]);
        });

        // RIB de l'organisateur (virements des participants)
        $r->ajouter('PUT', '/cagnottes/{id}/rib', function (Requete $q, string $id) {
            $compte = $this->compte($q);
            $this->identite->autoriserRib($compte, (string) ($q->corps['motDePasse'] ?? ''));
            $rib = $this->ribs->enregistrer($compte, (int) $id, $q->corps);
            $this->identite->alerterRib($compte, $rib['cagnotte'], $rib['ibanMasque']);

            return Reponse::ok(['titulaire' => $rib['titulaire'], 'ibanMasque' => $rib['ibanMasque']]);
        });
        $r->ajouter('DELETE', '/cagnottes/{id}/rib', function (Requete $q, string $id) {
            $this->ribs->effacerPourLeCompte($this->compte($q), (int) $id);

            return Reponse::vide();
        });
        $r->ajouter('GET', '/c/{code}/rib', fn (Requete $q, string $code) => Reponse::ok($this->ribs->pourParticipant($code, $q->ip)));

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

        // Liste d'envies : lien de partage (propriétaire) et page partagée (sans compte)
        $r->ajouter('GET', '/liste', fn (Requete $q) => Reponse::ok($this->envies->lien($this->compte($q))));
        $r->ajouter('POST', '/liste', fn (Requete $q) => Reponse::ok($this->envies->partager($this->compte($q), $q->corps)));
        $r->ajouter('DELETE', '/liste', function (Requete $q) {
            $this->envies->arreterPartage($this->compte($q));

            return Reponse::vide();
        });
        $r->ajouter('GET', '/l/{code}', fn (Requete $q, string $code) => Reponse::ok($this->envies->publique($code, $this->comptes->depuisJeton($q->jeton()))));
        $r->ajouter('POST', '/l/{code}/envies/{id}/reservation', fn (Requete $q, string $code, string $id) => Reponse::cree(
            $this->envies->reserver($code, (int) $id, $q->corps, $q->ip, $this->comptes->depuisJeton($q->jeton())),
        ));
        // « On se cotise » : une cagnotte pour cette envie, organisée par le proche connecté, et l'envie réservée au nom du groupe.
        $r->ajouter('POST', '/l/{code}/envies/{id}/cagnotte', function (Requete $q, string $code, string $id) {
            $compte = $this->compte($q);
            $envie = $this->envies->envieAPartager($code, (int) $id, $compte);
            $objectif = $q->corps['objectif'] ?? $envie['prix'];
            $cagnotte = $this->collections()['cagnottes']->ajouter($compte, [
                'titre' => $envie['titre'],
                'beneficiaire' => $envie['proprietaire'],
                'objectif' => $objectif,
                'mode' => 'libre',
                'lien' => $envie['lien'],
            ], $this->colonnesALaCreation('cagnottes'));
            try {
                $reservation = $this->envies->reserver($code, (int) $id, ['nom' => $this->comptes->compte($compte)['nom'] . ' et d’autres'], $q->ip, $compte, $cagnotte['code']);
            } catch (ErreurHttp $e) {
                $this->collections()['cagnottes']->supprimer($compte, $cagnotte['id']); // déjà prise : pas de cagnotte orpheline

                throw $e;
            }

            return Reponse::cree(['cagnotte' => $cagnotte] + $reservation);
        });
        $r->ajouter('DELETE', '/l/{code}/envies/{id}/reservation', function (Requete $q, string $code, string $id) {
            $this->envies->annulerReservation($code, (int) $id, $q->entete('x-cle-reservation'));

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
            'rib' => $this->ribs->resume($cagnotte['id']),
        ];
    }

    /**
     * Droit d'accès et de portabilité : tout ce que le compte contient, dans un format lisible (JSON).
     *
     * @return array<string, mixed>
     */
    private function export(int $compteId): array
    {
        $c = $this->collections();
        $compte = $this->pdo->prepare('SELECT email, nom, cree_le, derniere_activite, rappels FROM comptes WHERE id = ?');
        $compte->execute([$compteId]);
        $ligne = $compte->fetch(\PDO::FETCH_ASSOC) ?: throw ErreurHttp::introuvable();

        return [
            'exporteLe' => $this->horloge->texte(),
            'compte' => ['email' => $ligne['email'], 'nom' => $ligne['nom'], 'creeLe' => $ligne['cree_le'], 'derniereActivite' => $ligne['derniere_activite'], 'rappels' => (bool) $ligne['rappels']],
            'proches' => $c['personnes']->lister($compteId),
            'occasions' => $c['occasions']->lister($compteId),
            'cadeaux' => $c['cadeaux']->lister($compteId),
            'budgets' => $c['budgets']->lister($compteId),
            // Mes envies, sans leurs réservations : elles restent une surprise (et sont les données des autres).
            'envies' => $c['envies']->lister($compteId),
            'lienListeEnvies' => $this->envies->lien($compteId),
            'cagnottes' => array_map(
                fn (array $g): array => $g + ['participations' => $this->cagnottes->participations($g['id'])],
                $c['cagnottes']->lister($compteId),
            ),
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
            'envies' => ['cree_le' => $this->horloge->texte()],
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
                // Cadeau payé à plusieurs : seule la part de l'organisateur dans cette cagnotte compte dans le bilan.
                'cagnotteId' => ['colonne' => 'cagnotte_id', 'type' => 'ref', 'table' => 'cagnottes'],
                'creeLe' => ['colonne' => 'cree_le', 'type' => 'lecture'],
            ], 'id DESC'),
            'envies' => new Collection($pdo, 'envies', [
                'titre' => ['colonne' => 'titre', 'type' => 'texte', 'requis' => true, 'max' => 200],
                'lien' => ['colonne' => 'lien', 'type' => 'url'],
                'image' => ['colonne' => 'image', 'type' => 'url'],
                'prix' => ['colonne' => 'prix', 'type' => 'centimes'],
                'note' => ['colonne' => 'note', 'type' => 'texte', 'max' => 500],
                'priorite' => ['colonne' => 'priorite', 'type' => 'booleen', 'defaut' => false],
                'creeLe' => ['colonne' => 'cree_le', 'type' => 'lecture'],
            ], 'priorite DESC, id DESC'),
            'budgets' => new Collection($pdo, 'budgets', [
                'occasionId' => ['colonne' => 'occasion_id', 'type' => 'ref', 'table' => 'occasions', 'requis' => true],
                'personneId' => ['colonne' => 'personne_id', 'type' => 'ref', 'table' => 'personnes', 'requis' => true],
                'montant' => ['colonne' => 'montant', 'type' => 'centimes', 'requis' => true],
            ]),
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
