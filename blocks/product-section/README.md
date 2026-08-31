# Product Section Block

A reusable, flexible product section block for Adobe Commerce storefronts. Supports multiple display modes, product filtering, and full integration with cart and wishlist functionality.

## Features

- **Multiple Display Modes**: Grid or Carousel layouts
- **Responsive Design**: Mobile-first, adapts from mobile to tablet to desktop
- **Wishlist Integration**: Add/remove products from wishlist
- **Cart Integration**: Add products to cart with one click
- **Product Swatches**: Display color/size options
- **Pricing Options**: Support for regular and sale prices
- **Badges**: Display NEW, SALE, or custom badges
- **Manageable from da.live**: Configure via authored content

## Configuration

Create a product-section block in da.live by adding a table with the following configuration options:

| Config Key | Value | Description | Default |
|-----------|-------|-------------|---------|
| `displaytype` | `grid` or `carousel` | Layout style | `grid` |
| `pagesize` | number | Number of products to display | `6` |
| `productskus` | comma-separated SKUs | Specific products to show (e.g., `sku1,sku2,sku3`) | (empty) |
| `recommendationtype` | string | Type of recommendation algorithm (e.g., `viewed`, `bought-together`) | `viewed` |
| `categorypath` | path | Category path for filtering products | (empty) |
| `sortby` | string | Sort order (e.g., `name`, `price`, `relevance`) | (empty) |

## Example da.live Markup

```html
<!-- Grid Layout with 9 Products -->
<div class="product-section">
  <div>
    <div>Display Type</div>
    <div>grid</div>
  </div>
  <div>
    <div>Page Size</div>
    <div>9</div>
  </div>
  <div>
    <div>Product SKUs</div>
    <div></div>
  </div>
  <div>
    <div>Category Path</div>
    <div>/women/shoes</div>
  </div>
</div>
```

## Display Modes

### Grid Mode (Default)
- Mobile: 1 column
- Tablet (600px+): 2 columns
- Desktop (900px+): 3 columns
- Large Desktop (1200px+): 4 columns

### Carousel Mode
- Horizontal scrollable carousel with smooth scroll behavior
- Previous/Next navigation buttons on desktop
- Auto-responsive columns based on viewport

## Product Card Features

### Visual Elements
- **Product Image**: Optimized, lazy-loaded with hover zoom effect
- **Badge**: Positioned top-right for promotional tags (NEW, SALE, etc.)
- **Rating**: Star rating display with count
- **Price**: Displays original and sale prices with strikethrough
- **Swatches**: Color/option selector circles
- **Wishlist Icon**: Heart icon to save to wishlist

### Actions
- **Product Name Link**: Navigates to product detail page
- **Add to Cart Button**: Adds product to cart with instant feedback
- **Wishlist Toggle**: Adds/removes from saved items

## Styling & Customization

### CSS Variables
The block uses standard CSS variables for theming:

```css
--color-background-white: #fff
--color-background-light: #f5f5f5
--color-text-primary: #1a1a1a
--color-text-secondary: #666
--color-border-light: #e8e8e8
--color-accent-blue: #1976d2
--color-accent-red: #d32f2f
--color-accent-green: #0f9d58
--spacing-small: 0.5rem
--spacing-medium: 1rem
--spacing-large: 2rem
--border-radius: 4px
```

### Custom Styling
To customize, override these variables in your `styles.css` or `lazy-styles.css`:

```css
:root {
  --color-accent-blue: #your-color;
  --spacing-medium: 1.25rem;
}
```

## Integration Points

### Cart Events
The block listens to and emits cart-related events through the event bus:
- Emits: `itemAddedToCart` when product is added
- Listens: `cartUpdated` from other blocks/dropins

### Wishlist Integration
- Uses `WishlistToggle` dropin for save functionality
- Syncs with customer wishlist data
- Displays heart icon with filled/empty state

### Product Links
- Uses `getProductLink()` helper from commerce.js
- Automatically generates correct product detail page URLs

## Performance Considerations

### Image Optimization
- Lazy loading enabled by default
- Images optimized by AEM
- Aspect ratio 3:4 for consistency

### Bundle Size
- Uses tree-shaken dropin libraries
- Minimal JavaScript dependencies
- CSS Grid for layout efficiency

### Mobile Performance
- Touch-friendly hit targets (40px minimum)
- Smooth scroll for carousels
- Reduces animation on low-end devices

## Accessibility

- Semantic HTML structure
- ARIA labels on buttons and interactive elements
- Keyboard navigation support
- Focus indicators on interactive elements
- Color contrast ratios meet WCAG AA standards
- Screen reader friendly

## Troubleshooting

### Products Not Showing
1. Check da.live block configuration
2. Verify product SKUs are correct
3. Check browser console for errors
4. Ensure initializers/wishlist.js and initializers/recommendations.js are loaded

### Layout Issues
1. Clear browser cache
2. Check for CSS variable overrides
3. Inspect media query breakpoints (600px, 900px, 1200px)
4. Verify no conflicting CSS from other blocks

### Cart/Wishlist Not Working
1. Ensure dropins are initialized (check scripts/initializers/)
2. Verify Adobe Commerce API credentials
3. Check event bus for emission errors
4. Validate product SKUs exist in catalog

## Advanced Usage

### Dynamic Product Loading
To load products dynamically from the API instead of mocks:

```javascript
// Replace mockProducts with API call
const products = await fetchProductsFromAPI({
  skus: productSkus,
  categoryPath: categoryPath,
  pageSize: pageSize,
});
```

### Custom Product Rendering
Extend `renderProductCard()` to add additional fields:

```javascript
const customField = document.createElement('div');
customField.className = 'product-section-custom';
customField.textContent = product.customField;
infoWrapper.appendChild(customField);
```

## Future Enhancements

- [ ] Server-side pagination
- [ ] Filter sidebar integration
- [ ] Advanced sort options
- [ ] Product comparison
- [ ] Quick view modal
- [ ] Stock status indicator
- [ ] Custom templates per variant
- [ ] A/B testing support
