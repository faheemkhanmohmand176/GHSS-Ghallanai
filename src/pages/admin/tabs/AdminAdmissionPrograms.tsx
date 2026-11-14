/**
 * AdminAdmissionPrograms — Programs & Seats control for the Inter admission
 * system (GHSS Ghallanai: exactly four faculties — Pre-Medical,
 * Pre-Engineering, ICS (Computer Sciences), Arts/Humanities; Intermediate
 * only, no BS/ADP/D.Com/DIT).
 *
 * Seats are editable per program (inter_admin_set_program) and a faculty can
 * be temporarily closed for admission (is_active) — e.g. when seats are full.
 * The faculty list itself is fixed by migration 20 and never editable here.
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Landmark, Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";

interface InterProgram {
  id: number; name: string; study_level: string; seats: number;
  allowed_gender: string; is_active?: boolean;
  subject_groups?: Array<{ id: number; name: string }>;
}

export default function AdminAdmissionPrograms() {
  const qc = useQueryClient();
  const [draftSeats, setDraftSeats] = useState<Record<number, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["inter-admin-programs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inter_programs_list", {
        p_include_inactive: true,   // admin sees closed faculties too
      });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as InterProgram[];
    },
    staleTime: 60 * 1000,
  });

  const programs = data ?? [];

  // Seed the editable seats draft whenever the list loads
  useEffect(() => {
    if (programs.length) {
      setDraftSeats(Object.fromEntries(programs.map((p) => [p.id, p.seats])));
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async ({ id, seats }: { id: number; seats: number }) => {
      const { data, error } = await supabase.rpc("inter_admin_set_program", {
        p_program_id: id, p_seats: seats,
      });
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string };
      if (d?.ok === false) throw new Error(d?.error || "Save failed.");
      return d;
    },
    onSuccess: () => {
      toast.success("Seats updated.");
      qc.invalidateQueries({ queryKey: ["inter-admin-programs"] });
      qc.invalidateQueries({ queryKey: ["inter-programs"] });
      qc.invalidateQueries({ queryKey: ["inter-programs-public"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const { data, error } = await supabase.rpc("inter_admin_set_program", {
        p_program_id: id, p_is_active: active,
      });
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string };
      if (d?.ok === false) throw new Error(d?.error || "Update failed.");
      return d;
    },
    onSuccess: (_d, v) => {
      toast.success(v.active ? "Program re-opened for admission." : "Program closed for admission.");
      qc.invalidateQueries({ queryKey: ["inter-admin-programs"] });
      qc.invalidateQueries({ queryKey: ["inter-programs"] });
      qc.invalidateQueries({ queryKey: ["inter-programs-public"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <Card className="border-border/80">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[760px]">
                <thead className="bg-muted/60 border-b border-border">
                  <tr>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Faculty (Program)</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Level</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Subject Group(s)</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Seats</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Open for Admission</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((p) => {
                    const seats = draftSeats[p.id] ?? p.seats;
                    const dirty = seats !== p.seats;
                    return (
                      <tr key={p.id} className="border-b border-border/60 hover:bg-muted/30">
                        <td className="text-center align-middle px-4 py-3">
                          <div className="flex items-center justify-center gap-2.5">
                            <Landmark className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-semibold text-foreground">{p.name}</span>
                            {p.is_active === false && (
                              <Badge variant="secondary" className="bg-red-500/10 text-red-600">Closed</Badge>
                            )}
                          </div>
                        </td>
                        <td className="text-center align-middle px-4 py-3 text-muted-foreground">{p.study_level}</td>
                        <td className="text-center align-middle px-4 py-3 text-[12px] text-muted-foreground min-w-[200px]">
                          {(p.subject_groups ?? []).length === 0 ? "N/A" : (p.subject_groups ?? []).map((g) => (
                            <span key={g.id} className="block" title={g.name}>{g.name}</span>
                          ))}
                        </td>
                        <td className="text-center align-middle px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Input
                              type="number" min={0} max={10000}
                              value={seats}
                              onChange={(e) => setDraftSeats((s) => ({ ...s, [p.id]: Number(e.target.value) || 0 }))}
                              className="h-9 w-24"
                              aria-label={`Seats for ${p.name}`}
                            />
                            {dirty && (
                              <Button size="sm" className="h-8 text-xs font-semibold"
                                disabled={save.isPending}
                                onClick={() => save.mutate({ id: p.id, seats })}>
                                {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Save
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="text-center align-middle px-4 py-3">
                          <div className="inline-flex items-center justify-center gap-2.5">
                            <Switch
                              checked={p.is_active !== false}
                              onCheckedChange={(checked) => toggleActive.mutate({ id: p.id, active: checked })}
                              disabled={toggleActive.isPending}
                              aria-label={`Toggle admission for ${p.name}`}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
