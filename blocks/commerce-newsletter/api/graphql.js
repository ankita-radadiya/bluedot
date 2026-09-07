import { CORE_FETCH_GRAPHQL } from '../../../scripts/commerce.js';

/**
 * Fetches the current logged-in customer's newsletter subscription status.
 *
 * @returns {Promise<boolean>}
 */
export async function getCustomerSubscriptionStatus() {
  const query = `
    query GetCustomerStatus {
      customer {
        is_subscribed
      }
    }
  `;

  try {
    const response = await CORE_FETCH_GRAPHQL.fetchGraphQl(query, {
      method: 'POST',
    });

    if (response.errors?.length > 0) {
      throw new Error(response.errors[0].message);
    }

    return response?.data?.customer?.is_subscribed || false;
  } catch (error) {
    console.error('Error fetching customer subscription status:', error);
    throw error;
  }
}

/**
 * Updates the newsletter subscription status for an authenticated customer.
 *
 * @param {boolean} isSubscribed
 * @returns {Promise<boolean>}
 */
export async function updateCustomerSubscription(isSubscribed) {
  const query = `
    mutation UpdateCustomerSubscription($isSubscribed: Boolean!) {
      updateCustomerV2(input: { is_subscribed: $isSubscribed }) {
        customer {
          is_subscribed
        }
      }
    }
  `;

  try {
    const response = await CORE_FETCH_GRAPHQL.fetchGraphQl(query, {
      method: 'POST',
      variables: { isSubscribed },
    });

    if (response.errors?.length > 0) {
      throw new Error(response.errors[0].message);
    }

    return response?.data?.updateCustomerV2?.customer?.is_subscribed;
  } catch (error) {
    throw new Error(error?.message || 'Unable to update subscription status.');
  }
}
