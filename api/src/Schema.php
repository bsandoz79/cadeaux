<?php

declare(strict_types=1);

namespace Cadeaux;

/**
 * Tables de la base. Même schéma en MySQL (o2switch) et en SQLite (tests).
 * Montants en centimes (entiers), dates en texte « AAAA-MM-JJ », instants en « AAAA-MM-JJ HH:MM:SS » UTC.
 * Les tables sont créées si elles n'existent pas : pas de commande à lancer sur le serveur.
 */
final class Schema
{
    /** À augmenter à chaque changement des tables. */
    public const VERSION = 3;

    public static function installer(\PDO $pdo): void
    {
        $mysql = $pdo->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql';
        $id = $mysql ? 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
        $ref = $mysql ? 'INT UNSIGNED' : 'INTEGER';
        $fin = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';

        $tables = [
            "comptes (
                id $id,
                email VARCHAR(190) NOT NULL UNIQUE,
                nom VARCHAR(80) NOT NULL,
                mot_de_passe VARCHAR(255) NOT NULL,
                cree_le VARCHAR(19) NOT NULL,
                derniere_activite VARCHAR(19) NULL,
                averti_le VARCHAR(19) NULL
            )",
            "jetons (
                id $id,
                compte_id $ref NOT NULL,
                empreinte CHAR(64) NOT NULL UNIQUE,
                cree_le VARCHAR(19) NOT NULL,
                utilise_le VARCHAR(19) NULL,
                FOREIGN KEY (compte_id) REFERENCES comptes(id) ON DELETE CASCADE
            )",
            "tentatives (
                id $id,
                cle VARCHAR(190) NOT NULL,
                le VARCHAR(19) NOT NULL
            )",
            "personnes (
                id $id,
                compte_id $ref NOT NULL,
                nom VARCHAR(80) NOT NULL,
                date_naissance VARCHAR(10) NULL,
                note VARCHAR(500) NULL,
                FOREIGN KEY (compte_id) REFERENCES comptes(id) ON DELETE CASCADE
            )",
            "occasions (
                id $id,
                compte_id $ref NOT NULL,
                type VARCHAR(20) NOT NULL,
                titre VARCHAR(120) NOT NULL,
                date VARCHAR(10) NOT NULL,
                FOREIGN KEY (compte_id) REFERENCES comptes(id) ON DELETE CASCADE
            )",
            "cadeaux (
                id $id,
                compte_id $ref NOT NULL,
                occasion_id $ref NULL,
                personne_id $ref NULL,
                titre VARCHAR(200) NOT NULL,
                montant_prevu INT NULL,
                montant_depense INT NULL,
                statut VARCHAR(10) NOT NULL,
                lien VARCHAR(1000) NULL,
                image VARCHAR(1000) NULL,
                note VARCHAR(500) NULL,
                cree_le VARCHAR(19) NOT NULL,
                FOREIGN KEY (compte_id) REFERENCES comptes(id) ON DELETE CASCADE,
                FOREIGN KEY (occasion_id) REFERENCES occasions(id) ON DELETE SET NULL,
                FOREIGN KEY (personne_id) REFERENCES personnes(id) ON DELETE SET NULL
            )",
            "cagnottes (
                id $id,
                compte_id $ref NOT NULL,
                code CHAR(16) NOT NULL UNIQUE,
                titre VARCHAR(200) NOT NULL,
                beneficiaire VARCHAR(80) NOT NULL,
                objectif INT NOT NULL,
                mode VARCHAR(10) NOT NULL,
                nombre_parts INT NULL,
                date_limite VARCHAR(10) NULL,
                lien VARCHAR(1000) NULL,
                message VARCHAR(1000) NULL,
                close INT NOT NULL DEFAULT 0,
                cree_le VARCHAR(19) NOT NULL,
                FOREIGN KEY (compte_id) REFERENCES comptes(id) ON DELETE CASCADE
            )",
            "budgets (
                id $id,
                compte_id $ref NOT NULL,
                occasion_id $ref NOT NULL,
                personne_id $ref NOT NULL,
                montant INT NOT NULL,
                UNIQUE (occasion_id, personne_id),
                FOREIGN KEY (compte_id) REFERENCES comptes(id) ON DELETE CASCADE,
                FOREIGN KEY (occasion_id) REFERENCES occasions(id) ON DELETE CASCADE,
                FOREIGN KEY (personne_id) REFERENCES personnes(id) ON DELETE CASCADE
            )",
            "participations (
                id $id,
                cagnotte_id $ref NOT NULL,
                nom VARCHAR(80) NOT NULL,
                montant INT NOT NULL,
                paye INT NOT NULL DEFAULT 0,
                organisateur INT NOT NULL DEFAULT 0,
                cle CHAR(64) NULL,
                cree_le VARCHAR(19) NOT NULL,
                FOREIGN KEY (cagnotte_id) REFERENCES cagnottes(id) ON DELETE CASCADE
            )",
        ];

        foreach ($tables as $table) {
            $pdo->exec("CREATE TABLE IF NOT EXISTS $table$fin");
        }

        // Colonnes ajoutées après la première version : ajoutées aux bases déjà en ligne.
        $ajouts = [
            ['comptes', 'derniere_activite', 'VARCHAR(19) NULL'], // v2
            ['comptes', 'averti_le', 'VARCHAR(19) NULL'],         // v2
            ['jetons', 'utilise_le', 'VARCHAR(19) NULL'],         // v2
        ];
        foreach ($ajouts as [$table, $colonne, $type]) {
            if (!self::colonneExiste($pdo, $table, $colonne, $mysql)) {
                $pdo->exec("ALTER TABLE $table ADD COLUMN $colonne $type");
            }
        }
    }

    private static function colonneExiste(\PDO $pdo, string $table, string $colonne, bool $mysql): bool
    {
        $lignes = $pdo->query($mysql ? "SHOW COLUMNS FROM $table" : "PRAGMA table_info($table)")->fetchAll(\PDO::FETCH_ASSOC);

        return in_array($colonne, array_column($lignes, $mysql ? 'Field' : 'name'), true);
    }
}
