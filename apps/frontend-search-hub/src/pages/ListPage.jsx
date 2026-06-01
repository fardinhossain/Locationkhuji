import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { ListingCard } from "../components/ListingCard";
import { useLocationStore, useLangStore } from "../store";
import { CATEGORIES } from "../lib/constants";
import { api } from "../lib/api";
import { BDLocationEngine } from "shared-config";
import { useTranslation } from "react-i18next";

export default function ListPage() {
  const loc = useLocationStore();
  const { lang } = useLangStore();
  const { t } = useTranslation();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);

  const [division, setDivision] = useState("");
  const [district, setDistrict] = useState("");
  const [thana, setThana] = useState("");

  const divisions = BDLocationEngine.getDivisions();
  const districts = BDLocationEngine.getDistricts(division);
  const upazilas = BDLocationEngine.getUpazilas(district);

  useEffect(() => {
    setLoading(true);
    api.get("/listings/nearby", {
      params: { 
        lat: loc.selectedLat, 
        lng: loc.selectedLng, 
        radius: loc.radius, 
        category: loc.category || undefined, 
        division: division || undefined,
        district: district || undefined,
        thana: thana || undefined,
        limit: 60 
      }
    }).then((r) => setListings(r.data.listings || [])).finally(() => setLoading(false));
  }, [loc.selectedLat, loc.selectedLng, loc.radius, loc.category, division, district, thana]);

  const handleLocationSelect = (type, val) => {
    if (type === "division") {
      setDivision(val); setDistrict(""); setThana("");
      const div = BDLocationEngine.getDivisions().find(d => String(d.id) === val);
      if (div && div.coordinates) loc.setSelected(div.coordinates.latitude, div.coordinates.longitude, div.name);
    } else if (type === "district") {
      setDistrict(val); setThana("");
      const dist = BDLocationEngine.getDistricts().find(d => String(d.id) === val);
      if (dist && dist.coordinates) loc.setSelected(dist.coordinates.latitude, dist.coordinates.longitude, dist.name);
    } else if (type === "thana") {
      setThana(val);
      // Fallback to district coords if thana coords aren't available
      const dist = BDLocationEngine.getDistricts().find(d => String(d.id) === district);
      const thn = BDLocationEngine.getUpazilas().find(u => String(u.id) === val);
      if (dist && dist.coordinates) {
        loc.setSelected(dist.coordinates.latitude, dist.coordinates.longitude, thn?.name || dist.name);
      }
    }
  };

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
            {CATEGORIES.filter(c => c.key !== 'all').map((c) => {
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

        {/* Hierarchical Filters */}
        <div className="flex flex-wrap gap-3 mb-8 bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border-light)]">
          <select 
            value={division} 
            onChange={(e) => handleLocationSelect("division", e.target.value)}
            className="bg-[var(--bg-elevated)] border border-[var(--border-medium)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-primary transition"
          >
            <option value="">{t('all')} Divisions</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{lang === 'bn' ? d.bnName : d.name}</option>)}
          </select>

          <select 
            value={district} 
            onChange={(e) => handleLocationSelect("district", e.target.value)}
            disabled={!division}
            className="bg-[var(--bg-elevated)] border border-[var(--border-medium)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-primary transition disabled:opacity-50"
          >
            <option value="">{t('all')} Districts</option>
            {districts.map(d => <option key={d.id} value={d.id}>{lang === 'bn' ? d.bnName : d.name}</option>)}
          </select>

          <select 
            value={thana} 
            onChange={(e) => handleLocationSelect("thana", e.target.value)}
            disabled={!district}
            className="bg-[var(--bg-elevated)] border border-[var(--border-medium)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-primary transition disabled:opacity-50"
          >
            <option value="">{t('all')} Thanas/Upazilas</option>
            {upazilas.map(u => <option key={u.id} value={u.id}>{lang === 'bn' ? u.bnName : u.name}</option>)}
          </select>
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
