import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FiMapPin, FiPhone, FiMail, FiNavigation, FiBookmark, FiShare2, FiFlag, FiTrash2, FiChevronLeft, FiChevronRight, FiLock } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { toast } from "sonner";
import Navbar from "../components/Navbar";
import MapView from "../components/MapView";
import { CategoryBadge, StarRating } from "../components/ListingCard";
import { api, fileUrl } from "../lib/api";
import { useAuthStore, useLangStore } from "../store";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { useTranslation } from "react-i18next";

function StarPicker({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} data-testid={`star-${n}`}
          className={`text-2xl transition ${n <= value ? "text-star" : "text-[var(--border-medium)]"}`}>★</button>
      ))}
    </div>
  );
}

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const { lang } = useLangStore();
  const { t } = useTranslation();
  const [listing, setListing] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [activeImg, setActiveImg] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = React.useCallback(async () => {
    try {
      const [l, rv] = await Promise.all([api.get(`/listings/${id}`), api.get(`/listings/${id}/reviews`)]);
      setListing(l.data); setReviews(rv.data.reviews || []);
    } catch (err) {
      toast.error("Failed to load listing");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!user) return toast.error("Please login to review");
    setSubmitting(true);
    try {
      await api.post(`/listings/${id}/reviews`, { rating, comment });
      toast.success("Review added!");
      setComment(""); setRating(5);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setSubmitting(false); }
  };

  const toggleSave = async () => {
    if (!user) {
      toast.error("Please login to save places.");
      navigate(`/login?next=/listing/${id}`);
      return;
    }
    try {
      const r = await api.post(`/listings/${id}/save`);
      const newSaved = r.data.saved
        ? [...(user.saved_listings || []), id]
        : (user.saved_listings || []).filter((x) => x !== id);
      updateUser({ saved_listings: newSaved });
      toast.success(r.data.saved ? "Saved" : "Removed");
    } catch (err) {
      toast.error("Action failed");
    }
  };

  const handleReport = async () => {
    if (!user) return toast.error("Please login to report");
    try {
      await api.post(`/listings/${id}/report`);
      toast.success("Listing reported for review");
    } catch (err) {
      toast.error("Failed to report listing");
    }
  };

  const handleRemove = async () => {
    if (!window.confirm("Are you sure you want to remove this listing?")) return;
    try {
      await api.delete(`/listings/${id}`);
      toast.success("Listing removed");
      navigate(user.role === "admin" ? "/admin/listings" : "/owner/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to remove listing");
    }
  };

  if (!listing) return <div><Navbar /><div className="p-10 text-center">Loading...</div></div>;

  const isSaved = user?.saved_listings?.includes(id);
  const d = listing.details || {};
  const img = listing.images?.[activeImg] ? (listing.images[activeImg].startsWith("http") ? listing.images[activeImg] : fileUrl(listing.images[activeImg])) : null;

  const myReview = reviews.find((r) => r.user_id === user?.id);

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[1fr_360px] gap-8">
        <div>
          {/* Gallery */}
          <div className="relative h-[400px] rounded-2xl overflow-hidden bg-[var(--bg-elevated)] shadow-lg border border-[var(--border-light)] group">
            {img ? <img src={img} alt={listing.title} className="w-full h-full object-cover transition-opacity duration-300"/> :
              <div className="w-full h-full flex items-center justify-center text-[var(--text-tertiary)]"><FiMapPin size={48}/></div>}
            
            {listing.images?.length > 1 && (
              <>
                <button 
                  onClick={() => setActiveImg((prev) => (prev > 0 ? prev - 1 : listing.images.length - 1))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-black/80"
                >
                  <FiChevronLeft size={24}/>
                </button>
                <button 
                  onClick={() => setActiveImg((prev) => (prev < listing.images.length - 1 ? prev + 1 : 0))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-black/80"
                >
                  <FiChevronRight size={24}/>
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {listing.images.map((_, i) => (
                    <button 
                      key={i} 
                      onClick={() => setActiveImg(i)} 
                      className={`w-2.5 h-2.5 rounded-full transition-all shadow-sm ${i === activeImg ? 'bg-primary w-5' : 'bg-white/60 hover:bg-white'}`}
                    />
                  ))}
                </div>
              </>
            )}
            <div className="absolute top-4 left-4 flex gap-2">
              <CategoryBadge category={listing.category} />
              {listing.is_active && <span className="px-3 py-1 rounded-pill bg-emerald-500 text-white text-[10px] font-bold shadow-lg">✓ ACTIVE</span>}
            </div>
          </div>

          {/* Header */}
          <div className="mt-6 bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-2xl p-6 shadow-sm">
            <h1 data-testid="listing-title" className="font-sora font-bold text-3xl text-[var(--text-primary)]">{listing.title}</h1>
            <div className="flex items-center gap-2 mt-3 text-[var(--text-secondary)]">
              <FiMapPin size={16} className="text-primary" /> {[listing.address, listing.area, listing.district || listing.city].filter((v, i, arr) => v && arr.indexOf(v) === i).join(', ')}
            </div>
            <div className="flex items-center gap-4 mt-5">
              <div className="flex flex-col">
                <div className="text-xs uppercase font-bold tracking-widest text-[var(--text-tertiary)] mb-1">Rating</div>
                <div className="flex items-center gap-2">
                  <span className="font-sora font-bold text-xl text-[var(--text-primary)]">{(listing.average_rating || 0).toFixed(1)}</span>
                  <StarRating rating={listing.average_rating || 0} />
                  <span className="text-xs text-[var(--text-tertiary)] font-medium">({listing.total_reviews || 0} {t('reviews')})</span>
                </div>
              </div>
              <div className="w-px h-8 bg-[var(--border-light)]" />
              <div className="flex flex-col">
                <div className="text-xs uppercase font-bold tracking-widest text-[var(--text-tertiary)] mb-1">Category</div>
                <div className="capitalize text-[var(--text-primary)] font-semibold">{t(listing.category)}</div>
              </div>
            </div>
            
            <div className="mt-8 flex flex-wrap gap-3">
              <Button data-testid="save-listing-btn" variant={isSaved ? "default" : "outline"} onClick={toggleSave} title={!user ? "Login to save this place" : undefined} className={`gap-2 h-11 px-6 rounded-pill ${isSaved ? 'bg-primary text-white hover:bg-primary-dark shadow-teal' : ''} ${!user ? 'opacity-70' : ''}`}>
                {!user ? <FiLock size={14} /> : <FiBookmark fill={isSaved ? "currentColor" : "none"} />} {!user ? 'Login to Save' : (isSaved ? t('saved') : t('save'))}
              </Button>
              <Button variant="outline" className="gap-2 h-11 px-6 rounded-pill" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}>
                <FiShare2/> Share
              </Button>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${listing.lat},${listing.lng}`} target="_blank" rel="noreferrer">
                <Button variant="outline" className="gap-2 h-11 px-6 rounded-pill"><FiNavigation/> {t('directions')}</Button>
              </a>
              {user && user.role !== "admin" && listing.owner?.id !== user.id && (
                <Button variant="outline" className="gap-2 h-11 px-6 rounded-pill text-amber-600 border-amber-600/30 hover:bg-amber-50" onClick={handleReport}>
                  <FiFlag/> Report
                </Button>
              )}
              {(user?.role === "admin" || listing.owner?.id === user?.id) && (
                <Button variant="destructive" className="gap-2 h-11 px-6 rounded-pill shadow-lg" onClick={handleRemove}>
                  <FiTrash2/> Remove from Map
                </Button>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="mt-6 bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-2xl p-6 shadow-sm">
            <h2 className="font-sora font-semibold text-xl mb-6">Overview</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              {listing.category === "flat" && (
                <>
                  <Detail k="Rent" v={d.rent_price ? `৳ ${d.rent_price}/mo` : "—"} />
                  <Detail k="Bedrooms" v={d.bedrooms} />
                  <Detail k="Bathrooms" v={d.bathrooms} />
                  <Detail k="Area" v={d.area_sqft ? `${d.area_sqft} sqft` : "—"} />
                  <Detail k="Furnished" v={d.furnished ? "Yes" : "No"} />
                </>
              )}
              {listing.category === "pharmacy" && (
                <>
                  <Detail k="Hours" v={d.open_hours} />
                  <Detail k="Emergency" v={d.emergency ? "Yes" : "No"} />
                  <Detail k="Delivery" v={d.delivery ? "Yes" : "No"} />
                </>
              )}
              {listing.category === "hospital" && (
                <>
                  <Detail k="Specialties" v={(d.specialty || []).join(", ")} />
                  <Detail k="Emergency" v={d.emergency ? "Yes" : "No"} />
                  <Detail k="Beds" v={d.beds} />
                  <Detail k="Hours" v={d.open_hours} />
                </>
              )}
              {listing.category === "restaurant" && (
                <>
                  <Detail k="Cuisine" v={Array.isArray(d.cuisine) ? d.cuisine.join(", ") : d.cuisine} />
                  <Detail k="Hours" v={d.open_hours} />
                  <Detail k="Price Range" v={d.price_range} />
                  <Detail k="Delivery" v={d.delivery ? "Yes" : "No"} />
                </>
              )}
              {listing.category === "service" && (
                <>
                  <Detail k="Service Type" v={d.service_type} />
                  <Detail k="Experience" v={d.experience} />
                  <Detail k="Available Time" v={d.available_time} />
                  <Detail k="Price Range" v={d.price_range} />
                  <Detail k="Service Radius" v={d.service_radius_km ? `${d.service_radius_km} km` : "—"} />
                </>
              )}
            </div>
            <div className="mt-8 pt-8 border-t border-[var(--border-light)]">
              <h3 className="font-sora font-semibold text-lg mb-4">Description</h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">{listing.description}</p>
            </div>
          </div>

          {/* Map */}
          <div className="mt-6 bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-2xl p-2 h-[350px] overflow-hidden shadow-sm">
            <MapView center={[listing.lat, listing.lng]} listings={[listing]} interactive={true} zoom={15} />
          </div>

          {/* Reviews */}
          <div className="mt-6 bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-sora font-semibold text-xl">{t('reviews')}</h2>
              <div className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{reviews.length} total</div>
            </div>

            {!user ? (
              <div
                className="mb-8 p-6 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col items-center gap-3 text-center cursor-pointer hover:bg-primary/10 transition"
                onClick={() => navigate(`/login?next=/listing/${id}`)}
              >
                <div className="text-2xl">⭐</div>
                <p className="font-bold text-[var(--text-primary)]">Share your experience</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Login or create a free account to write a review
                </p>
                <button className="mt-2 px-6 py-2 bg-primary text-white text-sm font-bold rounded-full hover:bg-primary-dark transition shadow-teal">
                  Login to Review
                </button>
              </div>
            ) : user.role !== "admin" && listing.owner?.id !== user.id && !myReview ? (
              <form onSubmit={submit} className="mb-8 p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-light)]" data-testid="review-form">
                <div className="font-bold text-sm mb-4 uppercase tracking-wider text-[var(--text-tertiary)]">{t('writeReview')}</div>
                <StarPicker value={rating} onChange={setRating} />
                <Textarea data-testid="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was your experience?" className="mt-4 bg-white text-black font-semibold" maxLength={500} required />
                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-[var(--text-tertiary)] font-medium">{comment.length}/500</div>
                  <Button data-testid="review-submit" type="submit" disabled={submitting} className="bg-primary text-white h-10 px-6 rounded-pill shadow-teal">
                    {submitting ? "..." : t('submitReview')}
                  </Button>
                </div>
              </form>
            ) : myReview ? (
              <div className="mb-8 p-4 text-center rounded-xl bg-primary/5 border border-primary/20 text-primary font-bold text-sm">✓ You've already reviewed this place</div>
            ) : null}

            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="p-5 rounded-2xl border border-[var(--border-light)] bg-white/50" data-testid={`review-${r.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {r.user?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-[var(--text-primary)]">{r.user?.name || "Anonymous"}</div>
                      <div className="text-[11px] text-[var(--text-tertiary)] font-medium">{new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                    <StarRating rating={r.rating} />
                  </div>
                  <p className="text-sm mt-4 text-[var(--text-secondary)] leading-relaxed">{r.comment}</p>
                </div>
              ))}
              {!reviews.length && <div className="text-center text-sm text-[var(--text-tertiary)] py-12 italic">No reviews yet. Be the first to share!</div>}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-24 self-start">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mt-8" />
            
            <h3 className="font-sora font-bold text-lg mb-6 relative">{t('contactOwner')}</h3>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white font-bold text-xl flex items-center justify-center shadow-lg">
                {listing.owner?.name?.[0]?.toUpperCase() || "O"}
              </div>
              <div>
                <div className="font-bold text-[var(--text-primary)]">{listing.owner?.name || "Owner"}</div>
                <div className="text-xs text-primary font-bold uppercase tracking-widest mt-0.5">Verified Owner</div>
              </div>
            </div>
            
            <div className="space-y-3 relative">
              {user ? (
                <>
                  {listing.contact?.phone && (
                    <a href={`tel:${listing.contact.phone}`} data-testid="contact-call" className="flex items-center justify-center gap-3 h-12 rounded-full bg-primary text-white font-bold text-sm hover:bg-primary-dark transition-all shadow-teal">
                      <FiPhone size={16} /> {t('callNow')} — {listing.contact.phone}
                    </a>
                  )}
                  {listing.contact?.whatsapp && (
                    <a href={`https://wa.me/${listing.contact.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 h-12 rounded-full bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg">
                      <FaWhatsapp size={18} /> {t('whatsapp')} — {listing.contact.whatsapp}
                    </a>
                  )}
                  {listing.contact?.email && (
                    <a href={`mailto:${listing.contact.email}`} className="flex items-center justify-center gap-3 h-12 rounded-full border-2 border-[var(--border-light)] text-[var(--text-primary)] font-bold text-sm hover:bg-[var(--bg-elevated)] transition-all">
                      <FiMail size={16} /> {listing.contact.email}
                    </a>
                  )}
                  {!listing.contact?.phone && !listing.contact?.whatsapp && !listing.contact?.email && (
                    <p className="text-sm text-[var(--text-tertiary)] italic text-center py-4">No contact info provided</p>
                  )}
                </>
              ) : (
                /* GUEST: Show blurred placeholders + lock overlay */
                <div className="relative">
                  {/* Blurred fake contact buttons */}
                  <div className="space-y-3 select-none pointer-events-none">
                    <div className="flex items-center justify-center gap-3 h-12 rounded-full bg-primary/70 text-white font-bold text-sm blur-[6px]">
                      <FiPhone size={16} /> +880 1X XX XXX XXX
                    </div>
                    <div className="flex items-center justify-center gap-3 h-12 rounded-full bg-emerald-500/70 text-white font-bold text-sm blur-[6px]">
                      <FaWhatsapp size={18} /> +880 1X XX XXX XXX
                    </div>
                    <div className="flex items-center justify-center gap-3 h-12 rounded-full border-2 border-[var(--border-light)] font-bold text-sm blur-[6px]">
                      <FiMail size={16} /> owner@example.com
                    </div>
                  </div>

                  {/* Lock overlay */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-[var(--bg-surface)]/80 backdrop-blur-sm border border-primary/30 cursor-pointer gap-3"
                    onClick={() => navigate(`/login?next=/listing/${id}`)}
                  >
                    <div className="text-3xl">🔒</div>
                    <p className="text-sm font-bold text-[var(--text-primary)] text-center px-4">
                      Login to see contact details
                    </p>
                    <button className="mt-1 px-5 py-2 bg-primary text-white text-xs font-bold rounded-full hover:bg-primary-dark transition shadow-teal">
                      Login / Register
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-[var(--bg-elevated)] p-6 rounded-2xl border border-[var(--border-light)]">
            <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-[var(--text-tertiary)] mb-4">Safety Tips</h4>
            <ul className="text-xs text-[var(--text-secondary)] space-y-3 font-medium">
              <li className="flex gap-2"><span>•</span> Meet in a public place</li>
              <li className="flex gap-2"><span>•</span> Check the item before buying</li>
              <li className="flex gap-2"><span>•</span> Never pay in advance</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Detail({ k, v }) {
  return (
    <div className="flex justify-between items-center gap-3 py-3 border-b border-[var(--border-light)] last:border-0 group">
      <span className="text-[var(--text-tertiary)] font-bold uppercase tracking-widest text-[10px]">{k}</span>
      <span className="font-bold text-[var(--text-primary)] text-right group-hover:text-primary transition-colors">{v ?? "—"}</span>
    </div>
  );
}
