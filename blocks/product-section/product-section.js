// Dropin Tools
import { events } from '@dropins/tools/event-bus.js';

// Cart Dropin
import * as cartApi from '@dropins/storefront-cart/api.js';

// Recommendations Dropin
import { publishRecsItemAddToCartClick } from '@dropins/storefront-recommendations/api.js';

// Wishlist Dropin
import { WishlistToggle } from '@dropins/storefront-wishlist/containers/WishlistToggle.js';
import { render as wishlistRender } from '@dropins/storefront-wishlist/render.js';

// Block-level
import { readBlockConfig } from '../../scripts/aem.js';
import {
  getProductLink, CS_FETCH_GRAPHQL, rootLink, checkIsAuthenticated, CUSTOMER_LOGIN_PATH,
} from '../../scripts/commerce.js';
import {
  addCompareProduct,
  removeCompareProduct,
  isCompared,
} from '../../scripts/components/compare/compare.js';

// Initializers
import '../../scripts/initializers/recommendations.js';
import '../../scripts/initializers/wishlist.js';

/**
 * Fetches products from Adobe Commerce API
 * @param {Array<string>} skus - Product SKUs to fetch
 * @returns {Promise<Array>} Array of product objects
 */
async function fetchProductsFromCommerce(skus = []) {
  try {
    const query = skus.length > 0
      ? `
        query GetProductsBySku($skus: [String!]!) {
          products(skus: $skus) {
            sku
            name
            url
            urlKey
            images(roles: ["image"]) {
              url
              label
            }
            ... on SimpleProductView {
              price {
                regular {
                  amount {
                    value
                    currency
                  }
                }
                final {
                  amount {
                    value
                    currency
                  }
                }
              }
            }
            ... on ComplexProductView {
              priceRange {
                minimum {
                  regular {
                    amount {
                      value
                      currency
                    }
                  }
                  final {
                    amount {
                      value
                      currency
                    }
                  }
                }
                maximum {
                  regular {
                    amount {
                      value
                      currency
                    }
                  }
                  final {
                    amount {
                      value
                      currency
                    }
                  }
                }
              }
            }
          }
        }
      `
      : `
        query GetProducts($phrase: String!, $pageSize: Int!, $currentPage: Int = 1) {
          productSearch(phrase: $phrase, page_size: $pageSize, current_page: $currentPage) {
            items {
              productView {
                sku
                name
                url
                urlKey
                images(roles: ["image"]) {
                  url
                  label
                }
                ... on SimpleProductView {
                  price {
                    regular {
                      amount {
                        value
                        currency
                      }
                    }
                    final {
                      amount {
                        value
                        currency
                      }
                    }
                  }
                }
                ... on ComplexProductView {
                  priceRange {
                    minimum {
                      regular {
                        amount {
                          value
                          currency
                        }
                      }
                      final {
                        amount {
                          value
                          currency
                        }
                      }
                    }
                    maximum {
                      regular {
                        amount {
                          value
                          currency
                        }
                      }
                      final {
                        amount {
                          value
                          currency
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

    const variables = skus.length > 0
      ? { skus }
      : { phrase: '', pageSize: 6, currentPage: 1 };

    const response = await CS_FETCH_GRAPHQL.fetchGraphQl(query, {
      method: 'POST',
      variables,
    });

    if (response.errors) {
      console.error('GraphQL Errors:', JSON.stringify(response.errors, null, 2));
      return [];
    }

    const products = skus.length > 0
      ? response.data?.products || []
      : response.data?.productSearch?.items?.map((item) => item.productView) || [];

    return products.map((product) => {
      const priceData = product.price || product.priceRange?.minimum || {};
      const regularPrice = priceData?.regular?.amount?.value || 0;
      const finalPrice = priceData?.final?.amount?.value || regularPrice;
      const imageUrl = product.images?.[0]?.url || 'https://placehold.co/300x400';

      return {
        id: product.id || product.sku,
        sku: product.sku,
        name: product.name,
        urlKey: product.urlKey,
        url: product.url,
        price: regularPrice,
        specialPrice: finalPrice !== regularPrice ? finalPrice : '',
        image: imageUrl,
        rating: 0,
        badge: '',
        swatches: [],
        inStock: true,
      };
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

/**
 * Renders a product card with image, name, rating, price, and color swatches
 * @param {Object} product - The product object from the dropin
 * @param {HTMLElement} container - Container to append the product card to
 */
function renderProductCard(product, container) {
  const card = document.createElement('div');
  card.className = 'product-section-card';

  // Product image
  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'product-section-image-wrapper';

  const img = document.createElement('img');
  img.src = product.image || 'https://placehold.co/300x400';
  img.alt = product.name || 'Product';
  img.loading = 'lazy';
  img.className = 'product-section-image';

  imageWrapper.appendChild(img);

  // Badge (if available)
  if (product.badge) {
    const badge = document.createElement('span');
    badge.className = 'product-section-badge';
    badge.textContent = product.badge;
    imageWrapper.appendChild(badge);
  }

  // Actions overlay
  const actionsWrapper = document.createElement('div');
  actionsWrapper.className = 'product-section-actions product-discovery-product-actions';
  imageWrapper.appendChild(actionsWrapper);

  const wishlistContainer = document.createElement('div');
  wishlistContainer.className = 'product-section-wishlist product-discovery-product-actions__wishlist-toggle';

  card.appendChild(imageWrapper);

  // Product info
  const infoWrapper = document.createElement('div');
  infoWrapper.className = 'product-section-info';

  // Product name (link to product page)
  const nameLink = document.createElement('a');
  nameLink.href = getProductLink(product.urlKey || product.sku, product.sku) || '#';
  nameLink.className = 'product-section-name';
  nameLink.textContent = product.name || 'Product';

  infoWrapper.appendChild(nameLink);

  // Rating
  if (product.rating) {
    const ratingDiv = document.createElement('div');
    ratingDiv.className = 'product-section-rating';
    ratingDiv.innerHTML = `★★★★☆ <span class="rating-count">${product.rating}</span>`;
    infoWrapper.appendChild(ratingDiv);
  }

  // Price
  const priceDiv = document.createElement('div');
  priceDiv.className = 'product-section-price';

  if (product.specialPrice) {
    const oldPrice = document.createElement('span');
    oldPrice.className = 'old-price';
    oldPrice.textContent = `$${parseFloat(product.price).toFixed(2)}`;
    priceDiv.appendChild(oldPrice);

    const newPrice = document.createElement('span');
    newPrice.className = 'special-price';
    newPrice.textContent = `$${parseFloat(product.specialPrice).toFixed(2)}`;
    priceDiv.appendChild(newPrice);
  } else {
    const price = document.createElement('span');
    price.className = 'price';
    price.textContent = `$${parseFloat(product.price).toFixed(2)}`;
    priceDiv.appendChild(price);
  }

  infoWrapper.appendChild(priceDiv);

  // Color swatches (if available)
  if (product.swatches && product.swatches.length) {
    const swatchesDiv = document.createElement('div');
    swatchesDiv.className = 'product-section-swatches';

    product.swatches.forEach((swatch) => {
      const swatchSpan = document.createElement('span');
      swatchSpan.className = 'product-section-swatch';
      swatchSpan.style.backgroundColor = swatch.color;
      swatchSpan.title = swatch.label || swatch.color;
      swatchesDiv.appendChild(swatchSpan);
    });

    infoWrapper.appendChild(swatchesDiv);
  }

  // Add to Cart Button
  const addToCartBtn = document.createElement('button');
  addToCartBtn.className = 'product-section-add-to-cart';
  addToCartBtn.type = 'button';
  addToCartBtn.textContent = 'Add to Cart';
  addToCartBtn.disabled = !product.inStock;
  addToCartBtn.addEventListener('click', async () => {
    if (!product.inStock || addToCartBtn.disabled) {
      return;
    }

    try {
      await cartApi.addProductsToCart([{ sku: product.sku, quantity: 1 }]);
      publishRecsItemAddToCartClick(product.sku);
      addToCartBtn.textContent = 'Added!';
      setTimeout(() => {
        addToCartBtn.textContent = 'Add to Cart';
      }, 2000);
    } catch (error) {
      console.error('Error adding product to cart:', error);
    }
  });

  infoWrapper.appendChild(addToCartBtn);
  card.appendChild(infoWrapper);

  const wishlistProduct = {
    sku: product.sku,
    topLevelSku: product.sku,
    urlKey: product.urlKey,
    name: product.name,
    url: getProductLink(product.urlKey || product.sku, product.sku),
    images: [{ url: product.image, label: product.name }],
  };

  const compareBtn = document.createElement('button');
  compareBtn.className = 'product-section-compare product-discovery-product-actions__compare-toggle';
  compareBtn.type = 'button';
  compareBtn.innerHTML = '<img src="../../icons/compare.svg" alt="Compare" width="20" height="20" />';
  if (isCompared(product.sku)) {
    compareBtn.classList.add('active');
  }
  compareBtn.addEventListener('click', () => {
    if (isCompared(product.sku)) {
      removeCompareProduct(product.sku);
      compareBtn.classList.remove('active');
    } else {
      const result = addCompareProduct(product.sku);
      if (result.success) {
        compareBtn.classList.add('active');
      }
    }
  });

  actionsWrapper.appendChild(wishlistContainer);
  actionsWrapper.appendChild(compareBtn);

  // Render wishlist toggle after card is in DOM
  wishlistRender.render(WishlistToggle, {
    product: wishlistProduct,
    variant: 'tertiary',
    ...(!checkIsAuthenticated() && {
      onClick: (e) => {
        e?.preventDefault();
        e?.stopPropagation();
        const redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `${rootLink(CUSTOMER_LOGIN_PATH)}?redirect=${redirectUrl}`;
      },
    }),
  })(wishlistContainer);

  container.appendChild(card);
}

function setupProductSlider(container, prevBtn, nextBtn) {
  const getMaxScroll = () => Math.max(0, container.scrollWidth - container.clientWidth);

  const updateButtons = () => {
    requestAnimationFrame(() => {
      const maxScroll = getMaxScroll();
      const atStart = container.scrollLeft <= 0;
      const atEnd = container.scrollLeft >= Math.max(0, maxScroll - 1);
      prevBtn.disabled = atStart;
      nextBtn.disabled = atEnd;
    });
  };

  const scrollStep = () => Math.max(container.clientWidth * 0.8, 320);

  prevBtn.addEventListener('click', () => {
    container.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
  });

  nextBtn.addEventListener('click', () => {
    container.scrollBy({ left: scrollStep(), behavior: 'smooth' });
  });

  container.addEventListener('scroll', updateButtons, { passive: true });
  window.addEventListener('resize', updateButtons);

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(updateButtons);
    resizeObserver.observe(container);
  }

  container.querySelectorAll('img').forEach((img) => {
    if (img.complete) {
      updateButtons();
    } else {
      img.addEventListener('load', updateButtons, { once: true });
    }
  });

  requestAnimationFrame(updateButtons);
  window.setTimeout(updateButtons, 100);
}

/**
 * Main block decoration function
 * Configuration options (set in da.live as key-value pairs):
 * - productskus (or product-skus): comma-separated product SKUs to display
 * - recommendationtype: type of recommendation (e.g., 'viewed', 'bought-together')
 * - categorypath: category path for filtering (alternative to product SKUs)
 * - sortby: sort order (e.g., 'name', 'price', 'relevance')
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);

  const skuConfig = config.productskus || config['product-skus'] || config.productSkus || config.productSKUs;
  const productSkus = skuConfig
    ? String(skuConfig).split(',').map((sku) => sku.trim()).filter(Boolean)
    : [];

  // Create container and slider controls
  const fragment = document.createRange().createContextualFragment(`
    <div class="product-section-inner">
      <button type="button" class="product-section-arrow product-section-prev" aria-label="Previous products">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      </button>
      <div class="product-section-slider"></div>
      <button type="button" class="product-section-arrow product-section-next" aria-label="Next products">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 6 7.59 7.41 12.17 12l-4.58 4.59L9 18l6-6z"/></svg>
      </button>
    </div>
  `);

  const container = fragment.querySelector('.product-section-slider');
  container.className = 'product-section-slider';
  const prevBtn = fragment.querySelector('.product-section-prev');
  const nextBtn = fragment.querySelector('.product-section-next');

  block.innerHTML = '';
  block.appendChild(fragment);

  // Show loading state
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'product-section-loading';
  loadingDiv.textContent = 'Loading products...';
  container.appendChild(loadingDiv);

  // Fetch products from Commerce API
  const productsToDisplay = await fetchProductsFromCommerce(productSkus);

  // If no products found and no SKUs specified, show message
  if (productsToDisplay.length === 0) {
    loadingDiv.textContent = 'No products available';
    console.warn('No products found for config:', { productSkus });
  } else {
    // Clear loading state
    container.innerHTML = '';

    // Render products
    productsToDisplay.forEach((product) => {
      renderProductCard(product, container);
    });

    setupProductSlider(container, prevBtn, nextBtn);
  }

  // Emit event that block has loaded
  events.emit('aem/product-section-loaded', { productCount: productsToDisplay.length });
}
