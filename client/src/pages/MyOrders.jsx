import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { fmt } from '../constants.js';

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api('/orders/my');
        setOrders(data);
      } catch {
        setError('Could not load your orders.');
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="loading">Loading orders...</div>;
  if (error) return <div className="container"><div className="error-banner">{error}</div></div>;

  return (
    <div className="container">
      <div className="section-title">My Orders</div>
      {orders.length === 0 ? (
        <div className="empty">You haven't placed any orders yet. <a href="/" style={{ color: 'var(--accent)' }}>Browse listings</a></div>
      ) : (
        orders.map(o => (
          <div key={o.id} className="dash-listing">
            <div className="dl-img">
              {o.listings?.image_url ? <img src={o.listings.image_url} alt={o.listings?.title} /> : <span>📦</span>}
            </div>
            <div className="dl-info">
              <div className="dl-title">{o.listings?.title || 'Unknown'}</div>
              <div className="dl-price">{o.listings?.businesses?.name} · {fmt(o.listings?.price || 0)}</div>
              <div className="subtle">Qty: {o.quantity} · Placed {new Date(o.created_at).toLocaleDateString()}</div>
            </div>
            <span className={`status-badge ${o.status}`}>{o.status}</span>
          </div>
        ))
      )}
    </div>
  );
}
