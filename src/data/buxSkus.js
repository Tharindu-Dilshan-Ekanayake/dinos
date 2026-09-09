/**
 * The app's own Bux SKU catalogue - which product ids this game actually
 * offers. Prices are never listed here: the server-side catalogue (keyed by
 * gameSlug, on Bloxity's side) is the only source of truth for what a sku
 * costs, and `requestBloxityPurchase` (systems/bloxity.js) only ever passes
 * the sku string.
 */
export const BUX_SKUS = [
  { sku: 'gems_100', name: '100 Gems', icon: '💎' },
  { sku: 'gems_500', name: '500 Gems', icon: '💎' },
  { sku: 'gems_1200', name: '1200 Gems', icon: '💎' },
]
