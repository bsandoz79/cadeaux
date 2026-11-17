import type { Produit } from './produit';
export type ProduitVu = Produit & { vuLe: number };
export const VUS_MAX: number;
export const VUS_JOURS: number;
export function estPageMerci(url: string, texte?: string): boolean;
export function estFicheProduit(url: string): boolean;
export function ajouterVu(vus: ProduitVu[], produit: Produit | null | undefined, maintenant: number): ProduitVu[];
export function produitsRecents(vus: ProduitVu[], maintenant: number, heures?: number): ProduitVu[];
export function liensPartage(url: string, beneficiaire: string, titre: string): { texte: string; whatsapp: string; sms: string };
