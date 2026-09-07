import { CORE_FETCH_GRAPHQL } from '../../../scripts/commerce.js';

/**
 * Subscribes an email to the Adobe Commerce newsletter.
 *
 * @param {string} email
 * @returns {Promise<string>} Status: 'SUBSCRIBED', 'NOT_ACTIVE', or throws error
 */
export async function subscribeEmail(email) {
  const query = `
    mutation Subscribe($email: String!) {
      subscribeEmailToNewsletter(email: $email) {
        status
      }
    }
  `;

  try {
    const response = await CORE_FETCH_GRAPHQL.fetchGraphQl(query, {
      method: 'POST',
      variables: {
        email,
      },
    });

    if (response.errors && response.errors.length > 0) {
      throw new Error(response.errors[0].message);
    }

    return response?.data?.subscribeEmailToNewsletter?.status;
  } catch (error) {
    throw new Error(
      error?.message || 'Unable to subscribe to the newsletter.',
    );
  }
}
