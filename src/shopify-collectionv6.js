// Shopify Collection Page Integration

// Collection functionality
class CollectionPage {
  constructor(client) {
    this.client = client;
  }

  /**
   * Fetch products from a Shopify collection by handle
   * @param {string} collectionHandle
   * @returns {Promise<Array>} Array of products
   */
  async fetchCollectionProducts(collectionHandle) {
    const endpoint = `https://${this.client.domain}/api/${this.client.apiVersion}/graphql.json`;
    const query = `
      query GetCollectionProducts($handle: String!) {
        collectionByHandle(handle: $handle) {
          products(first: 20) {
            edges {
              node {
                id
                handle
                title
                images(first: 2) {
                  edges {
                    node {
                      url
                    }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      title
                      priceV2 {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const variables = { handle: collectionHandle };
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': this.client.storefrontAccessToken,
        },
        body: JSON.stringify({ query, variables }),
      });
      
      if (!res.ok) {
        throw new Error(`Shopify API error: ${res.status}`);
      }
      
      const { data, errors } = await res.json();
      if (errors) {
        throw new Error(errors[0].message);
      }
      
      return data.collectionByHandle?.products?.edges.map(e => e.node) || [];
    } catch (err) {
      console.error('Failed to fetch Shopify products:', err);
      return [];
    }
  }

  /**
   * Format price with currency
   */
  formatPrice(amount, currencyCode) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode
    }).format(amount);
  }

  /**
   * Inject products into the product grid container
   * @param {Array} products
   */
  injectProductsToGrid(products) {
    // Look for product grid with different possible selectors
    const grid = document.getElementById('product-grid') || 
                document.querySelector('.product-grid') || 
                document.querySelector('.collection-grid') ||
                document.querySelector('.w-dyn-items');
    
    if (!grid) {
      console.error('Could not find product grid element on the page');
      return;
    }
    
    grid.innerHTML = '';
    
    products.forEach(product => {
      const mainImage = product.images.edges[0]?.node.url || '';
      const hoverImage = product.images.edges[1]?.node.url || mainImage; // Use second image for hover if available
      const variant = product.variants.edges[0]?.node;
      const price = variant ? this.formatPrice(variant.priceV2.amount, variant.priceV2.currencyCode) : '';
      const productHTML = `
        <div role="listitem" class="product7_item w-dyn-item">
          <a href="/products/${product.handle}" class="product7_item-link w-inline-block">
            <div class="margin-bottom margin-xsmall">
              <div class="product7_image-wrapper">
                <img src="${mainImage}" class="product7_image" alt="${product.title}" loading="lazy" />
                <img src="${hoverImage}" class="product7_image is-hover" alt="${product.title}" loading="lazy" />
              </div>
            </div>
            <div class="margin-bottom margin-xxsmall">
              <div class="text-size-medium text-weight-semibold">${product.title}</div>
            </div>
            <div class="text-size-large text-weight-semibold">${price}</div>
          </a>
        </div>
      `;
      grid.insertAdjacentHTML('beforeend', productHTML);
    });
  }

  /**
   * Load products from a collection handle
   */
  async loadCollection(collectionHandle) {
    const products = await this.fetchCollectionProducts(collectionHandle);
    this.injectProductsToGrid(products);
  }

  /**
   * Initialize the collection page
   */
  init() {
    // Try different ways to find the collection handle
    const grid = document.getElementById('product-grid') || 
                document.querySelector('.product-grid') || 
                document.querySelector('.collection-grid') ||
                document.querySelector('.w-dyn-items');
    
    if (!grid) return;
    
    // Try to get collection handle from different attributes
    let handle = grid.getAttribute('data-collection') || 
                grid.getAttribute('data-collection-handle') ||
                document.body.getAttribute('data-collection');
                  
    // If no handle attribute, try to extract it from URL
    if (!handle) {
      const pathParts = window.location.pathname.split('/');
      const collectionsIndex = pathParts.indexOf('collections');
      if (collectionsIndex !== -1 && pathParts.length > collectionsIndex + 1) {
        handle = pathParts[collectionsIndex + 1];
      }
    }
    
    if (handle) {
      this.loadCollection(handle);
    }
  }
}

/**
 * Wait for shopifyClient to be available
 */
function waitForShopifyClient(callback, maxAttempts = 20) {
  let attempts = 0;
  
  const checkClient = () => {
    attempts++;
    if (window.shopifyClient) {
      callback(window.shopifyClient);
    } else if (attempts < maxAttempts) {
      setTimeout(checkClient, 100);
    }
  };
  
  checkClient();
}

// Initialize collection page functionality
document.addEventListener('DOMContentLoaded', () => {
  // Try different selectors to identify a collection page
  const isCollectionPage = document.getElementById('product-grid') || 
                         document.querySelector('.product-grid') || 
                         document.querySelector('.collection-grid') ||
                         document.querySelector('.w-dyn-items') ||
                         window.location.pathname.includes('/collections/');
  
  // Only run this code on collection pages
  if (isCollectionPage) {
    // Wait for shopifyClient to be available
    waitForShopifyClient(client => {
      const collectionPage = new CollectionPage(client);
      collectionPage.init();
    });
  }
});

