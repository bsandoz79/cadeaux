/**
 * Textes des pages légales. Ils suivent le registre des traitements (docs/rgpd.md) : à mettre à jour ensemble.
 * `[à compléter]` : information à vérifier avant d'écrire (jamais inventée).
 */
export interface SectionLegale { titre: string; paragraphes: string[] }
export interface PageLegale { titre: string; miseAJour: string; intro: string; sections: SectionLegale[] }

const CONTACT = 'contact@bsandoz.fr';

export const MENTIONS_LEGALES: PageLegale = {
  titre: 'Mentions légales',
  miseAJour: '2026-11-17',
  intro: 'Informations sur l’éditeur et l’hébergeur de cadeaux.bsandoz.fr.',
  sections: [
    {
      titre: 'Éditeur',
      paragraphes: [
        'Site édité par Baptiste Sandoz, à titre personnel.',
        `Contact : ${CONTACT}.`,
        'Directeur de la publication : Baptiste Sandoz.',
      ],
    },
    {
      titre: 'Hébergeur',
      paragraphes: ['o2switch, Clermont-Ferrand (France), www.o2switch.fr. Adresse postale : [à compléter].'],
    },
    {
      titre: 'Fonctionnement',
      paragraphes: [
        'Cadeaux est un outil gratuit pour noter ses cadeaux, suivre son budget et organiser des cadeaux communs. Le site note seulement des montants : aucun paiement ne passe par lui.',
      ],
    },
  ],
};

export const CONFIDENTIALITE: PageLegale = {
  titre: 'Politique de confidentialité',
  miseAJour: '2026-11-17',
  intro: 'Ce que Cadeaux garde sur vous et sur vos proches, pourquoi, combien de temps, et comment l’effacer.',
  sections: [
    {
      titre: 'Qui est responsable',
      paragraphes: [`Baptiste Sandoz, éditeur du site. Pour toute question ou demande sur vos données : ${CONTACT}.`],
    },
    {
      titre: 'Votre compte',
      paragraphes: [
        'Votre adresse e-mail, votre prénom et votre mot de passe (enregistré sous une forme illisible, même pour nous) servent à vous connecter.',
        'Votre connexion reste active sur un appareil tant que vous vous en servez ; après 90 jours sans visite, il faut vous reconnecter.',
        'Si les rappels sont activés (« Mon compte »), vous recevez au plus un e-mail par jour : 7 jours avant l’anniversaire d’un proche, et 2 jours avant la date limite d’une cagnotte incomplète. Vous pouvez les couper à tout moment.',
        'Si vous n’utilisez plus le site pendant près de 3 ans, vous recevez un e-mail ; sans nouvelle visite dans les 30 jours, votre compte et tout ce qu’il contient sont supprimés.',
      ],
    },
    {
      titre: 'Vos proches, vos occasions et vos cadeaux',
      paragraphes: [
        'Les prénoms, dates de naissance et notes de vos proches, vos occasions et vos cadeaux (montants, liens, notes) ne sont visibles que par vous.',
        'Ils servent uniquement à vous afficher vos listes, vos rappels d’anniversaire et votre bilan. Ils ne sont ni vendus, ni partagés, ni utilisés pour de la publicité.',
      ],
    },
    {
      titre: 'Les cagnottes',
      paragraphes: [
        'Une cagnotte est visible par toute personne qui a son lien : son titre, le prénom du bénéficiaire, le prénom de l’organisateur, et le prénom et le montant de chaque participant.',
        'Pour participer, il suffit d’un prénom (ou d’un surnom) et d’un montant. Vous pouvez modifier ou retirer votre part depuis le navigateur où vous l’avez ajoutée, ou en le demandant à l’organisateur.',
        'Les parts sont effacées quand l’organisateur supprime la cagnotte ou son compte.',
      ],
    },
    {
      titre: 'Les listes d’envies',
      paragraphes: [
        'Votre liste d’envies n’est visible que par les personnes à qui vous donnez son lien. Vous pouvez couper le lien à tout moment : l’ancienne adresse ne marche plus.',
        'Pour réserver une envie, il suffit d’un prénom. Il est visible par ceux qui ont le lien, mais jamais par le propriétaire de la liste, pour garder la surprise. La réservation s’annule depuis le navigateur où elle a été faite, et disparaît avec l’envie ou la liste.',
      ],
    },
    {
      titre: 'L’extension Chrome',
      paragraphes: [
        'L’extension lit la page ouverte (nom, prix, photo et adresse du produit) seulement quand vous cliquez sur son icône, et n’envoie rien tant que vous n’avez pas cliqué sur « Ajouter ».',
        'Si vous activez l’aide après achat sur Amazon (option désactivée au départ, avec l’autorisation de Chrome), l’extension retient dans votre navigateur les 10 derniers produits regardés sur amazon.fr, 7 jours au plus, pour vous les proposer après une commande. Ils ne sont envoyés que si vous cliquez sur « Noter le cadeau ». Désactiver l’option les efface.',
      ],
    },
    {
      titre: 'Sécurité et données techniques',
      paragraphes: [
        'Pour bloquer les tentatives d’intrusion et les abus, l’adresse IP d’un essai de connexion raté, d’une part ajoutée ou d’une envie réservée par lien est gardée 15 minutes, puis effacée.',
        'Le site n’utilise aucun cookie, aucune mesure d’audience et aucun service extérieur. Votre connexion est gardée dans votre navigateur, uniquement pour vous éviter de vous reconnecter.',
        'Les données sont hébergées en France par o2switch.',
      ],
    },
    {
      titre: 'Vos droits',
      paragraphes: [
        'Vous pouvez à tout moment télécharger toutes vos données (« Mon compte », « Télécharger mes données »), les corriger depuis le site, ou supprimer votre compte et tout ce qu’il contient (« Mon compte », « Supprimer mon compte »).',
        `Pour toute autre demande (accès, rectification, effacement, opposition), écrivez à ${CONTACT}. Si la réponse ne vous convient pas, vous pouvez saisir la CNIL (www.cnil.fr).`,
      ],
    },
  ],
};
