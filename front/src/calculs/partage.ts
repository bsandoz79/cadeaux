/** Message et liens d'envoi d'une cagnotte (WhatsApp, Snapchat, SMS), texte déjà écrit. */
export function liensPartage(url: string, beneficiaire: string, titre: string) {
  const texte = `On se cotise pour ${beneficiaire} (${titre}) ? Mets ta part ici : ${url}`;
  return {
    texte,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(texte)}`,
    // Lien de partage officiel de Snapchat (le lien seul : Snapchat affiche son aperçu).
    snapchat: `https://www.snapchat.com/share?link=${encodeURIComponent(url)}`,
    sms: `sms:?&body=${encodeURIComponent(texte)}`,
  };
}

/** Mêmes liens, pour un message déjà écrit (invitation à associer son compte…). */
export function liensMessage(url: string, texte: string) {
  return {
    texte,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(texte)}`,
    snapchat: `https://www.snapchat.com/share?link=${encodeURIComponent(url)}`,
    sms: `sms:?&body=${encodeURIComponent(texte)}`,
  };
}
