/**
 * safepay.ts — browser side of the Safepay online fee payment.
 *
 * The browser NEVER talks to Safepay directly and never sees any secret.
 * It only asks our own serverless function (api/safepay.js) for a hosted
 * checkout URL and then navigates there. The amount and the order id are
 * decided on the server from the database, not sent from here.
 */
import { useQuery } from "@tanstack/react-query";
import { ADMISSION_CLIENT_CACHE } from "@/config/admissionCache";

export async function fetchOnlinePaymentEnabled(): Promise<boolean> {
  try {
    const res = await fetch("/api/safepay?kind=config", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(ADMISSION_CLIENT_CACHE.paymentTimeoutMs),
    });
    if (!res.ok) throw new Error(`config ${res.status}`);
    const j = (await res.json()) as { enabled?: boolean };
    return j.enabled === true;
  } catch (e) {
    // Throw (not "false") so react-query retries instead of caching "online
    // payment is off" for a minute because of one dropped request.
    throw e instanceof Error ? e : new Error("config failed");
  }
}

/** True when the school has switched online payment on AND the server is configured. */
export function useOnlinePaymentEnabled() {
  return useQuery<boolean>({
    queryKey: ["online-payment-enabled"],
    queryFn: fetchOnlinePaymentEnabled,
    staleTime: 60 * 1000,
    retry: 2,
    retryDelay: 1200,
  });
}

export interface CreatePaymentResult { ok: boolean; url?: string; error?: string }

/** Ask the server for a Safepay checkout URL for one of the applicant's applications. */
export async function createOnlinePayment(token: string, applicationId: string): Promise<CreatePaymentResult> {
  try {
    const res = await fetch("/api/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token, application_id: applicationId }),
      signal: AbortSignal.timeout(ADMISSION_CLIENT_CACHE.paymentTimeoutMs),
    });
    const j = (await res.json().catch(() => ({}))) as CreatePaymentResult;
    if (!res.ok || !j.ok || !j.url) {
      return { ok: false, error: j.error || "Could not start the online payment. Please try again." };
    }
    // Only ever navigate to Safepay's own HTTPS checkout.
    let u: URL;
    try { u = new URL(j.url); } catch { return { ok: false, error: "Invalid payment link received." }; }
    if (u.protocol !== "https:" || !/(^|\.)getsafepay\.com$/i.test(u.hostname)) {
      return { ok: false, error: "Invalid payment link received." };
    }
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false, error: "Network error. Please check your connection and try again." };
  }
}
