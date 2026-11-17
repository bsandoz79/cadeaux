/** Message et liens d'envoi d'une cagnotte (WhatsApp, SMS), texte déjà écrit. */
export function liensPartage(url: string, beneficiaire: string, titre: string) {
  const texte = `On se cotise pour ${beneficiaire} (${titre}) ? Mets ta part ici : ${url}`;
  return {
    texte,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(texte)}`,
    sms: `sms:?&body=${encodeURIComponent(texte)}`,
  };
}
