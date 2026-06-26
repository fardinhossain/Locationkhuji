import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FaUser, FaStore, FaEye, FaEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuthStore, useLangStore } from "../store";
import { api } from "../lib/api";
import { signInWithGooglePopup } from "../lib/firebase";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useTranslation } from "react-i18next";

function googleAuthErrorMessage(err) {
  if (err?.code === "auth/unauthorized-domain") {
    const host = window.location.hostname;
    return `Google sign-in is not enabled for ${host}. Add this domain in Firebase Console > Authentication > Settings > Authorized domains.`;
  }
  return err?.response?.data?.detail || err?.message || "Google sign-in failed";
}

export function RegisterPage() {
  const { lang } = useLangStore();
  const { t } = useTranslation();
  const { setAuth } = useAuthStore();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const continueAfterRegister = (user) => {
    if (user.role === "admin") nav("/admin/dashboard");
    else if (user.role === "owner") nav("/owner/dashboard");
    else nav("/map");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error("Passwords don't match");
    setLoading(true);
    try {
      const r = await api.post("/auth/register", { name: form.name, email: form.email, password: form.password, role });
      setAuth(r.data.user, r.data.access_token);
      toast.success("Welcome! Check your email for the 6-digit verification code.");
      continueAfterRegister(r.data.user);
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Registration failed");
    } finally { setLoading(false); }
  };

  const continueWithGoogle = async () => {
    if (!role) return toast.error("Please choose your account type first");
    setGoogleLoading(true);
    try {
      const { idToken, refreshToken } = await signInWithGooglePopup();
      const r = await api.post("/auth/google", { idToken, refreshToken, role, mode: "register" });
      setAuth(r.data.user, r.data.access_token);
      toast.success("Welcome! Check your email for the 6-digit verification code.");
      continueAfterRegister(r.data.user);
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
      toast.error(googleAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-1 relative items-center justify-center text-white p-12"
        style={{ background: "linear-gradient(135deg, #0B0E11, #141A21)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="relative max-w-md">
          <Link to="/" className="font-sora font-extrabold text-3xl text-white">Location<span className="text-teal-400 drop-shadow-[0_0_8px_rgba(0,209,178,0.4)]">Khuji</span></Link>
          <p className="font-bengali text-white/60 mt-2">{t('tagline')}</p>
          <h2 className="font-sora font-bold text-4xl mt-12 leading-tight">Join the largest discovery platform in Bangladesh.</h2>
          <ul className="mt-8 space-y-3 text-white/80 font-medium">
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500" /> 20km radius discovery</li>
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500" /> Real verified listings</li>
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500" /> Bengali + English support</li>
          </ul>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-[var(--bg-base)]">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-md">
              <h1 className="font-sora font-bold text-2xl text-center"><span className="font-bengali">আপনি কে?</span> / Who are you?</h1>
              <p className="text-center text-sm text-[var(--text-secondary)] mt-2">Choose your account type</p>

              <div className="mt-8 space-y-3">
                <button data-testid="role-user" onClick={() => setRole("user")}
                  className={`w-full p-5 rounded-2xl border-2 text-left transition ${role === "user" ? "border-cat-flat bg-cat-flat-light" : "border-[var(--border-medium)] hover:border-cat-flat"}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cat-flat-light text-cat-flat flex items-center justify-center"><FaUser size={20} /></div>
                    <div className="flex-1">
                      <div className={`font-sora font-semibold ${role === "user" ? "text-slate-900" : "text-white"}`}>{t('iAmUser')}</div>
                      <div className={`font-bengali text-xs mt-0.5 ${role === "user" ? "text-slate-700" : "text-[var(--text-secondary)]"}`}>আমি স্থান খুঁজছি</div>
                      <div className={`text-xs mt-1 ${role === "user" ? "text-slate-600" : "text-[var(--text-tertiary)]"}`}>{t('userSub')}</div>
                    </div>
                  </div>
                </button>
                <button data-testid="role-owner" onClick={() => setRole("owner")}
                  className={`w-full p-5 rounded-2xl border-2 text-left transition ${role === "owner" ? "border-primary bg-primary-light" : "border-[var(--border-medium)] hover:border-primary"}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center"><FaStore size={20} /></div>
                    <div className="flex-1">
                      <div className={`font-sora font-semibold ${role === "owner" ? "text-slate-900" : "text-white"}`}>{t('iAmOwner')}</div>
                      <div className={`font-bengali text-xs mt-0.5 ${role === "owner" ? "text-slate-700" : "text-[var(--text-secondary)]"}`}>আমি একজন মালিক / ব্যবসায়ী</div>
                      <div className={`text-xs mt-1 ${role === "owner" ? "text-slate-600" : "text-[var(--text-tertiary)]"}`}>{t('ownerSub')}</div>
                    </div>
                  </div>
                </button>
              </div>

              <Button data-testid="next-btn" disabled={!role} onClick={() => setStep(2)} className="mt-6 w-full h-12 rounded-pill bg-primary text-white">
                {t('next')} →
              </Button>
              <div className="text-center mt-4 text-sm">
                {t('haveAccount')} <Link to="/login" className="text-primary font-semibold">{t('login')}</Link>
              </div>
            </motion.div>
          ) : (
            <motion.form key="step2" onSubmit={submit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-md" data-testid="register-form">
              <button type="button" onClick={() => setStep(1)} className="text-sm text-[var(--text-secondary)] mb-4">← Back</button>
              <h1 className="font-sora font-bold text-2xl">Create account</h1>
              <span className="inline-block mt-2 px-3 py-1 rounded-pill text-xs font-bold uppercase tracking-wider bg-primary-light text-primary">{role}</span>
              <div className="mt-6 space-y-3">
                <Input data-testid="register-name" placeholder={t('fullName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
                <Input data-testid="register-email" type="email" placeholder={t('email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                <div className="relative">
                  <Input
                    data-testid="register-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t('password')}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-white transition cursor-pointer"
                  >
                    {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    data-testid="register-confirm"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={t('confirmPassword')}
                    value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-white transition cursor-pointer"
                  >
                    {showConfirmPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
              </div>
              <Button data-testid="register-submit" type="submit" disabled={loading} className="mt-5 w-full h-12 rounded-pill bg-primary text-white">
                {loading ? "..." : t('register')}
              </Button>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--border-light)]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">or</span>
                <div className="h-px flex-1 bg-[var(--border-light)]" />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={loading || googleLoading}
                onClick={continueWithGoogle}
                className="w-full h-12 rounded-lg border-[var(--border-light)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold hover:bg-[var(--bg-base)] gap-3"
              >
                <FcGoogle size={22} />
                {googleLoading ? "Connecting..." : `Continue with Google as ${role}`}
              </Button>
              <div className="text-center mt-4 text-sm">
                {t('haveAccount')} <Link to="/login" className="text-primary font-semibold">{t('login')}</Link>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { lang } = useLangStore();
  const { t } = useTranslation();
  const { setAuth } = useAuthStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(0); // 0 = login, 1 = request code, 2 = reset password

  // Forgot password form states
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const continueAfterAuth = (user) => {
    const next = params.get("next");
    if (next) nav(next);
    else if (user.role === "admin") nav("/admin/dashboard");
    else if (user.role === "owner") nav("/owner/dashboard");
    else nav("/map");
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post("/auth/login", form);
      setAuth(r.data.user, r.data.access_token);
      toast.success("Welcome back!");
      continueAfterAuth(r.data.user);
    } catch (err) {
      toast.error("Invalid credentials");
    } finally { setLoading(false); }
  };

  const continueWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { idToken, refreshToken } = await signInWithGooglePopup();
      const r = await api.post("/auth/google", { idToken, refreshToken, mode: "login" });
      setAuth(r.data.user, r.data.access_token);
      toast.success(r.data.user?.is_verified === false ? "Check your email for the 6-digit verification code." : "Welcome back!");
      continueAfterAuth(r.data.user);
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
      toast.error(googleAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const requestResetCode = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return toast.error("Please enter your email");
    setForgotLoading(true);
    try {
      const r = await api.post("/auth/forgot-password", { email: forgotEmail });
      toast.success(r.data.message || "Verification code sent!");
      setForgotStep(2); // Go to verification and reset form
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to send reset code";
      toast.error(typeof msg === "string" ? msg : "Failed to send reset code");
    } finally {
      setForgotLoading(false);
    }
  };

  const executeResetPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail || !forgotCode || !forgotNewPassword) {
      return toast.error("Please fill in all fields");
    }
    if (forgotNewPassword.length < 6) {
      return toast.error("New password must be at least 6 characters");
    }
    setForgotLoading(true);
    try {
      const r = await api.post("/auth/reset-password", {
        email: forgotEmail,
        code: forgotCode,
        newPassword: forgotNewPassword
      });
      toast.success(r.data.message || "Password reset successful!");
      // Reset state and return to login
      setForgotStep(0);
      setForm({ ...form, email: forgotEmail, password: "" }); // Pre-populate login email
      setForgotCode("");
      setForgotNewPassword("");
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to reset password";
      toast.error(typeof msg === "string" ? msg : "Failed to reset password");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-1 relative items-center justify-center text-white p-12" style={{ background: "linear-gradient(135deg, #0D1B2A, #1A3A5C)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="relative max-w-md">
          <Link to="/" className="font-sora font-extrabold text-3xl text-black">Location<span className="text-primary">Khuji</span></Link>
          <p className="font-bengali text-white/60 mt-2">{t('tagline')}</p>
          <h2 className="font-sora font-bold text-4xl mt-12">Welcome back to Bangladesh's discovery map.</h2>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 bg-[var(--bg-base)]">
        <div className="w-full max-w-md">
          <div className="bg-[var(--bg-surface)] p-8 rounded-2xl shadow-xl border border-[var(--border-light)]">
            
            {forgotStep === 0 && (
              <>
                <h1 className="font-sora font-bold text-2xl">{t('welcome')}! 👋</h1>
                <p className="text-[var(--text-secondary)] text-sm mb-8">Login to your LocationKhuji account</p>

                <form onSubmit={submit} className="space-y-4" data-testid="login-form">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{t('email')}</label>
                    <Input data-testid="login-email" type="email" placeholder="example@mail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{t('password')}</label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(form.email); // Pre-fill with current email
                          setForgotStep(1);
                        }}
                        className="text-xs text-primary hover:underline font-bold"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        data-testid="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-white transition cursor-pointer"
                      >
                        {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                      </button>
                    </div>
                  </div>

                  <Button data-testid="login-submit" type="submit" disabled={loading} className="w-full h-12 rounded-pill bg-primary text-white font-bold mt-4 shadow-teal">
                    {loading ? "..." : t('login')}
                  </Button>
                </form>

                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[var(--border-light)]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">or</span>
                  <div className="h-px flex-1 bg-[var(--border-light)]" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || googleLoading}
                  onClick={continueWithGoogle}
                  className="w-full h-12 rounded-lg border-[var(--border-light)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold hover:bg-[var(--bg-base)] gap-3"
                >
                  <FcGoogle size={22} />
                  {googleLoading ? "Connecting..." : "Continue with Google"}
                </Button>

                <div className="text-center mt-6 text-sm text-[var(--text-secondary)]">
                  {t('noAccount')} <Link to="/register" className="text-primary font-bold hover:underline">{t('register')}</Link>
                </div>
              </>
            )}

            {forgotStep === 1 && (
              <>
                <button type="button" onClick={() => setForgotStep(0)} className="text-sm text-[var(--text-secondary)] mb-4">← Back to Login</button>
                <h1 className="font-sora font-bold text-2xl">Reset password</h1>
                <p className="text-[var(--text-secondary)] text-sm mb-6 mt-1">Enter your email and we'll send you a 6-digit verification code to reset your password.</p>

                <form onSubmit={requestResetCode} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Email address</label>
                    <Input type="email" placeholder="example@mail.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
                  </div>

                  <Button type="submit" disabled={forgotLoading} className="w-full h-12 rounded-pill bg-primary text-white font-bold mt-4 shadow-teal">
                    {forgotLoading ? "..." : "Send Verification Code"}
                  </Button>
                </form>
              </>
            )}

            {forgotStep === 2 && (
              <>
                <button type="button" onClick={() => setForgotStep(1)} className="text-sm text-[var(--text-secondary)] mb-4">← Back</button>
                <h1 className="font-sora font-bold text-2xl">Verify code & Reset</h1>
                <p className="text-[var(--text-secondary)] text-sm mb-6 mt-1">We sent a 6-digit code to <strong>{forgotEmail}</strong>. Enter the code and your new password below.</p>

                <form onSubmit={executeResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Verification Code</label>
                    <Input type="text" placeholder="123456" maxLength={6} value={forgotCode} onChange={(e) => setForgotCode(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">New Password</label>
                    <div className="relative">
                      <Input
                        type={showForgotNewPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        required
                        minLength={6}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-white transition cursor-pointer"
                      >
                        {showForgotNewPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" disabled={forgotLoading} className="w-full h-12 rounded-pill bg-primary text-white font-bold mt-4 shadow-teal">
                    {forgotLoading ? "..." : "Reset Password"}
                  </Button>
                </form>
              </>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
