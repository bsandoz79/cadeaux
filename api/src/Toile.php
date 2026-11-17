<?php

declare(strict_types=1);

namespace Cadeaux;

/**
 * Petite toile de dessin en PHP pur, enregistrée en PNG : rectangles pleins et texte avec une police en points
 * (chiffres, espace, « , », « / », « % », « € »). Suffit pour l'image d'aperçu des cagnottes.
 */
final class Toile
{
    /** Police 5 × 7 : une chaîne de 7 lignes de 5 points par caractère (« # » = point allumé). */
    private const POLICE = [
        '0' => ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
        '1' => ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
        '2' => ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
        '3' => ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
        '4' => ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
        '5' => ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
        '6' => ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
        '7' => ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
        '8' => ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
        '9' => ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
        '%' => ['##...', '##..#', '...#.', '..#..', '.#...', '#..##', '...##'],
        '/' => ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
        ',' => ['.....', '.....', '.....', '.....', '.....', '..#..', '.#...'],
        '€' => ['..###', '.#...', '####.', '.#...', '####.', '.#...', '..###'],
        ' ' => ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
    ];

    /** @var list<string> lignes de pixels RGB (3 octets par pixel) */
    private array $lignes;

    /** @param array{int, int, int} $fond */
    public function __construct(private readonly int $largeur, private readonly int $hauteur, array $fond)
    {
        $this->lignes = array_fill(0, $hauteur, str_repeat(self::rgb($fond), $largeur));
    }

    /** @param array{int, int, int} $couleur */
    public function rectangle(int $x, int $y, int $l, int $h, array $couleur): void
    {
        $x0 = max(0, $x);
        $x1 = min($this->largeur, $x + $l);
        if ($x1 <= $x0) {
            return;
        }
        $bande = str_repeat(self::rgb($couleur), $x1 - $x0);
        for ($ligne = max(0, $y); $ligne < min($this->hauteur, $y + $h); ++$ligne) {
            $this->lignes[$ligne] = substr_replace($this->lignes[$ligne], $bande, $x0 * 3, strlen($bande));
        }
    }

    /**
     * Texte en points carrés de `$taille` pixels (un caractère fait 5 × 7 points, plus 1 point d'écart ; une espace, 3 points).
     *
     * @param array{int, int, int} $couleur
     */
    public function texte(string $texte, int $x, int $y, int $taille, array $couleur): void
    {
        $avance = 0; // en points : 6 par caractère, 3 pour une espace
        foreach (mb_str_split($texte) as $car) {
            $glyphe = self::POLICE[$car] ?? self::POLICE[' '];
            foreach ($glyphe as $ligne => $points) {
                for ($colonne = 0; $colonne < 5; ++$colonne) {
                    if ($points[$colonne] === '#') {
                        $this->rectangle($x + ($avance + $colonne) * $taille, $y + $ligne * $taille, $taille, $taille, $couleur);
                    }
                }
            }
            $avance += $car === ' ' ? 3 : 6;
        }
    }

    public function png(): string
    {
        $brut = '';
        foreach ($this->lignes as $ligne) {
            $brut .= "\0" . $ligne; // filtre « aucun » pour chaque ligne
        }
        $morceau = static fn (string $type, string $donnees): string => pack('N', strlen($donnees)) . $type . $donnees . pack('N', crc32($type . $donnees));

        return "\x89PNG\r\n\x1a\n"
            . $morceau('IHDR', pack('NNCCCCC', $this->largeur, $this->hauteur, 8, 2, 0, 0, 0))
            . $morceau('IDAT', (string) gzcompress($brut, 6))
            . $morceau('IEND', '');
    }

    /** @param array{int, int, int} $c */
    private static function rgb(array $c): string
    {
        return chr($c[0]) . chr($c[1]) . chr($c[2]);
    }
}
