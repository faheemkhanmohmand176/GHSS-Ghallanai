/**
 * PersonalProfileForm — mirrors:
 * every personal field (name, father name, DOB via
 * day/month/year selects, gender radio, contact numbers, religion, domicile
 * province/district/tehsil/union council, parents' CNICs, mailing address,
 * blood group, hafiz e quran).
 *
 * NO ACCOUNT: the applicant's nationality + own CNIC/Form-B are entered here
 * (they used to be typed on the removed "Create Account" page).  Before the
 * final Submit everything is saved to a draft on the applicant's own device;
 * after submission (private session) the identity + mobile are locked.
 */

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Save, UserRound, BadgeCheck } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import toast from "react-hot-toast";
import AdmissionBackBar from "@/components/shared/AdmissionBackBar";
import AdmissionSessionRetry from "@/components/shared/AdmissionSessionRetry";
import { ADMISSION_CLIENT_CACHE } from "@/config/admissionCache";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useInterSession } from "@/hooks/useInterAdmission";
import {
  interApi, PROVINCES, RELIGIONS, GENDERS, MOHMAND_TEHSILS, DISTRICTS,
  PersonalProfileData, InterUc,
} from "@/lib/interAdmission";
import { saveDraftPersonal, getWip, setWip, clearWip } from "@/lib/admissionDraft";

const NATIONALITIES = ["Pakistani", "Afghani"] as const;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const DAYS: number[] = Array.from({ length: 30 }, (_, i) => i + 1);

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const EMPTY: PersonalProfileData = {
  full_name: "", father_name: "", date_of_birth: "", gender: "male",
  email_address: "", mobile_number: "", landline_number: "", religion: "Islam",
  nationality: "Pakistani", domicile_province: "Khyber Pakhtunkhwa",
  domicile_district: "Mohmand", tehsil: "", union_council: "",
  mailing_address: "", blood_group: "", father_cnic: "", father_mobile: "",
  mother_name: "", mother_cnic: "", photo_url: "", hafiz_e_quran: false,
};

export default function PersonalProfileForm() {
  const { session, loading, token, isDraft, netError, refresh } = useInterSession();
  const [form, setForm] = useState<PersonalProfileData>(EMPTY);
  // Applicant identity (no account): nationality + own CNIC / Form-B.
  const [nationality, setNationality] = useState<string>("Pakistani");
  const [cnic, setCnic] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // HYDRATE ONCE. The old effect re-ran whenever the session object changed
  // (background refetch, invalidation after another save) and reset the form
  // to the SAVED values — silently throwing away the edits the applicant was
  // still typing on a slow connection. The form is seeded exactly once.
  const hydratedRef = useRef(false);
  // Autosave is switched on only after the form has been seeded, so the empty
  // initial state can never overwrite a stored in-progress copy.
  const [autosaveReady, setAutosaveReady] = useState(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    if (session?.personal) {
      hydratedRef.current = true;
      const p = session.personal;
      setForm({ ...EMPTY, ...p });
      if (session.applicant) {
        setNationality(session.applicant.nationality || p.nationality || "Pakistani");
        setCnic(session.applicant.cnic_formb || "");
      }
      if (p.date_of_birth) {
        const d = new Date(p.date_of_birth);
        if (!isNaN(d.getTime())) {
          setDobDay(String(d.getDate()));
          setDobMonth(MONTHS[d.getMonth()]);
          setDobYear(String(d.getFullYear()));
        }
      }
    } else if (session?.applicant) {
      hydratedRef.current = true;
      // New profile: prefill identity from the draft / session
      setNationality(session.applicant.nationality || "Pakistani");
      setCnic(session.applicant.cnic_formb || "");
      setForm((f) => ({
        ...f,
        mobile_number: session.applicant!.mobile || f.mobile_number,
        nationality: session.applicant!.nationality || "Pakistani",
      }));
      // Restore a half-filled form from this device (draft mode only).
      if (isDraft) {
        const w = getWip<{ form: PersonalProfileData; nationality: string; cnic: string; dobDay: string; dobMonth: string; dobYear: string }>("personal");
        if (w?.form) {
          setForm({ ...EMPTY, ...w.form });
          setNationality(w.nationality || "Pakistani");
          setCnic(w.cnic || "");
          setDobDay(w.dobDay || ""); setDobMonth(w.dobMonth || ""); setDobYear(w.dobYear || "");
          toast.success("Your unsaved progress was restored.", { id: "wip-restored" });
        }
      }
    }
    if (hydratedRef.current) setAutosaveReady(true);
  }, [session, isDraft]);

  // Autosave every change (debounced) while the applicant is mid-way.
  useEffect(() => {
    if (!autosaveReady || !isDraft) return;
    const t = setTimeout(() => setWip("personal", { form, nationality, cnic, dobDay, dobMonth, dobYear }), 400);
    return () => clearTimeout(t);
  }, [autosaveReady, isDraft, form, nationality, cnic, dobDay, dobMonth, dobYear]);

  const set = <K extends keyof PersonalProfileData>(k: K, v: PersonalProfileData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isMohmand = form.domicile_district === "Mohmand";

  // College-jurisdiction union councils (: district-dependent UC select,
  // Mohmand = 65 UCs Baizai-1 … Chamarkand)
  const { data: ucsData } = useQuery({
    queryKey: ["inter-ucs"],
    queryFn: () => interApi.ucsList() as Promise<unknown>,
    staleTime: ADMISSION_CLIENT_CACHE.ucsStaleMs,
    enabled: isMohmand,
  });
  const ucs = (Array.isArray(ucsData) ? ucsData : []) as InterUc[];

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!dobDay || !dobMonth || !dobYear) {
      toast.error("Please select your Date of Birth (day, month and year).");
      return;
    }
    const yr = Number(dobYear);
    if (!/^\d{4}$/.test(dobYear) || yr < 1950 || yr > new Date().getFullYear() - 10) {
      toast.error("Please enter a valid 4-digit birth year (e.g. 2008).");
      return;
    }
    const dob = `${dobYear}-${String(MONTHS.indexOf(dobMonth) + 1).padStart(2, "0")}-${dobDay.padStart(2, "0")}`;
    if (isDraft && cnic.replace(/\D/g, "").length !== 13) {
      toast.error("CNIC/Form-B Number Must Be 13 Digits And WithOut dashes(-) E.g 0000000000000");
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, date_of_birth: dob, nationality };
      // DRAFT (no account yet) → saved on this device only; nothing is sent to
      // the database until the final captcha-verified Submit.
      const res = (isDraft
        ? saveDraftPersonal(payload, { nationality, cnic })
        : await interApi.savePersonal(token!, payload as unknown as Record<string, unknown>)) as unknown as {
        ok?: boolean; error?: string;
      };
      if (res?.ok) {
        toast.success("Personal profile saved.");
        clearWip("personal");
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        await queryClient.invalidateQueries({ queryKey: ["inter-session"] });
        // DIRECT FLOW: after Personal Information go straight to the next
        // unfinished step — Matric profile, then the admission request.
        const hasApp = (session?.applications ?? []).some((a) => !["cancelled", "rejected"].includes(a.status));
        navigate(hasApp ? "/admission/portal" : session?.ssc ? "/admission/apply" : "/admission/ssc", { replace: true });
      } else {
        toast.error(res?.error || "Could not save your profile.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const F = "space-y-1.5 min-w-0";
  const inp = "h-11";

  // Session failed for network reasons (after retries) → retry card instead
  // of a form whose save would fail confusingly.
  if (netError && !session) {
    return (
      <PageLayout>
        <div className="container mx-auto max-w-xl px-4 py-12">
          <AdmissionBackBar to="/admission/portal" />
          <AdmissionSessionRetry
            what="your personal information"
            onRetry={refresh}
            backTo={{ to: "/admission/portal", label: "Back to Dashboard" }}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-3xl">
        <AdmissionBackBar to="/admission/portal" />
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <UserRound className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Personal Information</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isDraft ? "Required before you can apply. Saved on this device until you submit." : "Required before you can apply."}
              </p>
            </div>
            {session?.personal && (
              <BadgeCheck className="w-5 h-5 text-green-600 ml-auto shrink-0" />
            )}
          </div>
        </div>

        <Card className="border-border/80 shadow-card">
          <CardContent className="p-5 sm:p-7">
            {loading ? (
              <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 rounded-xl" />)}</div>
            ) : (
              <form onSubmit={handleSave} className="space-y-5">
                {/* Applicant identity — no account: nationality + own CNIC / Form-B */}
                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div>
                    <Label className="font-semibold text-[13px]">Nationality <span className="text-red-500">*</span></Label>
                    <div className="grid grid-cols-2 gap-2.5 mt-1.5">
                      {NATIONALITIES.map((n) => (
                        <button
                          key={n} type="button" disabled={!isDraft}
                          onClick={() => { setNationality(n); set("nationality", n); }}
                          className={`h-11 rounded-xl border-2 text-sm font-semibold transition-all disabled:cursor-not-allowed ${
                            nationality === n
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">
                      {nationality === "Pakistani" ? "Your CNIC/Form-B" : "Your Afghan Card / Passport Number"} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      inputMode="numeric" maxLength={13}
                      className={`${inp} font-mono tracking-wide`}
                      value={cnic}
                      onChange={(e) => setCnic(e.target.value.replace(/\D/g, "").slice(0, 13))}
                      placeholder={nationality === "Pakistani" ? "Enter CNIC Number WithOut Dashes(-)" : "Afghan Card | Passport Number WithOut dashes(-)"}
                      readOnly={!isDraft}
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {nationality === "Pakistani"
                        ? "CNIC Number Must Be 13 Digits And WithOut dashes(-) E.g 0000000000000"
                        : "Number WithOut dashes(-)"}
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Name <span className="text-red-500">*</span></Label>
                    <Input className={inp} maxLength={50} placeholder="Enter your name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Father Name <span className="text-red-500">*</span></Label>
                    <Input className={inp} maxLength={50} placeholder="Enter your father's name" value={form.father_name} onChange={(e) => set("father_name", e.target.value)} required />
                  </div>
                </div>

                {/* DOB — three selects */}
                <div className={F}>
                  <Label className="font-semibold text-[13px]">Date of Birth <span className="text-red-500">*</span></Label>
                  <div className="grid grid-cols-3 gap-2.5">
<Input
                      className={`${inp} font-mono`} inputMode="numeric" autoComplete="off"
                      maxLength={4} placeholder="Year"
                      value={dobYear}
                      onChange={(e) => setDobYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      aria-label="Year of birth"
                      required
                    />
                    <select className={`${inp} block w-full min-w-0 max-w-full truncate rounded-xl border border-input bg-background px-3 text-sm`} value={dobMonth} onChange={(e) => setDobMonth(e.target.value)} required>
                      <option value="">Month</option>
                      {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select className={`${inp} block w-full min-w-0 max-w-full truncate rounded-xl border border-input bg-background px-3 text-sm`} value={dobDay} onChange={(e) => setDobDay(e.target.value)} required>
                      <option value="">Day</option>
                      {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                {/* Gender */}
                <div className={F}>
                  <Label className="font-semibold text-[13px]">Gender <span className="text-red-500">*</span></Label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {GENDERS.map((g) => (
                      <button key={g.value} type="button" onClick={() => set("gender", g.value)}
                        className={`h-11 rounded-xl border-2 text-sm font-semibold transition-all ${
                          form.gender === g.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                        }`}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Mobile Number <span className="text-red-500">*</span></Label>
                    <Input className={`${inp} font-mono`} maxLength={11} placeholder="03451234567"
                      value={form.mobile_number}
                      onChange={(e) => set("mobile_number", e.target.value.replace(/\D/g, "").slice(0, 11))}
                      readOnly={!isDraft}
                      required />
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Landline Number</Label>
                    <Input className={inp} maxLength={10} placeholder="Enter Landline Number" value={form.landline_number} onChange={(e) => set("landline_number", e.target.value.replace(/\D/g, ""))} />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Email Address</Label>
                    <Input type="email" className={inp} placeholder="Enter email address" value={form.email_address} onChange={(e) => set("email_address", e.target.value)} />
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Religion <span className="text-red-500">*</span></Label>
                    <select className={`${inp} block w-full min-w-0 max-w-full truncate rounded-xl border border-input bg-background px-3 text-sm`} value={form.religion} onChange={(e) => set("religion", e.target.value)} required>
                      {RELIGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                {/* Domicile */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Domicile Province <span className="text-red-500">*</span></Label>
                    <select className={`${inp} block w-full min-w-0 max-w-full truncate rounded-xl border border-input bg-background px-3 text-sm`} value={form.domicile_province} onChange={(e) => set("domicile_province", e.target.value)} required>
                      {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Domicile District <span className="text-red-500">*</span></Label>
                    <select className={`${inp} block w-full min-w-0 max-w-full truncate rounded-xl border border-input bg-background px-3 text-sm`} value={form.domicile_district} onChange={(e) => set("domicile_district", e.target.value)} required>
                      {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Tehsil <span className="text-red-500">*</span></Label>
                    {isMohmand ? (
                      <select className={`${inp} block w-full min-w-0 max-w-full truncate rounded-xl border border-input bg-background px-3 text-sm`} value={form.tehsil} onChange={(e) => set("tehsil", e.target.value)} required>
                        <option value="">Select Tehsil</option>
                        {MOHMAND_TEHSILS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <Input className={inp} placeholder="Enter your tehsil" value={form.tehsil} onChange={(e) => set("tehsil", e.target.value)} required />
                    )}
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Union Council <span className="text-red-500">*</span></Label>
                    {isMohmand ? (
                      <select
                        className={`${inp} block w-full min-w-0 max-w-full truncate rounded-xl border border-input bg-background px-3 text-sm`}
                        value={form.union_council}
                        onChange={(e) => set("union_council", e.target.value)}
                        required
                      >
                        <option value="">Select Union Council</option>
                        {ucs.map((u) => (
                          <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                      </select>
                    ) : (
                      <Input className={inp} placeholder="Enter your union council"
                        value={form.union_council} onChange={(e) => set("union_council", e.target.value)} required />
                    )}
                  </div>
                </div>

                <div className={F}>
                  <Label className="font-semibold text-[13px]">Mailing Address <span className="text-red-500">*</span></Label>
                  <Textarea rows={2} placeholder="House / Street, Village, Tehsil, District" value={form.mailing_address} onChange={(e) => set("mailing_address", e.target.value)} required />
                </div>

                {/* Parents */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Father CNIC <span className="text-red-500">*</span></Label>
                    <Input className={`${inp} font-mono`} maxLength={13} placeholder="Father CNIC (13 digits, no dashes)"
                      value={form.father_cnic} onChange={(e) => set("father_cnic", e.target.value.replace(/\D/g, "").slice(0, 13))} required />
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Father Mobile <span className="text-red-500">*</span></Label>
                    <Input className={`${inp} font-mono`} maxLength={11} placeholder="03451234567"
                      value={form.father_mobile} onChange={(e) => set("father_mobile", e.target.value.replace(/\D/g, "").slice(0, 11))} required />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Mother Name <span className="text-red-500">*</span></Label>
                    <Input className={inp} placeholder="Mother Name" value={form.mother_name} onChange={(e) => set("mother_name", e.target.value)} required />
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Mother CNIC <span className="text-red-500">*</span></Label>
                    <Input className={`${inp} font-mono`} maxLength={13} placeholder="Mother CNIC (13 digits, no dashes)"
                      value={form.mother_cnic} onChange={(e) => set("mother_cnic", e.target.value.replace(/\D/g, "").slice(0, 13))} required />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Blood Group</Label>
                    <select className={`${inp} block w-full min-w-0 max-w-full truncate rounded-xl border border-input bg-background px-3 text-sm`} value={form.blood_group} onChange={(e) => set("blood_group", e.target.value)}>
                      <option value="">Select</option>
                      {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Hafiz e Quran</Label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[{ v: false, l: "No" }, { v: true, l: "Yes" }].map((o) => (
                        <button key={o.l} type="button" onClick={() => set("hafiz_e_quran", o.v)}
                          className={`h-11 rounded-xl border-2 text-sm font-semibold transition-all ${
                            form.hafiz_e_quran === o.v ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                          }`}>{o.l}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button type="submit" disabled={busy} className="h-10 flex-1 font-semibold">
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Personal Profile
                  </Button>
                  <Link to="/admission/portal" className="sm:w-auto">
                    <Button type="button" variant="outline" className="h-10 w-full sm:w-40 font-semibold">Back to Dashboard</Button>
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
