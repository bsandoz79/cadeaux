/**
 * Pages de guide, écrites en HTML à la construction du site (voir scripts/pages-statiques.ts) : lisibles par Google
 * sans JavaScript, chacune répond à une recherche précise et mène à l'inscription.
 * Seulement ce que le site fait vraiment : aucun chiffre ni avis inventé.
 */
export const SITE = 'https://cadeaux.bsandoz.fr';

export type Section = { titre: string; paragraphes?: string[]; points?: string[] };

export type Guide = {
  chemin: string;
  /** Titre de l'onglet et de Google (moins de 65 caractères). */
  titre: string;
  /** Description sous le titre dans Google (moins de 160 caractères). */
  description: string;
  h1: string;
  /** Texte court du lien en pied de page du site (même texte que dans liensGuides.ts). */
  lien: string;
  chapo: string;
  sections: Section[];
  questions: { question: string; reponse: string }[];
};

export const GUIDES: Guide[] = [
  {
    chemin: '/cagnotte-cadeau-commun',
    lien: 'Cagnotte commune',
    titre: 'Cagnotte pour un cadeau commun, gratuite et sans frais',
    description: 'Organisez un cadeau à plusieurs : un lien à envoyer sur WhatsApp, Snap ou SMS, chacun note sa part, vous voyez ce qu’il manque. Gratuit, sans commission.',
    h1: 'Une cagnotte pour un cadeau commun, sans frais',
    chapo: 'Un cadeau à plusieurs pour un anniversaire, un départ ou Noël : vous choisissez le cadeau, vous envoyez un lien, et chacun note ce qu’il met. Vous voyez tout de suite ce qu’il reste à trouver.',
    sections: [
      {
        titre: 'Comment ça marche',
        points: [
          'Vous créez la cagnotte : le cadeau, pour qui, et son prix.',
          'Vous envoyez le lien sur le groupe WhatsApp, Snapchat ou par SMS. L’aperçu montre déjà où en est la cagnotte.',
          'Chacun ouvre le lien, met son prénom et choisit sa part en un clic (10, 20, 30 € ou un autre montant). Pas besoin de compte.',
          'Vous voyez les parts arriver et ce qu’il manque. Si le compte n’y est pas, « Je complète » ajoute le reste à votre nom.',
        ],
      },
      {
        titre: 'Et l’argent ?',
        paragraphes: [
          'L’argent ne passe pas par le site : chacun vous rembourse directement, par virement ou en liquide. C’est pour cela qu’il n’y a aucune commission.',
          'Si vous le souhaitez, vous ajoutez votre RIB : il est chiffré, montré seulement à ceux qui le demandent depuis le lien, et effacé dès que la cagnotte est terminée.',
        ],
      },
      {
        titre: 'Les parts égales, calculées pour vous',
        paragraphes: ['Le site propose des montants qui tombent juste : le prix divisé par le nombre de participants, arrondi au centime, sans centime perdu.'],
      },
    ],
    questions: [
      { question: 'Faut-il un compte pour participer ?', reponse: 'Non. Les participants mettent seulement leur prénom. Seul l’organisateur a un compte, gratuit.' },
      { question: 'Combien ça coûte ?', reponse: 'Rien : le site est gratuit et ne prend aucune commission, puisque l’argent ne passe pas par lui.' },
      { question: 'Qui voit les parts ?', reponse: 'Ceux qui ont le lien voient les prénoms et les montants. Chacun peut modifier ou retirer sa part.' },
    ],
  },
  {
    chemin: '/liste-de-noel',
    lien: 'Liste de Noël',
    titre: 'Liste de Noël en ligne à partager, sans cadeaux en double',
    description: 'Faites votre liste de Noël ou d’anniversaire et partagez le lien : vos proches réservent ce qu’ils offrent, sans doublon, et la surprise reste entière.',
    h1: 'Une liste de Noël à partager, sans cadeaux en double',
    chapo: 'Vous notez ce qui vous ferait plaisir, vous partagez le lien. Vos proches réservent ce qu’ils vous offrent : personne n’achète deux fois la même chose, et vous ne savez pas qui a pris quoi.',
    sections: [
      {
        titre: 'Votre liste en quelques minutes',
        points: [
          'Ajoutez vos envies : un nom, un prix si vous voulez, un lien vers le produit, une précision (taille, couleur…).',
          'Mettez en tête de liste ce qui vous ferait le plus plaisir.',
          'Ajoutez un petit mot en haut de la liste, par exemple « Pas de vêtements, merci ! ».',
          'Partagez le lien sur WhatsApp, Snapchat ou par SMS.',
        ],
      },
      {
        titre: 'La surprise est gardée',
        paragraphes: [
          'Quand un proche réserve une envie, les autres la voient prise. Vous, vous ne voyez rien : ni ce qui est réservé, ni par qui, même en ouvrant votre propre lien.',
          'Un cadeau trop cher pour une seule personne ? « On se cotise » transforme l’envie en cagnotte commune.',
        ],
      },
      {
        titre: 'Pour toute l’année',
        paragraphes: ['La même liste sert pour Noël, votre anniversaire ou n’importe quelle occasion. Vous pouvez couper le lien à tout moment : il ne marche plus, et un nouveau partage donne une nouvelle adresse.'],
      },
    ],
    questions: [
      { question: 'Mes proches doivent-ils créer un compte ?', reponse: 'Non. Ils ouvrent le lien et réservent avec leur prénom.' },
      { question: 'Puis-je voir qui m’offre quoi ?', reponse: 'Non, c’est voulu : les réservations vous sont cachées pour garder la surprise.' },
    ],
  },
  {
    chemin: '/budget-cadeaux',
    lien: 'Budget cadeaux',
    titre: 'Budget cadeaux de Noël et de l’année : le suivre simplement',
    description: 'Notez les cadeaux de chaque fête et de chaque proche, prévu et dépensé : vous voyez ce que les cadeaux vous coûtent dans l’année, par personne et par occasion.',
    h1: 'Suivre son budget cadeaux de l’année',
    chapo: 'Noël, anniversaires, fête des mères, mariages… Les cadeaux s’additionnent vite. Notez-les au fil de l’année et voyez où va votre budget, sans tableur.',
    sections: [
      {
        titre: 'Une méthode simple',
        points: [
          'Pour chaque fête, notez qui reçoit quoi et le prix prévu.',
          'Quand c’est acheté, notez le prix payé : c’est lui qui compte ensuite dans votre bilan.',
          'Fixez un budget par personne pour une occasion : vous voyez tout de suite si vous le dépassez.',
          'Votre part d’une cagnotte commune compte dans votre budget, pas le prix entier du cadeau.',
        ],
      },
      {
        titre: 'Le bilan de l’année',
        paragraphes: ['Le bilan montre le total de l’année, déjà dépensé et encore prévu, par occasion, par personne et par groupe (famille, amis, collègues).'],
      },
      {
        titre: 'Ne pas offrir deux fois la même chose',
        paragraphes: ['La fiche de chaque proche garde tout ce que vous lui avez déjà offert, année après année.'],
      },
    ],
    questions: [
      { question: 'Le site prélève-t-il de l’argent ?', reponse: 'Non. Il note seulement des montants : aucun paiement ne passe par lui.' },
      { question: 'Puis-je récupérer mes données ?', reponse: 'Oui, « Mon compte » permet de télécharger toutes vos données en un fichier, et de supprimer votre compte.' },
    ],
  },
  {
    chemin: '/rappel-anniversaires',
    lien: 'Rappels d’anniversaire',
    titre: 'Rappel d’anniversaire par e-mail : ne plus en oublier un',
    description: 'Notez les anniversaires de vos proches et recevez un rappel une semaine avant, le temps de trouver un cadeau. Fête des mères et des pères calculées.',
    h1: 'Ne plus oublier un anniversaire',
    chapo: 'Notez la date de naissance de vos proches : un e-mail vous prévient une semaine avant, le temps de trouver le bon cadeau.',
    sections: [
      {
        titre: 'Les rappels',
        points: [
          'Un e-mail 7 jours avant chaque anniversaire, avec votre budget et ce qui est déjà prévu pour la personne.',
          'Un rappel 2 jours avant la date limite d’une cagnotte à laquelle il manque de l’argent.',
          'Les rappels se coupent en un clic dans « Mon compte ».',
        ],
      },
      {
        titre: 'Toute la famille d’un coup d’œil',
        paragraphes: ['Rangez vos proches en groupes (famille, amis, collègues) et construisez l’arbre de famille : papa, maman, grands-parents de chaque côté, oncles, tantes, cousins… Un clic sur une personne propose ses prochaines occasions.'],
      },
      {
        titre: 'Fête des mères et fête des pères',
        paragraphes: ['Les dates sont calculées pour vous : la fête des mères tombe le dernier dimanche de mai (le premier dimanche de juin quand ce dimanche est la Pentecôte), la fête des pères le troisième dimanche de juin.'],
      },
    ],
    questions: [
      { question: 'L’anniversaire d’un proche qui a un compte se remplit-il seul ?', reponse: 'Oui, s’il associe son compte à votre fiche et indique sa date de naissance.' },
      { question: 'Mes données sont-elles revendues ?', reponse: 'Non. Pas de publicité, pas de traceur, pas de mesure d’audience.' },
    ],
  },
];

/** Pages à proposer à Google (plan du site). Les pages privées (comptes, liens partagés) n'y sont jamais. */
export const PAGES_PUBLIQUES = ['/', ...GUIDES.map((g) => g.chemin), '/confidentialite', '/mentions-legales'];

const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Page HTML complète d'un guide. `feuille` : adresse de la feuille de style. */
export function pageGuide(guide: Guide, feuille: string): string {
  const e = echapper;
  const autres = GUIDES.filter((g) => g.chemin !== guide.chemin);
  const section = (s: Section) => `
      <section>
        <h2>${e(s.titre)}</h2>
        ${(s.paragraphes ?? []).map((p) => `<p>${e(p)}</p>`).join('\n        ')}
        ${s.points ? `<ol>\n          ${s.points.map((p) => `<li>${e(p)}</li>`).join('\n          ')}\n        </ol>` : ''}
      </section>`;

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${e(guide.titre)} · Cadeaux</title>
    <meta name="description" content="${e(guide.description)}" />
    <link rel="canonical" href="${SITE}${guide.chemin}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Cadeaux" />
    <meta property="og:locale" content="fr_FR" />
    <meta property="og:title" content="${e(guide.titre)}" />
    <meta property="og:description" content="${e(guide.description)}" />
    <meta property="og:url" content="${SITE}${guide.chemin}" />
    <meta property="og:image" content="${SITE}/icone-512.png" />
    <meta name="theme-color" content="#9e1f2b" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="stylesheet" href="${feuille}" />
  </head>
  <body>
    <header class="entete">
      <a class="logo" href="/"><img src="/favicon.svg" alt="" width="30" height="30" /> Cadeaux</a>
      <a class="btn btn--petit" href="/">Créer mon compte</a>
    </header>
    <main class="guide">
      <h1>${e(guide.h1)}</h1>
      <p class="chapo">${e(guide.chapo)}</p>
${guide.sections.map(section).join('\n')}
      <section>
        <h2>Questions fréquentes</h2>
        <dl>
          ${guide.questions.map((q) => `<dt>${e(q.question)}</dt>\n          <dd>${e(q.reponse)}</dd>`).join('\n          ')}
        </dl>
      </section>
      <p class="appel"><a class="btn" href="/">Créer mon compte gratuit</a></p>
    </main>
    <footer class="pied">
      <nav aria-label="Guides">
        <p>À lire aussi :</p>
        <ul>
          ${autres.map((g) => `<li><a href="${g.chemin}">${e(g.h1)}</a></li>`).join('\n          ')}
        </ul>
      </nav>
      <p>Cadeaux · les montants sont notés ici, l’argent ne passe pas par le site. <a href="/confidentialite">Confidentialité</a> · <a href="/mentions-legales">Mentions légales</a></p>
    </footer>
  </body>
</html>
`;
}

/** Plan du site pour Google (sitemap.xml). */
export function planDuSite(): string {
  const urls = PAGES_PUBLIQUES.map((c) => `  <url><loc>${SITE}${c}</loc></url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
