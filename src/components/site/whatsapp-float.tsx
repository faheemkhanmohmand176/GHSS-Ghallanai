"use client";

import { WHATSAPP_LINK } from "@/content/site";
import { WhatsAppIcon } from "./whatsapp";

/** Floating WhatsApp button — the district's default channel (research §2.1).
 *  Sits above the mobile bottom nav so both stay one thumb apart. */
export function WhatsAppFloat() {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with the school on WhatsApp"
      className="button-press fixed right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/25 transition-transform duration-150 hover:scale-105 active:scale-95 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}
