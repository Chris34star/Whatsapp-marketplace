/*
# SokoHub Full Schema Upgrade

## Overview
Upgrades existing businesses/listings tables and adds new tables for full marketplace:
- Adds owner_id, paystack_subaccount_code to businesses
- Adds image_url to listings
- New: profiles, orders, transactions, otp_codes tables
- New: is_super_admin() SECURITY DEFINER function
- Full RLS with admin (super_admin) access to all tables

## Changes to Existing Tables
1. `businesses` — add owner_id (uuid FK auth.users), paystack_subaccount_code (text)
2. `listings` — add image_url (text)

## New Tables
1. `profiles` — id FK auth.users, phone, display_name, role (buyer/seller/super_admin)
2. `orders` — listing_id FK, buyer_id FK, buyer_name, buyer_phone, quantity, notes, status
3. `transactions` — business_id FK, user_id FK, reference, amount, status, plan, paystack_response
4. `otp_codes` — phone, code, expires_at, used

## Security
- RLS on all tables
- Public read on listings + businesses (marketplace browsing)
- Owner-scoped CRUD on businesses + listings
- Buyer-scoped read on orders; seller-scoped read on orders for their listings
- super_admin can read/update all tables via is_super_admin() function
*/

-- ============================================================
-- ALTER EXISTING TABLES
-- ============================================================
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS paystack_subaccount_code text DEFAULT '';

ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_url text DEFAULT '';

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  display_name text DEFAULT '',
  role text NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','seller','super_admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_own" ON profiles;
CREATE POLICY "profiles_read_own"
ON profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- BUSINESSES — add owner-scoped policies (existing table)
-- ============================================================
DROP POLICY IF EXISTS "businesses_owner_insert" ON businesses;
CREATE POLICY "businesses_owner_insert"
ON businesses FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "businesses_owner_update" ON businesses;
CREATE POLICY "businesses_owner_update"
ON businesses FOR UPDATE TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "businesses_owner_delete" ON businesses;
CREATE POLICY "businesses_owner_delete"
ON businesses FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

-- ============================================================
-- LISTINGS — add owner-scoped policies (existing table)
-- ============================================================
DROP POLICY IF EXISTS "listings_owner_insert" ON listings;
CREATE POLICY "listings_owner_insert"
ON listings FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM businesses WHERE businesses.id = listings.business_id AND businesses.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "listings_owner_update" ON listings;
CREATE POLICY "listings_owner_update"
ON listings FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM businesses WHERE businesses.id = listings.business_id AND businesses.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM businesses WHERE businesses.id = listings.business_id AND businesses.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "listings_owner_delete" ON listings;
CREATE POLICY "listings_owner_delete"
ON listings FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM businesses WHERE businesses.id = listings.business_id AND businesses.owner_id = auth.uid())
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_name text NOT NULL DEFAULT '',
  buyer_phone text NOT NULL DEFAULT '',
  quantity text NOT NULL DEFAULT '1',
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_buyer_read" ON orders;
CREATE POLICY "orders_buyer_read"
ON orders FOR SELECT TO authenticated
USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "orders_anyone_insert" ON orders;
CREATE POLICY "orders_anyone_insert"
ON orders FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "orders_seller_read" ON orders;
CREATE POLICY "orders_seller_read"
ON orders FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM listings JOIN businesses ON businesses.id = listings.business_id
          WHERE listings.id = orders.listing_id AND businesses.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "orders_seller_update" ON orders;
CREATE POLICY "orders_seller_update"
ON orders FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM listings JOIN businesses ON businesses.id = listings.business_id
          WHERE listings.id = orders.listing_id AND businesses.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM listings JOIN businesses ON businesses.id = listings.business_id
          WHERE listings.id = orders.listing_id AND businesses.owner_id = auth.uid())
);

-- ============================================================
-- TRANSACTIONS (Paystack)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reference text UNIQUE NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'KES',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  plan text DEFAULT '',
  paystack_response jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tx_user_read" ON transactions;
CREATE POLICY "tx_user_read"
ON transactions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tx_seller_read" ON transactions;
CREATE POLICY "tx_seller_read"
ON transactions FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM businesses WHERE businesses.id = transactions.business_id AND businesses.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "tx_insert" ON transactions;
CREATE POLICY "tx_insert"
ON transactions FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- ============================================================
-- OTP CODES (WhatsApp auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "otp_insert_any" ON otp_codes;
CREATE POLICY "otp_insert_any"
ON otp_codes FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- ============================================================
-- ADMIN: SECURITY DEFINER function
-- ============================================================
CREATE OR REPLACE FUNCTION is_super_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = uid AND role = 'super_admin'
  );
$$;

-- Admin SELECT/UPDATE on all tables
DROP POLICY IF EXISTS "admin_profiles_read" ON profiles;
CREATE POLICY "admin_profiles_read"
ON profiles FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_profiles_update" ON profiles;
CREATE POLICY "admin_profiles_update"
ON profiles FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_businesses_read" ON businesses;
CREATE POLICY "admin_businesses_read"
ON businesses FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_businesses_update" ON businesses;
CREATE POLICY "admin_businesses_update"
ON businesses FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_listings_read" ON listings;
CREATE POLICY "admin_listings_read"
ON listings FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_listings_delete" ON listings;
CREATE POLICY "admin_listings_delete"
ON listings FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_orders_read" ON orders;
CREATE POLICY "admin_orders_read"
ON orders FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_orders_update" ON orders;
CREATE POLICY "admin_orders_update"
ON orders FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_tx_read" ON transactions;
CREATE POLICY "admin_tx_read"
ON transactions FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_tx_update" ON transactions;
CREATE POLICY "admin_tx_update"
ON transactions FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_otp_read" ON otp_codes;
CREATE POLICY "admin_otp_read"
ON otp_codes FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_listings_business ON listings(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing ON orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_tx_business ON transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_tx_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
