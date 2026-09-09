import { getRootPath } from '@dropins/tools/lib/aem/configs.js';
import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  buildBlock,
} from './aem.js';
import {
  loadCommerceEager,
  loadCommerceLazy,
  initializeCommerce,
  applyTemplates,
  decorateLinks,
  loadErrorPage,
  decorateSections,
  IS_UE,
  IS_DA,
} from './commerce.js';

/* Trusted Types Policy (Safely Initialized) */
if (window.trustedTypes?.createPolicy) {
  const innerTT = window.trustedTypes.createPolicy('tt-inner', {
    createHTML: (s) => s,
  });

  window.trustedTypes.createPolicy('default', {
    createHTML: (input, type, sink) => {
      let processedInput = input;
      if (/srcdoc\s*=/i.test(processedInput)) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('iframe[srcdoc]').forEach((el) => el.removeAttribute('srcdoc'));
        processedInput = doc.body.innerHTML;
      }
      if (sink.includes('createContextualFragment') || sink.includes('Document write')) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        processedInput = doc.body.innerHTML;
      }
      return processedInput;
    },
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

/**
 * Loads fonts asynchronously and flags session storage.
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) {
      sessionStorage.setItem('fonts-loaded', 'true');
    }
  } catch (e) {
    /* Ignore storage errors */
  }
}

/**
 * Prevents redundant home CSS injections.
 */
function loadHomeStyles() {
  if (window.location.pathname === '/' && !document.querySelector('link[href*="home.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${window.hlx.codeBasePath}/styles/home.css`;
    document.head.appendChild(link);
  }
}

/**
 * Automatically builds widget blocks without extra loops.
 */
function buildWidgetAutoBlocks(main) {
  const widgetLinks = main.querySelectorAll('a[href*="/widgets/"]');
  widgetLinks.forEach((link) => {
    if (link.closest('.widget')) return;
    const widgetBlock = buildBlock('widget', { elems: [link.cloneNode(true)] });
    const p = link.closest('p');
    if (p && p.children.length === 1
      && p.firstElementChild === link
      && p.textContent.trim() === link.textContent.trim()) {
      p.replaceWith(widgetBlock);
    } else {
      link.replaceWith(widgetBlock);
    }
  });
}

/**
 * Parallelized fragment auto-loading to fix waterfall latency.
 */
async function buildAutoBlocks(main) {
  try {
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      const { loadFragment } = await import('../blocks/fragment/fragment.js');
      await Promise.all(
        fragments.map(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            if (frag?.children) {
              fragment.parentElement.replaceWith(...frag.children);
            }
          } catch (error) {
            console.error('Fragment loading failed', error);
          }
        }),
      );
    }
    buildWidgetAutoBlocks(main);
  } catch (error) {
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates action link buttons.
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title ||= a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';

    if (strong && em) {
      a.classList.add('accent');
      (strong.contains(em) ? strong : em).replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

export function decorateMain(main) {
  decorateLinks(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
}

function createGlobalBreadcrumbsContainer(doc = document) {
  const rootPath = getRootPath().replace(/\/$/, '') || '/';
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';

  if (pathname === rootPath) return null;

  const header = doc.querySelector('header');
  if (!header) return null;

  const isPlpPage = pathname.startsWith('/categories/');
  let container = doc.querySelector(isPlpPage ? '.category-banner-wrapper' : '.breadcrumbs-container');

  if (!container) {
    container = document.createElement('div');
    if (isPlpPage) {
      container.className = 'category-banner-wrapper';

      const breadcrumbsEl = document.createElement('div');
      breadcrumbsEl.className = 'breadcrumbs-container';

      const pageTitleEl = document.createElement('h1');
      pageTitleEl.className = 'page-title';

      container.append(breadcrumbsEl, pageTitleEl);
    } else {
      container.className = 'breadcrumbs-container';
    }
    header.insertAdjacentElement('afterend', container);
  }

  return container;
}

async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  createGlobalBreadcrumbsContainer(doc);

  const main = doc.querySelector('main');
  if (main) {
    try {
      await initializeCommerce();
      decorateMain(main);
      applyTemplates(doc);
      await loadCommerceEager();
    } catch (e) {
      console.error('Error initializing commerce configuration:', e);
      loadErrorPage(418);
      return;
    }
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
      loadHomeStyles();
    }
  } catch (e) { /* ignore failure */ }
}

async function loadLazy(doc) {
  const main = doc.querySelector('main');

  loadHeader(doc.querySelector('header'));
  await loadSections(main);

  const { hash } = window.location;
  if (hash) {
    const element = doc.getElementById(hash.substring(1));
    if (element) element.scrollIntoView();
  }

  loadFooter(doc.querySelector('footer'));
  loadCommerceLazy();

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
  loadHomeStyles();
}

function loadDelayed() {
  window.setTimeout(() => import('./delayed.js'), 3000);
}

async function loadPage() {
  const { pathname, search } = window.location;

  // Immediate redirect before loading DOM/Eager cycles
  if (pathname.startsWith('/categories/') && pathname !== '/categories/default') {
    window.location.replace(`/categories/default?cp=${encodeURIComponent(pathname)}`);
    return;
  }

  if (pathname === '/categories/default' && search.includes('cp=')) {
    const urlParams = new URLSearchParams(search);
    const cp = urlParams.get('cp');
    if (cp) {
      window.history.replaceState({}, '', decodeURIComponent(cp));
    }
  }

  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

if (IS_UE) {
  await import(`${window.hlx.codeBasePath}/scripts/ue.js`).then(({ default: ue }) => ue());
}

loadPage();

if (IS_DA) {
  // eslint-disable-next-line import/no-unresolved
  import('https://da.live/scripts/dapreview.js').then(({ default: daPreview }) => daPreview(loadPage));
}
