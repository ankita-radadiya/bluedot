import { render as orderRenderer } from '@dropins/storefront-order/render.js';
import { OrderProductList } from '@dropins/storefront-order/containers/OrderProductList.js';
import GiftOptions from '@dropins/storefront-cart/containers/GiftOptions.js';
import { render as CartProvider } from '@dropins/storefront-cart/render.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';

import '../../scripts/initializers/order.js';
import { getProductLink, rootLink } from '../../scripts/commerce.js';

function buildProductRow(item) {
  const imgEl = item.querySelector('img') || item.querySelector('picture');

  const titleEl = item.querySelector('[data-testid="product-name"]')
    || item.querySelector('.cart-summary-item__title')
    || item.querySelector('h3');
  const titleText = titleEl ? titleEl.textContent.trim() : 'Product';
  const linkEl = item.querySelector('a');
  const href = linkEl ? linkEl.getAttribute('href') : '#';
  const titleHtml = href && href !== '#'
    ? `<a href="${href}">${titleText}</a>` : titleText;

  const optionsEl = item.querySelector('.dropin-cart-item__options')
    || item.querySelector('[class*="configurations" i]');

  let skuText = 'N/A';
  const skuEl = item.querySelector('.dropin-cart-item__sku')
    || item.querySelector('[class*="sku" i]');
  if (skuEl && skuEl.textContent.trim()) {
    skuText = skuEl.textContent.replace(/^SKU\s*:?/i, '').trim();
  } else {
    const skuMatch = item.textContent.match(/SKU\s*:?\s*([A-Z0-9_-]+)/i);
    if (skuMatch) [, skuText] = skuMatch;
  }

  // Unit price: dropin renders it in __price container; total is in __total container.
  // When qty > 1, total = baseOriginalPrice × qty, so we must read them separately.
  let priceText = '';
  let subtotalText = '';

  const unitPriceContainer = item.querySelector('.dropin-cart-item__price');
  const totalContainer = item.querySelector('.dropin-cart-item__total');

  if (unitPriceContainer || totalContainer) {
    // Prefer reading from dedicated containers
    const getLeafPrice = (container) => {
      if (!container) return '';
      // Find the deepest .dropin-price leaf (not a wrapper)
      const leafEl = Array.from(container.querySelectorAll('.dropin-price'))
        .find((el) => !el.querySelector('.dropin-price'));
      return (leafEl || container).textContent.trim();
    };
    priceText = getLeafPrice(unitPriceContainer);
    subtotalText = getLeafPrice(totalContainer) || priceText;
  } else {
    // Fallback: collect all leaf-level .dropin-price elements in DOM order
    // First = unit price, last = subtotal (dropin always renders price before total)
    const leafPrices = Array.from(item.querySelectorAll('.dropin-price'))
      .filter((el) => !el.querySelector('.dropin-price') && el.textContent.trim());

    if (leafPrices.length >= 2) {
      priceText = leafPrices[0].textContent.trim();
      subtotalText = leafPrices[leafPrices.length - 1].textContent.trim();
    } else if (leafPrices.length === 1) {
      priceText = leafPrices[0].textContent.trim();
      subtotalText = priceText;
    } else {
      const matches = item.textContent.match(
        /(?:[$€£₹¥]|USD|EUR|GBP|INR|CAD|AUD)\s*[\d,]+(?:\.\d{2})?/g,
      );
      if (matches) {
        const [first = ''] = matches;
        priceText = first;
        subtotalText = matches[matches.length - 1] || first;
      }
    }
  }

  let qtyNumber = '1';
  const qtyEl = item.querySelector('.dropin-cart-item__quantity')
    || item.querySelector('[class*="quantity" i]');
  if (qtyEl) {
    const num = qtyEl.textContent.replace(/\D/g, '').trim();
    if (num) qtyNumber = num;
  } else {
    const qtyMatch = item.textContent.match(/(?:Qty|Quantity)\s*:?\s*(\d+)/i)
      || item.textContent.match(/Ordered\s*Qty\s*:?\s*(\d+)/i);
    if (qtyMatch) [, qtyNumber] = qtyMatch;
  }

  const row = document.createElement('div');
  row.className = 'commerce-order-product-list__row';
  row.innerHTML = `
    <div class="commerce-order-product-list__cell col-product">
      <span class="mobile-label">PRODUCT NAME</span>
      <div class="product-info-wrapper">
        ${imgEl ? `<div class="product-image-container">${imgEl.outerHTML}</div>` : ''}
        <div class="product-details-wrapper">
          <div class="product-title-container">${titleHtml}</div>
          ${optionsEl ? `<div class="product-options-container">${optionsEl.innerHTML}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="commerce-order-product-list__cell col-sku">
      <span class="mobile-label">SKU</span>
      <span class="cell-value">${skuText}</span>
    </div>
    <div class="commerce-order-product-list__cell col-price">
      <span class="mobile-label">PRICE</span>
      <span class="cell-value">${priceText}</span>
    </div>
    <div class="commerce-order-product-list__cell col-qty">
      <span class="mobile-label">QTY</span>
      <span class="cell-value">${qtyNumber}</span>
    </div>
    <div class="commerce-order-product-list__cell col-subtotal">
      <span class="mobile-label">SUBTOTAL</span>
      <span class="cell-value">${subtotalText}</span>
    </div>
  `;

  return row;
}

export default async function decorate(block) {
  const createProductLink = (productData) => {
    if (!productData) return rootLink('#');
    const { product, productUrlKey } = productData;
    if (!product || !productUrlKey || !product.sku) return rootLink('#');
    return getProductLink(productUrlKey, product.sku);
  };

  await orderRenderer.render(OrderProductList, {
    slots: {
      CartSummaryItemImage: (ctx) => {
        const { data, defaultImageProps } = ctx;
        const anchor = document.createElement('a');
        anchor.href = createProductLink(data);
        tryRenderAemAssetsImage(ctx, {
          alias: data.product.sku,
          imageProps: defaultImageProps,
          wrapper: anchor,
          params: { width: defaultImageProps.width, height: defaultImageProps.height },
        });
      },
      Footer: (ctx) => {
        const giftOptions = document.createElement('div');
        CartProvider.render(GiftOptions, {
          item: ctx.item,
          view: 'product',
          dataSource: 'order',
          isEditable: false,
          slots: {
            SwatchImage: (swatchCtx) => {
              const { defaultImageProps, imageSwatchContext } = swatchCtx;
              tryRenderAemAssetsImage(swatchCtx, {
                alias: imageSwatchContext.label,
                imageProps: defaultImageProps,
                wrapper: document.createElement('span'),
                params: { width: defaultImageProps.width, height: defaultImageProps.height },
              });
            },
          },
        })(giftOptions);
        ctx.appendChild(giftOptions);
      },
    },
    routeProductDetails: createProductLink,
  })(block);

  // Table header — created once and reused
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'commerce-order-product-list__table-wrapper';
  tableWrapper.innerHTML = `
    <div class="commerce-order-product-list__table-header">
      <div class="commerce-order-product-list__header-cell col-product">PRODUCT NAME</div>
      <div class="commerce-order-product-list__header-cell col-sku">SKU</div>
      <div class="commerce-order-product-list__header-cell col-price">PRICE</div>
      <div class="commerce-order-product-list__header-cell col-qty">QTY</div>
      <div class="commerce-order-product-list__header-cell col-subtotal">SUBTOTAL</div>
    </div>
  `;
  block.appendChild(tableWrapper);

  let debounceTimer = null;

  const buildTable = () => {
    const items = Array.from(
      block.querySelectorAll('[data-testid="order-product-list-content-item"]'),
    );

    if (!items.length) return;

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      fragment.appendChild(buildProductRow(item));
      item.remove();
    });

    // Remove the now-empty dropin list container
    const dropinList = block.querySelector('.order-order-product-list-content__items');
    if (dropinList && !dropinList.children.length) dropinList.remove();

    tableWrapper.appendChild(fragment);
  };

  const observer = new MutationObserver((mutations) => {
    const hasNewItems = mutations.some((m) => Array.from(m.addedNodes).some(
      (n) => n.nodeType === Node.ELEMENT_NODE
        && (n.dataset?.testid === 'order-product-list-content-item'
          || n.querySelector?.('[data-testid="order-product-list-content-item"]')),
    ));

    if (hasNewItems) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(buildTable, 150);
    }
  });

  observer.observe(block, { childList: true, subtree: true });

  // Initial trigger
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(buildTable, 150);
}
