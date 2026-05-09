import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Navbar from "../components/Navbar";
import MapView from "../components/MapView";
import { ListingCard } from "../components/ListingCard";
import { CATEGORIES } from "../lib/constants";
import { useAuthStore } from "../store";
import { api, fileUrl } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

// ----- Listing Form (shared add/edit) -----
function ListingForm({ initial, onSubmit, submitLabel }) {
  const [form, setForm] = useState(initial || {
    title: "", description: "", category: "flat",
    address: "", area: "", city: "Dhaka",
    lat: 23.8103, lng: 90.4125,
    contact_phone: "", contact_whatsapp: "", contact_email: "",
    images: [], details: {}, tags: [],
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const setDetail = (k, v) => setForm((f) => ({ ...f, details: { ...f.details, [k]: v } }));

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const newIds = [];
      for (const f of files.slice(0, 6 - form.images.length)) {
        const fd = new FormData(); fd.append("file", f);
        const r = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
        newIds.push(r.data.id);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...newIds].slice(0, 6) }));
      toast.success(`${newIds.length} uploaded`);
    } catch { toast.error("Upload failed"); } finally { setUploading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await onSubmit(form); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4 max-w-3xl" data-testid="listing-form">
      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map((c) => (
          <button key={c.key} type="button"
            data-testid={`form-cat-${c.key}`}
            onClick={() => setForm({...form, category: c.key, details: {}})}
            className="px-4 py-3 rounded-lg font-semibold text-sm border-2 transition"
            style={form.category === c.key
              ? { background: c.color, color: "white", borderColor: c.color }
              : { background: c.bg, color: c.color, borderColor: "transparent" }}>
            {c.key}
          </button>
        ))}
      </div>

      <Input data-testid="form-title" placeholder="Title" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} required />
      <Textarea data-testid="form-desc" placeholder="Description" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} required rows={3}/>

      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Address" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} required />
        <Input placeholder="Area / Thana" value={form.area} onChange={(e) => setForm({...form, area: e.target.value})} required />
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Click on map to set location</div>
        <div className="h-64 rounded-xl overflow-hidden border border-[var(--border-light)]">
          <MapView center={[form.lat, form.lng]} listings={[]} userLocation={[form.lat, form.lng]}
            onClickMap={(lat, lng) => setForm({...form, lat, lng})} radius={0.001} />
        </div>
        <div className="text-xs mt-2 text-[var(--text-tertiary)]">Coords: {form.lat.toFixed(4)}, {form.lng.toFixed(4)}</div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Input placeholder="Phone" value={form.contact_phone} onChange={(e) => setForm({...form, contact_phone: e.target.value})} required />
        <Input placeholder="WhatsApp" value={form.contact_whatsapp} onChange={(e) => setForm({...form, contact_whatsapp: e.target.value})} />
        <Input placeholder="Email" type="email" value={form.contact_email} onChange={(e) => setForm({...form, contact_email: e.target.value})} />
      </div>

      {/* Category-specific */}
      <div className="p-4 rounded-lg bg-[var(--bg-elevated)]">
        <div className="font-semibold text-sm mb-3">Details ({form.category})</div>
        {form.category === "flat" && (
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Bedrooms" type="number" onChange={(e) => setDetail("bedrooms", +e.target.value)} value={form.details.bedrooms || ""}/>
            <Input placeholder="Bathrooms" type="number" onChange={(e) => setDetail("bathrooms", +e.target.value)} value={form.details.bathrooms || ""}/>
            <Input placeholder="Area sqft" type="number" onChange={(e) => setDetail("area_sqft", +e.target.value)} value={form.details.area_sqft || ""}/>
            <Input placeholder="Rent (BDT/mo)" type="number" onChange={(e) => setDetail("rent_price", +e.target.value)} value={form.details.rent_price || ""}/>
            <label className="flex items-center gap-2 text-sm col-span-2"><input type="checkbox" checked={!!form.details.furnished} onChange={(e) => setDetail("furnished", e.target.checked)}/> Furnished</label>
          </div>
        )}
        {form.category === "pharmacy" && (
          <div className="grid grid-cols-1 gap-3">
            <Input placeholder="Open hours" onChange={(e) => setDetail("open_hours", e.target.value)} value={form.details.open_hours || ""}/>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.details.emergency} onChange={(e) => setDetail("emergency", e.target.checked)}/> Emergency</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.details.delivery} onChange={(e) => setDetail("delivery", e.target.checked)}/> Delivery</label>
          </div>
        )}
        {form.category === "hospital" && (
          <div className="grid gap-3">
            <Input placeholder="Specialties (comma separated)" onChange={(e) => setDetail("specialty", e.target.value.split(",").map(s=>s.trim()))} defaultValue={(form.details.specialty || []).join(",")}/>
            <Input placeholder="Beds" type="number" onChange={(e) => setDetail("beds", +e.target.value)} value={form.details.beds || ""}/>
            <Input placeholder="Open hours" onChange={(e) => setDetail("open_hours", e.target.value)} value={form.details.open_hours || ""}/>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.details.emergency} onChange={(e) => setDetail("emergency", e.target.checked)}/> Emergency</label>
          </div>
        )}
        {form.category === "fashion" && (
          <div className="grid gap-3">
            <Input placeholder="Brands (comma separated)" onChange={(e) => setDetail("brands", e.target.value.split(",").map(s=>s.trim()))} defaultValue={(form.details.brands || []).join(",")}/>
            <Input placeholder="Open hours" onChange={(e) => setDetail("open_hours", e.target.value)} value={form.details.open_hours || ""}/>
            <Input placeholder="Price range" onChange={(e) => setDetail("price_range", e.target.value)} value={form.details.price_range || ""}/>
          </div>
        )}
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Images (max 6)</div>
        <input data-testid="form-images" type="file" accept="image/*" multiple onChange={handleFile} disabled={uploading || form.images.length >= 6} className="text-sm"/>
        {uploading && <div className="text-xs text-primary mt-1">Uploading...</div>}
        <div className="flex gap-2 mt-3 flex-wrap">
          {form.images.map((id, i) => (
            <div key={id} className="relative">
              <img src={fileUrl(id)} alt="" className="w-20 h-20 object-cover rounded-md"/>
              <button type="button" onClick={() => setForm({...form, images: form.images.filter((_,j) => j !== i)})}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs">×</button>
            </div>
          ))}
        </div>
      </div>

      <Button data-testid="form-submit" type="submit" disabled={busy} className="bg-primary text-white px-8 h-11 rounded-pill">
        {busy ? "..." : submitLabel}
      </Button>
    </form>
  );
}

// ----- Owner Dashboard -----
export function OwnerDashboard() {
  const [listings, setListings] = useState([]);
  useEffect(() => { api.get("/listings/my").then((r) => setListings(r.data.listings || [])); }, []);
  const stats = {
    total: listings.length,
    approved: listings.filter((l) => l.is_approved && l.is_active).length,
    pending: listings.filter((l) => !l.is_approved && l.is_active).length,
  };
  return (
    <div>
      <Navbar />
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="font-sora font-bold text-2xl">Owner Dashboard</h1>
          <Link to="/owner/listings/add" data-testid="add-listing-btn"><Button className="bg-primary text-white">+ Add Listing</Button></Link>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          <StatCard label="Total" value={stats.total} color="#6366F1"/>
          <StatCard label="Approved" value={stats.approved} color="#10B981"/>
          <StatCard label="Pending" value={stats.pending} color="#F59E0B"/>
        </div>
        <h2 className="font-sora font-semibold text-lg mt-8 mb-3">My Listings</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((l) => (
            <div key={l.id} className="bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-xl p-4">
              <div className="font-semibold">{l.title}</div>
              <div className="text-xs text-[var(--text-tertiary)]">{l.area}</div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-pill ${l.is_approved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {l.is_approved ? "Approved" : "Pending"}
                </span>
                <Link to={`/listing/${l.id}`} className="text-xs text-primary ml-auto">View</Link>
                <Link to={`/owner/listings/${l.id}/edit`} className="text-xs text-primary">Edit</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const StatCard = ({ label, value, color }) => (
  <div className="bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-xl p-5">
    <div className="text-xs uppercase tracking-wider text-[var(--text-tertiary)]">{label}</div>
    <div className="font-sora font-bold text-3xl mt-1" style={{ color }}>{value}</div>
  </div>
);

export function AddListingPage() {
  const nav = useNavigate();
  return (
    <div>
      <Navbar />
      <div className="max-w-[1100px] mx-auto px-6 py-8">
        <h1 className="font-sora font-bold text-2xl mb-6">Add New Listing</h1>
        <ListingForm submitLabel="Submit for Review" onSubmit={async (data) => {
          try {
            await api.post("/listings", data);
            toast.success("Submitted for review!");
            nav("/owner/dashboard");
          } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
        }}/>
      </div>
    </div>
  );
}

export function EditListingPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => { api.get(`/listings/${id}`).then((r) => setData({
    ...r.data, contact_phone: r.data.contact?.phone, contact_whatsapp: r.data.contact?.whatsapp, contact_email: r.data.contact?.email,
  })); }, [id]);
  if (!data) return <div><Navbar/><div className="p-10">Loading...</div></div>;
  return (
    <div>
      <Navbar />
      <div className="max-w-[1100px] mx-auto px-6 py-8">
        <h1 className="font-sora font-bold text-2xl mb-6">Edit Listing</h1>
        <ListingForm initial={data} submitLabel="Update" onSubmit={async (form) => {
          try {
            await api.put(`/listings/${id}`, form);
            toast.success("Updated!");
            nav("/owner/dashboard");
          } catch (err) { toast.error("Failed"); }
        }}/>
      </div>
    </div>
  );
}

// ----- Saved -----
export function SavedPage() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/users/me/saved").then((r) => setItems(r.data.listings || [])); }, []);
  return (
    <div>
      <Navbar />
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <h1 className="font-sora font-bold text-2xl">Saved Places</h1>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {items.map((l) => <ListingCard key={l.id} listing={l} />)}
          {!items.length && <div className="col-span-full text-center text-[var(--text-tertiary)] py-10">No saved places yet</div>}
        </div>
      </div>
    </div>
  );
}

// ----- User Dashboard -----
export function UserDashboard() {
  const { user } = useAuthStore();
  return (
    <div>
      <Navbar />
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <div className="rounded-2xl p-8 text-white" style={{ background: "linear-gradient(135deg, #00C9A7, #0D1B2A)" }}>
          <h1 className="font-sora font-bold text-3xl">Welcome, {user?.name}! 👋</h1>
          <p className="mt-2 opacity-80">Discover places near you</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          <StatCard label="Saved" value={user?.saved_listings?.length || 0} color="#00C9A7"/>
          <Link to="/map" className="bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-xl p-5 hover:-translate-y-1 transition">
            <div className="font-sora font-semibold">Open Map →</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">Explore listings</div>
          </Link>
          <Link to="/user/saved" className="bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-xl p-5 hover:-translate-y-1 transition">
            <div className="font-sora font-semibold">Saved Places →</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">Your bookmarks</div>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ----- Admin -----
export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const load = async () => {
    const [s, p] = await Promise.all([api.get("/admin/stats"), api.get("/admin/listings", { params: { status: "pending" } })]);
    setStats(s.data); setPending(p.data.listings || []);
  };
  useEffect(() => { load(); }, []);

  const action = async (lid, type) => {
    try { await api.put(`/admin/listings/${lid}/${type}`); toast.success(type); load(); }
    catch { toast.error("Failed"); }
  };

  return (
    <div>
      <Navbar />
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <h1 className="font-sora font-bold text-2xl">Admin Dashboard</h1>
        {stats && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <StatCard label="Total Users" value={stats.total_users} color="#6366F1"/>
            <StatCard label="Owners" value={stats.total_owners} color="#00C9A7"/>
            <StatCard label="Listings" value={stats.total_listings} color="#10B981"/>
            <StatCard label="Pending" value={stats.pending} color="#F59E0B"/>
          </div>
        )}
        <h2 className="font-sora font-semibold text-lg mt-8 mb-4">Pending Approvals ({pending.length})</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {pending.map((l) => (
            <div key={l.id} className="bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-xl p-5">
              <div className="font-semibold">{l.title}</div>
              <div className="text-xs text-[var(--text-tertiary)] mt-1">{l.category} · {l.area}</div>
              <p className="text-sm text-[var(--text-secondary)] mt-2 line-clamp-2">{l.description}</p>
              <div className="flex gap-2 mt-4">
                <Button data-testid={`approve-${l.id}`} className="bg-green-500 hover:bg-green-600 text-white flex-1" onClick={() => action(l.id, "approve")}>Approve</Button>
                <Button data-testid={`reject-${l.id}`} variant="destructive" className="flex-1" onClick={() => action(l.id, "reject")}>Reject</Button>
                <Link to={`/listing/${l.id}`}><Button variant="outline">View</Button></Link>
              </div>
            </div>
          ))}
          {!pending.length && <div className="col-span-full text-center text-[var(--text-tertiary)] py-10">No pending listings</div>}
        </div>

        <h2 className="font-sora font-semibold text-lg mt-8 mb-4">Quick Links</h2>
        <div className="flex gap-3">
          <Link to="/admin/users"><Button variant="outline">Manage Users</Button></Link>
          <Link to="/admin/listings"><Button variant="outline">All Listings</Button></Link>
        </div>
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const load = async () => { const r = await api.get("/admin/users"); setUsers(r.data.users || []); };
  useEffect(() => { load(); }, []);
  const toggle = async (u) => {
    await api.put(`/admin/users/${u.id}`, { is_active: !u.is_active });
    load();
  };
  return (
    <div>
      <Navbar />
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <h1 className="font-sora font-bold text-2xl mb-6">Manage Users</h1>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-elevated)] text-left">
              <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border-light)]">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3 text-[var(--text-secondary)]">{u.email}</td>
                  <td className="p-3 uppercase text-xs">{u.role}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-pill ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3"><Button size="sm" variant="outline" onClick={() => toggle(u)}>{u.is_active ? "Deactivate" : "Activate"}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminListingsPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  const load = React.useCallback(async () => {
    const r = await api.get("/admin/listings", { params: filter ? { status: filter } : {} });
    setItems(r.data.listings || []);
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <Navbar />
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <h1 className="font-sora font-bold text-2xl mb-6">All Listings</h1>
        <div className="flex gap-2 mb-4">
          {["", "pending", "approved", "rejected"].map((f) => (
            <button key={f || "all"} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-pill text-xs font-semibold ${filter === f ? "bg-primary text-white" : "bg-[var(--bg-elevated)]"}`}>
              {f || "all"}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((l) => <ListingCard key={l.id} listing={l}/>)}
        </div>
      </div>
    </div>
  );
}
