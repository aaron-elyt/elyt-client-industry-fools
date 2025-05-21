
const STOREFRONT_ACCESS_TOKEN = 'e0f50e63d937029efed49ebb8bda6af4';
const SHOPIFY_DOMAIN = 'a6pzx0-qj.myshopify.com';
const SHOPIFY_API_VERSION = '2025-01'; // Update as needed

// Utility functions
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const safeDom = (selector, callback) => {
  const element = $(selector);
  if (element) callback(element);
  return element;
};

// Storefront API client
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

  async fetchAjaxProduct(handle) {
    try {
      const response = await fetch(`/${this.locale}/products/${handle}.js`);
      if (!response.ok) {
        throw new Error(`Product API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Ajax API error:', error);
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

// Cart functionality
class ShopifyCart {
  constructor(client) {
    this.client = client;
    this.cartId = localStorage.getItem('sf_cart_id');
    this.isOpen = false;
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
    safeDom('#cart-subtotal', (el) => {
      const { amount, currencyCode } = cart.cost.subtotalAmount;
      el.textContent = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode
      }).format(amount);
    });
    safeDom('#cart-checkout', (el) => {
      el.href = cart.checkoutUrl;
    });
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
      lineItem.innerHTML = `
        <div class="w-16">
          <img src="${image?.url || ''}" alt="${image?.altText || ''}" class="w-full">
        </div>
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
    $$('.cart-qty-btn.plus').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lineId = btn.dataset.lineId;
        const currentQty = parseInt(btn.dataset.qty, 10);
        await this.updateItem(lineId, currentQty + 1);
        await this.renderCart();
      });
    });
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
    safeDom('#cart-overlay', el => el.classList.toggle('hidden', !this.isOpen));
    safeDom('#cart-drawer', el => el.classList.toggle('translate-x-full', !this.isOpen));
    if (this.isOpen) {
      this.renderCart();
    }
  }

  setupCartUI() {
    safeDom('#cart-toggle', el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleCart();
      });
    });
    safeDom('#cart-close', el => {
      el.addEventListener('click', () => {
        this.toggleCart();
      });
    });
    safeDom('#cart-overlay', el => {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          this.toggleCart();
        }
      });
    });
    this.renderCart();
  }
}

// Product page functionality
class ProductPage {
  constructor(client, cart) {
    this.client = client;
    this.cart = cart;
    this.product = null;
    this.selectedVariant = null;
  }

  async loadProduct() {
    const productEmbed = $('#product-embed');
    if (!productEmbed) return null;
    const productId = productEmbed.dataset.shopifyId;
    if (!productId) return null;
    this.product = await this.client.getProductById(productId);
    return this.product;
  }

  renderProduct() {
    if (!this.product) return;
    safeDom('#prod-title', el => {
      el.textContent = this.product.title;
    });
    safeDom('#prod-desc', el => {
      el.innerHTML = this.product.descriptionHtml;
    });
    const images = this.product.images.edges;
    if (images.length > 0) {
      safeDom('#prod-img-main', el => {
        el.src = images[0].node.url;
        el.alt = images[0].node.altText || this.product.title;
      });
      ['prod-img-1', 'prod-img-2', 'prod-img-3'].forEach((id, index) => {
        if (images[index]) {
          safeDom(`#${id}`, el => {
            el.src = images[index].node.url;
            el.alt = images[index].node.altText || this.product.title;
            el.addEventListener('click', () => {
              safeDom('#prod-img-main', mainImg => {
                mainImg.src = images[index].node.url;
                mainImg.alt = images[index].node.altText || this.product.title;
              });
            });
          });
        }
      });
    }
    this.renderVariantSelect();
    this.updateSelectedVariant();
  }

  renderVariantSelect() {
    const variants = this.product.variants.edges;
    if (variants.length === 0) return;
    safeDom('#size-select', select => {
      select.innerHTML = '';
      variants.forEach(({ node }) => {
        const option = document.createElement('option');
        option.value = node.id;
        option.textContent = node.title;
        option.disabled = !node.availableForSale;
        select.appendChild(option);
      });
      const firstAvailable = variants.find(({ node }) => node.availableForSale);
      if (firstAvailable) {
        select.value = firstAvailable.node.id;
      }
      select.addEventListener('change', () => {
        this.updateSelectedVariant();
      });
    });
  }

  updateSelectedVariant() {
    const variantSelect = $('#size-select');
    if (!variantSelect) return;
    const variantId = variantSelect.value;
    this.selectedVariant = this.product.variants.edges
      .find(({ node }) => node.id === variantId)?.node;
    if (this.selectedVariant) {
      safeDom('#prod-price', el => {
        const { amount, currencyCode } = this.selectedVariant.priceV2;
        el.textContent = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currencyCode
        }).format(amount);
      });
    }
  }

  setupAddToCartButton() {
    safeDom('#add-to-cart', button => {
      button.addEventListener('click', async () => {
        if (!this.selectedVariant) return;
        const quantityInput = $('#qty');
        const quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;
        if (quantity > 0) {
          button.disabled = true;
          button.textContent = 'Adding...';
          await this.cart.addItem(this.selectedVariant.id, quantity);
          await this.cart.renderCart();
          this.cart.toggleCart();
          button.disabled = false;
          button.textContent = 'Add to Cart';
        }
      });
    });
  }

  init() {
    this.loadProduct().then(product => {
      if (product) {
        this.renderProduct();
        this.setupAddToCartButton();
      }
    });
  }
}

// Initialize integration on DOM content loaded
document.addEventListener('DOMContentLoaded', async () => {
  if (!$('#product-embed') && !$('#cart-drawer')) return;
  const client = new ShopifyClient(
    SHOPIFY_DOMAIN, 
    STOREFRONT_ACCESS_TOKEN,
    SHOPIFY_API_VERSION
  );
  const cart = new ShopifyCart(client);
  cart.setupCartUI();
  if ($('#product-embed')) {
    const productPage = new ProductPage(client, cart);
    productPage.init();
  }
});
