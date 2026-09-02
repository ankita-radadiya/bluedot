import { getFflConfig } from './config.js';
import { resolveCartRequiresFfl } from './products.js';
import {
  applyFflDealerToCart,
  cartHasFflShippingAddress,
  getStoredFflDealer,
  restoreFflDealer,
} from './address.js';
import { renderFflDealerSearch } from './ui.js';

export function applyFflLayout(block, { required, selected }) {
  block.classList.toggle('checkout--ffl', required);
  block.classList.toggle('checkout--ffl-ready', required && selected);
}

export function validateFflSelection(block, fflUi, fflEl) {
  if (!block.classList.contains('checkout--ffl') || block.classList.contains('checkout--ffl-ready')) {
    return true;
  }

  fflUi?.showValidation(getFflConfig().copy.selectPrompt);
  fflEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return false;
}

/**
 * Shows or hides the FFL dealer section based on the current cart.
 * @param {{
 *   cart: object|null,
 *   checkoutData: object|null,
 *   block: Element,
 *   fflEl: Element,
 *   fflUi: object|undefined,
 * }} params
 * @returns {Promise<{ required: boolean, selected: boolean, fflUi: object|undefined }>}
 */
export async function syncFflSection({
  cart,
  checkoutData,
  block,
  fflEl,
  fflUi,
}) {
  const required = await resolveCartRequiresFfl(cart);
  let selected = Boolean(getStoredFflDealer() || cartHasFflShippingAddress(checkoutData));
  let nextUi = fflUi;

  if (!required) {
    fflEl.replaceChildren();
    applyFflLayout(block, { required: false, selected: false });
    return { required: false, selected: false, fflUi: undefined };
  }

  if (!nextUi) {
    nextUi = renderFflDealerSearch(fflEl, {
      selectedDealer: getStoredFflDealer(),
      onDealerSelect: async (dealer) => {
        await applyFflDealerToCart(dealer);
        applyFflLayout(block, { required: true, selected: true });
      },
    });
  }

  applyFflLayout(block, { required, selected });

  if (!selected) {
    await restoreFflDealer(checkoutData);
    selected = Boolean(getStoredFflDealer() || cartHasFflShippingAddress(checkoutData));
    if (selected) {
      nextUi.setSelectedDealer(getStoredFflDealer());
      applyFflLayout(block, { required: true, selected: true });
    }
  }

  return { required, selected, fflUi: nextUi };
}
