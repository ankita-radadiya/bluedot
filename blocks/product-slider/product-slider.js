import { fetchProducts } from '../../scripts/commerce.js';

export default async function decorate(block) {
  // Extract key-value configurations from table rows
  const config = {};
  [...block.children].forEach((row) => {
    const cols = [...row.children];
    if (cols.length >= 2) {
      const key = cols[0].textContent.trim().toLowerCase();
      const val = cols[1].textContent.trim();
      config[key] = val;
    }
  });

  // Target the specific 'category id' key
  const categoryId = config['category id'] || '2';

  // Render slider shell with control buttons
  block.innerHTML = `
    <div class="product-slider-container">
      <button class="slider-arrow prev" aria-label="Previous products">&#10094;</button>
      <div class="slider-track"></div>
      <button class="slider-arrow next" aria-label="Next products">&#10095;</button>
    </div>
  `;

  const track = block.querySelector('.slider-track');
  const products = await fetchProducts({ categoryId, pageSize: 8 });

  // Render product cards
  products.forEach((product) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <a href="/products/${product.url_key}">
        <div class="image-container">
          <img src="${product.small_image.url}" alt="${product.name}" loading="lazy" width="240" height="240"/>
        </div>
        <h3 class="product-title">${product.name}</h3>
        <p class="product-price">${product.price_range.minimum_price.final_price.value} ${product.price_range.minimum_price.final_price.currency}</p>
      </a>
    `;
    track.appendChild(card);
  });

  // Attach navigation control logic
  const prevBtn = block.querySelector('.slider-arrow.prev');
  const nextBtn = block.querySelector('.slider-arrow.next');

  prevBtn.addEventListener('click', () => {
    const scrollAmount = track.clientWidth * 0.8;
    track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  });

  nextBtn.addEventListener('click', () => {
    const scrollAmount = track.clientWidth * 0.8;
    track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  });
}
