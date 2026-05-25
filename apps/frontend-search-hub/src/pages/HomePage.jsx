import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowRight } from "react-icons/fi";
import { FaHome, FaPills, FaHospital, FaShoppingBag } from "react-icons/fa";
import Navbar from "../components/Navbar";
import { useLangStore, useAuthStore } from "../store";
import HeroSection from "../components/hero/HeroSection";
import { useTranslation } from "react-i18next";

const CAT_CARDS = [
  { key: "flat", icon: FaHome, color: "#6366F1", bg: "#EEF2FF", titleKey: "flatRental", subKey: "flatSub", bn: "ফ্ল্যাট ভাড়া" },
  { key: "pharmacy", icon: FaPills, color: "#10B981", bg: "#D1FAE5", titleKey: "pharmacy", subKey: "pharmacySub", bn: "ফার্মেসি" },
  { key: "hospital", icon: FaHospital, color: "#EF4444", bg: "#FEE2E2", titleKey: "hospital", subKey: "hospitalSub", bn: "হাসপাতাল" },
  { key: "fashion", icon: FaShoppingBag, color: "#F59E0B", bg: "#FEF3C7", titleKey: "fashion", subKey: "fashionSub", bn: "ফ্যাশন শপ" },
];

export default function HomePage() {
  const { lang } = useLangStore();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const nav = useNavigate();

  const guard = (path) => (e) => {
    if (!user) {
      e.preventDefault();
      nav(`/login?next=${encodeURIComponent(path)}`);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />

      <HeroSection />

      {/* CATEGORY SECTION */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={`font-bold text-4xl text-[var(--text-primary)] ${lang === 'bn' ? 'font-bengali' : 'font-sora tracking-tight'}`}>
                {t('whatLooking')}
              </h2>
              <div className="w-20 h-1.5 bg-primary mx-auto mt-6 rounded-full shadow-[0_0_10px_rgba(0,201,167,0.5)]" />
            </motion.div>
          </div>


          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {CAT_CARDS.map((c, i) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.key} to={`/map?cat=${c.key}`}
                  onClick={guard(`/map?cat=${c.key}`)}
                  data-testid={`home-cat-${c.key}`}
                  className="group relative overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-light)] p-6 hover:-translate-y-1 hover:shadow-card transition-all"
                  style={{ "--cat-color": c.color }}
                >
                  <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-10" style={{ background: c.color }} />
                  <div className="relative">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
                      <Icon size={26} style={{ color: c.color }} />
                    </div>
                    <h3 className="font-sora font-semibold text-lg mt-5 text-[var(--text-primary)]">{t(c.titleKey)}</h3>
                    <p className="font-bengali text-sm text-[var(--text-secondary)] mt-1">{c.bn}</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-2">{t(c.subKey)}</p>
                    <div className="mt-5 flex items-center text-sm font-semibold opacity-0 group-hover:opacity-100 transition" style={{ color: c.color }}>
                      Browse <FiArrowRight className="ml-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5 bg-navy-900/50 backdrop-blur-md text-center">
        <div className="font-sora font-bold text-lg tracking-tight">
          <span className="text-white">Location</span><span className="text-teal-500">Khuji</span>
        </div>
        <div className="font-bengali mt-1 text-gray-400">আপনার কাছের সব কিছু · Made in Bangladesh 🇧🇩</div>
        <p className="mt-4 text-gray-500 text-xs">
          Developed by <span className="text-teal-500 font-medium">@Fardin_NovoSoft.AI</span>
        </p>
      </footer>
    </div>
  );
}
