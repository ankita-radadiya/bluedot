# Tabs Block

Tabbed content section used for "Shop by Caliber" style panels. Each tab shows an
image with a caption on the left and a grid of link buttons on the right.

## da.live Structure

Add the section heading as normal text above the block (an H2), then insert a
**Tabs** block with **2 columns**. Each row is one tab.

| Tabs | |
|------|--|
| Range | *(image)*<br>• [22LR](/) • [5.56 NATO](/) • [223 WYLDE](/) • [22 MAGNUM](/) • [350 LEGEND](/)<br>Shop the very best complete upper assemblies for memorable times at the range. |
| Hunting | *(image)*<br>• [12.7x42](/) • [450 BUSHMASTER](/) • [458 SOCOM](/) • [224 VALKYRIE](/)<br>Our barrels are known to supply increased accuracy. |
| Long- Distance | *(image)*<br>• [17 HMR](/) • [6MM ARC](/) • [6.5 GRENDEL](/)<br>With barrel lengths as long as 24 inches, no distance is too great. |

### Cell contents

| Column | Contents |
|--------|----------|
| **1** | Tab label, e.g. `Range` |
| **2** | The panel content: an **image**, a **bulleted list of links**, and a **paragraph** of description text |

The second cell is parsed by element type, not order, so you can arrange the
image, list, and description however you like within the cell:

- **Image** → rendered on the left side of the panel
- **Bulleted list of links** → rendered as the green buttons on the right
- **Paragraph text** → rendered as the caption below the image

Any of the three may be omitted.

### Example in plain HTML

```html
<div class="tabs">
  <div>
    <div>Range</div>
    <div>
      <p><picture><img src="/range.jpg" alt="Range Ready"></picture></p>
      <ul>
        <li><a href="/calibers/22lr">22LR</a></li>
        <li><a href="/calibers/556-nato">5.56 NATO</a></li>
        <li><a href="/calibers/223-wylde">223 WYLDE</a></li>
        <li><a href="/calibers/22-magnum">22 MAGNUM</a></li>
        <li><a href="/calibers/350-legend">350 LEGEND</a></li>
      </ul>
      <p>Shop the very best complete upper assemblies for memorable times at the range.</p>
    </div>
  </div>
</div>
```

## Behaviour

- The first tab is selected on load.
- Tabs follow the ARIA tabs pattern: arrow keys move between tabs, Home and End
  jump to the first and last tab.
- On mobile the panel stacks: image and caption first, then the buttons.

## Styling

Colors are exposed as custom properties on `.tabs`:

| Property | Default | Purpose |
|----------|---------|---------|
| `--tabs-cta` | `#14602e` | Button background |
| `--tabs-cta-hover` | `#0e4620` | Button hover background |
| `--tabs-border` | `#dcdcdc` | Tab and panel borders |
| `--tabs-inactive-bg` | `#f2f2f2` | Inactive tab background |
