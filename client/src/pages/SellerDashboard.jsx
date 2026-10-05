import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { TIERS, PRODUCT_CATS, SERVICE_CATS, fmt, catColor } from '../constants.js';
import { toast } from '../toast.js';

export default function SellerDashboard() {
  const navigate = useNavigate();
  const { profile, refresh } = useAuth();
  const [business, setBusiness] = useState(null);
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tierInfo, setTierInfo] = useState(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPlans, setShowPlans] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', price: '', type: 'product', category: 'Phones', emoji: '📦', image_url: '', photos: 1 });
  const [paying, setPaying] = useState(false);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const bizData = await api('/seller/business');
      if (!bizData) {
        navigate('/seller/onboarding');
        return;
      }
      setBusiness(bizData);

      const slData = await api('/seller/listings');
      setListings(slData.listings || []);
      setTierInfo(slData.tierInfo);
      setCount(slData.count || 0);

      try {
        const ordData = await api('/orders/seller');
        setOrders(ordData);
      } catch { setOrders([]); }
    } catch (err) {
      setError('Could not load your dashboard.');
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const addListing = async (e) => {
    e.preventDefault();
    if (!addForm.title || !addForm.price) { toast('Fill all required fields'); return; }
    try {
      await api('/seller/listings', {
        method: 'POST',
        body: JSON.stringify({
          title: addForm.title,
          price: Number(addForm.price),
          type: addForm.type,
          category: addForm.category,
          emoji: addForm.emoji || '📦',
          image_url: addForm.image_url,
          photos: Number(addForm.photos) || 1,
        }),
      });
      setAddForm({ title: '', price: '', type: 'product', category: 'Phones', emoji: '📦', image_url: '', photos: 1 });
      await loadData();
      toast('Listing added');
    } catch (err) {
      if (err.status === 403) {
        toast('Listing limit reached. Upgrade your plan.');
        setShowPlans(true);
      } else {
        toast(err.message || 'Could not add listing');
      }
    }
  };

  const deleteListing = async (id) => {
    try {
      await api(`/seller/listings/${id}`, { method: 'DELETE' });
      await loadData();
      toast('Listing deleted');
    } catch {
      toast('Could not delete listing');
    }
  };

  const updateOrderStatus = async (id, status) => {
    try {
      await api(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await loadData();
      toast('Order status updated');
    } catch {
      toast('Could not update order');
    }
  };

  const startUpgrade = async (plan) => {
    if (plan === 'unverified') {
      toast('You are already on the free plan');
      return;
    }
    setPaying(true);
    try {
      const data = await api('/paystack/initialize', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      });
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else if (data.demoMode) {
        // Demo: auto-verify
        await api('/paystack/verify', {
          method: 'POST',
          body: JSON.stringify({ reference: data.reference }),
        });
        await loadData();
        await refresh();
        toast(`Upgraded to ${TIERS[plan].label}!`);
        setShowPlans(false);
      }
    } catch (err) {
      toast(err.message || 'Payment failed');
    }
    setPaying(false);
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="container"><div className="error-banner">{error}</div></div>;
  if (!business) return null;

  const tier = TIERS[business.tier];
  const max = tierInfo?.max;
  const pct = max === null ? 100 : Math.min(100, (count / max) * 100);

  return (
    <div className="container">
      <div className="modal-head" style={{ marginBottom: 16 }}>
        <div className="modal-title">My Business Dashboard</div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="dash-grid">
        <div>
          {/* Business Summary */}
          <div className="dash-card">
            <div className="biz-head">
              <div>
                <div className="biz-name">{business.name}</div>
                <div className="biz-sub">📍 {business.area} · {business.phone}</div>
              </div>
              <span className={`plan-badge ${business.tier}`}>{tier.label}</span>
            </div>
            <div className="counter"><span className="num">{count}</span> / {max === null ? '∞' : max} listings used</div>
            <div className="progress"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-accent" onClick={() => setShowPlans(true)}>Upgrade plan</button>
              <button className="btn" onClick={() => setShowOrderForm(!showOrderForm)}>
                {showOrderForm ? 'Hide orders' : `View orders (${orders.length})`}
              </button>
            </div>
          </div>

          {/* Orders */}
          {showOrderForm && (
            <div className="dash-card" style={{ marginTop: 18 }}>
              <div className="section-title">Customer Orders</div>
              {orders.length === 0 ? (
                <div className="empty">No orders yet.</div>
              ) : (
                orders.map(o => (
                  <div key={o.id} className="dash-listing" style={{ flexWrap: 'wrap' }}>
                    <div className="dl-info" style={{ flex: 1 }}>
                      <div className="dl-title">{o.listings?.title || 'Unknown'}</div>
                      <div className="dl-price">{o.buyer_name} · {o.buyer_phone}</div>
                      <div className="subtle">Qty: {o.quantity} {o.notes && `· ${o.notes}`}</div>
                    </div>
                    <select
                      className="form-control"
                      style={{ width: 'auto', fontSize: 13 }}
                      value={o.status}
                      onChange={e => updateOrderStatus(o.id, e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Listings */}
          <div className="dash-card" style={{ marginTop: 18 }}>
            <div className="section-title">My Listings</div>
            {listings.length === 0 ? (
              <div className="empty">No listings yet. Add your first one below.</div>
            ) : (
              listings.map(l => (
                <div key={l.id} className="dash-listing">
                  <div className="dl-img" style={{ background: catColor(l.category) }}>
                    {l.image_url ? <img src={l.image_url} alt={l.title} /> : <span style={{ fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>{l.emoji}</span>}
                  </div>
                  <div className="dl-info">
                    <div className="dl-title">{l.title}</div>
                    <div className="dl-price">{fmt(l.price)} · {l.type} · {l.category}</div>
                  </div>
                  <button className="dl-del" onClick={() => deleteListing(l.id)}>Delete</button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add Listing Form */}
        <div>
          <div className="dash-card">
            <div className="section-title">Add product or service</div>
            <form onSubmit={addListing}>
              <div className="form-group">
                <label>Title</label>
                <input className="form-control" value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. iPhone Charger" />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Price (KSh)</label>
                  <input className="form-control" type="number" min="1" value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))} placeholder="500" />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select className="form-control" value={addForm.type} onChange={e => {
                    const newType = e.target.value;
                    setAddForm(f => ({ ...f, type: newType, category: newType === 'product' ? PRODUCT_CATS[0] : SERVICE_CATS[0] }));
                  }}>
                    <option value="product">Product</option>
                    <option value="service">Service</option>
                  </select>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Category</label>
                  <select className="form-control" value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}>
                    {(addForm.type === 'product' ? PRODUCT_CATS : SERVICE_CATS).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Images (1-6)</label>
                  <input className="form-control" type="number" min="1" max="6" value={addForm.photos} onChange={e => setAddForm(f => ({ ...f, photos: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Image URL</label>
                <input className="form-control" value={addForm.image_url} onChange={e => setAddForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label>Emoji (optional)</label>
                <input className="form-control" value={addForm.emoji} onChange={e => setAddForm(f => ({ ...f, emoji: e.target.value }))} maxLength={4} />
              </div>
              <button className="btn btn-accent" type="submit" disabled={paying} style={{ width: '100%' }}>Add listing</button>
            </form>
          </div>
        </div>
      </div>

      {/* Plans Modal */}
      {showPlans && (
        <div className="overlay" onClick={e => { if (e.target.className === 'overlay') setShowPlans(false); }}>
          <div className="modal lg">
            <div className="modal-head">
              <div className="modal-title">Choose your plan</div>
              <button className="close-btn" onClick={() => setShowPlans(false)}>×</button>
            </div>
            <p className="subtle" style={{ marginBottom: 16 }}>Upgrade to unlock more listings, a verification badge, and priority placement.</p>
            <div className="plans">
              {Object.values(TIERS).map(t => (
                <div key={t.key} className={`plan ${t.key} ${business.tier === t.key ? 'current' : ''}`}>
                  <h4>{t.label}</h4>
                  <div className="price">{t.price === 0 ? 'Free' : fmt(t.price)}</div>
                  <div className="per">{t.price === 0 ? 'no cost' : 'one-time'}</div>
                  <ul>
                    <li>Up to {t.max === Infinity ? '∞' : t.max} listings</li>
                    {t.key !== 'unverified' && <li>Verification badge</li>}
                    {t.key === 'gold' && <li>Top placement</li>}
                  </ul>
                  {business.tier === t.key ? (
                    <button className="btn" disabled>Current plan</button>
                  ) : (
                    <button className="btn btn-accent" onClick={() => startUpgrade(t.key)} disabled={paying}>
                      {paying ? 'Processing...' : `Choose ${t.label}`}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
