import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { fmt, TIERS } from '../constants.js';
import { toast } from '../toast.js';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'businesses', label: 'Businesses' },
  { key: 'listings', label: 'Listings' },
  { key: 'orders', label: 'Orders' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'users', label: 'Users' },
];

export default function AdminPanel() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    try {
      const data = await api('/admin/stats');
      setStats(data);
    } catch { setError('Could not load admin stats.'); }
    setLoading(false);
  }, []);

  const loadBusinesses = useCallback(async () => {
    try { setBusinesses(await api('/admin/businesses')); } catch { setError('Could not load businesses.'); }
  }, []);

  const loadListings = useCallback(async () => {
    try { setListings(await api('/admin/listings')); } catch { setError('Could not load listings.'); }
  }, []);

  const loadOrders = useCallback(async () => {
    try { setOrders(await api('/admin/orders')); } catch { setError('Could not load orders.'); }
  }, []);

  const loadTransactions = useCallback(async () => {
    try { setTransactions(await api('/admin/transactions')); } catch { setError('Could not load transactions.'); }
  }, []);

  const loadUsers = useCallback(async () => {
    try { setUsers(await api('/admin/users')); } catch { setError('Could not load users.'); }
  }, []);

  useEffect(() => {
    setError('');
    if (tab === 'overview') loadOverview();
    if (tab === 'businesses') loadBusinesses();
    if (tab === 'listings') loadListings();
    if (tab === 'orders') loadOrders();
    if (tab === 'transactions') loadTransactions();
    if (tab === 'users') loadUsers();
  }, [tab, loadOverview, loadBusinesses, loadListings, loadOrders, loadTransactions, loadUsers]);

  const changeTier = async (id, tier) => {
    try {
      await api(`/admin/businesses/${id}`, { method: 'PATCH', body: JSON.stringify({ tier }) });
      toast('Tier updated');
      loadBusinesses();
    } catch { toast('Could not update tier'); }
  };

  const deleteListing = async (id) => {
    if (!confirm('Delete this listing?')) return;
    try {
      await api(`/admin/listings/${id}`, { method: 'DELETE' });
      toast('Listing deleted');
      loadListings();
      loadOverview();
    } catch { toast('Could not delete listing'); }
  };

  const deleteBusiness = async (id, name) => {
    if (!confirm(`Delete ${name} and ALL its listings? This cannot be undone.`)) return;
    try {
      await api(`/admin/businesses/${id}`, { method: 'DELETE' });
      toast('Business deleted');
      loadBusinesses();
      loadOverview();
    } catch { toast('Could not delete business'); }
  };

  const updateOrderStatus = async (id, status) => {
    try {
      await api(`/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      toast('Order updated');
      loadOrders();
    } catch { toast('Could not update order'); }
  };

  const changeRole = async (id, role) => {
    try {
      await api(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
      toast('Role updated');
      loadUsers();
    } catch { toast('Could not update role'); }
  };

  return (
    <div className="container-wide">
      <div className="modal-head" style={{ marginBottom: 16 }}>
        <div className="modal-title">Admin Control Panel</div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="admin-nav">
        {TABS.map(t => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && tab === 'overview' ? (
        <div className="loading">Loading...</div>
      ) : tab === 'overview' && stats ? (
        <>
          <div className="admin-stats">
            <div className="stat-card"><div className="stat-val stat-accent">{stats.businesses}</div><div className="stat-label">Businesses</div></div>
            <div className="stat-card"><div className="stat-val stat-info">{stats.listings}</div><div className="stat-label">Listings</div></div>
            <div className="stat-card"><div className="stat-val stat-warn">{stats.orders}</div><div className="stat-label">Orders</div></div>
            <div className="stat-card"><div className="stat-val stat-accent">{stats.transactions}</div><div className="stat-label">Transactions</div></div>
            <div className="stat-card"><div className="stat-val stat-info">{stats.users}</div><div className="stat-label">Users</div></div>
            <div className="stat-card"><div className="stat-val stat-accent">{fmt(stats.revenue)}</div><div className="stat-label">Revenue</div></div>
          </div>

          <div className="dash-card">
            <div className="section-title">Business Tiers</div>
            <div className="admin-stats">
              <div className="stat-card"><div className="stat-val">{stats.tierBreakdown.gold}</div><div className="stat-label">Gold</div></div>
              <div className="stat-card"><div className="stat-val">{stats.tierBreakdown.silver}</div><div className="stat-label">Silver</div></div>
              <div className="stat-card"><div className="stat-val">{stats.tierBreakdown.verified}</div><div className="stat-label">Verified</div></div>
              <div className="stat-card"><div className="stat-val">{stats.tierBreakdown.unverified}</div><div className="stat-label">Unverified</div></div>
            </div>
          </div>
        </>
      ) : tab === 'businesses' ? (
        <div className="dash-card">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Area</th><th>Phone</th><th>Tier</th><th>Change tier</th><th>Action</th></tr></thead>
            <tbody>
              {businesses.map(b => (
                <tr key={b.id}>
                  <td><b>{b.name}</b></td>
                  <td>{b.area}</td>
                  <td>{b.phone}</td>
                  <td><span className={`badge-inline ${b.tier}`}>{TIERS[b.tier]?.label || b.tier}</span></td>
                  <td>
                    <select className="form-control" style={{ width: 'auto', fontSize: 12 }} value={b.tier} onChange={e => changeTier(b.id, e.target.value)}>
                      <option value="unverified">Unverified</option>
                      <option value="verified">Verified</option>
                      <option value="silver">Silver</option>
                      <option value="gold">Gold</option>
                    </select>
                  </td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => deleteBusiness(b.id, b.name)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'listings' ? (
        <div className="dash-card">
          <table className="admin-table">
            <thead><tr><th></th><th>Title</th><th>Price</th><th>Type</th><th>Business</th><th>Action</th></tr></thead>
            <tbody>
              {listings.map(l => (
                <tr key={l.id}>
                  <td><div className="td-img">{l.image_url ? <img src={l.image_url} alt="" /> : <span>📦</span>}</div></td>
                  <td><b>{l.title}</b></td>
                  <td>{fmt(l.price)}</td>
                  <td>{l.type}</td>
                  <td>{l.businesses?.name}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => deleteListing(l.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'orders' ? (
        <div className="dash-card">
          <table className="admin-table">
            <thead><tr><th>Buyer</th><th>Phone</th><th>Listing</th><th>Business</th><th>Status</th><th>Change</th></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td>{o.buyer_name}</td>
                  <td>{o.buyer_phone}</td>
                  <td>{o.listings?.title}</td>
                  <td>{o.listings?.businesses?.name}</td>
                  <td><span className={`status-badge ${o.status}`}>{o.status}</span></td>
                  <td>
                    <select className="form-control" style={{ width: 'auto', fontSize: 12 }} value={o.status} onChange={e => updateOrderStatus(o.id, e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'transactions' ? (
        <div className="dash-card">
          <table className="admin-table">
            <thead><tr><th>Reference</th><th>Business</th><th>Amount</th><th>Plan</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td><code>{t.reference}</code></td>
                  <td>{t.businesses?.name || '—'}</td>
                  <td>{fmt(t.amount)}</td>
                  <td>{t.plan || '—'}</td>
                  <td><span className={`status-badge ${t.status}`}>{t.status}</span></td>
                  <td>{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'users' ? (
        <div className="dash-card">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Joined</th><th>Change role</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><b>{u.display_name || '—'}</b></td>
                  <td>{u.phone}</td>
                  <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <select className="form-control" style={{ width: 'auto', fontSize: 12 }} value={u.role} onChange={e => changeRole(u.id, e.target.value)}>
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
