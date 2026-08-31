# Product Slider Block

Homepage product carousel styled for "Hot New Discoveries" / trend sections. Displays product cards with image, name, and "As low as" pricing with prev/next navigation.

## da.live Structure

Add a new section on the homepage and insert a **Product Slider** block with this table:

| Key | Value |
|-----|-------|
| Subtitle | New Trends For The Year |
| Title | Hot New Discoveries |
| Category Path | rifles |
| Page Size | 8 |
| Product SKUs | |

### Configuration Options

| Config Key | Example | Description |
|------------|---------|-------------|
| `Subtitle` | `New Trends For The Year` | Small label above the main heading |
| `Title` | `Hot New Discoveries` | Main section heading (centered) |
| `Category Path` | `rifles` or `gear/optics` | Category URL path used when SKUs are empty. Leave empty to show newest products from the whole catalog. |
| `Page Size` | `8` | Number of products to load |
| `Product SKUs` | `SKU1,SKU2,SKU3` | Optional comma-separated SKUs (overrides category) |

Products are fetched from the Catalog Service via `productSearch` (category mode) or
`products(skus:)` (SKU mode).

### Example in plain HTML

```html
<div class="product-slider">
  <div>
    <div>Subtitle</div>
    <div>New Trends For The Year</div>
  </div>
  <div>
    <div>Title</div>
    <div>Hot New Discoveries</div>
  </div>
  <div>
    <div>Category Path</div>
    <div>rifles</div>
  </div>
  <div>
    <div>Page Size</div>
    <div>8</div>
  </div>
  <div>
    <div>Product SKUs</div>
    <div></div>
  </div>
</div>
```

### Notes for authors

- Leave **Product SKUs** empty to load products from **Category Path**.
- Leave both **Product SKUs** and **Category Path** empty to show products from the whole catalog.
- Fill **Product SKUs** with comma-separated values to show specific products in that order.
- Place this block in its own section below the category columns section.
