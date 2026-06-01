import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { ListingCard } from "../components/ListingCard";
import { useLocationStore, useLangStore } from "../store";
import { CATEGORIES } from "../lib/constants";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";

export default function ListPage() {
  const loc = useLocationStore();
  const { lang } = useLangStore();
  const { t } = useTranslation();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get("/listings/nearby", {
      params: { lat: loc.selectedLat, lng: loc.selectedLng, radius: loc.radius, category: loc.category || undefined, limit: 60 }
    }).then((r) => setListings(r.data.listings || [])).finally(() => setLoading(false));
  }, [loc.selectedLat, loc.selectedLng, loc.radius, loc.category]);

  return (
    <div>
      <Navbar />
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="font-sora font-bold text-2xl">{t('listings')}</h1>
            <div className="text-sm text-[var(--text-secondary)]">{listings.length} {t('placesFound')} · {loc.radius}km</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => loc.setCategory(null)} data-testid="filter-all"
              className={`px-3 py-1.5 rounded-pill text-xs font-semibold transition ${loc.category === null ? "bg-primary text-white" : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"}`}>
              {t('all')}
            </button>
            {CATEGORIES.map((c) => {
              const labels = { all: t('all'), flat: t('flatRental'), pharmacy: t('pharmacy'), hospital: t('hospital'), restaurant: t('restaurant'), service: t('service') };
              return (
                <button key={c.key} onClick={() => loc.setCategory(c.key)} data-testid={`list-cat-${c.key}`}
                  className="px-3 py-1.5 rounded-pill text-xs font-semibold transition"
                  style={loc.category === c.key ? { background: c.color, color: "white" } : { background: c.bg, color: c.color }}>
                  {labels[c.key]}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({length: 6}).map((_, i) => <div key={i} className="h-72 skeleton rounded-xl"/>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
        {!loading && !listings.length && (
          <div className="text-center py-16 text-[var(--text-tertiary)]">
            <div className="font-sora text-lg">{t('noResults')}</div>
            <div className="text-sm mt-1">{t('tryDifferent')}</div>
          </div>
        )}
      </div>
    </div>
  );
}
