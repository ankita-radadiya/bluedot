import { readBlockConfig } from '../../scripts/aem.js';
import {
  CS_FETCH_GRAPHQL,
  getProductLink,
} from '../../scripts/commerce.js';

const PRODUCT_VIEW_FIELDS = `
  __typename
  sku
  name
  urlKey
  images {
    url
    label
    roles
  }
  ... on SimpleProductView {
    price {
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
        final {
          amount {
            value
            currency
          }
        }
      }
    }
  }
`;

function resolveImageUrl(url = '') {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

function pickProductImage(images = []) {
  const preferred = images.find((image) => image.roles?.includes('image'))
    || images.find((image) => image.roles?.includes('small_image'))
    || images.find((image) => image.roles?.includes('thumbnail'))
    || images[0];
  return resolveImageUrl(preferred?.url || '');
}

function normalizeProduct(product) {
  const priceData = product.price || product.priceRange?.minimum || {};
  const finalPrice = priceData?.final?.amount || { value: 0, currency: 'USD' };

  return {
    sku: product.sku,
    name: product.name,
    urlKey: product.urlKey || product.sku,
    image: pickProductImage(product.images),
    price: finalPrice.value,
    currency: finalPrice.currency || 'USD',
    // Configurable products need option selection on the product page
    requiresConfiguration: product.__typename === 'ComplexProductView',
  };
}

function formatPrice(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

async function fetchProductsBySku(skus = []) {
  if (!skus.length) return [];

  const query = `
    query ProductSliderBySku($skus: [String!]!) {
      products(skus: $skus) {
        ${PRODUCT_VIEW_FIELDS}
      }
    }
  `;

  try {
    const response = await CS_FETCH_GRAPHQL.fetchGraphQl(query, {
      method: 'POST',
      variables: { skus },
    });

    if (response.errors) {
      console.error('Product slider SKU query errors:', JSON.stringify(response.errors, null, 2));
      return [];
    }

    return (response.data?.products || []).filter(Boolean).map(normalizeProduct);
  } catch (error) {
    console.error('Error fetching products by SKU:', error);
    return [];
  }
}

async function searchProducts({ categoryPath, pageSize }) {
  const query = `
    query ProductSliderSearch(
      $phrase: String!
      $pageSize: Int!
      $filter: [SearchClauseInput!]
      $sort: [ProductSearchSortInput!]
    ) {
      productSearch(
        phrase: $phrase
        page_size: $pageSize
        filter: $filter
        sort: $sort
      ) {
        items {
          productView {
            ${PRODUCT_VIEW_FIELDS}
          }
        }
      }
    }
  `;

  const filter = [{ attribute: 'visibility', in: ['Catalog', 'Search', 'Catalog, Search'] }];
  if (categoryPath) {
    filter.push({ attribute: 'categoryPath', eq: categoryPath });
  }

  try {
    const response = await CS_FETCH_GRAPHQL.fetchGraphQl(query, {
      method: 'POST',
      variables: {
        phrase: '',
        pageSize,
        filter,
        sort: [{ attribute: 'position', direction: 'DESC' }],
      },
    });

    if (response.errors) {
      console.error('Product slider search errors:', JSON.stringify(response.errors, null, 2));
      return [];
    }

    return (response.data?.productSearch?.items || [])
      .map((item) => item.productView)
      .filter(Boolean)
      .map(normalizeProduct);
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
}

async function addToCart(product, button) {
  const originalLabel = button.textContent;
  button.disabled = true;

  try {
    const cartApi = await import('@dropins/storefront-cart/api.js');
    await cartApi.addProductsToCart([{ sku: product.sku, quantity: 1 }]);
    button.textContent = 'Added!';
  } catch (error) {
    console.error('Error adding product to cart:', error);
    button.textContent = 'Try again';
  } finally {
    window.setTimeout(() => {
      button.textContent = originalLabel;
      button.disabled = false;
    }, 2000);
  }
}

async function addToWishlist(product, button) {
  const originalLabel = button.textContent;
  button.disabled = true;

  try {
    await import('../../scripts/initializers/wishlist.js');
    const { addProductsToWishlist } = await import('@dropins/storefront-wishlist/api.js');
    await addProductsToWishlist([{ sku: product.sku, quantity: 1 }]);
    button.textContent = 'Added To Wishlist';
  } catch (error) {
    console.error('Error adding product to wishlist:', error);
    button.textContent = 'Try again';
    window.setTimeout(() => {
      button.textContent = originalLabel;
      button.disabled = false;
    }, 2000);
  }
}

function createProductCard(product) {
  const productUrl = getProductLink(product.urlKey, product.sku);

  const card = document.createElement('div');
  card.className = 'product-slider-card';

  const link = document.createElement('a');
  link.className = 'product-slider-link';
  link.href = productUrl;

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'product-slider-image';

  if (product.image) {
    const img = document.createElement('img');
    img.src = product.image;
    img.alt = product.name || 'Product';
    img.loading = 'lazy';
    img.width = 300;
    img.height = 300;
    imageWrapper.appendChild(img);
  }

  const info = document.createElement('div');
  info.className = 'product-slider-info';

  const name = document.createElement('h3');
  name.className = 'product-slider-name';
  name.textContent = product.name || 'Product';

  const price = document.createElement('p');
  price.className = 'product-slider-price';

  const priceLabel = document.createElement('span');
  priceLabel.className = 'product-slider-price-label';
  priceLabel.textContent = 'As low as';

  const priceValue = document.createElement('span');
  priceValue.className = 'product-slider-price-value';
  priceValue.textContent = formatPrice(product.price, product.currency);

  price.append(priceLabel, priceValue);
  info.append(name, price);
  link.append(imageWrapper, info);

  const actions = document.createElement('div');
  actions.className = 'product-slider-actions';

  let cartAction;
  if (product.requiresConfiguration) {
    cartAction = document.createElement('a');
    cartAction.href = productUrl;
  } else {
    cartAction = document.createElement('button');
    cartAction.type = 'button';
    cartAction.addEventListener('click', () => addToCart(product, cartAction));
  }
  cartAction.className = 'product-slider-add-to-cart';
  cartAction.textContent = 'Add to Cart';

  const wishlistBtn = document.createElement('button');
  wishlistBtn.type = 'button';
  wishlistBtn.className = 'product-slider-wishlist';
  wishlistBtn.textContent = 'Add To Wishlist';
  wishlistBtn.addEventListener('click', () => addToWishlist(product, wishlistBtn));

  actions.append(cartAction, wishlistBtn);
  card.append(link, actions);

  return card;
}

function setupSlider(track, prevBtn, nextBtn) {
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

  prevBtn.addEventListener('click', () => {
    track.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
  });

  nextBtn.addEventListener('click', () => {
    track.scrollBy({ left: scrollStep(), behavior: 'smooth' });
  });

  track.addEventListener('scroll', updateButtons, { passive: true });
  window.addEventListener('resize', updateButtons);

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(updateButtons);
    resizeObserver.observe(track);
  }

  track.querySelectorAll('img').forEach((img) => {
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
 * Product slider block for homepage trend/discovery sections.
 * Configure via key-value rows in da.live.
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);

  const { subtitle } = config;
  const { title } = config;
  const categoryPath = config.categorypath || config['category-path'] || '';
  const pageSize = parseInt(config.pagesize || config['page-size'] || '8', 10);
  const skuConfig = config.productskus || config['product-skus'] || '';
  const productSkus = skuConfig
    ? String(skuConfig).split(',').map((sku) => sku.trim()).filter(Boolean)
    : [];

  block.replaceChildren();

  const header = document.createElement('div');
  header.className = 'product-slider-header';

  const subtitleEl = document.createElement('p');
  subtitleEl.className = 'product-slider-subtitle';
  subtitleEl.textContent = subtitle;

  const titleEl = document.createElement('h2');
  titleEl.className = 'product-slider-title';
  titleEl.textContent = title;

  header.append(subtitleEl, titleEl);

  const container = document.createElement('div');
  container.className = 'product-slider-container';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'product-slider-arrow product-slider-prev';
  prevBtn.setAttribute('aria-label', 'Previous products');
  prevBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';

  const track = document.createElement('div');
  track.className = 'product-slider-track';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'product-slider-arrow product-slider-next';
  nextBtn.setAttribute('aria-label', 'Next products');
  nextBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 6 7.59 7.41 12.17 12l-4.58 4.59L9 18l6-6z"/></svg>';

  const loading = document.createElement('p');
  loading.className = 'product-slider-loading';
  loading.textContent = 'Loading products...';
  track.appendChild(loading);

  container.append(prevBtn, track, nextBtn);
  block.append(header, container);

  const products = productSkus.length
    ? await fetchProductsBySku(productSkus)
    : await searchProducts({ categoryPath, pageSize });

  track.replaceChildren();

  if (!products.length) {
    const empty = document.createElement('p');
    empty.className = 'product-slider-empty';
    empty.textContent = 'No products available.';
    track.appendChild(empty);
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  products.forEach((product) => {
    track.appendChild(createProductCard(product));
  });

  setupSlider(track, prevBtn, nextBtn);
}
