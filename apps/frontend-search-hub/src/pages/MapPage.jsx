import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiMapPin, FiNavigation, FiSearch, FiSliders, FiX, FiList } from "react-icons/fi";
import { Sparkles, Compass } from "lucide-react";
import Navbar from "../components/Navbar";
import MapView from "../components/MapView";
import { ListingCard } from "../components/ListingCard";
import { useLangStore, useLocationStore, useSearchModeStore } from "../store";
import { CATEGORIES, POPULAR_AREAS } from "../lib/constants";
import { CATEGORY_SYNONYMS } from "shared-config";
import { api } from "../lib/api";
import { Slider } from "../components/ui/slider";
import { Button } from "../components/ui/button";
import { io } from "socket.io-client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "../components/ui/drawer";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

function distKm(a, b, c, d) {
  const R = 6371, toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(c - a), dLng = toRad(d - b);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export default function MapPage() {
  const { lang } = useLangStore();
  const { t } = useTranslation();
  const loc = useLocationStore();
  const { mode: searchMode, setMode: setSearchMode } = useSearchModeStore();
  const [params, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [activePanel, setActivePanel] = useState(null);
  const [isAiMode, setIsAiMode] = useState(!!params.get("ai_q"));
  const lastProcessedAiQ = React.useRef("");
  const skipFetchRef = React.useRef(false);
  const listingsCache = React.useRef({});
  const currentAbortController = React.useRef(null);
  const fetchDebounceRef = React.useRef(null);
  const hasShownNoResultsRef = React.useRef(false);
  
  // Refs for socket listener state
  const isAiModeRef = React.useRef(isAiMode);
  const manualAddressRef = React.useRef(manualAddress);
  
  const filteredListings = React.useMemo(() => {
    // In nationwide mode, don't filter by radius — show all results
    if (loc.isNationwide) return listings;
    if (!loc.selectedLat || !loc.selectedLng || !loc.radius) return listings;
    return listings.filter(l => distKm(loc.selectedLat, loc.selectedLng, l.lat, l.lng) <= loc.radius);
  }, [listings, loc.selectedLat, loc.selectedLng, loc.radius, loc.isNationwide]);

  // Show "no matching place found" toast when search completes with empty results
  useEffect(() => {
    let timer;
    if (!loading && listings.length === 0 && loc.searchActive && !hasShownNoResultsRef.current) {
      timer = setTimeout(() => {
        // Double check after timeout in case socket brought results
        setListings((currentListings) => {
          if (currentListings.length === 0 && !hasShownNoResultsRef.current) {
            hasShownNoResultsRef.current = true;
            toast.error(t('noMatchFound'));
          }
          return currentListings;
        });
      }, 3500); // 3.5s delay to allow OSM background fetch to seed the DB and emit socket events
    }
    if (listings.length > 0) {
      hasShownNoResultsRef.current = false;
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [loading, listings.length, loc.searchActive, t, setListings]);

  useEffect(() => {
    isAiModeRef.current = isAiMode;
    manualAddressRef.current = manualAddress;
  }, [isAiMode, manualAddress]);

  // Sync searchMode store with URL params on mount
  useEffect(() => {
    if (params.get("ai_q")) {
      setIsAiMode(true);
      setSearchMode("ai");
    } else if (params.get("q")) {
      setIsAiMode(false);
      setSearchMode("standard");
    }
  }, []); // eslint-disable-line

  const parseQueryAndSyncStore = (query) => {
    if (!query) return;
    const lowerQuery = query.toLowerCase();
    
    // 1. Parse Category
    let detectedCategory = null;
    if (CATEGORY_SYNONYMS.flat.test(lowerQuery)) detectedCategory = "flat";
    else if (CATEGORY_SYNONYMS.pharmacy.test(lowerQuery)) detectedCategory = "pharmacy";
    else if (CATEGORY_SYNONYMS.hospital.test(lowerQuery)) detectedCategory = "hospital";
    else if (CATEGORY_SYNONYMS.restaurant.test(lowerQuery)) detectedCategory = "restaurant";
    else if (CATEGORY_SYNONYMS.service.test(lowerQuery)) detectedCategory = "service";

    if (detectedCategory) {
      loc.setCategory(detectedCategory);
      console.log("🎯 [Client Parse] Set category to:", detectedCategory);
    } else {
      loc.setCategory("all");
    }

    // 2. Parse Radius
    const radiusMatch = lowerQuery.match(/(\d+)\s*(?:km|k.m.|kilometer|kilometers|কিলোমিটার|কিমি)/i);
    if (radiusMatch) {
      const parsedRadius = Number(radiusMatch[1]);
      if (parsedRadius >= 1 && parsedRadius <= 20) {
        loc.setRadius(parsedRadius);
        console.log("🎯 [Client Parse] Set radius to:", parsedRadius);
      }
    }
  };

  const mapCenter = React.useMemo(() => {
    const lat = loc.selectedLat;
    const lng = loc.selectedLng;
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      return [23.8103, 90.4125];
    }
    return [lat, lng];
  }, [loc.selectedLat, loc.selectedLng]);

  useEffect(() => {
    const cat = params.get("cat");
    if (cat) loc.setCategory(cat);
  }, []); // eslint-disable-line

  useEffect(() => {
    const aiQuery = params.get("ai_q");
    if (aiQuery) {
      setIsAiMode(true);
      setManualAddress(aiQuery);
      parseQueryAndSyncStore(aiQuery);
    }
    const stdQuery = params.get("q");
    if (stdQuery && !aiQuery) {
      setIsAiMode(false);
      setManualAddress(stdQuery);
      parseQueryAndSyncStore(stdQuery);
    }
  }, [params]); // eslint-disable-line

  const fetchListings = React.useCallback(async (forceRefresh = false) => {
    const aiQuery = params.get("ai_q");

    // Cancel any pending request
    if (currentAbortController.current) {
      currentAbortController.current.abort();
    }
    const abortController = new AbortController();
    currentAbortController.current = abortController;
    const signal = abortController.signal;

    if (aiQuery) {
      // AI mode
      setLoading(true);
      loc.setSearchActive(true);
      try {
        if (aiQuery === lastProcessedAiQ.current) {
          const isAll = !loc.category || loc.category === 'all';
          // Fix 8: Cache key includes radius and query string
          const cacheKey = `ai_${aiQuery}_${loc.category}_${String(loc.selectedLat).slice(0,8)}_${String(loc.selectedLng).slice(0,8)}_${loc.radius}`;
          if (!forceRefresh && listingsCache.current[cacheKey]) {
            setListings(listingsCache.current[cacheKey]);
            setLoading(false);
            return;
          }
          const r = await api.get("/listings/search", {
            params: { lat: loc.selectedLat, lng: loc.selectedLng, radius: loc.radius || 10, category: isAll ? undefined : loc.category, limit: 5000 },
            signal
          });
          const data = r.data.listings || [];
          listingsCache.current[cacheKey] = data;
          setListings(data);
          return;
        }

        parseQueryAndSyncStore(aiQuery);
        hasShownNoResultsRef.current = false;
        const r = await api.post("/listings/ai-search", {
          query: aiQuery, userLat: loc.selectedLat, userLng: loc.selectedLng, radiusKm: loc.radius || 10
        }, { signal });
        
        const data = r.data.listings || [];
        setListings(data);
        lastProcessedAiQ.current = aiQuery;
        skipFetchRef.current = true;

        if (r.data.locationDetected && r.data.searchCenter) {
          loc.setNationwide(false);
          loc.setSelected(r.data.searchCenter.lat, r.data.searchCenter.lng, r.data.searchCenter.displayName || "Search Center");
          if (r.data.radius && Number.isFinite(r.data.radius)) {
            loc.setRadius(r.data.radius);
          }
          loc.triggerFocus();
        } else if (!r.data.locationDetected) {
          loc.setNationwide(true);
        } else if (data.length > 0) {
          loc.setNationwide(false);
          const first = data[0];
          loc.setSelected(first.lat, first.lng, first.area || first.title);
          loc.triggerFocus();
        }
        if (r.data.intent?.category) loc.setCategory(r.data.intent.category);
      } catch (error) {
        if (error.name === 'CanceledError' || error.message === 'canceled') return; // Ignore aborted requests
        console.error("Failed to load listings:", error);
        setListings([]);
        toast.error("Could not load map listings. Please make sure the backend is running.");
      } finally { 
        if (currentAbortController.current === abortController) {
          setLoading(false); 
        }
      }
      return;
    }

    // Standard mode
    lastProcessedAiQ.current = "";
    loc.setNationwide(false);
    loc.setSearchActive(true);
    const isAll = !loc.category || loc.category === 'all';
    const cacheKey = `${loc.category || 'all'}_${String(loc.selectedLat).slice(0,8)}_${String(loc.selectedLng).slice(0,8)}_${loc.radius}`;

    if (!forceRefresh && listingsCache.current[cacheKey]) {
      setListings(listingsCache.current[cacheKey]);
      return;
    }

    setLoading(true);
    try {
      const r = await api.get("/listings/search", {
        params: {
          q: params.get("q") || undefined,
          lat: loc.selectedLat,
          lng: loc.selectedLng,
          radius: loc.radius || 1,
          category: isAll ? undefined : loc.category,
          limit: 1000 // Ensure limit to map nodes
        },
        signal
      });
      const data = r.data.listings || [];
      listingsCache.current[cacheKey] = data; // Save to cache
      setListings(data);
    } catch (error) {
      if (error.name === 'CanceledError' || error.message === 'canceled') return; // Ignore aborts
      console.error("Failed to load listings:", error);
      toast.error("Could not load map listings. Please make sure the backend is running.");
    } finally { 
      if (currentAbortController.current === abortController) {
        setLoading(false); 
      }
    }
  }, [loc.selectedLat, loc.selectedLng, loc.radius, loc.category, manualAddress, params]); // eslint-disable-line


  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }
    // Debounce: cancel previous pending fetch and wait 80ms before firing.
    // This prevents rapid category clicks from firing multiple API calls.
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => {
      fetchListings();
    }, 80);
    return () => clearTimeout(fetchDebounceRef.current);
  }, [loc.selectedLat, loc.selectedLng, loc.radius, loc.category, params]); // eslint-disable-line

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (isAiMode) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      if (manualAddress.trim().length > 2) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddress)}&countrycodes=bd&limit=5`);
          const data = await res.json();
          setSuggestions(data);
          setShowSuggestions(true);
        } catch (err) {
          console.error("Suggestion error:", err);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 1000); // 1000ms strictly complies with Nominatim's absolute max of 1 request per second
    return () => clearTimeout(timer);
  }, [manualAddress, isAiMode]);

  // Use a ref to track current category and location inside the stable socket listener
  const categoryRef = React.useRef(loc.category);
  const latRef = React.useRef(loc.selectedLat);
  const lngRef = React.useRef(loc.selectedLng);
  const radiusRef = React.useRef(loc.radius);

  useEffect(() => { 
    categoryRef.current = loc.category; 
    latRef.current = loc.selectedLat;
    lngRef.current = loc.selectedLng;
    radiusRef.current = loc.radius;
  }, [loc.category, loc.selectedLat, loc.selectedLng, loc.radius]);

  useEffect(() => {
    // Socket is connected ONCE and never reconnected on category change.
    // The listener uses categoryRef so it always reads the latest category.
    const socketUrl = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL || "http://localhost:8001";
    const baseSocketUrl = socketUrl.endsWith('/api') ? socketUrl.slice(0, -4) : socketUrl;
    const socket = io(baseSocketUrl, { withCredentials: true });

    socket.on("new_listing", (newListing) => {
      const currentCategory = categoryRef.current;
      const isAll = !currentCategory || currentCategory === 'all';
      if (isAll || newListing.category === currentCategory) {
        // Enforce radius bounds client-side
        if (latRef.current && lngRef.current && radiusRef.current) {
          const R = 6371; // Earth's radius in km
          const dLat = (newListing.lat - latRef.current) * Math.PI / 180;
          const dLng = (newListing.lng - lngRef.current) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(latRef.current * Math.PI / 180) * Math.cos(newListing.lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;
          if (distance > radiusRef.current) {
            return; // Ignore this socket event, it's outside our search circle
          }
        }

        // Keyword enforcement to prevent socket cross-talk from other users' searches
        // Only enforce this in AI Mode. In Standard Mode, manualAddress is just a geographic anchor (e.g. "nakhalpara"),
        // so we shouldn't force the restaurant's name to contain "nakhalpara". Radius and Category checks are sufficient.
        if (isAiModeRef.current && lastProcessedAiQ.current && lastProcessedAiQ.current.trim().length > 2) {
          const words = lastProcessedAiQ.current.toLowerCase().split(/\s+/).filter(w => w.length > 2);
          const listingText = `${newListing.title || ''} ${newListing.description || ''} ${newListing.area || ''} ${(newListing.tags || []).join(' ')}`.toLowerCase();
          
          // If the AI query contains words, ensure at least one word from the query matches the listing text.
          if (words.length > 0) {
            const matches = words.some(w => listingText.includes(w));
            if (!matches) return; // Drop it
          }
        }

        // Also update cache so next category switch shows this new listing
        const cacheKey = `${newListing.category}_${String(newListing.lat).slice(0,8)}_${String(newListing.lng).slice(0,8)}_${loc.radius}`;
        if (listingsCache.current[cacheKey]) {
          listingsCache.current[cacheKey] = [newListing, ...listingsCache.current[cacheKey]];
        }
        setListings((prev) => {
          // If we had a nationwide fallback but received a socket listing (e.g., Nominatim failed but OSM found it), focus it.
          if (prev.length === 0 && useLocationStore.getState().isNationwide) {
            useLocationStore.getState().setNationwide(false);
            useLocationStore.getState().setSelected(newListing.lat, newListing.lng, newListing.area || newListing.title);
            useLocationStore.getState().setRadius(2); // Zoom in
          }
          return [newListing, ...prev];
        });
      }
    });

    return () => socket.disconnect();
  }, []); // eslint-disable-line -- intentionally empty: socket connects once only

  // Helper: clear AI search state when switching to Standard mode or selecting a location manually
  const cleanAiState = React.useCallback(() => {
    lastProcessedAiQ.current = "";
    loc.setNationwide(false);
    const newParams = new URLSearchParams(params);
    if (newParams.has("ai_q")) {
      newParams.delete("ai_q");
      setSearchParams(newParams);
    }
  }, [params, setSearchParams]); // eslint-disable-line

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cleanAiState();
        loc.setNationwide(false);
        loc.setUser(pos.coords.latitude, pos.coords.longitude);
        loc.setSelected(pos.coords.latitude, pos.coords.longitude, lang === "bn" ? "আমার অবস্থান" : "My Location");
        setShowSuggestions(false);
        setManualAddress("");
      },
      () => alert("Location permission denied")
    );
  };

  const handleSelectSuggestion = (s) => {
    cleanAiState();
    loc.setNationwide(false);
    parseQueryAndSyncStore(manualAddress); // Sync category before changing location
    loc.setSelected(parseFloat(s.lat), parseFloat(s.lon), s.display_name.split(',')[0]);
    // Do not clear manualAddress so the search context (like "restaurant in") remains
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const clearSearch = () => {
    setManualAddress("");
    setSuggestions([]);
    setShowSuggestions(false);
    loc.setSearchActive(false);
    loc.setNationwide(false);
    hasShownNoResultsRef.current = false;
    const newParams = new URLSearchParams(params);
    newParams.delete("ai_q");
    newParams.delete("q");
    setSearchParams(newParams);
  };

  const handleSearchAddress = async (e) => {
    if (e) e.preventDefault();
    const query = manualAddress.trim();
    if (!query) {
      toast.error(t("Please enter a search query"));
      return;
    }
    
    // Parse category and radius from the search query immediately to keep UI in sync
    parseQueryAndSyncStore(query);
    hasShownNoResultsRef.current = false;
    
    if (isAiMode) {
      setSearchParams({ ai_q: query });
    } else {
      // Standard mode: clear any stale AI search state
      cleanAiState();
      loc.setNationwide(false);
      if (suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
      } else {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=bd&limit=1`);
          const data = await res.json();
          if (data && data.length > 0) {
            handleSelectSuggestion(data[0]);
          } else {
            // No geocode result — trigger keyword-only search via backend
            setShowSuggestions(false);
            fetchListings();
          }
        } catch (err) {
          console.error("Geocoding error:", err);
          // On error, still try keyword search
          fetchListings();
        }
      }
    }
  };

  // Map click with confirmation when search is active
  const handleMapClick = (lat, lng) => {
    cleanAiState();
    setManualAddress(""); // Drop the text filter so we don't search for "Mirpur" in "Gulshan"
    loc.setNationwide(false);
    loc.setSelected(lat, lng, lang === "bn" ? "চিহ্নিত স্থান" : "Selected Pin");
  };

  const handleConfirmedMapClick = (lat, lng) => {
    cleanAiState();
    setManualAddress("");
    loc.setNationwide(false);
    loc.setSelected(lat, lng, lang === "bn" ? "চিহ্নিত স্থান" : "Selected Pin");
  };

  const togglePanel = (panel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background font-sans">
      <Navbar />
      <div className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
        
        {/* Floating Search Bar (Mobile Only) */}
        <div className="md:hidden absolute top-0 left-0 right-0 z-[100] pointer-events-none p-4 space-y-3">
          <div className="pointer-events-auto relative">
            <div className="flex items-center gap-2">
              <form onSubmit={handleSearchAddress} className={cn(
                "flex-1 flex items-center bg-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl px-4 py-3 border transition-all focus-within:ring-2 focus-within:ring-primary/30",
                isAiMode ? "border-primary/50" : "border-border/40"
              )}>
                <div className={cn("mr-3 transition-colors", isAiMode ? "text-primary animate-pulse" : "text-muted-foreground")}>
                   {isAiMode ? <Sparkles size={16} /> : <FiSearch size={16} />}
                </div>
                <input
                  type="text"
                  placeholder={isAiMode 
                    ? (lang === "bn" ? "এআই অনুসন্ধান..." : "Ask AI Search...")
                    : (lang === "bn" ? "কোথায় খুঁজছেন?" : "Where to?")
                  }
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  onFocus={() => setShowSuggestions(suggestions.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="flex-1 bg-transparent text-[15px] outline-none w-full text-foreground placeholder:text-muted-foreground/50"                  style={{ minWidth: 0 }}                />
                {manualAddress && (
                   <button type="button" onClick={clearSearch} className="p-1 hover:bg-muted rounded-full ml-1 transition-colors">
                      <FiX className="text-muted-foreground" size={18} />
                   </button>
                )}
                {/* Search button icon */}
                <button type="submit" className="p-1.5 ml-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors active:scale-90">
                  <FiSearch size={16} />
                </button>
              </form>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => togglePanel('filters')}
                className={cn(
                  "h-[52px] w-[52px] rounded-2xl bg-card/90 backdrop-blur-xl shadow-lg shrink-0 border-border/40 transition-all",
                  activePanel === 'filters' ? "border-primary bg-primary text-white" : "text-primary"
                )}
              >
                <FiSliders size={20} />
              </Button>
            </div>

            {/* Floating Suggestions Dropdown (Mobile) */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-[110%] left-0 right-0 bg-card/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-2xl border border-border/50 overflow-hidden z-[101]"
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full flex items-center gap-4 px-4 py-4 hover:bg-primary/5 transition-colors border-b border-border/10 last:border-0 text-left group"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <FiMapPin className="text-primary" size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-bold text-foreground truncate">
                          {s.display_name.split(',')[0]}
                        </div>
                        <div className="text-[12px] text-muted-foreground truncate font-medium opacity-70">
                          {s.display_name.split(',').slice(1).join(',').trim()}
                        </div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile AI Toggle Pills */}
          <div className="pointer-events-auto flex gap-2">
            <button 
              type="button"
              onClick={() => { setIsAiMode(false); setSearchMode("standard"); cleanAiState(); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-black transition-all border flex items-center gap-1",
                !isAiMode 
                  ? "bg-primary/20 text-primary border-primary/30" 
                  : "bg-card/90 backdrop-blur-md text-muted-foreground border-border/40 hover:bg-muted/40"
              )}
            >
              <Compass size={10} />
              🗺️ {t('standardMode')}
            </button>
            <button 
              type="button"
              onClick={() => { setIsAiMode(true); setSearchMode("ai"); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-black transition-all border flex items-center gap-1",
                isAiMode 
                  ? "bg-primary text-primary-foreground border-primary neon-glow-teal shadow-lg" 
                  : "bg-card/90 backdrop-blur-md text-muted-foreground border-border/40 hover:bg-muted/40"
              )}
            >
              <Sparkles size={10} className={cn(isAiMode ? "animate-pulse" : "")} />
              <span>{t('aiMode')}</span>
            </button>
          </div>

          <div className="pointer-events-auto flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {CATEGORIES.map((c) => {
              const active = loc.category === c.key || (!loc.category && c.key === 'all');
              return (
                <button
                  key={c.key}
                  onClick={() => loc.setCategory(c.key)}
                  className={cn(
                    "px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition shadow-sm border border-border/10",
                    active ? "bg-primary text-primary-foreground border-primary" : "bg-card/90 backdrop-blur-md text-foreground"
                  )}
                >
                  {c.key === 'all' ? t('all') : (t(c.key === 'flat' ? 'flatRental' : c.key))}
                </button>
              );
            })}
          </div>
        </div>

        {/* Map View */}
        <div className="h-full flex-1 relative z-0">
          <MapView
            center={mapCenter}
            listings={filteredListings}
            userLocation={loc.userLat ? [loc.userLat, loc.userLng] : null}
            radius={loc.radius}
            isNationwide={loc.isNationwide}
            confirmBeforeClick={loc.searchActive}
            onConfirmClick={handleConfirmedMapClick}
            onClickMap={handleMapClick}
            focusTrigger={loc.mapFocusTrigger}
          />
          
          <div className="md:hidden absolute bottom-24 right-4 z-[50]">
             <Button 
               size="icon" 
               className="h-12 w-12 rounded-full shadow-xl bg-card/95 backdrop-blur text-primary hover:bg-muted border border-border/40 transition-transform active:scale-90"
               onClick={useMyLocation}
             >
               <FiNavigation size={20} />
             </Button>
          </div>
        </div>

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-[420px] shrink-0 border-l border-border bg-card flex-col overflow-hidden relative z-10 shadow-2xl">
           <SidebarContent
             handleSearchAddress={handleSearchAddress}
             manualAddress={manualAddress}
             setManualAddress={setManualAddress}
             loc={loc}
             lang={lang}
             t={t}
             useMyLocation={useMyLocation}
             listings={filteredListings}
             loading={loading}
             suggestions={suggestions}
             onSelectSuggestion={handleSelectSuggestion}
             showSuggestions={showSuggestions}
             clearSearch={clearSearch}
             isDrawer={false}
             isAiMode={isAiMode}
             setIsAiMode={setIsAiMode}
             setShowSuggestions={setShowSuggestions}
             cleanAiState={cleanAiState}
             searchMode={searchMode}
             setSearchMode={setSearchMode}
           />
        </aside>

        {/* Mobile Results Trigger Pill */}
        <div className="md:hidden absolute bottom-6 left-0 right-0 z-[100] flex justify-center pointer-events-none">
          <motion.button 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => togglePanel('results')}
            className={cn(
              "pointer-events-auto flex items-center gap-2.5 px-6 py-3.5 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.3)] border transition-all duration-300",
              activePanel === 'results' 
                ? "bg-primary text-primary-foreground border-primary" 
                : "bg-foreground text-background border-white/10"
            )}
          >
            <FiList size={18} />
            <span className="text-[14px] font-black uppercase tracking-tight">{filteredListings.length} {t('placesFound')}</span>
          </motion.button>
        </div>

        {/* Unified Bottom Drawer for Results */}
        <Drawer open={activePanel === 'results'} onOpenChange={(o) => !o && setActivePanel(null)}>
          <DrawerContent className="h-[92vh] bg-background border-t-0 rounded-t-[32px] overflow-hidden z-[1000]">
             <div className="flex flex-col h-full overflow-hidden">
                <DrawerHeader className="px-6 pt-6 pb-2 shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <DrawerTitle className="text-2xl font-black tracking-tight text-foreground">{filteredListings.length} {t('placesFound')}</DrawerTitle>
                    <div className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-black uppercase">
                      {loc.isNationwide ? "🇧🇩 All BD" : `${loc.radius}km radius`}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium mb-4 flex items-center gap-2">
                     <FiMapPin className="text-primary" />
                     {t('searchNearBy')} <span className="text-foreground font-bold">{loc.selectedName || 'Dhaka'}</span>
                  </p>
                </DrawerHeader>
                
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 no-scrollbar pb-32">
                  {loading && <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 skeleton rounded-[24px]" />)}</div>}
                  {!loading && !filteredListings.length && (
                     <div className="text-center py-20 flex flex-col items-center">
                       <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center mb-6">
                         <FiMapPin size={32} className="text-muted-foreground/30" />
                       </div>
                       <p className="text-muted-foreground font-bold text-lg">{t('noMatchFound')}</p>
                     </div>
                  )}
                  {filteredListings.map((l) => (
                     <ListingCard key={l.id} listing={l}
                       distance={loc.userLat ? distKm(loc.userLat, loc.userLng, l.lat, l.lng) : null} />
                  ))}
                </div>
             </div>
          </DrawerContent>
        </Drawer>

        {/* Unified Bottom Drawer for Filters (mobile) */}
        <Drawer open={activePanel === 'filters'} onOpenChange={(o) => !o && setActivePanel(null)}>
          <DrawerContent className="h-[92vh] bg-background border-t-0 rounded-t-[32px] overflow-hidden z-[1000]">
             <div className="flex flex-col h-full overflow-hidden">
                <SidebarContent
                  handleSearchAddress={handleSearchAddress}
                  manualAddress={manualAddress}
                  setManualAddress={setManualAddress}
                  loc={loc}
                  lang={lang}
                  t={t}
                  useMyLocation={useMyLocation}
                  listings={filteredListings}
                  loading={loading}
                  suggestions={suggestions}
                  onSelectSuggestion={(s) => { handleSelectSuggestion(s); setActivePanel(null); }}
                  showSuggestions={showSuggestions}
                  clearSearch={clearSearch}
                  isDrawer={true}
                  isAiMode={isAiMode}
                  setIsAiMode={setIsAiMode}
                  setShowSuggestions={setShowSuggestions}
                  cleanAiState={cleanAiState}
                  searchMode={searchMode}
                  setSearchMode={setSearchMode}
                />
             </div>
          </DrawerContent>
        </Drawer>

      </div>
    </div>
  );
}

function SidebarContent({ handleSearchAddress, manualAddress, setManualAddress, loc, lang, t, useMyLocation, listings, loading, suggestions, onSelectSuggestion, showSuggestions, setShowSuggestions, clearSearch, isDrawer, isAiMode, setIsAiMode, cleanAiState, searchMode, setSearchMode }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <div className="p-7 border-b border-border bg-card relative z-10 shadow-sm">
          <h2 className={cn("font-black text-2xl mb-6 flex items-center gap-4 tracking-tighter text-foreground uppercase", lang === 'bn' ? 'font-bengali' : '')}>
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FiMapPin className="text-primary" size={22} />
            </div>
            <span>{t('searchNearBy')}</span>
          </h2>

          {/* AI Toggle Pills */}
          <div className="flex gap-2 mb-2">
            <button 
              type="button"
              onClick={() => { setIsAiMode(false); setSearchMode("standard"); if (cleanAiState) cleanAiState(); }}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-black transition-all border flex items-center gap-1.5",
                !isAiMode 
                  ? "bg-primary/10 text-primary border-primary/30" 
                  : "bg-background text-muted-foreground border-border hover:bg-muted/40"
              )}
            >
              <Compass size={12} />
              {t('standardMode')}
            </button>
            <button 
              type="button"
              onClick={() => { setIsAiMode(true); setSearchMode("ai"); }}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-black transition-all border flex items-center gap-1.5",
                isAiMode 
                  ? "bg-primary text-primary-foreground border-primary neon-glow-teal shadow-lg" 
                  : "bg-background text-muted-foreground border-border hover:bg-muted/40"
              )}
            >
              <Sparkles size={12} className={cn(isAiMode ? "animate-pulse" : "")} />
              <span>{t('aiMode')}</span>
            </button>
          </div>

          {/* Mode hint text */}
          <p className="text-[11px] text-muted-foreground/60 font-medium mb-4 ml-1">
            {isAiMode ? t('aiModeHint') : t('standardModeHint')}
          </p>

          <div className="relative mb-6 group">
            <form onSubmit={handleSearchAddress} className="relative flex items-center">
              <div className={cn(
                "absolute left-4 pointer-events-none transition-colors",
                isAiMode ? "text-primary animate-pulse" : "text-muted-foreground group-focus-within:text-primary"
              )}>
                 {isAiMode ? <Sparkles size={18} /> : <FiSearch size={18} />}
              </div>
              <input
                type="text"
                placeholder={isAiMode 
                  ? (lang === "bn" ? "এআই অনুসন্ধান (যেমন: ২ বেড ফ্ল্যাট ধানমন্ডি)..." : "Ask AI (e.g. 2-bed flat Dhanmondi)...")
                  : (lang === "bn" ? "এলাকা খুঁজুন..." : "Search area...")
                }
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className={cn(
                  "w-full pl-12 pr-20 py-4 rounded-[20px] border-2 bg-background text-[15px] font-medium outline-none transition-all shadow-sm text-foreground placeholder:text-muted-foreground/50",
                  isAiMode 
                    ? "border-primary/50 focus:ring-4 focus:ring-primary/10 focus:border-primary" 
                    : "border-border/40 focus:ring-4 focus:ring-primary/10 focus:border-primary"
                )}
                style={{ minWidth: 0 }}
              />
              {/* Action buttons (clear + search) */}
              <div className="absolute right-3 flex items-center gap-1">
                {manualAddress && (
                   <button type="button" onClick={clearSearch} className="p-1.5 hover:bg-muted rounded-full transition-colors">
                      <FiX className="text-muted-foreground hover:text-foreground" size={16} />
                   </button>
                )}
                <button 
                  type="submit" 
                  className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-all active:scale-90"
                  title={t('search')}
                >
                  <FiSearch size={16} />
                </button>
              </div>
            </form>

            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-[105%] left-0 right-0 bg-card shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[24px] border border-border/60 z-[100] overflow-hidden py-2"
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onSelectSuggestion(s)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-primary/5 transition-colors text-left group"
                    >
                      <FiMapPin className="text-primary shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" size={18} />
                      <div className="min-w-0">
                        <div className="text-[15px] font-bold text-foreground truncate tracking-tight">{s.display_name.split(',')[0]}</div>
                        <div className="text-[12px] text-muted-foreground truncate opacity-70 font-medium">{s.display_name.split(',').slice(1, 3).join(', ')}</div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-primary/5 text-primary text-xs font-black mb-8 border border-primary/10 uppercase tracking-widest overflow-hidden">
            <div className="w-2 h-2 rounded-full bg-primary animate-ping shrink-0" />
            <span className="truncate min-w-0">{loc.isNationwide ? "🇧🇩 All Bangladesh" : loc.selectedName}</span>
          </div>

          <div className="mb-6 sm:mb-10 px-1">
            <div className="flex items-center justify-between text-[14px] font-black text-foreground mb-4 sm:mb-6 uppercase tracking-wider">
              <span>{t('radius')}</span>
              <span className="text-primary bg-primary/10 px-3 py-1 rounded-lg">
                {loc.isNationwide ? "∞" : `${loc.radius} km`}
              </span>
            </div>
            <Slider 
              value={[loc.radius]} 
              min={1} 
              max={20} 
              step={1}
              onValueChange={(v) => {
                loc.setRadius(v[0]);
                // If user drags radius, switch off nationwide mode
                if (loc.isNationwide) loc.setNationwide(false);
              }} 
              className="py-2" 
              disabled={loc.isNationwide}
            />
          </div>

          <div className="mb-6 sm:mb-8">
            <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 sm:mb-5 px-1">{t('categories')}</h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {CATEGORIES.map((c) => {
                const labels = { all: t('all'), flat: t('flatRental'), pharmacy: t('pharmacy'), hospital: t('hospital'), restaurant: t('restaurant'), service: t('service') };
                const active = loc.category === c.key || (!loc.category && c.key === 'all');
                return (
                  <button
                    key={c.key}
                    onClick={() => loc.setCategory(c.key)}
                    className={cn(
                      "px-3 py-3 sm:px-4 sm:py-4 rounded-[16px] sm:rounded-[20px] text-[11px] sm:text-[13px] font-black transition-all border-2 flex flex-col items-start gap-2.5 sm:gap-3 group relative overflow-hidden",
                      active 
                        ? "bg-primary text-primary-foreground border-primary shadow-xl scale-[1.03] -translate-y-1" 
                        : "bg-background text-foreground border-border/60 hover:border-primary/40 hover:bg-muted/40"
                    )}
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-[10px] sm:rounded-[14px] flex items-center justify-center transition-all duration-300" style={{ backgroundColor: active ? 'rgba(255,255,255,0.2)' : `${c.color}20` }}>
                       <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: active ? "white" : c.color }} />
                    </div>
                    <span className={cn("text-left w-full truncate", lang === 'bn' ? 'font-bengali' : 'uppercase tracking-tight')}>{labels[c.key]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button variant="outline" className="w-full gap-3 py-6 sm:py-8 rounded-[18px] sm:rounded-[24px] border-2 border-border/60 font-black uppercase text-xs sm:text-sm tracking-[0.1em] hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all group shadow-sm active:scale-95" onClick={useMyLocation}>
            <FiNavigation size={18} className="group-hover:rotate-45 transition-transform" /> {t('useMyLocation')}
          </Button>

          <div className="mt-6 sm:mt-8 flex flex-wrap gap-2 sm:gap-2.5">
            {POPULAR_AREAS.map((p) => (
              <button key={p.name} onClick={() => { loc.setNationwide(false); loc.setSelected(p.lat, p.lng, p.name); }}
                className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-[11px] sm:text-[12px] font-black uppercase tracking-tighter bg-muted/40 hover:bg-primary hover:text-primary-foreground transition-all border border-border/40 shadow-sm active:scale-95 text-foreground">
                {t(`popularAreas.${p.name.toLowerCase()}`)}
              </button>
            ))}
          </div>
        </div>

        {!isDrawer && (
          <div className="p-7 bg-background no-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-2xl tracking-tighter text-foreground uppercase">{listings.length} {t('placesFound')}</h3>
              <div className="h-1.5 w-16 bg-primary/20 rounded-full" />
            </div>
            
            {loading && <div className="space-y-6">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 skeleton rounded-[28px] shadow-sm border border-border/10" />)}</div>}
            
            <div className="space-y-6 pb-12">
              {listings.slice(0, 100).map((l) => (
                <ListingCard key={l.id} listing={l}
                  distance={loc.userLat ? distKm(loc.userLat, loc.userLng, l.lat, l.lng) : null} />
              ))}
              
              {listings.length > 100 && (
                <div className="text-center py-6 text-muted-foreground text-[13px] font-bold tracking-tight bg-muted/20 rounded-[20px] border border-border/20">
                  Showing top 100 of {listings.length} results.<br/>Explore the map to see more.
                </div>
              )}
              
              {!loading && !listings.length && (
                <div className="text-center py-20 text-muted-foreground bg-card rounded-[40px] border-2 border-dashed border-border/40 flex flex-col items-center px-12">
                  <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center mb-8">
                    <FiMapPin size={32} className="opacity-30" />
                  </div>
                  <p className="font-black text-foreground text-xl mb-3 tracking-tighter">{t('noMatchFound')}</p>
                  <p className="text-sm leading-relaxed font-medium opacity-60">{t('tryDifferent')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
