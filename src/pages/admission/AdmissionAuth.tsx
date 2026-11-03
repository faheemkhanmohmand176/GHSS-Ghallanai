/**
 * AdmissionAuth — applicant Create Account and Login
 *, with the math captcha and the 4-step wizard
 * indicator:
 *   1 Create Account → 2 Board Verification → 3 Personal Information → 4 Academic Information
 */

import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { UserPlus, LogIn, Loader2 } from "lucide-react";
import AdmissionBackBar from "@/components/shared/AdmissionBackBar";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";
import AdmissionStepper from "@/components/shared/AdmissionStepper";
import { interApi, setToken, makeMathCaptcha, NATIONALITIES } from "@/lib/interAdmission";

function WizardSteps({ current }: { current: number }) {
  return <AdmissionStepper current={current} steps={["Account", "Board Check", "Personal", "Academic"]} />;
}

export default function AdmissionAuth() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const mode = pathname.endsWith("/login") || params.get("mode") === "login" ? "login" : "register";
  const navigate = useNavigate();

  // register state
  const [nationality, setNationality] = useState<string>("Pakistani");
  const [cnic, setCnic] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confPassword, setConfPassword] = useState("");
  // login state
  const [loginId, setLoginId] = useState("");
  // shared
  const [captchaInput, setCaptchaInput] = useState("");
  const [busy, setBusy] = useState(false);
  const captcha = useMemo(() => makeMathCaptcha(), [mode]);

  useEffect(() => { setCaptchaInput(""); }, [mode]);

  const captchaOk = captchaInput.trim() === captcha.answer;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confPassword) { toast.error("Password and Confirm Password do not match."); return; }
    if (!captchaOk) { toast.error("Solve this simple math problem and enter the result."); return; }
    setBusy(true);
    try {
      const res = (await interApi.register(nationality, cnic, mobile, password)) as unknown as {
        ok?: boolean; error?: string; token?: string;
      };
      if (res?.ok && res.token) {
        setToken(res.token);
        toast.success("Account created! Now complete your Personal Information.");
        navigate("/admission/portal?welcome=1");
      } else {
        toast.error(res?.error || "Registration failed. Please check your details.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaOk) { toast.error("Solve this simple math problem and enter the result."); return; }
    setBusy(true);
    try {
      const res = (await interApi.login(loginId, password)) as unknown as {
        ok?: boolean; error?: string; token?: string;
      };
      if (res?.ok && res.token) {
        setToken(res.token);
        toast.success("Logged in successfully.");
        navigate("/admission/portal");
      } else {
        toast.error(res?.error || "Invalid CNIC/Form-B or password.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-xl">
        <AdmissionBackBar to="/admission" />
        <div className="text-center mb-7">
          <div className="w-12 h-12 rounded-full border border-gold/40 bg-gold/[0.07] flex items-center justify-center mx-auto mb-3">
            {mode === "register"
              ? <UserPlus className="w-[22px] h-[22px] text-gold" strokeWidth={1.3} />
              : <LogIn className="w-[22px] h-[22px] text-gold" strokeWidth={1.3} />}
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-foreground">
            {mode === "register" ? "Create Account" : "Applicant Login"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {mode === "register"
              ? "Create your applicant account."
              : "Login with your CNIC/Form-B and password."}
          </p>
        </div>

        {mode === "register" && <WizardSteps current={1} />}

        <Card className="border-border/80 shadow-card">
          <CardContent className="p-5 sm:p-7">
            {mode === "register" ? (
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Nationality */}
                <div>
                  <Label className="font-semibold text-[13px]">Nationality <span className="text-red-500">*</span></Label>
                  <div className="grid grid-cols-2 gap-2.5 mt-1.5">
                    {NATIONALITIES.map((n) => (
                      <button
                        key={n} type="button" onClick={() => setNationality(n)}
                        className={`h-11 rounded-xl border-2 text-sm font-semibold transition-all ${
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

                {/* CNIC / Form-B */}
                <div>
                  <Label htmlFor="cnic" className="font-semibold text-[13px]">
                    {nationality === "Pakistani" ? "CNIC/Form-B" : "Afghan Card / Passport Number"} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="cnic" inputMode="numeric" maxLength={13}
                    value={cnic}
                    onChange={(e) => setCnic(e.target.value.replace(/\D/g, "").slice(0, 13))}
                    placeholder={nationality === "Pakistani" ? "Enter CNIC Number WithOut Dashes(-)" : "Afghan Card | Passport Number WithOut dashes(-)"}
                    className="h-11 mt-1.5 font-mono tracking-wide" required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {nationality === "Pakistani"
                      ? "CNIC Number Must Be 13 Digits And WithOut dashes(-) E.g 0000000000000"
                      : "Number WithOut dashes(-)"}
                  </p>
                </div>

                {/* Mobile */}
                <div>
                  <Label htmlFor="mobile" className="font-semibold text-[13px]">Mobile Number <span className="text-red-500">*</span></Label>
                  <Input
                    id="mobile" inputMode="numeric" maxLength={11}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="Enter Mobile Number without Dashes in 03451234567 format"
                    className="h-11 mt-1.5 font-mono tracking-wide" required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    This number cannot be changed later.
                  </p>
                </div>

                {/* Passwords */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="password" className="font-semibold text-[13px]">Password <span className="text-red-500">*</span></Label>
                    <Input
                      id="password" type="password" minLength={8} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter Password (at least 8 characters)"
                      className="h-11 mt-1.5" required
                    />
                  </div>
                  <div>
                    <Label htmlFor="conf_password" className="font-semibold text-[13px]">Confirm Password <span className="text-red-500">*</span></Label>
                    <Input
                      id="conf_password" type="password" minLength={8} value={confPassword}
                      onChange={(e) => setConfPassword(e.target.value)}
                      placeholder="Re-Enter Password" className="h-11 mt-1.5" required
                    />
                  </div>
                </div>

                {/* Captcha */}
                <div>
                  <Label htmlFor="captcha" className="font-semibold text-[13px]">Security Check <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="h-11 px-5 rounded-xl bg-muted border border-border flex items-center font-heading font-bold text-lg tracking-widest select-none">
                      {captcha.a} + {captcha.b} =
                    </div>
                    <Input
                      id="captcha" inputMode="numeric" value={captchaInput}
                      onChange={(e) => setCaptchaInput(e.target.value.replace(/\D/g, ""))}
                      placeholder="Result" className="h-11 w-28 font-bold text-center" required
                    />
                  </div>
                </div>

                <Button type="submit" disabled={busy} className="w-full h-10 font-semibold text-[13px]">
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                  Next Step
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Already have an account? Please{" "}
                  <Link to="/admission/login" className="text-primary font-semibold hover:underline">Login</Link>
                </p>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login_id" className="font-semibold text-[13px]">Login ID (CNIC/Form-B) <span className="text-red-500">*</span></Label>
                  <Input
                    id="login_id" inputMode="numeric" maxLength={13}
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value.replace(/\D/g, "").slice(0, 13))}
                    placeholder="Enter CNIC" className="h-11 mt-1.5 font-mono tracking-wide" required
                  />
                </div>
                <div>
                  <Label htmlFor="login_password" className="font-semibold text-[13px]">Password</Label>
                  <Input
                    id="login_password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password" className="h-11 mt-1.5" required
                  />
                </div>
                <div>
                  <Label htmlFor="captcha2" className="font-semibold text-[13px]">Security Check <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="h-11 px-5 rounded-xl bg-muted border border-border flex items-center font-heading font-bold text-lg tracking-widest select-none">
                      {captcha.a} + {captcha.b} =
                    </div>
                    <Input
                      id="captcha2" inputMode="numeric" value={captchaInput}
                      onChange={(e) => setCaptchaInput(e.target.value.replace(/\D/g, ""))}
                      placeholder="Result" className="h-11 w-28 font-bold text-center" required
                    />
                  </div>
                </div>
                <Button type="submit" disabled={busy} className="w-full h-10 font-semibold text-[13px]">
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                  Login
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  New student?{" "}
                  <Link to="/admission/register" className="text-primary font-semibold hover:underline">Create an account</Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>

      </div>
    </PageLayout>
  );
}
