// Dropin Tools
import { events } from '@dropins/tools/event-bus.js';
import { getConfigValue } from '@dropins/tools/lib/aem/configs.js';

// Dropin Components
import { Button, Icon, provider as UI } from '@dropins/tools/components.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';

// Cart Dropin
import * as cartApi from '@dropins/storefront-cart/api.js';

// Recommendations Dropin
import ProductList from '@dropins/storefront-recommendations/containers/ProductList.js';
import { render as provider } from '@dropins/storefront-recommendations/render.js';
import { publishRecsItemAddToCartClick } from '@dropins/storefront-recommendations/api.js';

// Wishlist Dropin
import { WishlistToggle } from '@dropins/storefront-wishlist/containers/WishlistToggle.js';
import { render as wishlistRender } from '@dropins/storefront-wishlist/render.js';

// Block-level
import { readBlockConfig } from '../../scripts/aem.js';
import {
  fetchPlaceholders, getProductLink, getStoreIdentifier,
} from '../../scripts/commerce.js';

// Initializers
import '../../scripts/initializers/recommendations.js';
import '../../scripts/initializers/wishlist.js';

const isMobile = window.matchMedia('only screen and (max-width: 900px)').matches;

const SLIDER_ARROW_SVG = {
  prev: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 6 7.59 7.41 12.17 12l-4.58 4.59L9 18l6-6z"/></svg>',
};

function createSliderControls() {
  const container = document.createElement('div');
  container.className = 'recommendations-slider-container';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'recommendations-slider-arrow recommendations-slider-prev';
  prevBtn.setAttribute('aria-label', 'Previous products');
  prevBtn.innerHTML = SLIDER_ARROW_SVG.prev;

  const mount = document.createElement('div');
  mount.className = 'recommendations__mount';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'recommendations-slider-arrow recommendations-slider-next';
  nextBtn.setAttribute('aria-label', 'Next products');
  nextBtn.innerHTML = SLIDER_ARROW_SVG.next;

  container.append(prevBtn, mount, nextBtn);
  return {
    container, mount, prevBtn, nextBtn,
  };
}

function getRecommendationsTrack(mount) {
  return mount.querySelector('.recommendations-carousel__content')
    || mount.querySelector('.recommendations-product-list__content .dropin-content-grid__content')
    || mount.querySelector('.recommendations-product-list__content');
}

function setupRecommendationsSlider(mount, prevBtn, nextBtn) {
  const track = getRecommendationsTrack(mount);
  if (!track) {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return null;
  }

  const hasProducts = track.querySelector('[data-testid="recommendations-product-item-card"]')
    || track.querySelector('.dropin-product-item-card');
  if (!hasProducts) {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return null;
  }

  const getMaxScroll = () => Math.max(0, track.scrollWidth - track.clientWidth);

  const updateButtons = () => {
    requestAnimationFrame(() => {
      const maxScroll = getMaxScroll();
      const atStart = track.scrollLeft <= 0;
      const atEnd = track.scrollLeft >= Math.max(0, maxScroll - 1);
      prevBtn.disabled = atStart;
      nextBtn.disabled = atEnd;
    });
  };

  const scrollStep = () => Math.max(track.clientWidth * 0.75, 280);

  const controller = mount.recommendationsSliderController;
  if (controller) {
    controller.cleanup();
  }

  const onScroll = () => updateButtons();
  const onResize = () => updateButtons();
  const onPrevClick = () => {
    track.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
  };
  const onNextClick = () => {
    track.scrollBy({ left: scrollStep(), behavior: 'smooth' });
  };

  prevBtn.addEventListener('click', onPrevClick);
  nextBtn.addEventListener('click', onNextClick);
  track.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  let resizeObserver;
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(updateButtons);
    resizeObserver.observe(track);
  }

  track.querySelectorAll('img').forEach((img) => {
    if (img.complete) {
      updateButtons();
    } else {
      img.addEventListener('load', updateButtons, { once: true });
    }
  });

  const cleanup = () => {
    prevBtn.removeEventListener('click', onPrevClick);
    nextBtn.removeEventListener('click', onNextClick);
    track.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    resizeObserver?.disconnect();
  };

  mount.recommendationsSliderController = { cleanup, updateButtons };

  requestAnimationFrame(updateButtons);
  window.setTimeout(updateButtons, 100);

  return mount.recommendationsSliderController;
}

/**
 * Validates and returns a product view history entry if valid
 * @param {Object} entry - The history entry to validate
 * @returns {Object|null} - Validated history entry or null if invalid
 */
function getValidViewEntry(entry) {
  // Basic validation to ensure the entry has necessary properties
  if (entry && typeof entry === 'object' && entry.sku && entry.date) {
    return {
      sku: entry.sku,
      date: entry.date,
    };
  }
  return null;
}

/**
 * Gets product view history from localStorage
 * @returns {Array} - Array of view history items
 */
export function getProductViewHistory() {
  const storeIdentifier = getStoreIdentifier();
  try {
    if (!storeIdentifier) {
      return [];
    }
    const viewHistory = window.localStorage.getItem(`${storeIdentifier}:productViewHistory`) || '[]';
    const parsedHistory = JSON.parse(viewHistory);
    if (!Array.isArray(parsedHistory)) {
      throw new Error('Product view history is not an array');
    }
    const validHistory = parsedHistory.map(getValidViewEntry).filter((entry) => entry !== null);
    if (validHistory.length === 0) {
      // If no valid entries, clear the history to prevent future parsing issues
      window.localStorage.removeItem(`${storeIdentifier}:productViewHistory`);
    }
    return validHistory;
  } catch (e) {
    window.localStorage.removeItem(`${storeIdentifier}:productViewHistory`);
    console.error('Error parsing product view history', e);
    return [];
  }
}

/**
 * Validates and returns a purchase history entry if valid
 * @param {Object} entry - The history entry to validate
 * @returns {Object|null} - Validated history entry or null if invalid
 */
function getValidPurchaseEntry(entry) {
  // Basic validation to ensure the entry has necessary properties
  const { items, date } = entry ?? {};
  if (Array.isArray(items) && items.every((item) => typeof item === 'string') && date) {
    return { items, date };
  }
  return null;
}

/**
 * Gets purchase history from localStorage
 * @returns {Array} - Array of purchase history items
 */
export function getPurchaseHistory() {
  const storeIdentifier = getStoreIdentifier();
  try {
    if (!storeIdentifier) {
      return [];
    }
    const purchaseHistory = window.localStorage.getItem(`${storeIdentifier}:purchaseHistory`) || '[]';
    const parsedHistory = JSON.parse(purchaseHistory);
    if (!Array.isArray(parsedHistory)) {
      throw new Error('Purchase history is not an array');
    }
    const validHistory = parsedHistory.map(getValidPurchaseEntry).filter((entry) => entry !== null);
    if (validHistory.length === 0) {
      // If no valid entries, clear the history to prevent future parsing issues
      window.localStorage.removeItem(`${storeIdentifier}:purchaseHistory`);
    }
    return validHistory;
  } catch (e) {
    window.localStorage.removeItem(`${storeIdentifier}:purchaseHistory`);
    console.error('Error parsing purchase history', e);
    return [];
  }
}

export default async function decorate(block) {
  const labels = await fetchPlaceholders();

  // Hide configuration rows if they exist
  const children = [...block.children];
  children.forEach((child) => {
    child.style.display = 'none';
  });

  // Configuration
  const { currentsku, currentprice, recid } = readBlockConfig(block);

  // Layout
  const $wrapper = document.createElement('div');
  $wrapper.className = 'recommendations__wrapper';
  const {
    container: sliderContainer,
    mount: $mount,
    prevBtn,
    nextBtn,
  } = createSliderControls();
  $wrapper.appendChild(sliderContainer);
  block.appendChild($wrapper);

  let sliderObserverTimeout;
  const sliderObserver = new MutationObserver(() => {
    window.clearTimeout(sliderObserverTimeout);
    sliderObserverTimeout = window.setTimeout(() => {
      setupRecommendationsSlider($mount, prevBtn, nextBtn);
    }, 100);
  });
  sliderObserver.observe($mount, { childList: true, subtree: true });

  let visibility = !isMobile;
  let isLoading = false;
  let loadTimeout = null;

  async function loadRecommendation(
    context,
    isVisible,
    container,
    forceReload = false,
  ) {
    // Only load once the recommendation becomes visible
    if (!isVisible) {
      return;
    }

    // Prevent multiple simultaneous loads
    if (isLoading) {
      return;
    }

    // Only proceed if container is empty or force reload is requested
    if (container.children.length > 0 && !forceReload) {
      return;
    }

    isLoading = true;

    // Clear container if reloading
    if (forceReload) {
      container.recommendationsSliderController?.cleanup();
      container.innerHTML = '';
    }

    const createProductLink = (item) => getProductLink(item.urlKey, item.sku);

    // Get product view history
    context.userViewHistory = getProductViewHistory();

    // Get purchase history
    context.userPurchaseHistory = getPurchaseHistory();

    let recommendationsData = null;

    // Get data from the event bus to set publish events
    events.on(
      'recommendations/data',
      (data) => {
        recommendationsData = data;
        if (data?.items?.length) {
          recommendationsData = data;
        }
      },
      { eager: true },
    );

    try {
      const skuFromConfig = !!currentsku;
      const resolvedSku = currentsku || context.currentSku;
      const isACO = getConfigValue('adobe-commerce-optimizer') === true
        || getConfigValue('adobe-commerce-optimizer') === 'true';
      // Price source must match SKU source: if SKU is pinned via block config,
      // do not pull price from ACDL context (it would belong to a different product).
      let resolvedPrice = null;
      if (isACO) {
        if (currentprice != null) {
          resolvedPrice = Number(currentprice);
        } else if (!skuFromConfig) {
          resolvedPrice = context.currentProductPrice ?? null;
        }
      }
      const currentProduct = resolvedSku
        ? { sku: resolvedSku, ...(resolvedPrice != null && { price: resolvedPrice }) }
        : undefined;

      await Promise.all([
        provider.render(ProductList, {
          routeProduct: createProductLink,
          recId: recid,
          currentProduct,
          userViewHistory: context.userViewHistory,
          userPurchaseHistory: context.userPurchaseHistory,
          slots: {
            Footer: (ctx) => {
              const wrapper = document.createElement('div');
              wrapper.className = 'footer__wrapper';

              const addToCart = document.createElement('div');
              addToCart.className = 'footer__button--add-to-cart';
              wrapper.appendChild(addToCart);

              if (ctx.item.itemType === 'SimpleProductView') {
                // Add to Cart Button
                UI.render(Button, {
                  children: labels.Global?.AddProductToCart,
                  icon: Icon({ source: 'Cart' }),
                  onClick: ctx.item.inStock
                    ? (event) => {
                      cartApi.addProductsToCart([
                        { sku: ctx.item.sku, quantity: 1 },
                      ]);
                      // Prevent the click event from bubbling up to the parent span
                      // to avoid triggering the recs-item-click event
                      event.stopPropagation();
                      // Publish ACDL event for add to cart click
                      const recommendationUnit = recommendationsData?.find(
                        (unit) => unit.items?.some(
                          (unitItem) => unitItem.sku === ctx.item.sku,
                        ),
                      );
                      publishRecsItemAddToCartClick({
                        recommendationUnit,
                        pagePlacement: 'product-list',
                        yOffsetTop: addToCart.getBoundingClientRect().top ?? 0,
                        yOffsetBottom:
                          addToCart.getBoundingClientRect().bottom ?? 0,
                        productId: ctx.index,
                      });
                    }
                    : undefined,
                  variant: 'primary',
                  disabled: !ctx.item.inStock,
                })(addToCart);
              } else {
                // Select Options Button
                UI.render(Button, {
                  children:
                    labels.Global?.SelectProductOptions,
                  href: createProductLink(ctx.item),
                  variant: 'tertiary',
                })(addToCart);
              }

              // Wishlist Button
              const $wishlistToggle = document.createElement('div');
              $wishlistToggle.classList.add('footer__button--wishlist-toggle');

              // Render Icon
              wishlistRender.render(WishlistToggle, {
                product: ctx.item,
                labelToWishlist: labels.Global?.AddToWishlist || 'Add to Wishlist',
                labelWishlisted: labels.Global?.Wishlisted || 'Add to Wishlist',
              })($wishlistToggle);

              // Append to Cart Item
              wrapper.appendChild($wishlistToggle);

              ctx.replaceWith(wrapper);
            },

            Thumbnail: (ctx) => {
              const { item, defaultImageProps } = ctx;
              const rawSrc = defaultImageProps?.src || item?.images?.[0]?.url || '';
              const src = rawSrc.startsWith('//') ? `https:${rawSrc}` : rawSrc;
              const width = Number(defaultImageProps?.width) || 300;
              const height = Number(defaultImageProps?.height) || width;
              // Include height on params. AEM Assets image-param keys treat a
              // missing height as Math.floor(undefined) → height=NaN, and the
              // Commerce media CDN then returns a 3×3 broken thumbnail.
              const imageProps = {
                ...defaultImageProps,
                ...(src ? { src } : {}),
                params: { width, height },
              };
              const wrapper = document.createElement('a');
              wrapper.href = createProductLink(item);

              try {
                tryRenderAemAssetsImage(ctx, {
                  alias: item.sku,
                  imageProps,
                  wrapper,
                  params: { width, height },
                });
              } catch (error) {
                if (!src) {
                  console.error('Recommendations thumbnail is missing an image source', error);
                  return;
                }
                const img = document.createElement('img');
                img.src = src;
                img.alt = defaultImageProps?.alt || item?.name || '';
                img.width = width;
                img.height = height;
                wrapper.appendChild(img);
                ctx.replaceWith(wrapper);
              }
            },
          },
        })($mount),
      ]);

      setupRecommendationsSlider($mount, prevBtn, nextBtn);
    } finally {
      isLoading = false;
    }
  }

  const context = {};
  // Debounced loader to prevent excessive API calls
  function debouncedLoadRecommendation(forceReload = false) {
    if (loadTimeout) {
      clearTimeout(loadTimeout);
    }

    loadTimeout = setTimeout(() => {
      loadRecommendation(context, visibility, $mount, forceReload);
    }, 300); // 300ms debounce
  }

  // Track previous context values to detect significant changes
  let previousContext = {};

  function shouldReloadRecommendations(newContext) {
    // Check if significant context changes occurred that warrant reloading recommendations
    const significantChanges = ['currentSku', 'currentProductPrice', 'pageType', 'category'];

    return significantChanges.some(
      (key) => newContext[key] !== previousContext[key] && newContext[key] !== undefined,
    );
  }

  function updateContext(updates) {
    const hasSignificantChanges = shouldReloadRecommendations({
      ...context,
      ...updates,
    });

    // Update context
    Object.assign(context, updates);

    // Update previous context for next comparison
    previousContext = { ...context };

    // Load or reload recommendations based on whether significant changes occurred
    if (hasSignificantChanges && $mount.children.length > 0) {
      // Force reload if recommendations already exist and context changed significantly
      debouncedLoadRecommendation(true);
    } else {
      // Initial load or minor context changes
      debouncedLoadRecommendation(false);
    }
  }

  function handleProductChanges({ productContext }) {
    const pricing = productContext?.pricing;
    const price = pricing
      ? (pricing.specialPrice ?? pricing.regularPrice)
      : undefined;
    updateContext({
      currentSku: productContext?.sku,
      currentProductPrice: price,
    });
  }

  function handleCategoryChanges({ categoryContext }) {
    updateContext({ category: categoryContext?.name });
  }

  function handlePageTypeChanges({ pageContext }) {
    updateContext({ pageType: pageContext?.pageType });
  }

  function handleCartChanges({ shoppingCartContext }) {
    const cartSkus = shoppingCartContext?.totalQuantity === 0
      ? []
      : shoppingCartContext?.items?.map(({ product }) => product.sku);
    updateContext({ cartSkus });
  }

  window.adobeDataLayer.push((dl) => {
    dl.addEventListener('adobeDataLayer:change', handlePageTypeChanges, { path: 'pageContext' });
    dl.addEventListener('adobeDataLayer:change', handleProductChanges, { path: 'productContext' });
    dl.addEventListener('adobeDataLayer:change', handleCategoryChanges, { path: 'categoryContext' });
    dl.addEventListener('adobeDataLayer:change', handleCartChanges, { path: 'shoppingCartContext' });
  });

  if (isMobile) {
    const section = block.closest('.section');
    const inViewObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibility = true;
          debouncedLoadRecommendation(false);
          inViewObserver.disconnect();
        }
      });
    });
    inViewObserver.observe(section);
  }
}
