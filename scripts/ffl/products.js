/* eslint-disable import/no-unresolved */
import { CS_FETCH_GRAPHQL } from '../commerce.js';
import { getFflConfig } from './config.js';
import {
  attributeIndicatesFfl,
  cartRequiresFfl,
  getCartItemSkus,
} from './detect.js';

const FFL_SKU_CACHE = new Map();

const FFL_PRODUCT_FLAGS_QUERY = `
  query FflProductFlags($skus: [String!]!, $names: [String!]!) {
    products(skus: $skus) {
      sku
      attributes(names: $names) {
        name
        label
        value
      }
    }
  }
`;

/**
 * Loads FFL flags for cart SKUs from Catalog Service.
 * The catalog attribute is not always included on the cart payload.
 * @param {string[]} skus
 * @returns {Promise<Map<string, boolean>>}
 */
export async function fetchFflFlagsBySku(skus = []) {
  const uniqueSkus = [...new Set(skus.filter(Boolean))];
  const missing = uniqueSkus.filter((sku) => !FFL_SKU_CACHE.has(sku));
  const { attributeCodes } = getFflConfig();

  if (missing.length) {
    try {
      const response = await CS_FETCH_GRAPHQL.fetchGraphQl(FFL_PRODUCT_FLAGS_QUERY, {
        method: 'POST',
        variables: { skus: missing, names: attributeCodes },
      });

      if (response?.errors?.length) {
        console.error('FFL product flag query errors:', response.errors);
      }

      const products = response?.data?.products || [];
      missing.forEach((sku) => {
        const product = products.find((item) => item?.sku === sku);
        const isFfl = Boolean((product?.attributes || []).some(attributeIndicatesFfl));
        FFL_SKU_CACHE.set(sku, isFfl);
      });
    } catch (error) {
      console.error('Unable to load FFL product flags:', error);
      missing.forEach((sku) => {
        if (!FFL_SKU_CACHE.has(sku)) FFL_SKU_CACHE.set(sku, false);
      });
    }
  }

  return new Map(uniqueSkus.map((sku) => [sku, Boolean(FFL_SKU_CACHE.get(sku))]));
}

/**
 * Resolves whether checkout should use the FFL dealer flow.
 * Uses cart attributes first; Catalog Service is queried when the flag is not on the cart payload.
 * @param {object|null} cart
 * @returns {Promise<boolean>}
 */
export async function resolveCartRequiresFfl(cart) {
  if (!cart?.items?.length) return false;
  if (cartRequiresFfl(cart)) return true;

  const fflSkuMap = await fetchFflFlagsBySku(getCartItemSkus(cart));
  return cartRequiresFfl(cart, fflSkuMap);
}
