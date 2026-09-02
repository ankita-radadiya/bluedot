/* eslint-disable import/no-unresolved */
import { getConfigValue } from '@dropins/tools/lib/aem/configs.js';

/**
 * Storefront config keys. Override these in config.json without changing code.
 */
export const FFL_CONFIG_KEYS = {
  endpoint: 'commerce-ffl-endpoint',
  attribute: 'commerce-ffl-attribute',
  radiusOptions: 'commerce-ffl-radius-options',
  country: 'commerce-ffl-default-country',
  licensePrefix: 'commerce-ffl-license-prefix',
  fallbackPhone: 'commerce-ffl-fallback-phone',
};

export const FFL_DEFAULTS = {
  attribute: 'isFFL',
  radiusOptions: [5, 10, 25, 50],
  country: 'US',
  licensePrefix: 'FFL-License : ',
  fallbackPhone: '0000000000',
  storageKey: 'checkout_ffl_dealer',
  event: 'checkout/ffl',
};

export const FFL_COPY = {
  title: 'FFL Terms and Conditions',
  terms: 'We will only ship firearms to a valid FFL. It is your responsibility to confirm that the firearm or accessories you are purchasing are legal for you to own under all applicable laws. By continuing, you confirm that you are legally allowed to own these items and that delivery will not violate any state law or published ordinance. You also certify that you are 18 or older if purchasing a rifle, and 21 or older if purchasing a handgun or lower assembly.',
  instructions: 'Please enter a zip code below for a list of FFL dealers in your area, then select an FFL. If you have any questions please call us at 919-439-8133. Thanks!',
  paperworkNote: 'Orders cannot ship until proper FFL licenses are on file. Contact your FFL dealer to discuss their fees, license status, and pickup process. If paperwork is not on file we will attempt to collect it on your behalf.',
  zipcodeLabel: 'Zipcode',
  radiusLabel: 'Radius',
  searchLabel: 'Search',
  searchingLabel: 'Searching for FFL dealers…',
  emptyResults: 'No FFL dealers were found for that zip code and radius. Try a larger radius.',
  searchError: 'Unable to search FFL dealers right now. Please try again or contact support.',
  apiMissing: 'FFL dealer search is not available yet. The Commerce GraphQL dealer query still needs to be connected.',
  selectPrompt: 'Please select an FFL dealer to continue checkout.',
  shippingTo: 'Shipping to selected FFL dealer',
  paperworkOnFile: 'FFL Paperwork On File, Ships faster',
  paperworkNeeded: 'Need FFL Paperwork',
  dealerRestricted: 'Restricted dealer',
  phoneLabel: 'Phone',
  milesSuffix: 'miles',
  zipInvalid: 'Enter a valid 5-digit zip code.',
  fallbackFirstName: 'FFL',
  fallbackLastName: 'Dealer',
};

function readConfig(key, fallback) {
  try {
    const value = getConfigValue(key);
    return value == null || value === '' ? fallback : value;
  } catch {
    return fallback;
  }
}

function parseList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberList(value, fallback) {
  const numbers = parseList(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);
  return numbers.length ? numbers : fallback;
}

/**
 * Runtime FFL settings from config.json, with safe defaults.
 * @returns {{
 *   endpoint: string,
 *   attributeCodes: string[],
 *   radiusOptions: number[],
 *   country: string,
 *   licensePrefix: string,
 *   fallbackPhone: string,
 *   storageKey: string,
 *   event: string,
 *   copy: typeof FFL_COPY,
 * }}
 */
export function getFflConfig() {
  return {
    endpoint: String(readConfig(FFL_CONFIG_KEYS.endpoint, '')),
    attributeCodes: parseList(readConfig(FFL_CONFIG_KEYS.attribute, FFL_DEFAULTS.attribute)),
    radiusOptions: parseNumberList(
      readConfig(FFL_CONFIG_KEYS.radiusOptions, FFL_DEFAULTS.radiusOptions),
      FFL_DEFAULTS.radiusOptions,
    ),
    country: String(readConfig(FFL_CONFIG_KEYS.country, FFL_DEFAULTS.country)),
    licensePrefix: String(readConfig(FFL_CONFIG_KEYS.licensePrefix, FFL_DEFAULTS.licensePrefix)),
    fallbackPhone: String(readConfig(FFL_CONFIG_KEYS.fallbackPhone, FFL_DEFAULTS.fallbackPhone)),
    storageKey: FFL_DEFAULTS.storageKey,
    event: FFL_DEFAULTS.event,
    copy: FFL_COPY,
  };
}
