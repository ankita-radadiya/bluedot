import { getFflConfig } from './config.js';
import { isTruthyFflValue } from './detect.js';

const SEARCH_FFL_DEALERS_QUERY = `
  query SearchFflDealers($zipcode: String!, $radius: Int!) {
    zipcodeStores(zipcode: $zipcode, radius: $radius) {
      status
      error_msg
      stores {
        id
        licenseName
        businessName
        premiseStreet
        premiseCity
        premiseState
        premiseZipCode
        voicePhone
        isDealerRestricted
        isActive
      }
    }
  }
`;

export function padZipcode(zipcode) {
  return String(zipcode || '').replace(/\D/g, '').padStart(5, '0').slice(-5);
}

function readField(record, key) {
  const value = record?.[key];
  return value == null ? '' : String(value).trim();
}

async function fetchFflGraphQl(query, variables) {
  const { endpoint, copy } = getFflConfig();
  if (!endpoint) {
    return { data: null, errors: [{ message: copy.apiMissing }], apiMissing: true };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`FFL GraphQL HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Normalizes a zipcodeStores record for checkout address mapping.
 * @param {object} record
 * @param {number} index
 * @returns {object|null}
 */
export function normalizeFflDealer(record, index = 0) {
  if (!record || typeof record !== 'object') return null;

  const licenseName = readField(record, 'licenseName');
  const premiseStreet = readField(record, 'premiseStreet');
  if (!licenseName && !premiseStreet) return null;

  if (record.isActive === false || record.isActive === 0 || record.isActive === '0') {
    return null;
  }

  const city = readField(record, 'premiseCity');
  const state = readField(record, 'premiseState').toUpperCase();
  const zipCode = padZipcode(readField(record, 'premiseZipCode'));
  const licenseNumber = readField(record, 'id');

  return {
    id: licenseNumber || `${licenseName}-${index}`,
    licenseName,
    businessName: readField(record, 'businessName'),
    premiseStreet,
    city,
    state,
    zipCode,
    phone: readField(record, 'voicePhone'),
    isDealerRestricted: isTruthyFflValue(record.isDealerRestricted),
    licenseNumber,
  };
}

/**
 * Searches FFL dealers by zip code and radius.
 * @param {{ zipcode: string, radius: number|string }} params
 * @returns {Promise<{ dealers: object[], error: string|null, apiMissing: boolean }>}
 */
export async function searchFflDealers({ zipcode, radius }) {
  const { copy } = getFflConfig();
  const paddedZip = padZipcode(zipcode);
  const miles = Number(radius);

  if (!/^\d{5}$/.test(paddedZip)) {
    return { dealers: [], error: copy.zipInvalid, apiMissing: false };
  }

  try {
    const response = await fetchFflGraphQl(SEARCH_FFL_DEALERS_QUERY, {
      zipcode: paddedZip,
      radius: miles,
    });

    if (response?.apiMissing) {
      return { dealers: [], error: copy.apiMissing, apiMissing: true };
    }

    if (response?.errors?.length) {
      console.error('FFL dealer search GraphQL errors:', response.errors);
      return { dealers: [], error: copy.searchError, apiMissing: false };
    }

    const payload = response?.data?.zipcodeStores;
    if (payload?.status && payload.status !== 'success') {
      return {
        dealers: [],
        error: payload.error_msg || copy.searchError,
        apiMissing: false,
      };
    }

    const dealers = (payload?.stores || [])
      .map(normalizeFflDealer)
      .filter(Boolean);

    return {
      dealers,
      error: dealers.length ? null : copy.emptyResults,
      apiMissing: false,
    };
  } catch (error) {
    console.error('FFL dealer search failed:', error);
    return { dealers: [], error: copy.searchError, apiMissing: false };
  }
}
