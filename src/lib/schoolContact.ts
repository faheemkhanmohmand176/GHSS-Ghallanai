/**
 * Single source for the school's WhatsApp payment-verification line.
 * Change the number here and every payment screen updates.
 */
export const SCHOOL_WHATSAPP_E164 = "923459409585";
export const SCHOOL_WHATSAPP_DISPLAY = "+92 345 9409585";

export function whatsappLink(message: string): string {
  return `https://wa.me/${SCHOOL_WHATSAPP_E164}?text=${encodeURIComponent(message)}`;
}
