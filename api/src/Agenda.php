<?php

declare(strict_types=1);

namespace Cadeaux;

use Cadeaux\Http\ErreurHttp;

/**
 * Agenda à s'abonner (format iCalendar) : anniversaires des proches (chaque année), occasions et dates limites des
 * cagnottes ouvertes. Adresse privée par compte, avec un code de 256 bits dont seule l'empreinte est gardée :
 * l'adresse s'affiche une fois, et un nouveau lien remplace l'ancien.
 */
final class Agenda
{
    public function __construct(
        private readonly \PDO $pdo,
        private readonly Horloge $horloge,
        private readonly string $site,
    ) {
    }

    /** Nouveau lien d'agenda (l'ancien cesse de marcher) : adresse à donner à l'agenda. */
    public function creerLien(int $compteId): string
    {
        $code = bin2hex(random_bytes(32));
        $this->pdo->prepare('UPDATE comptes SET agenda_empreinte = ? WHERE id = ?')->execute([hash('sha256', $code), $compteId]);

        return $this->site . '/api/agenda/' . $code . '.ics';
    }

    public function couper(int $compteId): void
    {
        $this->pdo->prepare('UPDATE comptes SET agenda_empreinte = NULL WHERE id = ?')->execute([$compteId]);
    }

    /** Contenu de l'agenda du compte qui a ce code. */
    public function ics(string $code): string
    {
        $requete = $this->pdo->prepare('SELECT id FROM comptes WHERE agenda_empreinte = ? AND bloque = 0');
        $requete->execute([hash('sha256', $code)]);
        $compteId = $requete->fetchColumn();
        if ($compteId === false || preg_match('/^[a-f0-9]{64}$/', $code) !== 1) {
            throw ErreurHttp::introuvable();
        }
        $compteId = (int) $compteId;
        $maintenant = $this->horloge->maintenant()->format('Ymd\THis\Z');
        $evenements = [];

        // Anniversaires : date du proche, sinon celle de son compte associé (s'il l'a indiquée).
        $proches = $this->pdo->prepare(
            'SELECT p.id, p.nom, COALESCE(p.date_naissance, c.date_naissance) AS naissance
             FROM personnes p LEFT JOIN comptes c ON c.id = p.compte_lie_id
             WHERE p.compte_id = ? AND COALESCE(p.date_naissance, c.date_naissance) IS NOT NULL',
        );
        $proches->execute([$compteId]);
        foreach ($proches->fetchAll(\PDO::FETCH_ASSOC) as $p) {
            $evenements[] = $this->evenement('anniversaire-' . $p['id'], (string) $p['naissance'], 'Anniversaire de ' . $p['nom'], "{$this->site}/proches/{$p['id']}", $maintenant, true);
        }

        // Occasions (les anniversaires reviennent déjà chaque année ci-dessus).
        $occasions = $this->pdo->prepare("SELECT id, titre, date FROM occasions WHERE compte_id = ? AND type <> 'anniversaire'");
        $occasions->execute([$compteId]);
        foreach ($occasions->fetchAll(\PDO::FETCH_ASSOC) as $o) {
            $evenements[] = $this->evenement('occasion-' . $o['id'], (string) $o['date'], (string) $o['titre'], "{$this->site}/occasions/{$o['id']}", $maintenant);
        }

        // Cagnottes encore ouvertes : leur date limite.
        $cagnottes = $this->pdo->prepare('SELECT id, titre, beneficiaire, date_limite FROM cagnottes WHERE compte_id = ? AND close = 0 AND date_limite IS NOT NULL');
        $cagnottes->execute([$compteId]);
        foreach ($cagnottes->fetchAll(\PDO::FETCH_ASSOC) as $c) {
            $evenements[] = $this->evenement('cagnotte-' . $c['id'], (string) $c['date_limite'], "Fin de la cagnotte pour {$c['beneficiaire']} : {$c['titre']}", "{$this->site}/cagnottes/{$c['id']}", $maintenant);
        }

        $lignes = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Cadeaux//cadeaux.bsandoz.fr//FR',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:Cadeaux',
            'X-WR-CALDESC:Anniversaires, occasions et cagnottes (cadeaux.bsandoz.fr)',
            'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
            'X-PUBLISHED-TTL:PT12H',
            ...array_merge(...($evenements === [] ? [[]] : $evenements)),
            'END:VCALENDAR',
        ];

        return implode("\r\n", array_map(self::plier(...), $lignes)) . "\r\n";
    }

    /** @return list<string> */
    private function evenement(string $uid, string $date, string $titre, string $lien, string $maintenant, bool $chaqueAnnee = false): array
    {
        $jour = \DateTimeImmutable::createFromFormat('!Y-m-d', $date, new \DateTimeZone('UTC'));
        if ($jour === false) {
            return [];
        }

        return [
            'BEGIN:VEVENT',
            "UID:$uid@cadeaux.bsandoz.fr",
            "DTSTAMP:$maintenant",
            'DTSTART;VALUE=DATE:' . $jour->format('Ymd'),
            'DTEND;VALUE=DATE:' . $jour->modify('+1 day')->format('Ymd'),
            ...($chaqueAnnee ? ['RRULE:FREQ=YEARLY'] : []),
            'SUMMARY:' . self::echapper($titre),
            'DESCRIPTION:' . self::echapper("Dans Cadeaux : $lien"),
            'URL:' . $lien,
            'TRANSP:TRANSPARENT',
            'END:VEVENT',
        ];
    }

    private static function echapper(string $texte): string
    {
        return str_replace(['\\', ';', ',', "\r\n", "\n"], ['\\\\', '\\;', '\\,', '\\n', '\\n'], $texte);
    }

    /** Lignes de 75 octets au plus, la suite commençant par une espace (RFC 5545), sans couper un caractère. */
    private static function plier(string $ligne): string
    {
        $morceaux = [];
        while (strlen($ligne) > 75) {
            $coupe = 75;
            while ($coupe > 0 && (ord($ligne[$coupe]) & 0xC0) === 0x80) {
                --$coupe;
            }
            $morceaux[] = substr($ligne, 0, $coupe);
            $ligne = ' ' . substr($ligne, $coupe);
        }
        $morceaux[] = $ligne;

        return implode("\r\n", $morceaux);
    }
}
