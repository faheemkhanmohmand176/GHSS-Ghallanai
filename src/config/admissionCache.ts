/**
 * admissionCache — ONE config file for the admission feature's client-side
 * cache tunables (React Query staleTime values, in milliseconds).
 *
 * WHY A SEPARATE FILE
 *   Nothing admission-related that a future admin may want to tune should be
 *   buried inside component code.  Server-side cache windows (s-maxage per
 *   /api/public-data kind) already live in ONE place — the CACHE map at the
 *   top of api/public-data.js.  Retention windows and DB rate limits live in
 *   the admission_settings table (see migration 25).  This file is the third
 *   and last knob: how long the BROWSER keeps admission data before it asks
 *   again.
 *
 * HOW THE VALUES WORK TOGETHER (example: admission settings)
 *   • CDN window (server)      60 s  — one origin read per minute for the
 *                                      whole site, no matter how many
 *                                      visitors are online.
 *   • settingsStaleMs (here)  120 s  — each visitor's React Query cache.
 *   Worst case a visitor sees a change ~3 min old; the admin save flow
 *   busts the CDN key immediately (markAdmissionSettingsBust), so an admin
 *   change is live for everyone on their next refetch.
 *
 * RAISING / LOWERING
 *   Bigger  = fewer Supabase queries (better for the free-plan Nano compute
 *             and 500 MB budget), slightly older data.
 *   Smaller = fresher data, more queries.
 *   These are cache freshness values only — nothing here is a school fact,
 *   fee amount, date or security limit.
 */

export const ADMISSION_CLIENT_CACHE = {
  /** Admission settings (open/closed, dates, fee, payment accounts).
   *  Read by the homepage banner and every public admission page. */
  settingsStaleMs: 2 * 60 * 1000,

  /** Active programs + seats + subject groups (admission-programs kind). */
  programsStaleMs: 5 * 60 * 1000,

  /** Union-council list for the domicile picker (admission-ucs kind). */
  ucsStaleMs: 24 * 60 * 60 * 1000,

  /** Published admission merit lists (admission-merit-lists kind). */
  meritListsStaleMs: 2 * 60 * 1000,

  /** One merit list + entries (admission-merit-list kind). */
  meritListStaleMs: 5 * 60 * 1000,
} as const;
