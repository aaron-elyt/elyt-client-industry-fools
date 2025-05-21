# Shopify Integration for Webflow

This repository contains JavaScript files to integrate Shopify with Webflow.

## Usage

**For best performance, use the minified files in production:**

```html
<!-- Required: Fancybox for product lightbox -->
<script src="https://cdn.jsdelivr.net/npm/@fancyapps/ui@4.0/dist/fancybox.umd.js"></script>

<!-- Common code (include on all pages) -->
<script src="shopify-common15.min.js"></script>

<!-- Include only on product pages -->
<script src="shopify-product12.min.js"></script>

<!-- Include only on collection pages -->
<script src="shopify-collectionv4.min.js"></script>
```

## HTML Requirements

### On all pages (for cart):
- `#cart-drawer`: Cart drawer container (the sliding cart panel)
- `#cart-close`: Button or element to close the cart drawer
- `#cart-body`: Container for cart line items
- `#cart-subtotal`: Element to display the cart subtotal
- `#cart-checkout`: Checkout button (should be an `<a>` tag for the checkout URL)
- `#cart-overlay`: Overlay element behind the cart drawer
- Cart toggle button(s):
  - Use **any** of the following for cart open/close buttons (mobile/desktop):
    - `id="cart-toggle"` (can be used on multiple elements)
    - `class="cart-toggle"`
    - `data-cart-toggle` attribute
    - Any `<button>` or `<a>` with "cart" in its text (except add-to-cart)
  - The script will update the text to show the item count, e.g. `CART (2)`
  - To customize the text, add `data-cart-text-template="My Cart ({count})"`

### On product pages:
- `#product-embed` with `data-shopify-id="YOUR_PRODUCT_ID"` (hidden or visible, used to identify the product)
- `#prod-img-main`: Main product image
- `#prod-img-1`, `#prod-img-2`, `#prod-img-3`: Thumbnail images (optional, up to 3)
- `#prod-title`: Product title
- `#prod-desc`: Product description (HTML allowed)
- `#size-select`: Container for variant buttons (e.g. sizes)
- `#prod-price`: Price display
- `#add-to-cart`: Add to cart button (will always show "Add to Cart")
- `#stock-warning`: (optional, auto-created) – displays low stock warning if quantity < 10

### On collection pages:
- `#product-grid` with `data-collection="YOUR_COLLECTION_HANDLE"` (or use `/collections/YOUR_COLLECTION_HANDLE` in the URL)

## Notes
- All IDs and classes are **case-sensitive** and must match exactly.
- You can style all elements as you wish; the scripts only require the correct IDs/classes/attributes to function.
- For best performance, always use the `.min.js` files in production.
- If you update your JS, re-run the build script to regenerate the minified files.