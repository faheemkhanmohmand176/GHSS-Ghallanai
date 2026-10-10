"use client";

import { useEffect, useState } from "react";
import { Save, RotateCcw, Building2, Phone, BarChart3, MapPin, ImageIcon, UserRound, CheckCircle2 } from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabaseBrowser } from "@/lib/auth";
import { DEMO_SETTINGS, type SchoolSettingsRow } from "@/content/demo-content";

/**
 * College Setting — the single school_settings row (id = 1) driving the
 * homepage, header, footer and public pages. Six numbered sections like
 * Babi Khel: Identity, Registration & Contact, Public Statistics, Location,
 * Branding, Principal — plus the Admission window.
 */
export default function AdminSettingsPage() {
  const [form, setForm] = useState<SchoolSettingsRow>(DEMO_SETTINGS);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const sb = supabaseBrowser();
      if (!sb) {
        setLoaded(true);
        return;
      }
      sb.from("school_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
        if (data) setForm({ ...DEMO_SETTINGS, ...(data as SchoolSettingsRow) });
        setLoaded(true);
      });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function set<K extends keyof SchoolSettingsRow>(key: K, value: SchoolSettingsRow[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const sb = supabaseBrowser();
    if (sb) {
      const { id, ...payload } = form;
      void id;
      const { error } = await sb
        .from("school_settings")
        .upsert({ id: 1, ...payload, updated_at: new Date().toISOString() });
      if (error) {
        toast({ title: "Could not save", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    setDirty(false);
    setSaving(false);
    toast({
      title: "Settings saved",
      description: "The public site reflects these values within a minute (ISR).",
    });
  }

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="College Setting"
        desc="One structured row behind the whole public site — identity, contact, statistics, location, branding, principal and the admission window. Changes audit-log and propagate via ISR."
        actions={
          <div className="flex items-center gap-2">
            {dirty && (
              <Button
                variant="outline"
                onClick={() => {
                  setForm(DEMO_SETTINGS);
                  setDirty(false);
                }}
                className="button-press h-10 rounded-full"
              >
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden /> Discard
              </Button>
            )}
            <Button
              onClick={save}
              disabled={!dirty || saving}
              className="button-press h-10 rounded-full font-bold"
            >
              <Save className="mr-1.5 h-4 w-4" aria-hidden />
              {saving ? "Saving…" : dirty ? "Save all changes" : "Saved"}
            </Button>
          </div>
        }
      />

      {!loaded && <p className="mb-4 text-xs text-muted-foreground">Loading settings…</p>}

      <div className="grid gap-5 xl:grid-cols-2">
        {/* 01 Identity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">01</span>
              <Building2 className="h-4 w-4 text-primary" aria-hidden /> Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="School name" value={form.school_name} onChange={(v) => set("school_name", v)} />
            <Field label="Tagline" value={form.tagline} onChange={(v) => set("tagline", v)} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-small font-semibold">Short description (homepage hero)</Label>
                <span className="text-[0.65rem] text-muted-foreground">{(form.description ?? "").length}/300</span>
              </div>
              <Textarea
                rows={3}
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value.slice(0, 300))}
                placeholder="One sentence families read first…"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">About text (About page)</Label>
              <Textarea rows={4} value={form.about_text ?? ""} onChange={(e) => set("about_text", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* 02 Registration & Contact */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">02</span>
              <Phone className="h-4 w-4 text-primary" aria-hidden /> Registration &amp; Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="EMIS code" value={form.emis_code ?? ""} onChange={(v) => set("emis_code", v)} />
            <Field label="Established year" type="number" value={form.established_year?.toString() ?? ""} onChange={(v) => set("established_year", num(v) as number | null)} />
            <Field label="Phone" value={form.phone ?? ""} onChange={(v) => set("phone", v)} placeholder="+92-XXX-XXXXXXX" />
            <Field label="Email" type="email" value={form.email ?? ""} onChange={(v) => set("email", v)} />
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-small font-semibold">Postal address</Label>
              <Textarea rows={2} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* 03 Public Statistics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">03</span>
              <BarChart3 className="h-4 w-4 text-primary" aria-hidden /> Public statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Total students" type="number" value={form.total_students?.toString() ?? ""} onChange={(v) => set("total_students", num(v) as number | null)} />
            <Field label="Total teachers" type="number" value={form.total_teachers?.toString() ?? ""} onChange={(v) => set("total_teachers", num(v) as number | null)} />
            <Field label="Board pass rate (%)" type="number" value={form.pass_percentage?.toString() ?? ""} onChange={(v) => set("pass_percentage", num(v) as number | null)} />
            <Field label="Board results grade" value={form.board_results ?? ""} onChange={(v) => set("board_results", v)} placeholder="A+" />
            <p className="text-xs text-muted-foreground sm:col-span-2">
              These figures feed the homepage statistics band (odometer counters).
            </p>
          </CardContent>
        </Card>

        {/* 04 Location */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">04</span>
              <MapPin className="h-4 w-4 text-primary" aria-hidden /> Location
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Latitude" type="number" value={form.location_lat?.toString() ?? ""} onChange={(v) => set("location_lat", num(v) as number | null)} placeholder="34.5269" />
            <Field label="Longitude" type="number" value={form.location_lng?.toString() ?? ""} onChange={(v) => set("location_lng", num(v) as number | null)} placeholder="71.4567" />
            <Button
              variant="outline"
              className="button-press h-10 rounded-full sm:col-span-2"
              onClick={() => {
                navigator.geolocation?.getCurrentPosition(
                  (pos) => {
                    set("location_lat", Number(pos.coords.latitude.toFixed(6)));
                    set("location_lng", Number(pos.coords.longitude.toFixed(6)));
                    toast({ title: "Location captured from this device" });
                  },
                  () => toast({ title: "Could not read location", variant: "destructive" })
                );
              }}
            >
              <MapPin className="mr-1.5 h-4 w-4" aria-hidden /> Use my device location
            </Button>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              The contact page links out to Google Maps with these coordinates — no heavy map
              library on low bandwidth.
            </p>
          </CardContent>
        </Card>

        {/* 05 Branding */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">05</span>
              <ImageIcon className="h-4 w-4 text-primary" aria-hidden /> Branding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Logo URL (square)" value={form.logo_url ?? ""} onChange={(v) => set("logo_url", v)} placeholder="https://…/logo.png" />
            <Field label="Campus banner URL (16:7, homepage)" value={form.banner_url ?? ""} onChange={(v) => set("banner_url", v)} placeholder="https://…/banner.jpg" />
            <p className="text-xs text-muted-foreground">
              Paste any hosted image URL (Cloudinary, Supabase Storage, your CDN). The campus banner
              section appears on the homepage only when a URL is set.
            </p>
          </CardContent>
        </Card>

        {/* 06 Principal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">06</span>
              <UserRound className="h-4 w-4 text-primary" aria-hidden /> Principal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Principal name" value={form.principal_name ?? ""} onChange={(v) => set("principal_name", v)} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-small font-semibold">Principal&apos;s message</Label>
                <span className="text-[0.65rem] text-muted-foreground">{(form.principal_message ?? "").length}/600</span>
              </div>
              <Textarea
                rows={4}
                value={form.principal_message ?? ""}
                onChange={(e) => set("principal_message", e.target.value.slice(0, 600))}
              />
            </div>
            <Field label="Principal photo URL (4:5)" value={form.principal_photo_url ?? ""} onChange={(v) => set("principal_photo_url", v)} />
          </CardContent>
        </Card>

        {/* 07 Admission window */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">07</span>
              <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> Admission window
            </CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-4">
              <span className="text-small font-semibold">
                Admissions open
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  Drives the homepage CTA, the header ribbon and the apply gate
                </span>
              </span>
              <Switch checked={form.admission_open} onCheckedChange={(v) => set("admission_open", v)} aria-label="Toggle admissions open" />
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Session year" value={form.admission_session} onChange={(v) => set("admission_session", v)} placeholder="2026-27" />
              <Field label="Last date" type="date" value={form.admission_deadline ?? ""} onChange={(v) => set("admission_deadline", v)} />
              <Field label="Banner message" value={form.admission_banner ?? ""} onChange={(v) => set("admission_banner", v)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminChrome>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-small font-semibold">{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11"
      />
    </div>
  );
}
