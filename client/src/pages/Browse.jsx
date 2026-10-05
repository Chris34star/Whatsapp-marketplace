import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { PRODUCT_CATS, SERVICE_CATS, ALL_CATS, fmt, catColor, badgeHTML } from '../constants.js';

export default function Browse() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [chip, setChip] = useState('all');
  const [search, setSearch] = useState('');

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (tab !== 'all') params.set('type', tab);
      if (chip !== 'all') params.set('category', chip);
      if (search) params.set('search', search);
      const qs = params.toString();
      const data = await api(`/listings${qs ? '?' + qs : ''}`);
      setListings(data);
    } catch {
      setError('Could not load listings. Please try again.');
    }
    setLoading(false);
  }, [tab, chip, search]);

  useEffect(() => { loadListings(); }, [loadListings]);

  const cats = tab === 'product' ? PRODUCT_CATS : tab === 'service' ? SERVICE_CATS : ALL_CATS;

  return (
    <div className="container">
      {error && <div className="error-banner">{error}</div>}

      <div className="tabs">
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => { setTab('all'); setChip('all'); }}>All</button>
        <button className={`tab ${tab === 'product' ? 'active' : ''}`} onClick={() => { setTab('product'); setChip('all'); }}>Products</button>
        <button className={`tab ${tab === 'service' ? 'active' : ''}`} onClick={() => { setTab('service'); setChip('all'); }}>Services</button>
      </div>

      <div className="chips">
        <button className={`chip ${chip === 'all' ? 'active' : ''}`} onClick={() => setChip('all')}>All</button>
        {cats.map(c => (
          <button key={c} className={`chip ${chip === c ? 'active' : ''}`} onClick={() => setChip(c)}>{c}</button>
        ))}
      </div>

      <div className="search" style={{ marginBottom: 18, maxWidth: 400 }}>
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search listings..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">Loading listings...</div>
      ) : listings.length === 0 ? (
        <div className="empty">No listings match your search.</div>
      ) : (
        <div className="grid">
          {listings.map(l => (
            <div key={l.id} className={`card tier-${l.business.tier}`} onClick={() => navigate(`/listing/${l.id}`)}>
              <div className="card-img">
                {l.image_url ? (
                  <img src={l.image_url} alt={l.title} loading="lazy" />
                ) : (
                  <div className="card-img-fallback" style={{ background: catColor(l.category) }}>
                    <span>{l.emoji}</span>
                  </div>
                )}
                <span className={`tier-flag ${l.business.tier}`}>
                  {l.business.tier === 'gold' ? 'GOLD' : l.business.tier === 'silver' ? 'SILVER' : l.business.tier === 'verified' ? '✓ Verified' : 'Unverified'}
                </span>
                {l.photos > 1 && <span className="photo-count">📷 {l.photos}</span>}
              </div>
              <div className="card-body">
                <div className="card-title">{l.title}</div>
                <div className="card-price">{fmt(l.price)}</div>
                <div className="card-meta">
                  <span className="biz">{l.business.name} <span className={`badge-inline ${l.business.tier}`}>{badgeHTML(l.business.tier)}</span></span>
                  <span>📍 {l.business.area}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
