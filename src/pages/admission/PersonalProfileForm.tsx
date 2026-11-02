/**
 * PersonalProfileForm — mirrors HED student_personal_profile.php:
 * every field captured from the live system (name, father name, DOB via
 * day/month/year selects, gender radio, contact numbers, religion, domicile
 * province/district/tehsil/union council, parents' CNICs, mailing address,
 * blood group, hafiz e quran). Mobile number is locked (immutable, as HED).
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Save, UserRound, BadgeCheck } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { useInterSession } from "@/hooks/useInterAdmission";
import {
  interApi, PROVINCES, RELIGIONS, GENDERS, MOHMAND_TEHSILS, DISTRICTS,
  PersonalProfileData, InterUc,
} from "@/lib/interAdmission";

const YEARS: number[] = Array.from({ length: 26 }, (_, i) => 2012 - i);
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
  const { session, loading, token, refresh } = useInterSession();
  const [form, setForm] = useState<PersonalProfileData>(EMPTY);
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [busy, setBusy] = useState(false);

  // Hydrate from session (once)
  useEffect(() => {
    if (session?.personal) {
      const p = session.personal;
      setForm({ ...EMPTY, ...p });
      if (p.date_of_birth) {
        const d = new Date(p.date_of_birth);
        if (!isNaN(d.getTime())) {
          setDobDay(String(d.getDate()));
          setDobMonth(MONTHS[d.getMonth()]);
          setDobYear(String(d.getFullYear()));
        }
      }
    } else if (session?.applicant) {
      // New profile: prefill mobile + nationality from the account (locked fields)
      setForm((f) => ({
        ...f,
        mobile_number: session.applicant!.mobile,
        nationality: session.applicant!.nationality,
      }));
    }
  }, [session]);

  const set = <K extends keyof PersonalProfileData>(k: K, v: PersonalProfileData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isMohmand = form.domicile_district === "Mohmand";

  // College-jurisdiction union councils (HED: district-dependent UC select,
  // Mohmand = 65 UCs Baizai-1 … Chamarkand)
  const { data: ucsData } = useQuery({
    queryKey: ["inter-ucs"],
    queryFn: () => interApi.ucsList() as Promise<unknown>,
    staleTime: 24 * 60 * 60 * 1000,
    enabled: isMohmand,
  });
  const ucs = (Array.isArray(ucsData) ? ucsData : []) as InterUc[];

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!dobDay || !dobMonth || !dobYear) {
      toast.error("Please select your Date of Birth (day, month and year).");
      return;
    }
    const dob = `${dobYear}-${String(MONTHS.indexOf(dobMonth) + 1).padStart(2, "0")}-${dobDay.padStart(2, "0")}`;
    setBusy(true);
    try {
      const payload = { ...form, date_of_birth: dob };
      const res = (await interApi.savePersonal(token!, payload as unknown as Record<string, unknown>)) as unknown as {
        ok?: boolean; error?: string;
      };
      if (res?.ok) {
        toast.success("Personal profile saved.");
        refresh();
      } else {
        toast.error(res?.error || "Could not save your profile.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const F = "space-y-1.5";
  const inp = "h-11";

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-10 sm:py-12 max-w-3xl">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <UserRound className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Personal Information</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Complete your personal profile. It is required before you can apply.</p>
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

                {/* DOB — three selects like HED */}
                <div className={F}>
                  <Label className="font-semibold text-[13px]">Date of Birth <span className="text-red-500">*</span></Label>
                  <div className="grid grid-cols-3 gap-2.5">
                    <select className={`${inp} rounded-xl border border-input bg-background px-3 text-sm`} value={dobYear} onChange={(e) => setDobYear(e.target.value)} required>
                      <option value="">Year</option>
                      {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select className={`${inp} rounded-xl border border-input bg-background px-3 text-sm`} value={dobMonth} onChange={(e) => setDobMonth(e.target.value)} required>
                      <option value="">Month</option>
                      {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select className={`${inp} rounded-xl border border-input bg-background px-3 text-sm`} value={dobDay} onChange={(e) => setDobDay(e.target.value)} required>
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
                      readOnly={Boolean(session?.applicant)}
                      required />
                    {session?.applicant && <p className="text-[11px] text-muted-foreground">Locked. Your registered mobile number (used for fee payment and SMS alerts).</p>}
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
                    <select className={`${inp} rounded-xl border border-input bg-background px-3 text-sm`} value={form.religion} onChange={(e) => set("religion", e.target.value)} required>
                      {RELIGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                {/* Domicile */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Domicile Province <span className="text-red-500">*</span></Label>
                    <select className={`${inp} rounded-xl border border-input bg-background px-3 text-sm`} value={form.domicile_province} onChange={(e) => set("domicile_province", e.target.value)} required>
                      {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Domicile District <span className="text-red-500">*</span></Label>
                    <select className={`${inp} rounded-xl border border-input bg-background px-3 text-sm`} value={form.domicile_district} onChange={(e) => set("domicile_district", e.target.value)} required>
                      {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Tehsil <span className="text-red-500">*</span></Label>
                    {isMohmand ? (
                      <select className={`${inp} rounded-xl border border-input bg-background px-3 text-sm`} value={form.tehsil} onChange={(e) => set("tehsil", e.target.value)} required>
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
                        className={`${inp} rounded-xl border border-input bg-background px-3 text-sm`}
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
                    {isMohmand && <p className="text-[11px] text-muted-foreground">Union councils of District Mohmand (college jurisdiction). Select yours exactly as on your domicile.</p>}
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
                    <select className={`${inp} rounded-xl border border-input bg-background px-3 text-sm`} value={form.blood_group} onChange={(e) => set("blood_group", e.target.value)}>
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
                    <p className="text-[11px] text-muted-foreground">If Yes, 20 additional marks are added to your SSC percentage for merit.</p>
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
