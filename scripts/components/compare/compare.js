import { showToast } from '../../lib/toast.js';

const STORAGE_KEY = 'compare-products';
const MAX_PRODUCTS = 4;

export function getCompareProducts() {
  try {
    const products = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || '[]',
    );
    return Array.isArray(products) ? products : [];
  } catch {
    return [];
  }
}

export function getCompareCount() {
  return getCompareProducts().length;
}

export function isCompared(sku) {
  return getCompareProducts().includes(sku);
}

export function addCompareProduct(sku) {
  const products = getCompareProducts();

  if (products.includes(sku)) {
    return {
      success: true,
      products,
    };
  }

  if (products.length >= MAX_PRODUCTS) {
    const message = `Maximum ${MAX_PRODUCTS} products can be compared.`;
    showToast(message, 'warning');
    return {
      success: false,
      message,
    };
  }

  const updated = [...products, sku];

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(updated),
  );

  window.dispatchEvent(
    new CustomEvent('compare-products-updated', {
      detail: updated,
    }),
  );

  showToast('Added to compare list', 'success');

  return {
    success: true,
    products: updated,
  };
}

export function removeCompareProduct(sku) {
  const updated = getCompareProducts().filter(
    (item) => item !== sku,
  );

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(updated),
  );

  window.dispatchEvent(
    new CustomEvent('compare-products-updated', {
      detail: updated,
    }),
  );

  showToast('Removed from compare list', 'info');

  return updated;
}

export function clearCompareProducts() {
  localStorage.removeItem(STORAGE_KEY);

  window.dispatchEvent(
    new CustomEvent('compare-products-updated', {
      detail: [],
    }),
  );

  showToast('Compare list cleared', 'info');
}
