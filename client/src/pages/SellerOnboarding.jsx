import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { toast } from '../toast.js';

export default function SellerOnboarding() {
  const navigate = useNavigate();
  const { profile, refresh } = useAuth();
  const [form, setForm] = useState({ name: '', area: '', phone: profile?.phone || '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) { setError('Business name is required'); return; }
    setError('');
    setLoading(true);
    try {
      await api('/seller/business', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      await refresh();
      toast('Business created!');
      navigate('/seller/dashboard');
    } catch (err) {
      setError(err.message || 'Could not create business');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Soko<span>Hub</span></div>
        <div className="auth-subtitle">Start selling on SokoHub</div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label>Business name</label>
            <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Wanjiru Electronics" />
          </div>
          <div className="form-group">
            <label>Area / Location</label>
            <input className="form-control" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="e.g. Westlands, Nairobi" />
          </div>
          <div className="form-group">
            <label>WhatsApp number (for customer orders)</label>
            <input className="form-control" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="07XX XXX XXX — customers will contact you here" />
            <div className="subtle" style={{ marginTop: 4 }}>This number is used for "Order via WhatsApp" buttons on your listings.</div>
          </div>
          <button className="btn btn-accent" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Creating...' : 'Create my business'}
          </button>
        </form>
      </div>
    </div>
  );
}
