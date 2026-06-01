import React from "react";
import { Link } from "react-router-dom";
import { FiMapPin, FiBookmark, FiStar } from "react-icons/fi";
import { CATEGORIES } from "../lib/constants";
import { useAuthStore, useLangStore } from "../store";
import { api, fileUrl } from "../lib/api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const CategoryBadge = ({ category }) => {
  const { t } = useTranslation();
  const c = CATEGORIES.find((x) => x.key === category);
  if (!c) return null;
  
  // Custom colors for the new design
  const colors = {
    flat: { text: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
    pharmacy: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    hospital: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    restaurant: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  };
  const theme = colors[category] || { text: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/20" };

  return (
    <span
      data-testid={`category-badge-${category}`}
      className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm border ${theme.bg} ${theme.text} ${theme.border} backdrop-blur-md`}
    >
      {t(category === 'flat' ? 'flatRental' : category)}
    </span>
  );
};

export const StarRating = ({ rating = 0, size = 14, count = null }) => {
  const stars = Array.from({ length: 5 }).map((_, i) => i < Math.round(rating));
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {stars.map((on, i) => (
          <FiStar key={i} size={size} className={on ? "fill-teal-500 text-teal-500" : "text-gray-700"} fill={on ? "currentColor" : "none"} />
        ))}
      </div>
      {count !== null && <span className="text-[11px] font-bold text-gray-500 ml-0.5">({count})</span>}
    </div>
  );
};

function ListingCardImpl({ listing, distance, compact }) {
  const { user, updateUser } = useAuthStore();
  const { lang } = useLangStore();
  const { t } = useTranslation();
  const isSaved = user?.saved_listings?.includes(listing.id);

  const detailLine = () => {
    const d = listing.details || {};
    if (listing.category === "flat") return `${d.bedrooms || 0} ${t('bedrooms')} · ${d.bathrooms || 0} ${t('bathrooms')}`;
    if (listing.category === "pharmacy") return `${d.open_hours || "—"}${d.emergency ? ` · ${t('emergency')}` : ""}`;
    if (listing.category === "hospital") return `${(d.specialty || []).slice(0,1).join(", ")}${d.emergency ? ` · ${t('emergency')}` : ""}`;
    if (listing.category === "restaurant") return `${(Array.isArray(d.cuisine) ? d.cuisine : [d.cuisine].filter(Boolean)).slice(0,2).join(", ")}`;
    if (listing.category === "service") return `${d.service_type || "Service"} · ${d.experience ? `${d.experience}` : "Available"}`;
    return "";
  };

  const handleSave = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) return toast.error("Please login to save");
    try {
      const r = await api.post(`/listings/${listing.id}/save`);
      const newSaved = r.data.saved
        ? [...(user.saved_listings || []), listing.id]
        : (user.saved_listings || []).filter((x) => x !== listing.id);
      updateUser({ saved_listings: newSaved });
      toast.success(r.data.saved ? "Saved!" : "Removed");
    } catch { toast.error("Failed"); }
  };

  const img = listing.images?.[0] ? (listing.images[0].startsWith("http") ? listing.images[0] : fileUrl(listing.images[0])) : null;

  return (
    <Link
      to={`/listing/${listing.id}`}
      data-testid={`listing-card-${listing.id}`}
      className={`group block bg-navy-800/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden hover:shadow-[0_0_30px_rgba(0,209,178,0.15)] hover:border-teal-500/30 transition-all duration-500 ${compact ? "flex" : "shadow-xl"}`}
    >
      <div className={`relative ${compact ? "w-40 h-40 shrink-0" : "h-56"} bg-navy-900/50 overflow-hidden`}>
        {img ? (
          <img src={img} alt={listing.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-40">
            <FiMapPin size={48} className="text-teal-500/50" />
          </div>
        )}
        <div className="absolute top-4 left-4"><CategoryBadge category={listing.category} /></div>
        <button
          data-testid={`save-btn-${listing.id}`}
          onClick={handleSave}
          className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-lg border border-white/10 transition-all active:scale-90 shadow-xl ${
            isSaved ? "bg-teal-500 text-navy-900" : "bg-black/40 text-white hover:bg-teal-500 hover:text-navy-900"
          }`}
        >
          <FiBookmark size={16} fill={isSaved ? "currentColor" : "none"} />
        </button>
        {/* Subtle bottom gradient on image */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-navy-900/80 to-transparent opacity-60 pointer-events-none" />
      </div>
      <div className={`p-6 flex-1 ${compact ? "flex flex-col justify-center" : ""}`}>
        <h3 className={`font-bold text-lg text-white line-clamp-1 group-hover:text-teal-400 transition-colors duration-300 ${lang === 'bn' ? 'font-bengali' : 'font-sora tracking-tight'}`}>{listing.title}</h3>
        
        <div className="flex flex-col gap-2 mt-3">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
            <FiMapPin size={14} className="text-teal-500/70 shrink-0" />
            <span className="truncate">{(() => {
              const area = listing.area || listing.thana || '';
              const loc = listing.district || listing.city || '';
              if (area && loc && area !== loc) return `${area}, ${loc}`;
              return area || loc || listing.address || 'Bangladesh';
            })()}</span>
          </div>
          {distance != null && (
            <div className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 text-[10px] font-bold uppercase tracking-wider border border-teal-500/20">
              {distance.toFixed(1)} km {t('distanceAway')}
            </div>
          )}
        </div>

        <p className={`text-xs text-gray-500 mt-4 line-clamp-1 font-semibold uppercase tracking-widest ${lang === 'bn' ? 'font-bengali' : ''}`}>{detailLine()}</p>
        
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/5">
          <StarRating rating={listing.average_rating} count={listing.total_reviews} />
          <span className="text-[11px] font-bold text-teal-500 uppercase tracking-widest group-hover:translate-x-1.5 transition-transform duration-300">{t('viewDetails')} →</span>
        </div>
      </div>
    </Link>
  );
}

export const ListingCard = ListingCardImpl;
