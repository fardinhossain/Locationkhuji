import React, { useEffect } from "react";
import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuthStore } from "./store";
import { api } from "./lib/api";
import HomePage from "./pages/HomePage";
import MapPage from "./pages/MapPage";
import ListPage from "./pages/ListPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { OwnerDashboard, AddListingPage, EditListingPage, SavedPage, UserDashboard, AdminDashboard, AdminUsersPage, AdminListingsPage } from "./pages/DashboardPages";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  const { token, setAuth, clear } = useAuthStore();

  useEffect(() => {
    if (token) {
      api.get("/auth/me").then((r) => setAuth(r.data, token)).catch(() => clear());
    }
  }, []); // eslint-disable-line

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/list" element={<ListPage />} />
        <Route path="/listing/:id" element={<ListingDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/user/dashboard" element={<ProtectedRoute roles={["user"]}><UserDashboard /></ProtectedRoute>} />
        <Route path="/user/saved" element={<ProtectedRoute roles={["user"]}><SavedPage /></ProtectedRoute>} />

        <Route path="/owner/dashboard" element={<ProtectedRoute roles={["owner"]}><OwnerDashboard /></ProtectedRoute>} />
        <Route path="/owner/listings/add" element={<ProtectedRoute roles={["owner", "admin"]}><AddListingPage /></ProtectedRoute>} />
        <Route path="/owner/listings/:id/edit" element={<ProtectedRoute roles={["owner", "admin"]}><EditListingPage /></ProtectedRoute>} />

        <Route path="/admin/dashboard" element={<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><AdminUsersPage /></ProtectedRoute>} />
        <Route path="/admin/listings" element={<ProtectedRoute roles={["admin"]}><AdminListingsPage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
