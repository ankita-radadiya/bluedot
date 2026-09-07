# Commerce Newsletter

## Overview

The Commerce Newsletter block provides a customer newsletter subscription interface for an Adobe Commerce Storefront.

The implementation supports two display modes:

- **Minified view** — displays the customer's current newsletter subscription status and an Edit link.
- **Full view** — displays the newsletter subscription checkbox and Save button.

The block uses Adobe Commerce Core GraphQL through the shared `CORE_FETCH_GRAPHQL` implementation from `scripts/commerce.js`.

## File Structure

```text
commerce-newsletter/
├── commerce-newsletter.js
└── api/
    └── graphql.js
```

## `commerce-newsletter.js`

The main block decorator is responsible for:

1. Reading the block configuration.
2. Detecting the configured view mode.
3. Fetching the current customer's newsletter subscription status.
4. Rendering the appropriate UI.
5. Handling subscription updates.

### Block Configuration

The implementation reads:

```text
minified-view
```

The value is enabled when it resolves to:

```text
true
```

It also supports:

```text
minifiedview
```

as an alternative configuration key.

### Minified View

When minified view is enabled, the block renders:

- `NEWSLETTERS` heading
- Current newsletter subscription status
- Edit link

The status is displayed as either:

```text
You are subscribed to "General Subscription".
```

or:

```text
You are not subscribed to any newsletter.
```

The Edit link points to:

```text
/customer/newsletter
```

### Full View

When minified view is disabled, the block renders:

- `NEWSLETTER SUBSCRIPTION` heading
- `Subscription option` label
- `General Subscription` checkbox
- `SAVE` button

The checkbox is initialized using the customer's current subscription status.

When Save is clicked:

1. The button is disabled.
2. The button text changes to `SAVING...`.
3. `updateCustomerSubscription()` is called.
4. The checkbox is updated with the returned status.
5. A success message is displayed.
6. On failure, the previous checkbox state is restored.
7. The Save button is enabled again.

## `api/graphql.js`

The GraphQL API module provides the functions used by the newsletter block.

### Core GraphQL Client

The implementation imports:

```js
import { CORE_FETCH_GRAPHQL } from '../../../scripts/commerce.js';
```

Requests are executed through:

```js
CORE_FETCH_GRAPHQL.fetchGraphQl()
```

This uses the shared Core GraphQL configuration.

## `fetchGraphQL()`

```js
export async function fetchGraphQL(query, variables = {})
```

This helper:

- Sends GraphQL requests using `CORE_FETCH_GRAPHQL`.
- Uses `POST`.
- Accepts a query and optional variables.
- Checks the GraphQL `errors` response.
- Returns the GraphQL `data`.
- Throws an error when the request fails.

Example:

```js
const data = await fetchGraphQL(query, variables);
```

## `getCustomerSubscriptionStatus()`

This function retrieves the current customer's newsletter subscription status.

Query:

```graphql
query GetCustomerSubscription {
    customer {
        is_subscribed
    }
}
```

The function returns a Boolean.

If the request fails, the implementation logs a warning and returns `false`.

## `updateCustomerSubscription()`

```js
export async function updateCustomerSubscription(isSubscribed)
```

This function updates the customer's newsletter subscription state.

The implementation uses:

```graphql
mutation UpdateCustomerSubscription(
    $input: CustomerUpdateInput!
) {
    updateCustomerV2(input: $input) {
        customer {
            is_subscribed
        }
    }
}
```

Variables:

```js
{
    input: {
        is_subscribed: Boolean(isSubscribed),
    },
}
```

The resulting `is_subscribed` value is returned as a Boolean.

## GraphQL Schema Dependency

The implementation expects the Adobe Commerce GraphQL schema to provide:

### Customer query

```graphql
customer {
    is_subscribed
}
```

### Customer update mutation

```graphql
updateCustomerV2(input: CustomerUpdateInput!)
```

### Customer update response

```graphql
updateCustomerV2 {
    customer {
        is_subscribed
    }
}
```

The supplied schema confirms that `updateCustomerV2` exists and accepts `CustomerUpdateInput`. The implementation additionally expects `is_subscribed` to be supported by the relevant customer query, update input, and update response.

## Error Handling

GraphQL errors are handled by `fetchGraphQL()`:

```js
if (response?.errors?.length) {
    throw new Error(response.errors[0].message);
}
```

The subscription status request handles errors by logging a warning and returning `false`.

The subscription update request passes errors back to the block, which:

- Restores the previous checkbox state.
- Re-enables the Save button.
- Displays the error message.

## UI Flow

### Initial Load

```text
Block loads
    ↓
Read block configuration
    ↓
Determine view mode
    ↓
Get customer subscription status
    ↓
Render minified or full view
```

### Save Flow

```text
User changes checkbox
    ↓
Click SAVE
    ↓
Disable SAVE button
    ↓
Call updateCustomerSubscription()
    ↓
Update checkbox state
    ↓
Show success message
    ↓
Enable SAVE button
```

### Error Flow

```text
User clicks SAVE
    ↓
GraphQL request fails
    ↓
Restore previous subscription state
    ↓
Show error message
    ↓
Enable SAVE button
```

## Dependencies

The implementation depends on:

- Adobe Commerce GraphQL
- `CORE_FETCH_GRAPHQL`
- `readBlockConfig`
- Customer authentication/session for customer-specific operations

The shared GraphQL client is provided by:

```text
scripts/commerce.js
```

The block configuration is read using:

```js
readBlockConfig(block)
```

## Notes

- The newsletter implementation uses **Core GraphQL**, not Catalog Service GraphQL.
- `CORE_FETCH_GRAPHQL` is used for customer/newsletter operations.
- `CS_FETCH_GRAPHQL` is not used by this newsletter implementation.
- Subscription status is represented as a Boolean in JavaScript.
- The Save button is disabled while an update request is in progress.
- The implementation does not define a separate unsubscribe mutation.
