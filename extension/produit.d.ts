export interface Produit { titre: string; prix: number | null; image: string | null; lien: string }
export function lireProduit(): Produit;
