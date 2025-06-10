// Shopify integration for Webflow - Common Code
const STOREFRONT_ACCESS_TOKEN = 'cb5f20fd2b37738c0d35f1e08278c7fb';
const SHOPIFY_DOMAIN = 'industry-fools.myshopify.com';
const SHOPIFY_API_VERSION = '2025-01';

// Utility functions
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Safe DOM manipulation - handles null elements
const safeDom = (selector, callback) => {
  const element = $(selector);
  if (element) callback(element);
  return element;
};

// Gets all elements matching a selector, including those with duplicate IDs
const getAllElements = (selector) => {
  // If this is an ID selector and there might be duplicates, use a different approach
  if (selector.startsWith('#')) {
    const id = selector.substring(1);
    return Array.from(document.querySelectorAll(`[id="${id}"]`));
  }
  return Array.from(document.querySelectorAll(selector));
};

// Add CSS for invisible-before-load
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .invisible-before-load { visibility: hidden; }
  `;
  document.head.appendChild(style);
})();

// Helper to determine if an element is the Add to Cart button
function isAddToCartButton(el) {
  if (!el) return false;
  if (el.id === 'add-to-cart') return true;
  if (el.classList && (el.classList.contains('add-to-cart') || el.classList.contains('add_to_cart'))) return true;
  if (el.getAttribute && el.getAttribute('data-action') === 'add-to-cart') return true;
  const text = (el.textContent || '').toLowerCase();
  return text.includes('add to cart') || text.includes('add-to-cart');
}

/**
 * Shopify Storefront API Client
 */
class ShopifyClient {
  constructor(domain, storefrontAccessToken, apiVersion) {
    this.domain = domain;
    this.storefrontAccessToken = storefrontAccessToken;
    this.apiVersion = apiVersion;
    this.locale = 'en-US'; // Default locale
  }

  async fetchStorefront(query, variables = {}) {
    try {
      const response = await fetch(
        `https://${this.domain}/api/${this.apiVersion}/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': this.storefrontAccessToken
          },
          body: JSON.stringify({ query, variables })
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const { data, errors } = await response.json();
      if (errors) {
        throw new Error(errors[0].message);
      }
      return data;
    } catch (error) {
      console.error('Storefront API error:', error);
      return null;
    }
  }

  async getProductById(id) {
    const query = `
      query GetProductById($id: ID!) {
        product(id: $id) {
          id
          title
          description
          descriptionHtml
          handle
          images(first: 4) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 250) {
            edges {
              node {
                id
                title
                availableForSale
                priceV2 {
                  amount
                  currencyCode
                }
                quantityAvailable
              }
            }
          }
        }
      }
    `;
    const data = await this.fetchStorefront(query, {
      id: `gid://shopify/Product/${id}`
    });
    return data?.product;
  }

  async createCart() {
    const query = `
      mutation CartCreate {
        cartCreate {
          cart {
            id
            checkoutUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    const data = await this.fetchStorefront(query);
    return data?.cartCreate?.cart;
  }

  async getCart(cartId) {
    const query = `
      query GetCart($cartId: ID!) {
        cart(id: $cartId) {
          id
          lines(first: 100) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    product {
                      title
                    }
                    image {
                      url
                      altText
                    }
                    priceV2 {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
          cost {
            subtotalAmount {
              amount
              currencyCode
            }
          }
          checkoutUrl
        }
      }
    `;
    const data = await this.fetchStorefront(query, { cartId });
    return data?.cart;
  }

  async addToCart(cartId, merchandiseId, quantity) {
    const query = `
      mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    const variables = {
      cartId,
      lines: [{ merchandiseId, quantity: parseInt(quantity, 10) }]
    };
    const data = await this.fetchStorefront(query, variables);
    return data?.cartLinesAdd?.cart;
  }

  async updateCartLine(cartId, lineId, quantity) {
    const query = `
      mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    const variables = {
      cartId,
      lines: [{ id: lineId, quantity: parseInt(quantity, 10) }]
    };
    const data = await this.fetchStorefront(query, variables);
    return data?.cartLinesUpdate?.cart;
  }

  async removeCartLine(cartId, lineId) {
    const query = `
      mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    const variables = {
      cartId,
      lineIds: [lineId]
    };
    const data = await this.fetchStorefront(query, variables);
    return data?.cartLinesRemove?.cart;
  }
}

/**
 * Shopify Cart functionality
 */
class ShopifyCart {
  constructor(client) {
    this.client = client;
    this.cartId = localStorage.getItem('sf_cart_id');
    this.isOpen = false;
    
    // Store the event listeners so we don't attach duplicates
    this.boundEvents = new WeakMap();
  }

  async getOrCreateCart() {
    if (!this.cartId) {
      const cart = await this.client.createCart();
      if (cart) {
        this.cartId = cart.id;
        localStorage.setItem('sf_cart_id', cart.id);
      }
    }
    return this.cartId;
  }

  async fetchCart() {
    if (!this.cartId) return null;
    return await this.client.getCart(this.cartId);
  }

  async addItem(merchandiseId, quantity = 1) {
    const cartId = await this.getOrCreateCart();
    if (!cartId) return null;
    return await this.client.addToCart(cartId, merchandiseId, quantity);
  }

  async updateItem(lineId, quantity) {
    if (!this.cartId) return null;
    return await this.client.updateCartLine(this.cartId, lineId, quantity);
  }

  async removeItem(lineId) {
    if (!this.cartId) return null;
    return await this.client.removeCartLine(this.cartId, lineId);
  }

  async renderCart() {
    if (!$('#cart-drawer')) return;
    const cart = await this.fetchCart();
    if (!cart) return;
    
    this.renderCartItems(cart);
    
    // Update cart subtotal
    getAllElements('#cart-subtotal').forEach(el => {
      const { amount, currencyCode } = cart.cost.subtotalAmount;
      el.textContent = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode
      }).format(amount);
    });
    
    // Update checkout URL
    getAllElements('#cart-checkout').forEach(el => {
      el.href = cart.checkoutUrl;
    });
    
    // Calculate item count
    const itemCount = cart.lines.edges.reduce((sum, { node }) => sum + node.quantity, 0);
    
    // Update all cart toggle buttons with the item count
    const cartCountText = `CART (${itemCount})`;
    
    // Find all possible cart toggle buttons and update their text
    this.getAllCartToggleButtons().forEach(el => {
      // Store the original text if we haven't already
      if (!el.dataset.originalText) {
        el.dataset.originalText = el.textContent;
      }
      
      if (el.dataset.cartTextTemplate) {
        // Use custom template if provided
        el.textContent = el.dataset.cartTextTemplate.replace('{count}', itemCount);
      } else {
        // Otherwise use default format
        el.textContent = cartCountText;
      }
    });
  }
  
  // Override getAllCartToggleButtons with exclusion logic
  getAllCartToggleButtons() {
    const buttons = [];
    buttons.push(...$$('.cart-toggle'));
    buttons.push(...getAllElements('#cart-toggle'));
    buttons.push(...$$('[data-cart-toggle]'));
    // buttons containing 'cart'
    const cartTextElements = Array.from($$('button, a')).filter(el => {
      if (el.classList.contains('cart-toggle') || el.id === 'cart-toggle' || el.hasAttribute('data-cart-toggle')) return false;
      if (isAddToCartButton(el)) return false;
      return (el.textContent || '').toLowerCase().includes('cart');
    });
    buttons.push(...cartTextElements);
    const unique = [...new Set(buttons)].filter(el => !isAddToCartButton(el));
    return unique;
  }

  renderCartItems(cart) {
    const cartBody = $('#cart-body');
    if (!cartBody) return;
    
    cartBody.innerHTML = '';
    
    if (cart.lines.edges.length === 0) {
      cartBody.innerHTML = '<div class="p-4 text-center">Your cart is empty</div>';
      return;
    }
    
    cart.lines.edges.forEach(({ node }) => {
      const { id, quantity, merchandise } = node;
      const { product, image, priceV2 } = merchandise;
      const lineItem = document.createElement('div');
      lineItem.className = 'cart-line flex items-center gap-4 py-3 border-b';
      
      const formattedPrice = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: priceV2.currencyCode
      }).format(priceV2.amount * quantity);
      
      let imageHtml = '';
      if (image?.url) {
        imageHtml = `<img src="${image.url}" alt="${image.altText || ''}" class="w-full">`;
      }
      
      lineItem.innerHTML = `
        <div class="w-16">${imageHtml}</div>
        <div class="flex-1">
          <div class="font-medium">${product.title}</div>
          <div class="cart-title text-sm text-gray-600">${merchandise.title}</div>
          <div class="flex items-center gap-2 mt-1">
            <button class="cart-qty-btn minus" data-line-id="${id}">-</button>
            <span>${quantity}</span>
            <button class="cart-qty-btn plus" data-line-id="${id}" data-qty="${quantity}">+</button>
            <button class="ml-2 text-sm text-red-500 remove" data-line-id="${id}">Remove</button>
          </div>
        </div>
        <div class="cart-price font-medium">${formattedPrice}</div>
      `;
      
      cartBody.appendChild(lineItem);
    });
    
    this.addCartItemEvents();
  }

  addCartItemEvents() {
    // Minus button functionality
    $$('.cart-qty-btn.minus').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lineId = btn.dataset.lineId;
        const currentQty = parseInt(btn.nextElementSibling.textContent, 10);
        if (currentQty > 1) {
          await this.updateItem(lineId, currentQty - 1);
        } else {
          await this.removeItem(lineId);
        }
        await this.renderCart();
      });
    });
    
    // Plus button functionality
    $$('.cart-qty-btn.plus').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lineId = btn.dataset.lineId;
        const currentQty = parseInt(btn.dataset.qty, 10);
        await this.updateItem(lineId, currentQty + 1);
        await this.renderCart();
      });
    });
    
    // Remove button functionality
    $$('.remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lineId = btn.dataset.lineId;
        await this.removeItem(lineId);
        await this.renderCart();
      });
    });
  }

  toggleCart() {
    this.isOpen = !this.isOpen;
    
    getAllElements('#cart-overlay').forEach(el => 
      el.classList.toggle('hidden', !this.isOpen)
    );
    
    getAllElements('#cart-drawer').forEach(el => 
      el.classList.toggle('translate-x-full', !this.isOpen)
    );
    
    if (this.isOpen) {
      this.renderCart();
    }
  }
  
  // Safe way to add an event listener only once
  addSafeEventListener(element, eventType, handler) {
    // Check if we've already added this handler
    if (!this.boundEvents.has(element)) {
      this.boundEvents.set(element, new Map());
    }
    
    const elementEvents = this.boundEvents.get(element);
    if (!elementEvents.has(eventType)) {
      // Create a bound version of the handler
      const boundHandler = handler.bind(this);
      elementEvents.set(eventType, boundHandler);
      element.addEventListener(eventType, boundHandler);
    }
  }

  setupCartUI() {
    // Get all cart toggle buttons
    const toggleButtons = this.getAllCartToggleButtons();
    
    // Add click listeners to all cart toggle buttons
    toggleButtons.forEach(el => {
      this.addSafeEventListener(el, 'click', function(e) {
        e.preventDefault();
        this.toggleCart();
      });
    });
    
    // Set up other cart UI elements
    getAllElements('#cart-close').forEach(el => {
      this.addSafeEventListener(el, 'click', function() {
        this.toggleCart();
      });
    });
    
    getAllElements('#cart-overlay').forEach(el => {
      this.addSafeEventListener(el, 'click', function(e) {
        if (e.target === el) {
          this.toggleCart();
        }
      });
    });
    
    // Initial render
    this.renderCart();
  }
}

// Initialize cart on all pages
document.addEventListener('DOMContentLoaded', () => {
  // Create the client instance if it doesn't exist yet
  if (!window.shopifyClient) {
    window.shopifyClient = new ShopifyClient(
      SHOPIFY_DOMAIN, 
      STOREFRONT_ACCESS_TOKEN,
      SHOPIFY_API_VERSION
    );
  }
  
  // Initialize cart if the drawer exists
  if ($('#cart-drawer')) {
    window.shopifyCart = new ShopifyCart(window.shopifyClient);
    window.shopifyCart.setupCartUI();
  }
});
