import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  MapPin, 
  Home, 
  Pill, 
  PlusSquare, 
  UtensilsCrossed, 
  Briefcase,
  Moon,
  Sun,
  ToggleLeft,
  ToggleRight,
  Menu,
  X,
  User,
  LogOut,
  Plus
} from "lucide-react";
import { useThemeStore, useLangStore, useAuthStore, useLocationStore } from "../store";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";


const CATS = [
  { key: "flat", icon: Home, labelKey: "flatRental" },
  { key: "pharmacy", icon: Pill, labelKey: "pharmacy" },
  { key: "hospital", icon: PlusSquare, labelKey: "hospital" },
  { key: "restaurant", icon: UtensilsCrossed, labelKey: "restaurant" },
  { key: "service", icon: Briefcase, labelKey: "service" },
];

export default function Navbar() {
  const { theme, toggle } = useThemeStore();
  const { lang, setLang } = useLangStore();
  const { user, clear } = useAuthStore();
  const { setCategory, category } = useLocationStore();
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [checking, setChecking] = React.useState(false);

  React.useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang, i18n]);

  const toggleLang = () => {
    const next = lang === "en" ? "bn" : "en";
    setLang(next);
  };

  const handleLogout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    clear();
    nav("/");
  };

  const dashboardPath =
    user?.role === "admin" ? "/admin/dashboard" : user?.role === "owner" ? "/owner/dashboard" : "/user/dashboard";

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-50 backdrop-blur-xl bg-navy-900/85 border-b border-white/5"
    >
      {/* Verification Alert Banner */}
      {user && user.is_verified === false && (
        <div className="bg-gradient-to-r from-amber-500/15 via-teal-500/10 to-amber-500/15 border-b border-white/5 px-4 py-2 flex flex-wrap items-center justify-center gap-3 relative z-50">
          <span className="text-xs sm:text-sm font-medium text-amber-300 flex items-center gap-1.5 font-sans animate-pulse-slow">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            {lang === 'bn' ? 
              "আপনার অ্যাকাউন্টটি এখনও ভেরিফাই করা হয়নি। মেইল পাননি?" : 
              "Your account is not verified yet. Did not receive the email?"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              disabled={resending || checking}
              onClick={async () => {
                setResending(true);
                try {
                  await api.post("/auth/resend-verification");
                  toast.success(
                    lang === 'bn' ? 
                      "ভেরিফিকেশন মেইল পুনরায় পাঠানো হয়েছে! অনুগ্রহ করে ইনবক্স চেক করুন।" : 
                      "Verification email resent successfully! Please check your inbox."
                  );
                } catch (err) {
                  toast.error(err.response?.data?.detail || "Failed to resend verification email");
                } finally {
                  setResending(false);
                }
              }}
              className="bg-teal-500 hover:bg-teal-400 text-navy-900 font-extrabold text-[11px] h-7 px-3 rounded-full shadow-[0_0_10px_rgba(0,201,167,0.3)] transition-all uppercase tracking-wider shrink-0"
            >
              {resending ? "..." : (lang === 'bn' ? "মেইল পুনরায় পাঠান" : "Resend Email")}
            </Button>
            
            <Button
              size="xs"
              variant="outline"
              disabled={resending || checking}
              onClick={async () => {
                setChecking(true);
                try {
                  const r = await api.get("/auth/me");
                  if (r.data.is_verified) {
                    useAuthStore.getState().updateUser({ is_verified: true });
                    toast.success(
                      lang === 'bn' ? 
                        "অ্যাকাউন্ট সফলভাবে ভেরিফাই করা হয়েছে! প্রিমিয়াম ফিচারে স্বাগতম।" : 
                        "Account verified successfully! Welcome to premium features."
                    );
                  } else {
                    toast.warning(
                      lang === 'bn' ? 
                        "আপনার ইমেইলটি এখনো ভেরিফাই করা হয়নি। অনুগ্রহ করে ইনবক্স চেক করে লিংকে ক্লিক করুন!" : 
                        "Your email is still unverified. Please check your inbox and click the verification link first!"
                    );
                  }
                } catch (err) {
                  toast.error("Failed to refresh status");
                } finally {
                  setChecking(false);
                }
              }}
              className="border-white/20 hover:border-white/40 text-white font-extrabold text-[11px] h-7 px-3 rounded-full transition-all uppercase tracking-wider shrink-0 bg-navy-800/50 hover:bg-navy-700/50"
            >
              {checking ? "..." : (lang === 'bn' ? "স্ট্যাটাস চেক করুন" : "Check Status")}
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 h-16 sm:h-20 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 sm:gap-4 shrink-0 group">
          <div className="relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 shrink-0">
            {/* Outer animated ring */}
            <div className="absolute inset-0 rounded-full bg-teal-500/20 group-hover:animate-ping transition-all" style={{ animationDuration: '3s' }}></div>
            {/* Inner glowing circle */}
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-[0_0_15px_rgba(0,209,178,0.4)] group-hover:shadow-[0_0_25px_rgba(0,209,178,0.7)] transition-all duration-500 z-10">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <MapPin className="text-black w-4 h-4 sm:w-5 sm:h-5 relative z-10" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xl sm:text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-gray-400 group-hover:to-white transition-all duration-500">
              Location<span className="text-teal-400 drop-shadow-[0_0_8px_rgba(0,209,178,0.5)]">Khuji</span>
            </span>
            <span className={`text-[10px] sm:text-[11px] text-gray-400 font-medium whitespace-nowrap mt-1 group-hover:text-gray-300 transition-colors ${lang === 'bn' ? 'font-bengali' : 'uppercase tracking-[0.15em] opacity-80'}`}>
              {t('tagline')}
            </span>
          </div>
        </Link>

        {/* Center categories */}
        <nav className="hidden lg:flex items-center gap-8 mx-auto">
          {CATS.map((c) => {
            const Icon = c.icon;
            const active = category === c.key;
            return (
              <button
                key={c.key}
                onClick={() => {
                  if (!user) { nav("/login?next=/map"); return; }
                  setCategory(active ? null : c.key); nav("/map");
                }}
                className={`flex items-center gap-2 transition-colors group ${
                  active ? "text-white" : "text-gray-300 hover:text-white"
                }`}
              >
                <span className={`transition-colors ${active ? "text-teal-400" : "text-gray-400 group-hover:text-teal-400"}`}>
                  <Icon size={18} />
                </span>
                <span className="font-medium text-[15px]">{t(c.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 sm:gap-6 ml-auto lg:ml-0">
          {/* Language Toggle */}
          <button 
            onClick={toggleLang}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full border border-gray-700 hover:border-gray-500 transition-colors bg-navy-800/50"
          >
            <span className={`text-xs sm:text-sm ${lang === 'en' ? 'text-teal-400 font-bold' : 'text-gray-400'}`}>EN</span>
            {lang === 'en' ? 
              <ToggleLeft className="text-teal-400" size={18} /> : 
              <ToggleRight className="text-teal-400" size={18} />
            }
            <span className={`text-xs sm:text-sm ${lang === 'bn' ? 'text-teal-400 font-bold font-bengali' : 'text-gray-400 font-bengali'}`}>বাংলা</span>
          </button>

          {/* Theme */}
          <button
            onClick={toggle}
            className="text-gray-400 hover:text-teal-400 transition-colors flex flex-col items-center"
            aria-label="Toggle map theme"
            title={theme === "light" ? "Switch to Dark Map" : "Switch to Light Map"}
          >
            <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}>
              {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
            </motion.span>
            <span className="text-[8px] uppercase font-bold tracking-tighter mt-0.5 opacity-60">Map</span>
          </button>

          {/* Auth */}
          {!user ? (
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="ghost" className="text-gray-300 hover:text-white" onClick={() => nav("/login")}>
                {t('login')}
              </Button>
              <Button className="bg-teal-500 hover:bg-teal-400 text-navy-900 rounded-full font-bold glow-teal px-6" onClick={() => nav("/register")}>
                {t('register')}
              </Button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm sm:text-lg shadow-[0_0_15px_rgba(0,209,178,0.3)]"
              >
                {user.name?.[0]?.toUpperCase() || "U"}
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 cyber-panel border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="px-4 py-3 border-b border-white/5">
                    <div className="font-semibold text-sm text-white">{user.name}</div>
                    <div className="text-xs text-gray-400">{user.email}</div>
                    <div className="text-[10px] uppercase tracking-wider text-teal-400 mt-1 font-bold">{user.role}</div>
                  </div>
                  <Link to={dashboardPath} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                    <User size={14} /> {t('dashboard')}
                  </Link>
                  {user.role === "user" && (
                    <Link to="/user/saved" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                      <Home size={14} /> {t('savedPlaces')}
                    </Link>
                  )}
                  {user.role === "owner" && (
                    <Link to="/owner/listings/add" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                      <Plus size={14} /> {t('addListing')}
                    </Link>
                  )}
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 border-t border-white/5 transition-colors">
                    <LogOut size={14} /> {t('logout')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/5 bg-navy-900/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-2">
            {CATS.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  onClick={() => {
                    if (!user) { nav("/login?next=/map"); setMobileOpen(false); return; }
                    setCategory(c.key); nav("/map"); setMobileOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Icon size={18} className="text-teal-400" /> {t(c.labelKey)}
                </button>
              );
            })}
            {!user && (
              <div className="pt-4 flex flex-col gap-2">
                <Button variant="outline" className="w-full border-gray-700 text-gray-300" onClick={() => { nav("/login"); setMobileOpen(false); }}>{t('login')}</Button>
                <Button className="w-full bg-teal-500 text-navy-900 font-bold" onClick={() => { nav("/register"); setMobileOpen(false); }}>{t('register')}</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.header>
  );
}

