import { getFflConfig } from './config.js';

const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'y', 'on']);

/**
 * Normalizes attribute identifiers for comparison.
 * Cart drop-in title-cases attribute codes (isFFL → "IsFFL").
 * @param {string} value
 * @returns {string}
 */
export function normalizeFflKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function isTruthyFflValue(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null || value === '') return false;
  return TRUTHY_VALUES.has(String(value).trim().toLowerCase());
}

function getNormalizedAttributeCodes() {
  return getFflConfig().attributeCodes.map(normalizeFflKey);
}

function attributeIndicatesFfl(attribute) {
  const attributeKey = normalizeFflKey(attribute?.code || attribute?.name);
  if (!getNormalizedAttributeCodes().includes(attributeKey)) {
    return false;
  }

  if (isTruthyFflValue(attribute?.value)) return true;

  return (attribute?.selected_options || []).some((option) => (
    isTruthyFflValue(option?.value) || isTruthyFflValue(option?.label)
  ));
}

function hasFflAttribute(item) {
  const attributes = item?.productAttributes;
  if (!Array.isArray(attributes) || !attributes.length) return false;
  return attributes.some(attributeIndicatesFfl);
}

function skuIsFfl(item, fflSkuMap) {
  if (!fflSkuMap) return false;
  return Boolean(
    fflSkuMap.get?.(item?.sku)
    || fflSkuMap.get?.(item?.topLevelSku)
    || fflSkuMap[item?.sku]
    || fflSkuMap[item?.topLevelSku],
  );
}

/**
 * Returns true when a cart line item requires FFL shipping.
 * @param {object} item Cart drop-in item
 * @param {Map<string, boolean>|object} [fflSkuMap]
 * @returns {boolean}
 */
export function isFflCartItem(item, fflSkuMap) {
  if (!item) return false;
  return hasFflAttribute(item) || skuIsFfl(item, fflSkuMap);
}

/**
 * Unique SKUs from cart line items, including parent SKUs for variants.
 * @param {object|null} cart
 * @returns {string[]}
 */
export function getCartItemSkus(cart) {
  return [...new Set(
    (cart?.items || []).flatMap((item) => [item?.sku, item?.topLevelSku]).filter(Boolean),
  )];
}

/**
 * Returns true when the cart contains at least one FFL-restricted product.
 * Mixed carts follow the FFL flow because firearms must ship to a dealer.
 * @param {object|null} cart Cart drop-in data
 * @param {Map<string, boolean>|object} [fflSkuMap]
 * @returns {boolean}
 */
export function cartRequiresFfl(cart, fflSkuMap) {
  return Boolean(cart?.items?.some((item) => isFflCartItem(item, fflSkuMap)));
}

export { attributeIndicatesFfl };
