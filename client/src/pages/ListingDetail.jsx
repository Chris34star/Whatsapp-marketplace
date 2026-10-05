import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getToken } from '../api.js';
import { fmt, catColor, badgeHTML } from '../constants.js';
import { toast } from '../toast.js';
import { useAuth } from '../AuthContext.jsx';

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderForm, setOrderForm] = useState({ name: '', phone: '', quantity: '1', notes: '' });

  useEffect(() => {
    (async () => {
      try {
        const data = await api(`/listings/${id}`);
        setListing(data);
      } catch {
        setError('Listing not found.');
      }
      setLoading(false);
    })();
  }, [id]);

  const placeOrder = async (e) => {
    e.preventDefault();
    try {
      await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          listing_id: listing.id,
          buyer_name: orderForm.name,
          buyer_phone: orderForm.phone,
          quantity: orderForm.quantity,
          notes: orderForm.notes,
        }),
      });
      setOrderPlaced(true);
      toast('Order placed successfully');
    } catch (err) {
      toast(err.message || 'Could not place order');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="container"><div className="error-banner">{error}</div><button className="btn" onClick={() => navigate('/')}>Back to browse</button></div>;
  if (!listing) return null;

  const b = listing.business;
  const waText = encodeURIComponent(`Hi ${b.name}, I'm interested in "${listing.title}" listed for ${fmt(listing.price)} on SokoHub. Is it available?`);
  const verifyNote = b.tier === 'unverified'
    ? <div className="verification-note warn">⚠ This business is <b>unverified</b>. SokoHub has not confirmed its identity. Take care before paying.</div>
    : <div className="verification-note ok">✅ Verified by SokoHub — this business has passed our identity check.</div>;

  return (
    <div className="container" style={{ maxWidth: 700 }}>
      <button className="btn" style={{ marginBottom: 16 }} onClick={() => navigate('/')}>← Back to browse</button>

      <div className="dash-card">
        <div className="gallery-main" style={{ background: catColor(listing.category) }}>
          {listing.image_url ? (
            <img src={listing.image_url} alt={listing.title} />
          ) : (
            <div className="gallery-main-fallback"><span>{listing.emoji}</span></div>
          )}
        </div>

        <h2 style={{ marginBottom: 8 }}>{listing.title}</h2>
        <div className="detail-price">{fmt(listing.price)}</div>

        <div className="detail-row"><span className="detail-label">Type</span><span className="detail-val">{listing.type === 'product' ? 'Product' : 'Service'}</span></div>
        <div className="detail-row"><span className="detail-label">Category</span><span className="detail-val">{listing.category}</span></div>
        <div className="detail-row"><span className="detail-label">Business</span><span className="detail-val">{b.name} <span className={`badge-inline ${b.tier}`}>{badgeHTML(b.tier)}</span></span></div>
        <div className="detail-row"><span className="detail-label">Area</span><span className="detail-val">📍 {b.area}</span></div>
        <div className="detail-row"><span className="detail-label">Phone</span><span className="detail-val">{b.phone}</span></div>

        {verifyNote}

        <div className="modal-actions">
          <a className="btn btn-wa" href={`https://wa.me/${b.phone}?text=${waText}`} target="_blank" rel="noopener">Order via WhatsApp</a>
          <button className="btn btn-accent" onClick={() => setShowOrderForm(!showOrderForm)}>Order on platform</button>
        </div>

        {showOrderForm && !orderPlaced && (
          <form onSubmit={placeOrder} style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <div className="section-title">Place your order</div>
            <div className="form-group"><label>Your name</label><input className="form-control" value={orderForm.name} onChange={e => setOrderForm(f => ({ ...f, name: e.target.value }))} required placeholder="Jane Wanjiru" /></div>
            <div className="form-group"><label>Phone number</label><input className="form-control" value={orderForm.phone} onChange={e => setOrderForm(f => ({ ...f, phone: e.target.value }))} required placeholder="07XX XXX XXX" /></div>
            <div className="form-grid">
              <div className="form-group"><label>{listing.type === 'service' ? 'Preferred date' : 'Quantity'}</label><input className="form-control" value={orderForm.quantity} onChange={e => setOrderForm(f => ({ ...f, quantity: e.target.value }))} required /></div>
              <div className="form-group"><label>Notes</label><input className="form-control" value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" /></div>
            </div>
            <button className="btn btn-accent" type="submit" style={{ width: '100%' }}>Place order</button>
          </form>
        )}

        {orderPlaced && (
          <div className="success-msg">
            <div className="check">✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Order placed!</div>
            <div className="subtle">{b.name} will contact you shortly to confirm your order for <b>{listing.title}</b> ({fmt(listing.price)}).</div>
            {user && <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate('/orders')}>View my orders</button>}
          </div>
        )}
      </div>
    </div>
  );
}
