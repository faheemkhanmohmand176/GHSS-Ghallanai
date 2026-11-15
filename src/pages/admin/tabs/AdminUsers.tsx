import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Plus, Trash2, Loader2, Users, ShieldCheck, Phone, UserCog, KeyRound, LogOut, ChevronDown, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";

// ─── UserAvatar (extracted to avoid hook-in-loop) ──────────────────────
function UserAvatar({ imgUrl, fullName }: { imgUrl: string | null; fullName: string }) {
  const [imgError, setImgError] = useState(false);
  return imgUrl && !imgError ? (
    <img src={imgUrl} alt={`${fullName}'s avatar`} className="w-10 h-10 rounded-full object-cover ring-1 ring-border shrink-0" onError={() => setImgError(true)} loading="lazy" decoding="async" />
  ) : (
    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary ring-1 ring-border flex items-center justify-center text-sm font-semibold shrink-0">
      {fullName.charAt(0).toUpperCase()}
    </div>
  );
}

interface UserProfile {
  id: string;
  full_name: string | null;
  role: string;
  class: string | null;
  phone: string | null;
  roll_number: string | null;
  avatar_url: string | null;
  created_at: string;
}

// This screen manages ADMINISTRATORS only. Every account added here is an
// admin, and only admin accounts are listed — students and teachers are not
// managed from here (students sign up / are handled elsewhere).
const ADMIN_ROLE = "admin";

const AdminUsers = () => {
  const qc = useQueryClient();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // Add user modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [adding, setAdding] = useState(false);

  // My-account menu (change password / sign out)
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [outOpen, setOutOpen] = useState(false);

  const friendly = (msg?: string) =>
    /rate limit/i.test(msg || "") ? "Too many email requests right now. Please wait a few minutes and try again." : (msg || "Something went wrong");

  // Changed on the server (after verifying the current password) because the
  // browser-side updateUser() fails with "AAL2 session is required" on
  // accounts that still have an authenticator (MFA) factor enrolled.
  const changePassword = async () => {
    if (!pw.current) return toast.error("Enter your current password");
    if (pw.next.length < 12) return toast.error("New password must be at least 12 characters");
    if (pw.next !== pw.confirm) return toast.error("Passwords do not match");
    setPwBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { toast.error("Session expired. Please sign in again."); return; }
      const res = await fetch("/api/auth-gateway?action=admin-change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: pw.current, new_password: pw.next }),
      });
      let out: any = null;
      try { out = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok || !out?.ok) { toast.error(out?.error || "Could not change the password"); return; }
      toast.success("Password changed successfully");
      setPwOpen(false); setPw({ current: "", next: "", confirm: "" });
    } catch (e: any) { toast.error(e?.message || "Something went wrong"); }
    finally { setPwBusy(false); }
  };

  const doSignOut = async () => { await signOut(); navigate("/"); };

  // ── Fetch administrators only (rejected accounts excluded) ──
  const { data: users = [], isLoading } = useQuery<UserProfile[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Primary: read through the server (service role) so every admin shows
      // up regardless of row-level-security claims on this browser's token.
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (token) {
          const res = await fetch("/api/auth-gateway?action=admin-list", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: "{}",
          });
          const out = await res.json();
          if (res.ok && out?.ok && Array.isArray(out.rows)) return out.rows as UserProfile[];
        }
      } catch { /* fall back to the direct read below */ }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", ADMIN_ROLE)
        .not("status", "eq", "rejected")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Delete user ──────────────────────────────────────────────────────────
  // Calls the admin_delete_user RPC which deletes from auth.users (cascades
  // to profiles). This frees up the email for re-registration.
  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_delete_user", { target_user_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User permanently deleted — email is now free for re-registration");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-teachers"] });
      qc.invalidateQueries({ queryKey: ["admin-pending-users"] });
    },
    onError: (err: any) => {
      // Surface the actual error message — could be "Permission denied",
      // "Cannot delete your own account", or a missing-function error.
      const msg = err?.message || "Delete failed";
      toast.error(`Delete failed: ${msg}`, { duration: 6000 });
    },
  });

  // ── Add new administrator ────────────────────────────────────────────────
  // IMPORTANT: the account is created with a TEMPORARY, non-persistent
  // Supabase client. Calling supabase.auth.signUp() on the main client
  // signs the browser into the newly created account (replacing the current
  // admin's session) — that was the "I get logged in as the user I just
  // added" bug. The throwaway client never touches the stored session, so
  // the current admin stays logged in. The profile is then promoted with the
  // admin's own (main) client, which is allowed to update profiles.
  const handleAddUser = async () => {
    const fullName = addForm.full_name.trim();
    const email = addForm.email.trim();
    if (!fullName || !email || !addForm.password.trim()) {
      toast.error("Name, email, and password are required");
      return;
    }
    if (addForm.password.length < 12) {
      toast.error("Password must be at least 12 characters");
      return;
    }

    setAdding(true);
    try {
      // Created on the server with the Auth admin API (email pre-confirmed):
      // no confirmation e-mail is sent, so Supabase's e-mail rate limit can
      // never block adding an admin, and your own session is untouched.
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { toast.error("Session expired. Please sign in again."); return; }

      const res = await fetch("/api/auth-gateway?action=admin-create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ full_name: fullName, email, password: addForm.password, phone: addForm.phone.trim() }),
      });
      let out: any = null;
      try { out = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok || !out?.ok) {
        toast.error(`Failed: ${friendly(out?.error) || "server error"}`);
        return;
      }
      if (!out.promoted) {
        toast.error("Account created, but it could not be made an admin yet. Refresh and check the list.", { duration: 7000 });
      } else {
        toast.success(`✅ Admin "${fullName}" added — you are still logged in as yourself`);
        setAddOpen(false);
        setAddForm({ full_name: "", email: "", password: "", phone: "" });
      }
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast.error(err?.message || "Something went wrong");
    } finally {
      setAdding(false);
    }
  };

  // ── Filter admins by search ──────────────────────────────────────────────
  const filtered = users.filter(u => {
    const q = search.trim().toLowerCase();
    return !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.phone?.includes(search.trim());
  });

  const adminBadge = (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
      <ShieldCheck className="w-3 h-3" /> Admin
    </span>
  );

  const youPill = (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">You</span>
  );

  const renderRemove = (u: UserProfile) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full shadow-none text-muted-foreground hover:text-destructive" aria-label="Remove admin">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {u.full_name || "this admin"}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will <strong>permanently delete</strong> {u.full_name || "this admin"}'s account completely. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-9 flex-1 rounded-full px-4 text-xs font-semibold shadow-none sm:flex-none">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteUser.mutate(u.id)}
            className="h-9 flex-1 rounded-full bg-destructive px-4 text-xs font-semibold text-destructive-foreground shadow-none hover:bg-destructive/90 sm:flex-none"
          >
            Remove Admin
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="space-y-4 pb-20 md:pb-0">

      {/* ── Premium header + action toolbar ────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm sm:p-4">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -left-12 -bottom-12 h-28 w-28 rounded-full bg-[hsl(43_89%_58%)]/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20">
            <UserCog className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-heading font-bold leading-tight tracking-tight text-foreground sm:text-xl">Manage Admins</h2>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-sm">
              <span className="font-semibold text-foreground">{users.length}</span> administrator{users.length === 1 ? "" : "s"} · add or remove admin accounts
            </p>
          </div>
          <div className="shrink-0 self-start">
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button type="button" aria-label="Account menu"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gold/50 bg-gradient-to-b from-white to-[hsl(45_80%_95%)] py-1 pl-1 pr-2.5 text-[12px] font-semibold text-[hsl(158_45%_14%)] shadow-[0_6px_14px_-10px_hsl(38_70%_40%/.7)] transition-all active:scale-95 dark:from-card dark:to-gold/10 dark:text-foreground">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-[11px] font-bold text-primary-foreground">
                    {(users.find(u => u.id === user?.id)?.full_name || user?.email || "A").charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline">Account</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-[hsl(36_75%_36%)] transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-60 overflow-hidden rounded-2xl border border-gold/40 p-0 shadow-[0_24px_50px_-24px_hsl(var(--primary)/.55)]">
                <div className="border-b border-border/60 bg-gradient-to-b from-[hsl(45_90%_95%)] to-card px-3.5 py-3 dark:from-gold/10">
                  <p className="truncate text-[13px] font-bold text-foreground">{users.find(u => u.id === user?.id)?.full_name || "Administrator"}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
                </div>
                <div className="p-1.5">
                  <button type="button" onClick={() => { setMenuOpen(false); setPwOpen(true); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold text-foreground transition-colors hover:bg-secondary">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-gold/35 bg-gradient-to-b from-[hsl(46_96%_91%)] to-[hsl(42_85%_82%)] text-[hsl(36_75%_32%)]"><KeyRound className="h-3.5 w-3.5" /></span>
                    Change Password
                  </button>
                  <button type="button" onClick={() => { setMenuOpen(false); setOutOpen(true); }}
                    className="mt-0.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold text-destructive transition-colors hover:bg-destructive/10">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10"><LogOut className="h-3.5 w-3.5" /></span>
                    Sign out
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="relative mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 sm:flex sm:flex-wrap">
          <Button onClick={() => setAddOpen(true)} className="col-span-2 h-9 min-w-0 gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-none hover:bg-primary/90 sm:col-span-1">
            <Plus className="h-3.5 w-3.5 shrink-0" /> Add Admin
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search name or phone"
          className="h-10 rounded-full border-border/60 bg-card pl-10 text-sm shadow-none"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card py-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold text-sm text-foreground">No admins found</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different search or add a new admin</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(u => {
              const isSelf = u.id === user?.id;
              return (
                <div key={u.id} className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <UserAvatar imgUrl={u.avatar_url} fullName={u.full_name || "User"} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground leading-snug break-words">{u.full_name || "—"}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {adminBadge}
                        {isSelf && youPill}
                      </div>
                    </div>
                    {!isSelf && renderRemove(u)}
                  </div>
                  <div className="mt-2.5 pt-2.5 border-t border-border/70 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone || "No phone"}</span>
                    <span>Joined {format(new Date(u.created_at), "dd MMM yyyy")}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-4 py-2.5">Admin</th>
                  <th className="text-left px-3 py-2.5">Role</th>
                  <th className="text-left px-3 py-2.5">Phone</th>
                  <th className="text-left px-3 py-2.5">Joined</th>
                  <th className="w-16 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const isSelf = u.id === user?.id;
                  return (
                    <tr key={u.id} className="border-t border-border/50 transition-colors hover:bg-primary/5">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <UserAvatar imgUrl={u.avatar_url} fullName={u.full_name || "User"} />
                          <span className="font-medium text-foreground">{u.full_name || "—"}</span>
                          {isSelf && youPill}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{adminBadge}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{u.phone || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(u.created_at), "dd MMM yyyy")}</td>
                      <td className="px-3 py-2.5"><div className="flex justify-end">{!isSelf && renderRemove(u)}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {/* Count */}
      <p className="text-[11px] text-muted-foreground text-center">
        Showing {filtered.length} of {users.length} admins
      </p>

      {/* Add User Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md rounded-2xl p-5 gap-3">
          <DialogHeader>
            <DialogTitle className="text-base">Add New Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Full Name *</Label>
              <Input
                className="h-9 text-sm mt-1"
                value={addForm.full_name}
                onChange={e => setAddForm(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Admin full name"
              />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input
                className="h-9 text-sm mt-1"
                type="email"
                value={addForm.email}
                onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
                placeholder="admin@gmail.com"
              />
            </div>
            <div>
              <Label className="text-xs">Password * (min 12 characters, mixed case, number, symbol)</Label>
              <Input
                className="h-9 text-sm mt-1"
                type="password"
                value={addForm.password}
                onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                className="h-9 text-sm mt-1"
                value={addForm.phone}
                onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="0300-0000000"
              />
            </div>
            <p className="text-[11px] text-muted-foreground rounded-xl bg-secondary/40 border border-border px-3 py-2 leading-relaxed">
              Role: <strong>Administrator</strong> (automatic). You will stay logged in to your own account.
            </p>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" className="h-9 min-w-0 flex-1 whitespace-nowrap rounded-full border-border/60 px-4 text-xs font-semibold shadow-none sm:flex-none" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={adding} className="h-9 min-w-0 flex-1 gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-none hover:bg-primary/90 sm:flex-none">
              {adding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {adding ? "Adding..." : "Add Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Change Password */}
      <Dialog open={pwOpen} onOpenChange={(o) => { setPwOpen(o); if (!o) { setPw({ current: "", next: "", confirm: "" }); setShowPw(false); } }}>
        <DialogContent className="max-w-sm rounded-2xl p-5 gap-3">
          <DialogHeader><DialogTitle className="text-base">Change Password</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Current password</Label>
              <Input className="mt-1 h-9 text-sm" type={showPw ? "text" : "password"} autoComplete="current-password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} placeholder="••••••••" /></div>
            <div><Label className="text-xs">New password (min 12 characters, mixed case, number, symbol)</Label>
              <Input className="mt-1 h-9 text-sm" type={showPw ? "text" : "password"} autoComplete="new-password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} placeholder="••••••••" /></div>
            <div><Label className="text-xs">Confirm new password</Label>
              <Input className="mt-1 h-9 text-sm" type={showPw ? "text" : "password"} autoComplete="new-password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} placeholder="••••••••" /></div>
            <button type="button" onClick={() => setShowPw(v => !v)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
              {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{showPw ? "Hide passwords" : "Show passwords"}
            </button>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" className="h-9 flex-1 rounded-full px-4 text-xs font-semibold shadow-none sm:flex-none" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={changePassword} disabled={pwBusy} className="h-9 flex-1 gap-1.5 rounded-full px-4 text-xs font-semibold shadow-none sm:flex-none">
              {pwBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{pwBusy ? "Saving..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign out */}
      <AlertDialog open={outOpen} onOpenChange={setOutOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>You will be signed out of the admin dashboard on this device.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 flex-1 rounded-full px-4 text-xs font-semibold shadow-none sm:flex-none">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doSignOut} className="h-9 flex-1 rounded-full bg-destructive px-4 text-xs font-semibold text-destructive-foreground shadow-none hover:bg-destructive/90 sm:flex-none">Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
