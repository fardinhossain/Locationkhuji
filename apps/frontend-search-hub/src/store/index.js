import { create } from "zustand";
import { persist } from "zustand/middleware";

// Map Theme store
export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: "dark",
      toggle: () => {
        const next = get().theme === "light" ? "dark" : "light";
        set({ theme: next });
      },
      hydrate: () => {
        // App is always dark, map theme handled locally
      },
    }),
    { name: "lk_map_theme" }
  )
);

// Language store
export const useLangStore = create(
  persist((set) => ({ lang: "en", setLang: (l) => set({ lang: l }) }), { name: "lk_lang" })
);

// Auth store
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        if (token) localStorage.setItem("lk_token", token);
        set({ user, token });
      },
      updateUser: (partial) => set((s) => ({ user: { ...s.user, ...partial } })),
      clear: () => {
        localStorage.removeItem("lk_token");
        set({ user: null, token: null });
      },
    }),
    { name: "lk_auth", partialize: (s) => ({ user: s.user, token: s.token }) }
  )
);

// Location store
export const useLocationStore = create((set) => ({
  userLat: null,
  userLng: null,
  selectedLat: 23.8103,
  selectedLng: 90.4125,
  selectedName: "Dhaka",
  radius: 5,
  category: null,
  searchActive: false,
  isNationwide: false,
  setUser: (lat, lng) => set({ userLat: lat, userLng: lng, selectedLat: lat, selectedLng: lng, selectedName: "My Location" }),
  setSelected: (lat, lng, name) => set({ selectedLat: lat, selectedLng: lng, selectedName: name }),
  setRadius: (r) => set({ radius: r }),
  setCategory: (c) => set({ category: c }),
  setSearchActive: (v) => set({ searchActive: v }),
  setNationwide: (v) => set({ isNationwide: v }),
}));

// Search mode store (persisted)
export const useSearchModeStore = create(
  persist((set) => ({ mode: "ai", setMode: (m) => set({ mode: m }) }), { name: "lk_search_mode" })
);
