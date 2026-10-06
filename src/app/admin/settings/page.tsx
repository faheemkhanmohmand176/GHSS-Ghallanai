import { Save, School, User, Palette, MapPin, Calendar, Upload, Info } from "lucide-react";
import { AdminTitle, AdminDemoBanner } from "@/components/admin/admin-shell";
import { PageContainer, SectionCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { SITE } from "@/content/site";

export default function AdminSettingsPage() {
  return (
    <PageContainer>
      <AdminDemoBanner />
      <AdminTitle
        title="School Settings"
        desc="The institution's identity, principal, branding and academic calendar. Changes write to the settings table and propagate across every public page within 60 seconds."
        actions={
          <Button className="h-11 rounded-full font-semibold">
            <Save className="mr-1.5 h-4 w-4" aria-hidden /> Save Changes
          </Button>
        }
      />

      <form action="/api/admin/settings" method="post" className="space-y-5">
        {/* School Identity */}
        <SectionCard
          title="School Identity"
          description="The institution's name, contact details and EMIS code"
          actions={<School className="h-5 w-5 text-primary" aria-hidden />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="School Name (English)"
              name="name"
              defaultValue={SITE.fullName}
            />
            <Field
              label="School Name (Urdu)"
              name="urduName"
              defaultValue={SITE.urduName}
              dir="rtl"
            />
            <Field
              label="Tagline"
              name="tagline"
              defaultValue={SITE.tagline}
            />
            <Field
              label="EMIS Code"
              name="emis"
              defaultValue=""
              placeholder="e.g. 5214-XXXXX"
            />
            <div className="sm:col-span-2">
              <Field
                label="Address"
                name="address"
                defaultValue={SITE.address}
              />
            </div>
            <Field
              label="Phone"
              name="phone"
              defaultValue={SITE.phone}
            />
            <Field
              label="Email"
              name="email"
              type="email"
              defaultValue={SITE.email}
            />
            <Field
              label="WhatsApp Number"
              name="whatsapp"
              defaultValue={SITE.whatsapp}
              hint="International format, no +"
            />
            <Field
              label="Office Hours"
              name="officeHours"
              defaultValue={SITE.officeHours}
            />
          </div>
        </SectionCard>

        {/* Principal */}
        <SectionCard
          title="Principal"
          description="The head of the institution — name, message and photograph"
          actions={<User className="h-5 w-5 text-primary" aria-hidden />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Principal Name"
              name="principalName"
              defaultValue="Principal"
              placeholder="Full name"
            />
            <Field
              label="Title"
              name="principalTitle"
              defaultValue="Principal, GHSS Ghallanai"
            />
            <div className="sm:col-span-2">
              <Label htmlFor="principalMessage" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Principal's Message
              </Label>
              <Textarea
                id="principalMessage"
                name="principalMessage"
                rows={5}
                defaultValue="Assalam-o-Alaikum. On behalf of the students, teachers and staff of Government Higher Secondary School Ghallanai, I welcome you to our school and to this website."
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Principal Photograph
              </Label>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
                  <User className="h-8 w-8 text-muted-foreground" aria-hidden />
                </div>
                <Button type="button" variant="outline" className="h-11 rounded-full">
                  <Upload className="mr-1.5 h-4 w-4" aria-hidden /> Upload Photo
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Branding */}
        <SectionCard
          title="Branding"
          description="Institutional colours and logo"
          actions={<Palette className="h-5 w-5 text-primary" aria-hidden />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="primaryColor" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Primary Colour (Institutional Green)
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="primaryColor"
                  name="primaryColor"
                  defaultValue="#14532D"
                  className="h-11 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
                />
                <Input
                  name="primaryColorText"
                  defaultValue="#14532D"
                  className="h-11 font-mono"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="accentColor" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Accent Colour (Honour Gold)
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="accentColor"
                  name="accentColor"
                  defaultValue="#b8860b"
                  className="h-11 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
                />
                <Input
                  name="accentColorText"
                  defaultValue="#b8860b"
                  className="h-11 font-mono"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                School Logo / Crest
              </Label>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-secondary">
                  <School className="h-8 w-8 text-primary" aria-hidden />
                </div>
                <Button type="button" variant="outline" className="h-11 rounded-full">
                  <Upload className="mr-1.5 h-4 w-4" aria-hidden /> Upload Logo
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Recommended: SVG or PNG with transparent background, 512×512 minimum.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Location */}
        <SectionCard
          title="Location"
          description="Geo-coordinates for the map embed and directions"
          actions={<MapPin className="h-5 w-5 text-primary" aria-hidden />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Latitude"
              name="lat"
              defaultValue={String(SITE.geo.lat)}
              type="number"
              step="0.0001"
            />
            <Field
              label="Longitude"
              name="lng"
              defaultValue={String(SITE.geo.lng)}
              type="number"
              step="0.0001"
            />
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Map Embed Preview
              </Label>
              <div className="overflow-hidden rounded-xl border border-border">
                <iframe
                  title="Map preview"
                  src={`https://www.google.com/maps?q=${SITE.geo.lat},${SITE.geo.lng}&z=14&output=embed`}
                  className="h-64 w-full"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Academic Session */}
        <SectionCard
          title="Academic Session"
          description="The current academic year and its key term dates"
          actions={<Calendar className="h-5 w-5 text-primary" aria-hidden />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Session Year"
              name="sessionYear"
              defaultValue={SITE.session}
            />
            <Field
              label="Board"
              name="board"
              defaultValue={SITE.board}
            />
            <Field
              label="Session Start Date"
              name="sessionStart"
              type="date"
              defaultValue="2026-12-01"
            />
            <Field
              label="Session End Date"
              name="sessionEnd"
              type="date"
              defaultValue="2027-05-31"
            />
            <Field
              label="Admissions Open"
              name="admissionsOpen"
              type="date"
              defaultValue={SITE.admissionStatus.open ? "2026-10-01" : ""}
            />
            <Field
              label="Admissions Deadline"
              name="admissionsDeadline"
              type="date"
              defaultValue={SITE.admissionStatus.deadline}
            />
          </div>

          <Separator className="my-5" />

          <div className="flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-strong" aria-hidden />
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">Note:</span> Settings changes are audit-logged and
              reflected on the public site within 60 seconds. The EMIS code and board affiliation details are shown
              in the footer of every public page.
            </p>
          </div>
        </SectionCard>

        {/* Footer save bar */}
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <p className="text-xs text-muted-foreground">
            Changes are staged until you press <span className="font-semibold text-foreground">Save Changes</span>.
          </p>
          <div className="flex gap-2">
            <Button type="reset" variant="outline" className="h-11 rounded-full">
              Reset
            </Button>
            <Button type="submit" className="h-11 rounded-full font-semibold">
              <Save className="mr-1.5 h-4 w-4" aria-hidden /> Save Changes
            </Button>
          </div>
        </div>
      </form>
    </PageContainer>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  step,
  hint,
  dir,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  step?: string;
  hint?: string;
  dir?: "rtl" | "ltr";
}) {
  return (
    <div>
      <Label htmlFor={name} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-11"
        dir={dir}
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
