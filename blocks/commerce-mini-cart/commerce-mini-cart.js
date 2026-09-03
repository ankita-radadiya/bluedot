import { render as provider } from '@dropins/storefront-cart/render.js';
import MiniCart from '@dropins/storefront-cart/containers/MiniCart.js';
import * as cartApi from '@dropins/storefront-cart/api.js';
import { events } from '@dropins/tools/event-bus.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';
import {
  InLineAlert,
  Icon,
  provider as UI,
  Button,
} from '@dropins/tools/components.js';
import { h } from '@dropins/tools/preact.js';

import createModal from '../modal/modal.js';
import createMiniPDP from '../../scripts/components/commerce-mini-pdp/commerce-mini-pdp.js';

import '../../scripts/initializers/cart.js';
import { readBlockConfig } from '../../scripts/aem.js';
import { fetchPlaceholders, rootLink, getProductLink } from '../../scripts/commerce.js';

export default async function decorate(block) {
  const {
    'start-shopping-url': startShoppingURL = '',
    'cart-url': cartURL = '',
    'checkout-url': checkoutURL = '',
    'enable-updating-product': enableUpdatingProduct = 'true',
    'undo-remove-item': undo = 'false',
  } = readBlockConfig(block);

  // Immediately clear raw block table configuration from DOM
  block.innerHTML = '';

  const placeholders = await fetchPlaceholders();

  const MESSAGES = {
    ADDED: placeholders?.Global?.MiniCartAddedMessage,
    UPDATED: placeholders?.Global?.MiniCartUpdatedMessage,
  };

  let currentModal = null;
  let currentCartNotification = null;

  const updateMessage = document.createElement('div');
  updateMessage.className = 'commerce-mini-cart__update-message';

  const shadowWrapper = document.createElement('div');
  shadowWrapper.className = 'commerce-mini-cart__message-wrapper';
  shadowWrapper.appendChild(updateMessage);

  const showMessage = (message) => {
    if (!message) return;
    updateMessage.textContent = message;
    updateMessage.classList.add('commerce-mini-cart__update-message--visible');
    shadowWrapper.classList.add('commerce-mini-cart__message-wrapper--visible');
    setTimeout(() => {
      updateMessage.classList.remove('commerce-mini-cart__update-message--visible');
      shadowWrapper.classList.remove('commerce-mini-cart__message-wrapper--visible');
    }, 3000);
  };

  async function handleEditButtonClick(cartItem) {
    try {
      const miniPDPContent = await createMiniPDP(
        cartItem,
        async () => {
          const productName = cartItem.name || cartItem.product?.name
           || placeholders?.Global?.CartUpdatedProductName;
          const message = placeholders?.Global?.CartUpdatedProductMessage?.replace('{product}', productName);

          const cartNotification = document.querySelector('.cart__notification');
          if (cartNotification) {
            currentCartNotification?.remove();
            currentCartNotification = await UI.render(InLineAlert, {
              heading: message,
              type: 'success',
              variant: 'primary',
              icon: h(Icon, { source: 'CheckWithCircle' }),
              'aria-live': 'assertive',
              role: 'alert',
              onDismiss: () => currentCartNotification?.remove(),
            })(cartNotification);

            setTimeout(() => currentCartNotification?.remove(), 5000);
          }
          showMessage(message);
        },
        () => {
          if (currentModal) {
            currentModal.removeModal();
            currentModal = null;
          }
        },
      );

      currentModal = await createModal([miniPDPContent]);
      if (currentModal.block) {
        currentModal.block.setAttribute('id', 'mini-pdp-modal');
      }
      currentModal.showModal();
    } catch (error) {
      console.error('Error opening mini PDP modal:', error);
      showMessage(placeholders?.Global?.ProductLoadError);
    }
  }

  events.on('cart/product/added', () => showMessage(MESSAGES.ADDED), { eager: true });
  events.on('cart/product/updated', () => showMessage(MESSAGES.UPDATED), { eager: true });

  const createProductLink = (product) => getProductLink(product.url.urlKey, product.topLevelSku);

  try {
    await provider.render(MiniCart, {
      routeEmptyCartCTA: startShoppingURL ? () => rootLink(startShoppingURL) : undefined,
      routeCart: cartURL ? () => rootLink(cartURL) : undefined,
      routeCheckout: checkoutURL ? () => rootLink(checkoutURL) : undefined,
      routeProduct: createProductLink,
      undo: undo === 'true',
      enableItemRemoval: true,
      enableQuantityUpdate: true,

      slots: {
        Thumbnail: (ctx) => {
          const { item, defaultImageProps } = ctx;
          const src = defaultImageProps?.src || item?.image?.src;
          const width = Number(defaultImageProps?.width) || 100;
          const height = Number(defaultImageProps?.height) || width;
          // Include height on params. AEM Assets image-param keys treat a
          // missing height as Math.floor(undefined) → height=NaN, and the
          // Commerce media CDN then returns a 3×3 broken thumbnail.
          const imageProps = {
            ...defaultImageProps,
            ...(src ? { src } : {}),
            params: { width, height },
          };
          const anchorWrapper = document.createElement('a');
          anchorWrapper.href = createProductLink(item);

          // Pass the link as `wrapper` only. ctx is a Slot context, not a DOM
          // node, so appendChild here never mounts the rendered <img>.
          try {
            tryRenderAemAssetsImage(ctx, {
              alias: item.sku,
              imageProps,
              wrapper: anchorWrapper,
              params: { width, height },
            });
          } catch (error) {
            if (!src) {
              console.error('MiniCart thumbnail is missing an image source', error);
              return;
            }
            const img = document.createElement('img');
            img.src = src;
            img.alt = defaultImageProps?.alt || item?.name || '';
            img.width = width;
            img.height = height;
            anchorWrapper.appendChild(img);
            ctx.replaceWith(anchorWrapper);
          }
        },

        // MiniCart's supported slot is "ItemQuantity" — a slot literally named
        // "Quantity" is never invoked, which is why the stepper wasn't showing.
        ItemQuantity: (ctx) => {
          const { item } = ctx;
          ctx.innerHTML = '';

          const wrapper = document.createElement('div');
          wrapper.className = 'minicart-qty-pill-wrapper';

          const label = document.createElement('span');
          label.className = 'minicart-qty-label';
          label.textContent = 'Qty';

          const pill = document.createElement('div');
          pill.className = 'minicart-qty-pill';

          const minusBtn = document.createElement('button');
          minusBtn.type = 'button';
          minusBtn.className = 'minicart-qty-btn minicart-qty-minus';
          minusBtn.textContent = '−';
          minusBtn.ariaLabel = 'Decrease quantity';
          minusBtn.onclick = async (e) => {
            e.preventDefault();
            if (item.quantity > 1 && cartApi.updateProductsFromCart) {
              await cartApi.updateProductsFromCart([{
                uid: item.uid, quantity: item.quantity - 1,
              }]);
            }
          };

          const qtyVal = document.createElement('span');
          qtyVal.className = 'minicart-qty-value';
          qtyVal.textContent = item.quantity;

          const plusBtn = document.createElement('button');
          plusBtn.type = 'button';
          plusBtn.className = 'minicart-qty-btn minicart-qty-plus';
          plusBtn.textContent = '+';
          plusBtn.ariaLabel = 'Increase quantity';
          plusBtn.onclick = async (e) => {
            e.preventDefault();
            if (cartApi.updateProductsFromCart) {
              await cartApi.updateProductsFromCart([{
                uid: item.uid, quantity: item.quantity + 1,
              }]);
            }
          };

          pill.appendChild(minusBtn);
          pill.appendChild(qtyVal);
          pill.appendChild(plusBtn);

          wrapper.appendChild(label);
          wrapper.appendChild(pill);
          ctx.appendChild(wrapper);
        },

        ItemRemoveAction: (ctx) => {
          const { item } = ctx;
          const originalRemoveBtn = ctx.querySelector('.dropin-cart-item__remove') || ctx.firstChild;

          const actionContainer = document.createElement('div');
          actionContainer.className = 'minicart-item-actions-row';

          if (enableUpdatingProduct === 'true') {
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'minicart-action-btn minicart-edit-btn';
            editBtn.setAttribute('aria-label', `Edit ${item.name}`);
            UI.render(Button, {
              variant: 'tertiary',
              size: 'medium',
              icon: h(Icon, { source: 'Edit' }),
              onClick: () => handleEditButtonClick(item),
            })(editBtn);

            actionContainer.appendChild(editBtn);
          }

          if (originalRemoveBtn) {
            actionContainer.appendChild(originalRemoveBtn);
          }

          ctx.innerHTML = '';
          ctx.appendChild(actionContainer);
        },
      },
    })(block);
  } catch (error) {
    console.error('Failed to render MiniCart component:', error);
  }

  const productsContainer = block.querySelector('.cart-mini-cart__products');
  if (productsContainer) {
    productsContainer.insertBefore(shadowWrapper, productsContainer.firstChild);
  } else {
    block.appendChild(shadowWrapper);
  }

  return block;
}
