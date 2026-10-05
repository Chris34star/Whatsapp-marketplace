export const TIERS = {
  unverified: { key: 'unverified', label: 'Unverified', max: 5, price: 0 },
  verified:   { key: 'verified',   label: 'Verified',   max: 50, price: 350 },
  silver:     { key: 'silver',     label: 'Silver',     max: 200, price: 1000 },
  gold:       { key: 'gold',       label: 'Gold',       max: Infinity, price: 2500 },
};

export const PRODUCT_CATS = ['Phones', 'Fashion', 'Home', 'Food', 'Electronics'];
export const SERVICE_CATS = ['Cleaning', 'Repairs', 'Tutoring', 'Beauty', 'Transport'];
export const ALL_CATS = [...PRODUCT_CATS, ...SERVICE_CATS];

export const fmt = (n) => 'KSh ' + Number(n).toLocaleString('en-KE');

export const catColor = (c) => `var(--c-${(c || 'phones').toLowerCase()})`;

export function badgeHTML(tier) {
  if (tier === 'verified') return '✓ Verified';
  if (tier === 'silver') return '★ Silver';
  if (tier === 'gold') return '⭐ Gold';
  return 'Unverified';
}

export function tierClass(tier) {
  return `badge-inline ${tier}`;
}
