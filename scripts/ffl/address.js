/* eslint-disable import/no-unresolved */
import * as checkoutApi from '@dropins/storefront-checkout/api.js';
import { events } from '@dropins/tools/event-bus.js';
import { getCartAddress } from '@dropins/storefront-checkout/lib/utils.js';
import { getFflConfig } from './config.js';

/**
 * Maps a normalized FFL dealer to a checkout shipping address input.
 * License number is stored in company so the selection can be restored.
 * @param {object} dealer
 * @returns {import('@dropins/storefront-checkout/data/models').AddressInput}
 */
export function dealerToShippingAddress(dealer) {
  const {
    country,
    licensePrefix,
    fallbackPhone,
    copy,
  } = getFflConfig();
  const street = [dealer.premiseStreet].filter(Boolean);
  const licenseValue = dealer.licenseNumber || dealer.id;

  return {
    firstName: dealer.licenseName || copy.fallbackFirstName,
    lastName: dealer.businessName || dealer.licenseName || copy.fallbackLastName,
    street: street.length ? street : [dealer.licenseName || copy.fallbackFirstName],
    city: dealer.city,
    postcode: dealer.zipCode,
    telephone: dealer.phone || fallbackPhone,
    countryCode: country,
    region: dealer.state,
    company: licenseValue ? `${licensePrefix}${licenseValue}` : licensePrefix.trim(),
    saveInAddressBook: false,
  };
}

export function getStoredFflDealer() {
  const { storageKey } = getFflConfig();
  try {
    const raw = sessionStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Unable to read stored FFL dealer:', error);
    return null;
  }
}

export function storeFflDealer(dealer) {
  const { storageKey } = getFflConfig();
  if (!dealer) {
    sessionStorage.removeItem(storageKey);
    return;
  }

  sessionStorage.setItem(storageKey, JSON.stringify(dealer));
}

export function clearStoredFflDealer() {
  sessionStorage.removeItem(getFflConfig().storageKey);
}

/**
 * Returns true when the cart shipping address already represents an FFL dealer.
 * @param {object|null} checkoutData
 * @returns {boolean}
 */
export function cartHasFflShippingAddress(checkoutData) {
  const shippingAddress = getCartAddress(checkoutData, 'shipping');
  const prefix = getFflConfig().licensePrefix.trim();
  return Boolean(shippingAddress?.company?.startsWith(prefix));
}

/**
 * Applies the selected FFL dealer as the cart shipping address.
 * Billing is copied from that dealer so a separate billing form is not required.
 * @param {object} dealer
 * @returns {Promise<object|null|undefined>}
 */
export async function applyFflDealerToCart(dealer) {
  if (!dealer) return null;

  events.emit('checkout/values', {
    ...(events.lastPayload('checkout/values') || {}),
    isBillToShipping: true,
  });

  const address = dealerToShippingAddress(dealer);
  const result = await checkoutApi.setShippingAddress({ address });
  await checkoutApi.setBillingAddress({ sameAsShipping: true }).catch(console.error);

  storeFflDealer(dealer);
  events.emit(getFflConfig().event, { selected: true, dealer });

  return result;
}

/**
 * Restores a previously selected dealer when checkout reloads.
 * @param {object|null} checkoutData
 * @returns {Promise<object|null>}
 */
export async function restoreFflDealer(checkoutData) {
  const storedDealer = getStoredFflDealer();
  if (!storedDealer) {
    return cartHasFflShippingAddress(checkoutData) ? { restored: true, dealer: null } : null;
  }

  if (!cartHasFflShippingAddress(checkoutData)) {
    await applyFflDealerToCart(storedDealer);
  } else {
    events.emit(getFflConfig().event, { selected: true, dealer: storedDealer });
  }

  return storedDealer;
}
