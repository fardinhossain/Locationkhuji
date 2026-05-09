import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FaUser, FaStore } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuthStore, useLangStore } from "../store";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useTranslation } from "react-i18next";

export function RegisterPage() {
  const { lang } = useLangStore();
  const { t } = useTranslation();
  const { setAuth } = useAuthStore();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error("Passwords don't match");
    setLoading(true);
    try {
      const r = await api.post("/auth/register", { name: form.name, email: form.email, password: form.password, role });
      setAuth(r.data.user, r.data.access_token);
      toast.success("Welcome!");
      nav(role === "owner" ? "/owner/dashboard" : "/map");
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-1 relative items-center justify-center text-white p-12"
        style={{ background: "linear-gradient(135deg, #0B0E11, #141A21)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="relative max-w-md">
          <Link to="/" className="font-sora font-extrabold text-3xl text-white">Location<span className="text-teal-400 drop-shadow-[0_0_8px_rgba(0,209,178,0.4)]">Khuji</span></Link>
          <p className="font-bengali text-white/60 mt-2">আপনার কাছের সব কিছু</p>
          <h2 className="font-sora font-bold text-4xl mt-12 leading-tight">Join the largest discovery platform in Bangladesh.</h2>
          <ul className="mt-8 space-y-3 text-white/80 font-medium">
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500"/> 5km radius discovery</li>
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500"/> Real verified listings</li>
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500"/> Bengali + English support</li>
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
                    <div className="w-12 h-12 rounded-xl bg-cat-flat-light text-cat-flat flex items-center justify-center"><FaUser size={20}/></div>
                    <div className="flex-1">
                      <div className="font-sora font-semibold">{t('iAmUser')}</div>
                      <div className="font-bengali text-xs text-[var(--text-secondary)] mt-0.5">আমি স্থান খুঁজছি</div>
                      <div className="text-xs text-[var(--text-tertiary)] mt-1">{t('userSub')}</div>
                    </div>
                  </div>
                </button>
                <button data-testid="role-owner" onClick={() => setRole("owner")}
                  className={`w-full p-5 rounded-2xl border-2 text-left transition ${role === "owner" ? "border-primary bg-primary-light" : "border-[var(--border-medium)] hover:border-primary"}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center"><FaStore size={20}/></div>
                    <div className="flex-1">
                      <div className="font-sora font-semibold">{t('iAmOwner')}</div>
                      <div className="font-bengali text-xs text-[var(--text-secondary)] mt-0.5">আমি একজন মালিক / ব্যবসায়ী</div>
                      <div className="text-xs text-[var(--text-tertiary)] mt-1">{t('ownerSub')}</div>
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
                <Input data-testid="register-name" placeholder={t('fullName')} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required minLength={2} />
                <Input data-testid="register-email" type="email" placeholder={t('email')} value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required />
                <Input data-testid="register-password" type="password" placeholder={t('password')} value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} required minLength={6} />
                <Input data-testid="register-confirm" type="password" placeholder={t('confirmPassword')} value={form.confirm} onChange={(e) => setForm({...form, confirm: e.target.value})} required />
              </div>
              <Button data-testid="register-submit" type="submit" disabled={loading} className="mt-5 w-full h-12 rounded-pill bg-primary text-white">
                {loading ? "..." : t('register')}
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

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post("/auth/login", form);
      setAuth(r.data.user, r.data.access_token);
      toast.success("Welcome back!");
      const next = params.get("next");
      if (next) nav(next);
      else if (r.data.user.role === "admin") nav("/admin/dashboard");
      else if (r.data.user.role === "owner") nav("/owner/dashboard");
      else nav("/map");
    } catch (err) {
      toast.error("Invalid credentials");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-1 relative items-center justify-center text-white p-12" style={{ background: "linear-gradient(135deg, #0D1B2A, #1A3A5C)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="relative max-w-md">
          <Link to="/" className="font-sora font-extrabold text-3xl text-black">Location<span className="text-primary">Khuji</span></Link>
          <p className="font-bengali text-white/60 mt-2">আপনার কাছের সব কিছু</p>
          <h2 className="font-sora font-bold text-4xl mt-12">Welcome back to Bangladesh's discovery map.</h2>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 bg-[var(--bg-base)]">
        <div className="w-full max-w-md">
          <div className="bg-[var(--bg-surface)] p-8 rounded-2xl shadow-xl border border-[var(--border-light)]">
            <h1 className="font-sora font-bold text-2xl">{t('welcome')}! 👋</h1>
            <p className="text-[var(--text-secondary)] text-sm mb-8">Login to your LocationKhuji account</p>
            
            <form onSubmit={submit} className="space-y-4" data-testid="login-form">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{t('email')}</label>
                <Input data-testid="login-email" type="email" placeholder="example@mail.com" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{t('password')}</label>
                <Input data-testid="login-password" type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} required />
              </div>
              
              <Button data-testid="login-submit" type="submit" disabled={loading} className="w-full h-12 rounded-pill bg-primary text-white font-bold mt-4 shadow-teal">
                {loading ? "..." : t('login')}
              </Button>
            </form>

            <div className="text-center mt-6 text-sm text-[var(--text-secondary)]">
              {t('noAccount')} <Link to="/register" className="text-primary font-bold hover:underline">{t('register')}</Link>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-[var(--text-tertiary)]" data-testid="demo-credentials">
            <div className="font-bold uppercase tracking-widest mb-4 opacity-50">Quick Demo Access</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Admin", email: "admin@locationkhuji.com", password: "Admin@123", color: "#EF4444" },
                { label: "Owner", email: "owner@locationkhuji.com", password: "Owner@123", color: "#00C9A7" },
                { label: "User",  email: "user@locationkhuji.com",  password: "User@123",  color: "#6366F1" },
              ].map((d) => (
                <button
                  key={d.label}
                  type="button"
                  data-testid={`demo-${d.label.toLowerCase()}`}
                  onClick={() => setForm({ email: d.email, password: d.password })}
                  className="flex flex-col items-center p-2 rounded-lg border border-[var(--border-light)] hover:border-primary hover:bg-[var(--bg-elevated)] transition"
                >
                  <span className="w-2 h-2 rounded-full mb-1" style={{ background: d.color }} />
                  <span className="font-bold text-[10px]">{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

