import { getFflConfig } from './config.js';
import { padZipcode, searchFflDealers } from './api.js';

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function setStatus(statusEl, message, type = '') {
  statusEl.textContent = message || '';
  statusEl.className = `checkout__ffl-status${type ? ` checkout__ffl-status--${type}` : ''}`;
  statusEl.hidden = !message;
}

function formatDealerAddress(dealer) {
  return [
    dealer.premiseStreet,
    dealer.city,
    dealer.state,
    dealer.zipCode,
  ]
    .filter(Boolean)
    .join(', ');
}

function renderDealerCard(dealer, selectedId, copy, onSelect) {
  const isSelected = dealer.id === selectedId;
  const button = createElement('button', `checkout__ffl-dealer${isSelected ? ' is-selected' : ''}`);
  button.type = 'button';
  button.setAttribute('role', 'option');
  button.setAttribute('aria-selected', String(isSelected));

  if (dealer.isDealerRestricted) {
    button.append(createElement(
      'p',
      'checkout__ffl-badge checkout__ffl-badge--needed',
      copy.dealerRestricted,
    ));
  }

  button.append(
    createElement('strong', 'checkout__ffl-dealer-name', dealer.licenseName),
    createElement('p', 'checkout__ffl-dealer-address', formatDealerAddress(dealer)),
  );

  if (dealer.phone) {
    button.append(createElement(
      'p',
      'checkout__ffl-dealer-phone',
      `${copy.phoneLabel} : ${dealer.phone}`,
    ));
  }

  button.addEventListener('click', () => onSelect(dealer));
  return button;
}

function renderSelectedSummary(container, dealer, copy) {
  container.replaceChildren();
  if (!dealer) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  container.append(
    createElement('h3', 'checkout__ffl-selected-title', copy.shippingTo),
    createElement('strong', 'checkout__ffl-selected-name', dealer.licenseName),
    createElement('p', 'checkout__ffl-selected-address', formatDealerAddress(dealer)),
  );
}

/**
 * Renders the FFL terms, zip/radius search, and dealer list.
 * @param {HTMLElement} container
 * @param {{ onDealerSelect: Function, selectedDealer?: object|null }} options
 * @returns {{ setSelectedDealer: Function, getSelectedDealer: Function, showValidation: Function }}
 */
export function renderFflDealerSearch(container, options = {}) {
  const { copy, radiusOptions } = getFflConfig();
  const { onDealerSelect } = options;
  let selectedDealer = options.selectedDealer || null;
  let dealers = [];

  container.replaceChildren();
  container.classList.add('checkout__ffl-panel');

  const accordion = createElement('details', 'checkout__ffl-accordion');
  accordion.open = true;
  accordion.append(
    createElement('summary', 'checkout__ffl-accordion-title', copy.title),
    createElement('p', 'checkout__ffl-terms', copy.terms),
  );

  const form = createElement('form', 'checkout__ffl-form');
  form.setAttribute('novalidate', '');

  const zipField = createElement('div', 'checkout__ffl-field checkout__ffl-field--zip');
  const zipLabel = createElement('label', 'checkout__ffl-label', copy.zipcodeLabel);
  zipLabel.setAttribute('for', 'ffl-zipcode');
  const zipInput = createElement('input', 'checkout__ffl-input');
  zipInput.id = 'ffl-zipcode';
  zipInput.name = 'ffl-zipcode';
  zipInput.type = 'text';
  zipInput.inputMode = 'numeric';
  zipInput.maxLength = 5;
  zipInput.autocomplete = 'postal-code';
  zipInput.required = true;
  zipInput.setAttribute('aria-required', 'true');
  zipInput.placeholder = '12345';
  zipField.append(zipLabel, zipInput);

  const radiusField = createElement('div', 'checkout__ffl-field checkout__ffl-field--radius');
  const radiusLabel = createElement('label', 'checkout__ffl-label', copy.radiusLabel);
  radiusLabel.setAttribute('for', 'ffl-radius');
  const radiusSelect = createElement('select', 'checkout__ffl-select');
  radiusSelect.id = 'ffl-radius';
  radiusSelect.name = 'ffl-radius';
  radiusOptions.forEach((miles) => {
    const option = document.createElement('option');
    option.value = String(miles);
    option.textContent = `${miles} ${copy.milesSuffix}`;
    radiusSelect.append(option);
  });
  radiusField.append(radiusLabel, radiusSelect);

  const actions = createElement('div', 'checkout__ffl-actions');
  const actionLabel = createElement('span', 'checkout__ffl-label checkout__ffl-label--spacer', '\u00a0');
  actionLabel.setAttribute('aria-hidden', 'true');
  const searchButton = createElement('button', 'button checkout__ffl-search', copy.searchLabel);
  searchButton.type = 'submit';
  actions.append(actionLabel, searchButton);
  form.append(zipField, radiusField, actions);

  const status = createElement('p', 'checkout__ffl-status');
  status.id = 'ffl-search-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;

  const results = createElement('div', 'checkout__ffl-results');
  results.setAttribute('role', 'listbox');
  results.setAttribute('aria-label', copy.title);

  const selected = createElement('div', 'checkout__ffl-selected');
  selected.hidden = true;

  container.append(
    accordion,
    createElement('p', 'checkout__ffl-note', copy.paperworkNote),
    createElement('p', 'checkout__ffl-instructions', copy.instructions),
    form,
    status,
    results,
    selected,
  );
  renderSelectedSummary(selected, selectedDealer, copy);

  const paintResults = () => {
    results.replaceChildren();
    dealers.forEach((dealer) => {
      results.append(renderDealerCard(dealer, selectedDealer?.id, copy, async (nextDealer) => {
        selectedDealer = nextDealer;
        paintResults();
        renderSelectedSummary(selected, selectedDealer, copy);
        setStatus(status, '');
        if (typeof onDealerSelect === 'function') {
          await onDealerSelect(nextDealer);
        }
      }));
    });
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const zipcode = padZipcode(zipInput.value);

    if (!/^\d{5}$/.test(zipcode)) {
      zipInput.value = zipcode.replace(/^0+/, '') || zipInput.value;
      setStatus(status, copy.zipInvalid, 'error');
      zipInput.focus();
      return;
    }

    zipInput.value = zipcode;
    searchButton.disabled = true;
    setStatus(status, copy.searchingLabel);

    const result = await searchFflDealers({
      zipcode,
      radius: radiusSelect.value,
    });

    searchButton.disabled = false;
    dealers = result.dealers;
    paintResults();

    if (result.error) {
      setStatus(status, result.error, result.apiMissing ? 'warning' : 'error');
      return;
    }

    setStatus(status, '');
  });

  return {
    setSelectedDealer(dealer) {
      selectedDealer = dealer;
      renderSelectedSummary(selected, selectedDealer, copy);
      paintResults();
    },
    getSelectedDealer: () => selectedDealer,
    showValidation(message = copy.selectPrompt) {
      setStatus(status, message, 'error');
    },
  };
}
