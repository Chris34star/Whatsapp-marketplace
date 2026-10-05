/*
# Create businesses and listings tables for SokoHub marketplace

1. New Tables
- `businesses`: stores seller businesses with name, area, tier, phone
- `listings`: stores marketplace listings (products/services) linked to a business

2. Columns
- `businesses.id` (uuid PK), `name`, `area`, `tier` (enum-like text), `phone`, `created_at`
- `listings.id` (uuid PK), `business_id` (FK -> businesses), `title`, `price` (integer),
  `type` (product|service), `category`, `emoji`, `photos` (int 1-6), `created_at`

3. Security
- RLS enabled on both tables
- anon + authenticated can SELECT (browse without login)
- anon + authenticated can INSERT/UPDATE/DELETE (demo with no auth required)
- All four CRUD policies per table (no FOR ALL)

4. Notes
- Tier values: unverified, verified, silver, gold
- Product limits enforced in app logic: unverified=5, verified=50, silver=200, gold=unlimited
- No user_id / auth.users linkage — this is a demo marketplace without login walls
*/

CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area text NOT NULL,
  tier text NOT NULL DEFAULT 'unverified'
    CHECK (tier IN ('unverified','verified','silver','gold')),
  phone text NOT NULL DEFAULT '254700000000',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  type text NOT NULL CHECK (type IN ('product','service')),
  category text NOT NULL,
  emoji text NOT NULL DEFAULT '📦',
  photos integer NOT NULL DEFAULT 1 CHECK (photos >= 1 AND photos <= 6),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_business_id ON listings(business_id);
CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(type);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- businesses: 4 CRUD policies for anon + authenticated
DROP POLICY IF EXISTS "anon_select_businesses" ON businesses;
CREATE POLICY "anon_select_businesses" ON businesses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_businesses" ON businesses;
CREATE POLICY "anon_insert_businesses" ON businesses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_businesses" ON businesses;
CREATE POLICY "anon_update_businesses" ON businesses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_businesses" ON businesses;
CREATE POLICY "anon_delete_businesses" ON businesses FOR DELETE
  TO anon, authenticated USING (true);

-- listings: 4 CRUD policies for anon + authenticated
DROP POLICY IF EXISTS "anon_select_listings" ON listings;
CREATE POLICY "anon_select_listings" ON listings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_listings" ON listings;
CREATE POLICY "anon_insert_listings" ON listings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_listings" ON listings;
CREATE POLICY "anon_update_listings" ON listings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_listings" ON listings;
CREATE POLICY "anon_delete_listings" ON listings FOR DELETE
  TO anon, authenticated USING (true);
