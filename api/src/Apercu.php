<?php

declare(strict_types=1);

namespace Cadeaux;

/**
 * Aperçu d'un lien de cagnotte dans Snapchat, WhatsApp, Messenger… : ces applis lisent les balises Open Graph de la
 * page sans exécuter son JavaScript. La page /c/{code} est donc servie par PHP (partage.php), avec titre, avancement et
 * une image 1200 × 630 : grand pourcentage, barre de progression, « 100 € / 150 € ».
 * Rien d'autre que ce que montre déjà la page : titre, bénéficiaire, objectif et total (pas les participants).
 * L'image est dessinée en PHP pur (aucune extension graphique nécessaire).
 */
final class Apercu
{
    public const LARGEUR = 1200;
    public const HAUTEUR = 630;

    public function __construct(private readonly \PDO $pdo)
    {
    }

    /** @return array{code: string, titre: string, beneficiaire: string, objectif: int, total: int, close: bool}|null */
    public function donnees(string $code): ?array
    {
        $requete = $this->pdo->prepare(
            'SELECT g.code, g.titre, g.beneficiaire, g.objectif, g.close, COALESCE(SUM(p.montant), 0) AS total
             FROM cagnottes g LEFT JOIN participations p ON p.cagnotte_id = g.id
             WHERE g.code = ? GROUP BY g.id, g.code, g.titre, g.beneficiaire, g.objectif, g.close',
        );
        $requete->execute([$code]);
        $g = $requete->fetch(\PDO::FETCH_ASSOC);

        return $g === false ? null : [
            'code' => (string) $g['code'],
            'titre' => (string) $g['titre'],
            'beneficiaire' => (string) $g['beneficiaire'],
            'objectif' => (int) $g['objectif'],
            'total' => (int) $g['total'],
            'close' => (bool) $g['close'],
        ];
    }

    public static function pourcentage(int $total, int $objectif): int
    {
        return $objectif > 0 ? min(100, (int) floor($total * 100 / $objectif)) : 0;
    }

    /**
     * La page de l'application (index.html), avec les balises d'aperçu de cette cagnotte.
     *
     * @param array{code: string, titre: string, beneficiaire: string, objectif: int, total: int, close: bool} $g
     */
    public static function html(string $modele, array $g, string $site): string
    {
        $e = static fn (string $t): string => htmlspecialchars($t, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $reste = max(0, $g['objectif'] - $g['total']);
        $titre = "Cagnotte pour {$g['beneficiaire']} : {$g['titre']}";
        $description = Rappels::euros($g['total']) . ' sur ' . Rappels::euros($g['objectif'])
            . ($g['close'] ? ' · cagnotte terminée' : ($reste > 0 ? ' · il manque ' . Rappels::euros($reste) . ' · Mets ta part en un clic' : ' · objectif atteint'));
        $url = "$site/c/{$g['code']}";
        // Le total dans l'adresse de l'image : les applis qui la gardent en cache en reprennent une nouvelle quand il change.
        $image = "$url/apercu.png?t={$g['total']}";
        $balises = implode("\n    ", [
            '<title>' . $e($titre) . '</title>',
            '<meta name="description" content="' . $e($description) . '" />',
            '<meta property="og:type" content="website" />',
            '<meta property="og:site_name" content="Cadeaux" />',
            '<meta property="og:locale" content="fr_FR" />',
            '<meta property="og:title" content="' . $e($titre) . '" />',
            '<meta property="og:description" content="' . $e($description) . '" />',
            '<meta property="og:url" content="' . $e($url) . '" />',
            '<meta property="og:image" content="' . $e($image) . '" />',
            '<meta property="og:image:width" content="' . self::LARGEUR . '" />',
            '<meta property="og:image:height" content="' . self::HAUTEUR . '" />',
            '<meta property="og:image:alt" content="' . $e(self::pourcentage($g['total'], $g['objectif']) . ' % de la cagnotte atteint') . '" />',
            '<meta name="twitter:card" content="summary_large_image" />',
        ]);
        $sans = preg_replace(['#<title>.*?</title>#s', '#<meta name="description"[^>]*>#'], '', $modele) ?? $modele;

        return str_replace('</head>', "    $balises\n  </head>", $sans);
    }

    /**
     * Image d'aperçu (PNG 1200 × 630).
     *
     * @param array{objectif: int, total: int, close: bool} $g
     */
    public static function png(array $g): string
    {
        $pct = self::pourcentage($g['total'], $g['objectif']);
        $toile = new Toile(self::LARGEUR, self::HAUTEUR, [250, 246, 240]);
        // Ruban du paquet cadeau, en haut.
        $toile->rectangle(0, 0, self::LARGEUR, 24, [158, 31, 43]);
        $toile->rectangle(560, 0, 80, 24, [199, 146, 43]);
        // Paquet cadeau, à droite.
        $toile->rectangle(870, 170, 230, 150, [158, 31, 43]);
        $toile->rectangle(850, 120, 270, 56, [124, 22, 33]);
        $toile->rectangle(965, 120, 40, 200, [199, 146, 43]);
        $toile->rectangle(915, 80, 50, 40, [199, 146, 43]);
        $toile->rectangle(1005, 80, 50, 40, [199, 146, 43]);
        $toile->rectangle(935, 92, 18, 18, [250, 246, 240]);
        $toile->rectangle(1017, 92, 18, 18, [250, 246, 240]);
        // Grand pourcentage.
        $toile->texte("$pct %", 100, 120, 26, [36, 22, 26]);
        // Barre de progression : fond, puis partie remplie (rouge vers or).
        $toile->rectangle(100, 380, 1000, 64, [236, 227, 217]);
        $rempli = (int) round(1000 * $pct / 100);
        for ($x = 0; $x < $rempli; $x += 10) {
            $t = $x / 1000;
            $couleur = [(int) (158 + (199 - 158) * $t), (int) (31 + (146 - 31) * $t), (int) (43 + (43 - 43) * $t)];
            $toile->rectangle(100 + $x, 380, min(10, $rempli - $x), 64, $couleur);
        }
        // Montants : « 100 € / 150 € ».
        $toile->texte(self::montant($g['total']) . ' / ' . self::montant($g['objectif']), 100, 490, 10, $g['close'] ? [106, 90, 93] : [29, 107, 74]);

        return $toile->png();
    }

    /** « 1 234,50 € » sans espace insécable (la police de l'image ne connaît que les chiffres, « , », « / », « € », « % »). */
    private static function montant(int $centimes): string
    {
        return str_replace("\u{a0}", ' ', Rappels::euros($centimes));
    }
}
