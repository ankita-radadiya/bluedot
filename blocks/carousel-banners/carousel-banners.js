import { fetchPlaceholders } from '../../scripts/commerce.js';

/*
 * Authoring convention for this block:
 * - Every row EXCEPT THE LAST `BANNER_ROW_COUNT` rows is one carousel slide,
 *   authored exactly like the original `carousel` block: column 1 = image,
 *   column 2 = content.
 * - The LAST `BANNER_ROW_COUNT` rows are banner rows. Every column across
 *   all of those rows is flattened into one banner (an image, optionally
 *   wrapped in a link). E.g. with BANNER_ROW_COUNT = 2 and 2 columns per
 *   row, author 2 rows x 2 columns = 4 banners total.
 */
const BANNER_ROW_COUNT = 2;

function updateActiveSlide(slide) {
  const block = slide.closest('.carousel-banners');
  const slideIndex = parseInt(slide.dataset.slideIndex, 10);
  block.dataset.activeSlide = slideIndex;

  const slides = block.querySelectorAll('.carousel-slide');

  slides.forEach((aSlide, idx) => {
    aSlide.setAttribute('aria-hidden', idx !== slideIndex);
    aSlide.querySelectorAll('a').forEach((link) => {
      if (idx !== slideIndex) {
        link.setAttribute('tabindex', '-1');
      } else {
        link.removeAttribute('tabindex');
      }
    });
  });

  const indicators = block.querySelectorAll('.carousel-slide-indicator');
  indicators.forEach((indicator, idx) => {
    if (idx !== slideIndex) {
      indicator.querySelector('button').removeAttribute('disabled');
    } else {
      indicator.querySelector('button').setAttribute('disabled', 'true');
    }
  });
}

export function showSlide(block, slideIndex = 0) {
  const slides = block.querySelectorAll('.carousel-slide');
  if (!slides.length) return;

  let realSlideIndex = slideIndex < 0 ? slides.length - 1 : slideIndex;
  if (slideIndex >= slides.length) realSlideIndex = 0;
  const activeSlide = slides[realSlideIndex];

  activeSlide
    .querySelectorAll('a')
    .forEach((link) => link.removeAttribute('tabindex'));

  block.querySelector('.carousel-slides').scrollTo({
    top: 0,
    left: activeSlide.offsetLeft,
    behavior: 'smooth',
  });
}

function bindEvents(block) {
  const slideIndicators = block.querySelector('.carousel-slide-indicators');
  if (!slideIndicators) return;

  slideIndicators.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', (e) => {
      const slideIndicator = e.currentTarget.parentElement;
      showSlide(block, parseInt(slideIndicator.dataset.targetSlide, 10));
    });
  });

  // scope the observer to the scroll container so it only fires for THIS
  // carousel, not any other IntersectionObserver-based block on the page
  const slideObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) updateActiveSlide(entry.target);
      });
    },
    { threshold: 0.5, root: block.querySelector('.carousel-slides') },
  );
  block.querySelectorAll('.carousel-slide').forEach((slide) => {
    slideObserver.observe(slide);
  });
}

function createNavigationButtons(block, placeholders) {
  const nav = document.createElement('div');
  nav.classList.add('carousel-nav-buttons');

  const prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.classList.add('carousel-nav-prev');
  prevButton.setAttribute(
    'aria-label',
    placeholders.previousSlide || 'Previous Slide',
  );
  prevButton.addEventListener('click', () => {
    const current = parseInt(block.dataset.activeSlide || '0', 10);
    showSlide(block, current - 1);
  });

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.classList.add('carousel-nav-next');
  nextButton.setAttribute(
    'aria-label',
    placeholders.nextSlide || 'Next Slide',
  );
  nextButton.addEventListener('click', () => {
    const current = parseInt(block.dataset.activeSlide || '0', 10);
    showSlide(block, current + 1);
  });

  nav.append(prevButton, nextButton);
  return nav;
}

function startAutoplay(block, interval = 6000) {
  const slides = block.querySelectorAll('.carousel-slide');
  if (slides.length < 2) return;

  let currentIndex = parseInt(block.dataset.activeSlide || '0', 10);
  setInterval(() => {
    const nextIndex = (currentIndex + 1) % slides.length;
    showSlide(block, nextIndex);
    currentIndex = nextIndex;
  }, interval);
}

function createSlide(row, slideIndex, blockId) {
  const slide = document.createElement('li');
  slide.dataset.slideIndex = slideIndex;
  slide.setAttribute('id', `carousel-banners-${blockId}-slide-${slideIndex}`);
  slide.classList.add('carousel-slide');

  row.querySelectorAll(':scope > div').forEach((column, colIdx) => {
    column.classList.add(
      `carousel-slide-${colIdx === 0 ? 'image' : 'content'}`,
    );
    slide.append(column);
  });

  const labeledBy = slide.querySelector('h1, h2, h3, h4, h5, h6');
  if (labeledBy) {
    slide.setAttribute('aria-labelledby', labeledBy.getAttribute('id'));
  }

  return slide;
}

function buildBanners(bannerRows) {
  const banners = document.createElement('ul');
  banners.classList.add('carousel-banners-list');

  let idx = 0;
  bannerRows.forEach((row) => {
    row.querySelectorAll(':scope > div').forEach((cell) => {
      const item = document.createElement('li');
      item.classList.add('carousel-banner');
      item.dataset.bannerIndex = idx;
      item.append(...cell.childNodes);
      banners.append(item);
      idx += 1;
    });
  });

  return banners;
}

let blockId = 0;

export default async function decorate(block) {
  blockId += 1;
  block.setAttribute('id', `carousel-banners-${blockId}`);
  block.classList.add('carousel'); // so imported carousel.css rules match

  const rows = Array.from(block.querySelectorAll(':scope > div'));
  if (!rows.length) return;

  // last BANNER_ROW_COUNT authored rows = banners, everything before = slides
  const bannerRows = rows.splice(-BANNER_ROW_COUNT, BANNER_ROW_COUNT);
  const slideRows = rows;
  const isSingleSlide = slideRows.length < 2;

  const placeholders = await fetchPlaceholders();

  block.setAttribute('role', 'region');
  block.setAttribute(
    'aria-roledescription',
    placeholders.carousel || 'Carousel',
  );

  const grid = document.createElement('div');
  grid.classList.add('carousel-banners-grid');

  // ---- left: carousel column (mirrors the original carousel block) ----
  const carouselCol = document.createElement('div');
  carouselCol.classList.add(
    'carousel-banners-carousel-col',
    'carousel-slides-container',
  );

  const slidesWrapper = document.createElement('ul');
  slidesWrapper.classList.add('carousel-slides');
  carouselCol.append(slidesWrapper);

  let slideIndicators;
  if (!isSingleSlide) {
    const slideIndicatorsNav = document.createElement('nav');
    slideIndicatorsNav.setAttribute(
      'aria-label',
      placeholders.carouselSlideControls || 'Carousel Slide Controls',
    );
    slideIndicators = document.createElement('ol');
    slideIndicators.classList.add('carousel-slide-indicators');
    slideIndicatorsNav.append(slideIndicators);
    carouselCol.append(slideIndicatorsNav);
    carouselCol.append(createNavigationButtons(block, placeholders));
  }

  slideRows.forEach((row, idx) => {
    const slide = createSlide(row, idx, blockId);
    slidesWrapper.append(slide);

    if (slideIndicators) {
      const indicator = document.createElement('li');
      indicator.classList.add('carousel-slide-indicator');
      indicator.dataset.targetSlide = idx;
      indicator.innerHTML = `<button type="button" aria-label="${
        placeholders.showSlide || 'Show Slide'
      } ${idx + 1} ${placeholders.of || 'of'} ${slideRows.length}"></button>`;
      slideIndicators.append(indicator);
    }
    row.remove();
  });

  // ---- right: stacked banners column ----
  const bannersCol = buildBanners(bannerRows);
  bannersCol.classList.add('carousel-banners-banners-col');
  bannerRows.forEach((row) => row.remove());

  grid.append(carouselCol, bannersCol);
  block.textContent = '';
  block.append(grid);

  if (!isSingleSlide) {
    bindEvents(block);
    startAutoplay(block);
  }
}
