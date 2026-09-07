import { render as accountRenderer } from '@dropins/storefront-account/render.js';
import { OrdersList } from '@dropins/storefront-account/containers/OrdersList.js';
import { Pagination } from '@dropins/tools/components.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';
import { readBlockConfig } from '../../scripts/aem.js';
import {
  checkIsAuthenticated,
  CUSTOMER_LOGIN_PATH,
  CUSTOMER_ORDER_DETAILS_PATH,
  CUSTOMER_ORDERS_PATH,
  CUSTOMER_RETURN_DETAILS_PATH,
  UPS_TRACKING_URL,
  rootLink,
  getProductLink,
} from '../../scripts/commerce.js';

// Initialize
import '../../scripts/initializers/account.js';

export default async function decorate(block) {
  const { 'minified-view': minifiedViewConfig = 'false' } = readBlockConfig(block);
  const createProductLink = (productData) => {
    // If product is null/undefined, it's been deleted from catalog
    if (!productData?.product) {
      return rootLink('#');
    }

    // Product exists in catalog, validate it has the required fields
    const { urlKey, topLevelSku } = productData;
    if (urlKey && topLevelSku) {
      return getProductLink(urlKey, topLevelSku);
    }
    return rootLink('#');
  };

  if (!checkIsAuthenticated()) {
    window.location.href = rootLink(CUSTOMER_LOGIN_PATH);
  } else {
    const isMinified = minifiedViewConfig === 'true';
    let currentPage = 1;

    await accountRenderer.render(OrdersList, {
      minifiedView: isMinified,
      ordersInMinifiedView: 5,
      pageSize: isMinified ? 5 : 50,
      routeTracking: ({ carrier, number }) => {
        if (carrier === 'ups') {
          return `${UPS_TRACKING_URL}?tracknum=${number}`;
        }
        return '';
      },
      routeOrdersList: () => rootLink(CUSTOMER_ORDERS_PATH),
      routeOrderDetails: (orderNumber) => (
        rootLink(`${CUSTOMER_ORDER_DETAILS_PATH}?orderRef=${orderNumber}`)
      ),
      routeReturnDetails: ({ orderNumber, returnNumber }) => (
        rootLink(`${CUSTOMER_RETURN_DETAILS_PATH}?orderRef=${orderNumber}&returnRef=${returnNumber}`)
      ),
      routeOrderProduct: createProductLink,
      slots: {
        OrderItemImage: (ctx) => {
          const { data, defaultImageProps } = ctx;
          const anchor = document.createElement('a');
          anchor.href = createProductLink(ctx.data);

          tryRenderAemAssetsImage(ctx, {
            alias: data.product.sku,
            imageProps: defaultImageProps,
            wrapper: anchor,

            params: {
              width: defaultImageProps.width,
              height: defaultImageProps.height,
            },
          });
        },
      },
    })(block);

    const extractDate = (item) => {
      const timeEl = item.querySelector('time');
      if (timeEl) {
        const dt = timeEl.getAttribute('datetime') || timeEl.textContent;
        if (dt) return dt.replace(/Placed on|Order date|Date:?/gi, '').trim();
      }

      const dateClassEl = item.querySelector('[class*="date" i], [class*="Date"]');
      if (dateClassEl) {
        const text = dateClassEl.textContent.replace(/Placed on|Order date|Date:?/gi, '').trim();
        if (text) return text;
      }

      const text = item.textContent;

      const prefixMatch = text.match(/(?:Placed\s+on|Order\s+date|Date)\s*:?\s*([0-9]{1,4}[-/.\s][0-9]{1,2}[-/.\s][0-9]{1,4}|[A-Za-z]+\s+\d{1,2},?\s+\d{2,4}|\d{1,2}\s+[A-Za-z]+,?\s+\d{2,4})/i);
      if (prefixMatch && prefixMatch[1]) return prefixMatch[1].trim();

      const slashDashMatch = text.match(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/);
      if (slashDashMatch) return slashDashMatch[0];

      const monthDayMatch = text.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{2,4}\b/i);
      if (monthDayMatch) return monthDayMatch[0];

      const dayMonthMatch = text.match(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?),?\s+\d{2,4}\b/i);
      if (dayMonthMatch) return dayMonthMatch[0];

      return '';
    };

    const parseOrderTime = (dateStr) => {
      if (!dateStr) return 0;
      const cleanStr = dateStr.replace(/Placed on|Order date|Date:?/gi, '').trim();
      const parsed = Date.parse(cleanStr);
      if (!Number.isNaN(parsed)) return parsed;

      const dateMatch = cleanStr.match(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/);
      if (dateMatch) {
        const parts = dateMatch[0].split(/[-/.]/);
        if (parts.length === 3) {
          const [p1, p2, p3] = parts;
          if (p3.length === 4) {
            const d = new Date(parseInt(p3, 10), parseInt(p1, 10) - 1, parseInt(p2, 10));
            if (!Number.isNaN(d.getTime())) return d.getTime();
          } else if (p1.length === 4) {
            const d = new Date(parseInt(p1, 10), parseInt(p2, 10) - 1, parseInt(p3, 10));
            if (!Number.isNaN(d.getTime())) return d.getTime();
          }
        }
      }
      return 0;
    };

    const createFormattedRowNode = (item) => {
      if (item.classList.contains('account-orders-list__formatted-row')
        || item.querySelector('.account-orders-list__row-cells')) return null;

      const linkEl = item.querySelector('a[href*="orderRef"]')
        || item.querySelector('a[href*="orderNumber"]')
        || item.querySelector('a')
        || (item.tagName === 'A' ? item : null);
      const href = linkEl ? linkEl.getAttribute('href') : '#';

      let orderNumber = '';
      if (href && href.includes('orderRef=')) {
        const [, paramStr] = href.split('orderRef=');
        [orderNumber] = paramStr.split('&');
      } else if (href && href.includes('orderNumber=')) {
        const [, paramStr] = href.split('orderNumber=');
        [orderNumber] = paramStr.split('&');
      }

      if (!orderNumber) {
        const numMatch = item.textContent.match(/Order\s*(?:number|#)?\s*:?\s*([A-Z0-9_-]{3,})/i)
          || item.textContent.match(/\b[A-Z0-9_-]{5,}\b/);
        if (numMatch) {
          orderNumber = numMatch[1] || numMatch[0];
        }
      }

      if (!orderNumber || orderNumber.length < 2) return null;

      const date = extractDate(item) || 'N/A';

      const priceEl = item.querySelector('[class*="price" i], [class*="Price" i], [data-testid*="price" i]');
      let total = priceEl ? priceEl.textContent.trim() : '';

      if (!total) {
        const totalMatch = item.textContent.match(/(?:[$€£₹¥]|USD|EUR|GBP|INR|CAD|AUD)\s*[\d,]+(?:\.\d{2})?/)
          || item.textContent.match(/[\d,]+(?:\.\d{2})?\s*(?:[$€£₹¥]|USD|EUR|GBP|INR|CAD|AUD)/)
          || item.textContent.match(/\d+(?:\.\d{2})?/);
        total = totalMatch ? totalMatch[0] : '';
      }

      let status = '';
      const contentDiv = item.querySelector('.account-orders-list-card__content');
      if (contentDiv) {
        const firstChild = contentDiv.querySelector(':scope > div:first-child');
        if (firstChild && firstChild.textContent.trim()) {
          status = firstChild.textContent.trim();
        }
      }

      if (!status) {
        const text = item.textContent;
        if (/Complete|Completed/i.test(text)) {
          status = 'Complete';
        } else if (/Processing/i.test(text)) {
          status = 'Processing';
        } else if (/Canceled|Cancelled/i.test(text)) {
          status = 'Canceled';
        } else if (/Pending/i.test(text)) {
          status = 'Pending';
        } else if (/Closed/i.test(text)) {
          status = 'Closed';
        } else if (/Hold/i.test(text)) {
          status = 'On Hold';
        } else {
          status = 'Pending';
        }
      }

      const detailHref = href !== '#'
        ? href
        : rootLink(`${CUSTOMER_ORDER_DETAILS_PATH}?orderRef=${orderNumber}`);

      const rowWrapper = document.createElement('div');
      rowWrapper.className = 'account-orders-list-card account-orders-list__formatted-row';
      rowWrapper.innerHTML = `
        <div class="account-orders-list__row-cells">
          <div class="account-orders-list__cell col-order">
            <span class="mobile-label">ORDER #</span>
            <span class="cell-value">${orderNumber}</span>
          </div>
          <div class="account-orders-list__cell col-date">
            <span class="mobile-label">DATE</span>
            <span class="cell-value">${date}</span>
          </div>
          <div class="account-orders-list__cell col-total">
            <span class="mobile-label">ORDER TOTAL</span>
            <span class="cell-value">${total}</span>
          </div>
          <div class="account-orders-list__cell col-status">
            <span class="mobile-label">STATUS</span>
            <span class="cell-value">${status}</span>
          </div>
          <div class="account-orders-list__cell col-action">
            <a href="${detailHref}" class="account-orders-list__view-order-link">View Order</a>
          </div>
        </div>
      `;

      return rowWrapper;
    };

    let isProcessing = false;

    const setupTableStructure = () => {
      if (isProcessing) return;
      isProcessing = true;

      try {
        const ordersListEl = block.querySelector('.account-orders-list');
        if (!ordersListEl) return;

        const unformattedRows = ordersListEl.querySelectorAll(
          '.account-orders-list-card:not(.account-orders-list__formatted-row):not(.account-orders-list__table-header)',
        );

        if (unformattedRows.length > 0) {
          currentPage = 1;
          const oldFormattedRows = ordersListEl.querySelectorAll('.account-orders-list__formatted-row');
          oldFormattedRows.forEach((oldRow) => oldRow.remove());

          const fragment = document.createDocumentFragment();
          unformattedRows.forEach((row) => {
            const formattedNode = createFormattedRowNode(row);
            if (formattedNode) {
              fragment.appendChild(formattedNode);
            }
            row.remove();
          });

          const actionBtn = ordersListEl.querySelector('.account-orders-list-action');
          if (actionBtn && actionBtn.parentNode) {
            actionBtn.parentNode.insertBefore(fragment, actionBtn);
          } else {
            ordersListEl.appendChild(fragment);
          }
        }

        const emptyStateEl = ordersListEl.querySelector('.account-empty-list');
        if (emptyStateEl) {
          const lingeringRows = ordersListEl.querySelectorAll('.account-orders-list__formatted-row');
          lingeringRows.forEach((row) => row.remove());

          const existingHeader = ordersListEl.querySelector('.account-orders-list__table-header');
          if (existingHeader) existingHeader.remove();

          const existingPagination = block.querySelector('.account-orders-list__pagination');
          if (existingPagination) existingPagination.remove();
          return;
        }

        const existingHeader = ordersListEl.querySelector('.account-orders-list__table-header');
        const allCards = Array.from(
          ordersListEl.querySelectorAll('.account-orders-list-card:not(.account-orders-list__table-header)'),
        );

        if (allCards.length === 0) {
          if (existingHeader) existingHeader.remove();
          const existingPagination = block.querySelector('.account-orders-list__pagination');
          if (existingPagination) existingPagination.remove();
          return;
        }

        allCards.sort((a, b) => {
          const dateA = extractDate(a);
          const dateB = extractDate(b);
          const timeA = parseOrderTime(dateA);
          const timeB = parseOrderTime(dateB);

          if (timeA !== timeB && timeA > 0 && timeB > 0) {
            return timeB - timeA;
          }

          const numA = (a.textContent.match(/ORDER\s*#?\s*:?\s*([A-Z0-9]+)/i) || [])[1] || '';
          const numB = (b.textContent.match(/ORDER\s*#?\s*:?\s*([A-Z0-9]+)/i) || [])[1] || '';
          return numB.localeCompare(numA, undefined, { numeric: true, sensitivity: 'base' });
        });

        let tableHeader = existingHeader;
        if (!tableHeader) {
          tableHeader = document.createElement('div');
          tableHeader.className = 'account-orders-list__table-header';
          tableHeader.innerHTML = `
            <div class="account-orders-list__table-header-item col-order">ORDER#</div>
            <div class="account-orders-list__table-header-item col-date">DATE</div>
            <div class="account-orders-list__table-header-item col-total">ORDER TOTAL</div>
            <div class="account-orders-list__table-header-item col-status">STATUS</div>
            <div class="account-orders-list__table-header-item col-action">ACTION</div>
          `;
        }

        const renderActivePage = () => {
          const actionBtn = ordersListEl.querySelector('.account-orders-list-action');
          const cardsContainer = actionBtn?.parentNode || ordersListEl;

          let paginationEl = block.querySelector('.account-orders-list__pagination');

          if (isMinified) {
            if (allCards.length > 5) {
              const extraCards = allCards.slice(5);
              extraCards.forEach((card) => card.remove());
              allCards.splice(5);
            }

            allCards.forEach((card) => card.remove());
            const fragment = document.createDocumentFragment();
            allCards.forEach((card) => fragment.appendChild(card));

            if (actionBtn && actionBtn.parentNode) {
              cardsContainer.insertBefore(fragment, actionBtn);
            } else {
              cardsContainer.appendChild(fragment);
            }

            const firstCard = allCards[0];
            if (firstCard && firstCard.parentNode) {
              firstCard.parentNode.insertBefore(tableHeader, firstCard);
            }

            if (paginationEl) paginationEl.remove();
            return;
          }

          const PAGE_SIZE = 6;
          const totalCards = allCards.length;

          if (totalCards > PAGE_SIZE) {
            const totalPages = Math.ceil(totalCards / PAGE_SIZE);
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;

            const startIndex = (currentPage - 1) * PAGE_SIZE;
            const activeCards = allCards.slice(startIndex, startIndex + PAGE_SIZE);

            allCards.forEach((card) => card.remove());

            const fragment = document.createDocumentFragment();
            activeCards.forEach((card) => {
              card.style.display = '';
              fragment.appendChild(card);
            });

            if (actionBtn && actionBtn.parentNode) {
              cardsContainer.insertBefore(fragment, actionBtn);
            } else {
              cardsContainer.appendChild(fragment);
            }

            const firstCard = activeCards[0];
            if (firstCard && firstCard.parentNode) {
              firstCard.parentNode.insertBefore(tableHeader, firstCard);
            }

            if (!paginationEl) {
              paginationEl = document.createElement('div');
              paginationEl.className = 'account-orders-list__pagination';
            }
            ordersListEl.appendChild(paginationEl);

            accountRenderer.render(Pagination, {
              totalPages,
              currentPage,
              onChange: (newPage) => {
                if (currentPage !== newPage) {
                  currentPage = newPage;
                  renderActivePage();
                  const headerOffset = 120;
                  const elementPosition = block.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                  window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth',
                  });
                }
              },
            })(paginationEl);
          } else {
            allCards.forEach((card) => card.remove());
            const fragment = document.createDocumentFragment();
            allCards.forEach((card) => {
              card.style.display = '';
              fragment.appendChild(card);
            });

            if (actionBtn && actionBtn.parentNode) {
              cardsContainer.insertBefore(fragment, actionBtn);
            } else {
              cardsContainer.appendChild(fragment);
            }

            const firstCard = allCards[0];
            if (firstCard && firstCard.parentNode) {
              firstCard.parentNode.insertBefore(tableHeader, firstCard);
            }

            if (paginationEl) paginationEl.remove();
          }
        };

        renderActivePage();
      } finally {
        isProcessing = false;
      }
    };

    setupTableStructure();

    const observer = new MutationObserver(() => {
      if (isProcessing) return;

      const hasUnformatted = block.querySelector(
        '.account-orders-list-card:not(.account-orders-list__formatted-row):not(.account-orders-list__table-header)',
      ) !== null;

      const hasEmptyState = block.querySelector('.account-empty-list') !== null;
      const hasLingeringRows = block.querySelector('.account-orders-list__formatted-row') !== null;

      if (hasUnformatted || (hasEmptyState && hasLingeringRows)) {
        setupTableStructure();
      }
    });

    observer.observe(block, { childList: true, subtree: true });
  }
}
