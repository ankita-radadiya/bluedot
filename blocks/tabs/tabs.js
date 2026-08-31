import { toClassName } from '../../scripts/aem.js';

let tabsInstanceCount = 0;

/**
 * Splits an authored content cell into its media, links, and description parts.
 * Parsing is by element type rather than position so authors can order the
 * cell contents freely.
 * @param {Element} cell The authored content cell
 */
function parseContent(cell) {
  const picture = cell.querySelector('picture');
  const list = cell.querySelector('ul, ol');

  const description = [...cell.children].filter((child) => (
    child !== list
    && !child.contains(list)
    && !child.querySelector('picture')
    && child.textContent.trim()
  ));

  return { picture, list, description };
}

function buildPanelContent(cell) {
  const { picture, list, description } = parseContent(cell);

  const inner = document.createElement('div');
  inner.className = 'tabs-panel-inner';

  const main = document.createElement('div');
  main.className = 'tabs-panel-main';

  if (picture) {
    const media = document.createElement('div');
    media.className = 'tabs-panel-media';
    media.append(picture);
    main.append(media);
  }

  if (description.length) {
    const text = document.createElement('div');
    text.className = 'tabs-panel-description';
    text.append(...description);
    main.append(text);
  }

  if (main.children.length) inner.append(main);

  if (list) {
    const links = document.createElement('div');
    links.className = 'tabs-panel-links';
    links.append(list);
    inner.append(links);
  }

  return inner;
}

function activateTab(tabs, panels, index) {
  tabs.forEach((tab, i) => {
    const selected = i === index;
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.setAttribute('tabindex', selected ? '0' : '-1');
    panels[i].hidden = !selected;
  });
}

function handleKeydown(event, tabs, panels, index) {
  const keys = {
    ArrowRight: (index + 1) % tabs.length,
    ArrowLeft: (index - 1 + tabs.length) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  };

  const target = keys[event.key];
  if (target === undefined) return;

  event.preventDefault();
  activateTab(tabs, panels, target);
  tabs[target].focus();
}

/**
 * Loads and decorates the tabs block.
 * Each authored row is one tab: first cell is the label, second cell holds the
 * panel content (image, link list, and description).
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children].filter((row) => row.children.length);
  if (!rows.length) return;

  tabsInstanceCount += 1;
  const blockId = `tabs-${tabsInstanceCount}`;

  const tablist = document.createElement('div');
  tablist.className = 'tabs-list';
  tablist.setAttribute('role', 'tablist');

  const tabs = [];
  const panels = [];

  rows.forEach((row, index) => {
    const [labelCell, contentCell] = row.children;
    const label = labelCell.textContent.trim() || `Tab ${index + 1}`;
    const id = `${blockId}-${toClassName(label) || index}`;

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tabs-tab';
    tab.id = `${id}-tab`;
    tab.textContent = label;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `${id}-panel`);

    const panel = document.createElement('div');
    panel.className = 'tabs-panel';
    panel.id = `${id}-panel`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `${id}-tab`);

    if (contentCell) panel.append(buildPanelContent(contentCell));

    tab.addEventListener('click', () => activateTab(tabs, panels, index));
    tab.addEventListener('keydown', (event) => handleKeydown(event, tabs, panels, index));

    tabs.push(tab);
    panels.push(panel);
    tablist.append(tab);
  });

  block.replaceChildren(tablist, ...panels);
  activateTab(tabs, panels, 0);
}
