import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const distDir = join(__dirname, 'dist');
const clientDir = join(__dirname, 'client');
const staticDir = existsSync(distDir) ? distDir : clientDir;
app.use(express.static(staticDir));

const PORT = process.env.PORT || 3001;

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Service-role client (bypasses RLS) — only used when the service key is real
const hasServiceKey = supabaseServiceKey && !supabaseServiceKey.startsWith('placeholder');
const supabaseAdmin = createClient(supabaseUrl, hasServiceKey ? supabaseServiceKey : supabaseAnonKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

const TIERS = {
  unverified: { max: 5, price: 0, label: 'Unverified' },
  verified:   { max: 50, price: 350, label: 'Verified' },
  silver:     { max: 200, price: 1000, label: 'Silver' },
  gold:       { max: Infinity, price: 2500, label: 'Gold' },
};
const TIER_RANK = { gold: 0, silver: 1, verified: 2, unverified: 3 };

// ============================================================
// AUTH MIDDLEWARE — verify Supabase JWT from Google OAuth
// ============================================================
function getToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '');
}

async function getUserFromToken(req) {
  const token = getToken(req);
  if (!token) return null;
  const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Create a per-request client that carries the user's JWT so RLS policies evaluate correctly
function userClient(req) {
  const token = getToken(req);
  if (!token) return supabaseAdmin;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function requireAuth(req, res, next) {
  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  req.db = userClient(req);
  next();
}

async function requireAdmin(req, res, next) {
  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const db = userClient(req);
  const { data: profile } = await db
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'super_admin')
    return res.status(403).json({ error: 'Admin access required' });
  req.user = user;
  req.db = db;
  next();
}

// ============================================================
// AUTH: Get current user profile (auto-create on first login)
// ============================================================
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const { data: profile } = await req.db
      .from('profiles').select('*').eq('id', req.user.id).maybeSingle();

    // Auto-create profile if it doesn't exist (first Google login)
    if (!profile) {
      const adminEmail = process.env.ADMIN_EMAIL;
      const role = adminEmail && req.user.email === adminEmail ? 'super_admin' : 'buyer';
      const { data: newProfile, error } = await req.db
        .from('profiles').insert({
          id: req.user.id,
          phone: '',
          display_name: req.user.user_metadata?.full_name || req.user.email || 'User',
          role,
        }).select('*').single();
      if (error) throw error;
      return res.json({ user: req.user, profile: newProfile });
    }

    // Auto-upgrade to admin if email matches ADMIN_EMAIL but role hasn't been set
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && req.user.email === adminEmail && profile.role !== 'super_admin') {
      const { data: updated } = await req.db
        .from('profiles').update({ role: 'super_admin' })
        .eq('id', req.user.id).select('*').single();
      return res.json({ user: req.user, profile: updated || profile });
    }

    res.json({ user: req.user, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PUBLIC: BROWSE LISTINGS
// ============================================================
app.get('/api/listings', async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('listings')
      .select('id, title, price, type, category, emoji, image_url, photos, created_at, businesses!inner(id, name, area, tier, phone)')
      .order('created_at', { ascending: false });

    if (req.query.type && req.query.type !== 'all')
      query = query.eq('type', req.query.type);
    if (req.query.category && req.query.category !== 'all')
      query = query.eq('category', req.query.category);
    if (req.query.search)
      query = query.or(`title.ilike.%${req.query.search}%,category.ilike.%${req.query.search}%`);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).map(l => ({
      id: l.id, title: l.title, price: Number(l.price), type: l.type,
      category: l.category, emoji: l.emoji, image_url: l.image_url, photos: l.photos,
      created_at: l.created_at,
      business: { id: l.businesses.id, name: l.businesses.name, area: l.businesses.area,
                  tier: l.businesses.tier, phone: l.businesses.phone },
    }));
    rows.sort((a, b) => TIER_RANK[a.business.tier] - TIER_RANK[b.business.tier]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/listings/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('listings')
      .select('id, title, price, type, category, emoji, image_url, photos, created_at, businesses!inner(id, name, area, tier, phone)')
      .eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Listing not found' });
    res.json({
      id: data.id, title: data.title, price: Number(data.price), type: data.type,
      category: data.category, emoji: data.emoji, image_url: data.image_url, photos: data.photos,
      created_at: data.created_at,
      business: { id: data.businesses.id, name: data.businesses.name, area: data.businesses.area,
                  tier: data.businesses.tier, phone: data.businesses.phone },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ORDERS
// ============================================================
app.post('/api/orders', async (req, res) => {
  try {
    const { listing_id, buyer_name, buyer_phone, quantity, notes } = req.body;
    if (!listing_id || !buyer_name || !buyer_phone)
      return res.status(400).json({ error: 'Missing required fields' });

    const db = userClient(req);
    let buyerId = null;
    const user = await getUserFromToken(req);
    if (user) buyerId = user.id;

    const { data, error } = await db.from('orders').insert({
      listing_id, buyer_id: buyerId, buyer_name, buyer_phone,
      quantity: quantity || '1', notes: notes || '', status: 'pending',
    }).select('id, status').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/my', requireAuth, async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('orders')
      .select('id, buyer_name, buyer_phone, quantity, notes, status, created_at, listings!inner(id, title, price, image_url, businesses!inner(name))')
      .eq('buyer_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/seller', requireAuth, async (req, res) => {
  try {
    const { data: biz } = await req.db
      .from('businesses').select('id').eq('owner_id', req.user.id).maybeSingle();
    if (!biz) return res.json([]);

    const { data: listings } = await req.db
      .from('listings').select('id').eq('business_id', biz.id);
    if (!listings || !listings.length) return res.json([]);

    const listingIds = listings.map(l => l.id);
    const { data, error } = await req.db
      .from('orders')
      .select('id, buyer_name, buyer_phone, quantity, notes, status, created_at, listings!inner(id, title, price, image_url)')
      .in('listing_id', listingIds)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending','confirmed','completed','cancelled'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });

    const { data: order } = await req.db
      .from('orders').select('listing_id').eq('id', req.params.id).maybeSingle();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { data: listing } = await req.db
      .from('listings').select('business_id, businesses!inner(owner_id)')
      .eq('id', order.listing_id).maybeSingle();
    if (!listing || listing.businesses.owner_id !== req.user.id)
      return res.status(403).json({ error: 'Not authorized' });

    const { error } = await req.db.from('orders')
      .update({ status }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SELLER: BUSINESS + LISTINGS
// ============================================================
app.get('/api/seller/business', requireAuth, async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('businesses').select('*').eq('owner_id', req.user.id).maybeSingle();
    if (error) throw error;
    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/seller/business', requireAuth, async (req, res) => {
  try {
    const { name, area, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Business name required' });

    const { data: existing } = await req.db
      .from('businesses').select('id').eq('owner_id', req.user.id).maybeSingle();
    if (existing)
      return res.status(400).json({ error: 'You already have a business. Edit it instead.' });

    await req.db.from('profiles')
      .update({ role: 'seller' }).eq('id', req.user.id);

    const { data, error } = await req.db.from('businesses').insert({
      owner_id: req.user.id, name, area: area || '', phone: phone || '',
      tier: 'unverified',
    }).select('*').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/seller/business', requireAuth, async (req, res) => {
  try {
    const { name, area, phone } = req.body;
    const { data, error } = await req.db.from('businesses')
      .update({ name, area, phone }).eq('owner_id', req.user.id)
      .select('*').single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/seller/listings', requireAuth, async (req, res) => {
  try {
    const { data: biz } = await req.db
      .from('businesses').select('id, tier').eq('owner_id', req.user.id).maybeSingle();
    if (!biz) return res.json({ listings: [], tier: null, tierInfo: null });

    const { data: items } = await req.db
      .from('listings').select('*').eq('business_id', biz.id)
      .order('created_at', { ascending: false });

    const tier = TIERS[biz.tier];
    res.json({
      listings: items || [],
      tier: biz.tier,
      tierInfo: { ...tier, key: biz.tier, max: tier.max === Infinity ? null : tier.max },
      count: (items || []).length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/seller/listings', requireAuth, async (req, res) => {
  try {
    const { title, price, type, category, emoji, image_url, photos } = req.body;
    if (!title || price == null || !type || !category)
      return res.status(400).json({ error: 'Missing required fields' });

    const { data: biz } = await req.db
      .from('businesses').select('id, tier').eq('owner_id', req.user.id).maybeSingle();
    if (!biz) return res.status(404).json({ error: 'Create a business first' });

    const { count } = await req.db
      .from('listings').select('id', { count: 'exact', head: true })
      .eq('business_id', biz.id);
    const limit = TIERS[biz.tier].max;
    if (count >= limit)
      return res.status(403).json({ error: 'Product limit reached', limit });

    const { data, error } = await req.db.from('listings').insert({
      business_id: biz.id, title, price: Number(price), type, category,
      emoji: emoji || '📦', image_url: image_url || '', photos: Math.max(1, Math.min(6, Number(photos) || 1)),
    }).select('*').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/seller/listings/:id', requireAuth, async (req, res) => {
  try {
    const { data: biz } = await req.db
      .from('businesses').select('id').eq('owner_id', req.user.id).maybeSingle();
    if (!biz) return res.status(404).json({ error: 'No business found' });

    const { error } = await req.db.from('listings')
      .delete().eq('id', req.params.id).eq('business_id', biz.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PAYSTACK: INIT + VERIFY
// ============================================================
app.post('/api/paystack/initialize', requireAuth, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!TIERS[plan]) return res.status(400).json({ error: 'Invalid plan' });
    const tier = TIERS[plan];
    if (tier.price === 0) return res.status(400).json({ error: 'Free plan requires no payment' });

    const { data: biz } = await req.db
      .from('businesses').select('id, owner_id').eq('owner_id', req.user.id).maybeSingle();
    if (!biz) return res.status(404).json({ error: 'Create a business first' });

    const reference = `SH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    await req.db.from('transactions').insert({
      business_id: biz.id, user_id: req.user.id, reference,
      amount: tier.price, currency: 'KES', status: 'pending', plan,
    });

    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackKey || paystackKey.startsWith('placeholder')) {
      return res.json({
        authorization_url: null,
        reference,
        demoMode: true,
        message: 'Paystack not configured. Payment will be simulated.',
      });
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: req.user.email || `${req.user.id}@sokohub.ke`,
        amount: tier.price * 100,
        currency: 'KES',
        reference,
        callback_url: `${req.headers.origin || 'http://localhost:5173'}/seller/dashboard`,
        metadata: { plan, business_id: biz.id, custom_fields: [{ display_name: 'Plan', variable_name: 'plan', value: plan }] },
      }),
    });
    const psData = await paystackRes.json();
    if (!psData.status) throw new Error(psData.message || 'Paystack initialization failed');

    res.json({ authorization_url: psData.data.authorization_url, reference });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/paystack/verify', requireAuth, async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ error: 'Reference required' });

    const { data: tx } = await req.db
      .from('transactions').select('*').eq('reference', reference).maybeSingle();
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    const paystackKey = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackKey || paystackKey.startsWith('placeholder')) {
      await req.db.from('transactions')
        .update({ status: 'success', paystack_response: { demo: true } })
        .eq('reference', reference);
      if (tx.plan && TIERS[tx.plan]) {
        await req.db.from('businesses')
          .update({ tier: tx.plan }).eq('id', tx.business_id);
      }
      return res.json({ success: true, status: 'success', demoMode: true });
    }

    const psRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { 'Authorization': `Bearer ${paystackKey}` },
    });
    const psData = await psRes.json();
    if (!psData.status || psData.data.status !== 'success')
      return res.json({ success: false, status: 'failed' });

    await req.db.from('transactions')
      .update({ status: 'success', paystack_response: psData.data })
      .eq('reference', reference);

    if (tx.plan && TIERS[tx.plan]) {
      await req.db.from('businesses')
        .update({ tier: tx.plan }).eq('id', tx.business_id);
    }

    res.json({ success: true, status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/paystack/webhook', async (req, res) => {
  try {
    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    const signature = req.headers['x-paystack-signature'];
    if (signature && paystackKey && !paystackKey.startsWith('placeholder')) {
      const body = JSON.stringify(req.body);
      const hash = crypto.createHmac('sha512', paystackKey).update(body).digest('hex');
      if (hash !== signature) return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    if (event.event === 'charge.success') {
      const ref = event.data.reference;
      await supabaseAdmin.from('transactions')
        .update({ status: 'success', paystack_response: event.data })
        .eq('reference', ref);
      const plan = event.data?.metadata?.plan;
      const bizId = event.data?.metadata?.business_id;
      if (plan && bizId && TIERS[plan]) {
        await supabaseAdmin.from('businesses')
          .update({ tier: plan }).eq('id', bizId);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ADMIN: FULL DASHBOARD
// ============================================================
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const [biz, listings, orders, tx, users] = await Promise.all([
      req.db.from('businesses').select('id, tier, created_at', { count: 'exact' }),
      req.db.from('listings').select('id', { count: 'exact' }),
      req.db.from('orders').select('id, status', { count: 'exact' }),
      req.db.from('transactions').select('id, amount, status, plan, created_at', { count: 'exact' }),
      req.db.from('profiles').select('id, role, created_at', { count: 'exact' }),
    ]);

    const revenue = (tx.data || []).filter(t => t.status === 'success')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    res.json({
      businesses: biz.count || 0,
      listings: listings.count || 0,
      orders: orders.count || 0,
      transactions: tx.count || 0,
      users: users.count || 0,
      revenue,
      tierBreakdown: {
        gold: (biz.data || []).filter(b => b.tier === 'gold').length,
        silver: (biz.data || []).filter(b => b.tier === 'silver').length,
        verified: (biz.data || []).filter(b => b.tier === 'verified').length,
        unverified: (biz.data || []).filter(b => b.tier === 'unverified').length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/businesses', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('businesses')
      .select('id, name, area, tier, phone, created_at, owner_id')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/businesses/:id', requireAdmin, async (req, res) => {
  try {
    const { tier } = req.body;
    if (tier && !TIERS[tier]) return res.status(400).json({ error: 'Invalid tier' });
    const update = {};
    if (tier) update.tier = tier;
    const { data, error } = await req.db.from('businesses')
      .update(update).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/businesses/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await req.db.from('businesses')
      .delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/listings', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('listings')
      .select('id, title, price, type, category, image_url, created_at, businesses!inner(name, tier)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/listings/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await req.db.from('listings')
      .delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('orders')
      .select('id, buyer_name, buyer_phone, quantity, notes, status, created_at, listings!inner(title, price, businesses!inner(name))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const { error } = await req.db.from('orders')
      .update({ status }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/transactions', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('transactions')
      .select('id, reference, amount, currency, status, plan, created_at, businesses!inner(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('profiles')
      .select('id, phone, display_name, role, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['buyer','seller','super_admin'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });
    const { data, error } = await req.db.from('profiles')
      .update({ role }).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SPA fallback — serve index.html for non-API routes
// ============================================================
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: staticDir });
});

app.listen(PORT, () => {
  console.log(`SokoHub server running on http://localhost:${PORT}`);
});
