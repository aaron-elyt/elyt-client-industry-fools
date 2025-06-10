// Shopify Product Page Integration

// Make sure shopify-common.js is loaded first!

// Fancybox product lightbox integration
class ProductLightbox {
  constructor(options = {}) {
    this.options = {
      mainImageSelector: '#prod-img-main',
      thumbnailSelectors: ['#prod-img-1', '#prod-img-2', '#prod-img-3'],
      galleryContainerSelector: '.product-header4_image-grid',
      ...options
    };
    
    this.images = [];
    this.fancyboxInstance = null;
    
    // Bind methods
    this.initFancybox = this.initFancybox.bind(this);
    this.updateImages = this.updateImages.bind(this);
    this.createGallery = this.createGallery.bind(this);
    this.openGallery = this.openGallery.bind(this);
    
    // Initialize Fancybox (assume it's already loaded)
    this.initFancybox();
  }
  
  initFancybox() {
    // Wait for Fancybox to be available
    if (typeof Fancybox === 'undefined') {
      setTimeout(this.initFancybox, 100);
      return;
    }
    
    // Configure Fancybox defaults
    Fancybox.defaults = {
      ...Fancybox.defaults,
      Images: {
        zoom: true,
      },
      Thumbs: {
        autoStart: true,
      },
      Carousel: {
        transition: 'slide',
      }
    };
    
    // Remove any existing Webflow lightbox functionality
    this.removeWebflowLightbox();
    
    // Setup main image click handler
    const mainImage = document.querySelector(this.options.mainImageSelector);
    if (mainImage) {
      mainImage.addEventListener('click', (e) => {
        e.preventDefault();
        this.openGallery(0);
      });
    }
    
    // For option 1:
    this.createMobileSlideshow();
  }
  
  removeWebflowLightbox() {
    // Remove lightbox classes from links
    document.querySelectorAll('.w-lightbox').forEach(el => {
      el.classList.remove('w-lightbox');
      
      // Make sure clicks don't trigger default behavior
      el.addEventListener('click', (e) => {
        if (el.closest('a')) {
          e.preventDefault();
        }
      });
      
      // Remove any w-json scripts
      const wJson = el.querySelector('.w-json');
      if (wJson) {
        wJson.remove();
      }
    });
  }
  
  updateImages(images) {
    this.images = images.map(img => ({
      src: img.node.url,
      thumb: img.node.url,
      alt: img.node.altText || 'Product image'
    }));
    
    return this.images;
  }
  
  createGallery() {
    if (!this.images || this.images.length === 0) return;
    
    // Setup main product image
    const mainImage = document.querySelector(this.options.mainImageSelector);
    if (mainImage) {
      const mainImageWrapper = mainImage.closest('a') || mainImage.parentNode;
      mainImageWrapper.setAttribute('data-fancybox', 'product-gallery');
      mainImageWrapper.setAttribute('data-src', this.images[0].src);
      mainImageWrapper.style.cursor = 'pointer';
      
      // Remove any href that might be there from Webflow
      if (mainImageWrapper.tagName === 'A') {
        mainImageWrapper.removeAttribute('href');
      }
    }
    
    // Setup thumbnail images
    this.options.thumbnailSelectors.forEach((selector, index) => {
      // Calculate imgIndex to avoid duplicating the main image
      const imgIndex = index + 1;
      if (imgIndex >= this.images.length) return;
      
      const thumbnail = document.querySelector(selector);
      if (thumbnail) {
        const thumbWrapper = thumbnail.closest('a') || thumbnail.parentNode;
        thumbWrapper.setAttribute('data-fancybox', 'product-gallery');
        thumbWrapper.setAttribute('data-src', this.images[imgIndex].src);
        thumbWrapper.style.cursor = 'pointer';
        
        // Remove any href that might be there from Webflow
        if (thumbWrapper.tagName === 'A') {
          thumbWrapper.removeAttribute('href');
        }
        
        // Add click handler to open gallery at this image
        thumbWrapper.addEventListener('click', (e) => {
          e.preventDefault();
          this.openGallery(imgIndex);
        });
      }
    });
  }
  
  openGallery(index = 0) {
    if (!this.images || this.images.length === 0) return;
    
    Fancybox.show(this.images, {
      startIndex: index
    });
  }
  
  createMobileSlideshow() {
    // Only create slideshow on mobile devices
    if (window.innerWidth > 767) return;
    
    const container = document.querySelector(this.options.galleryContainerSelector);
    if (!container || !this.images.length) return;
    
    // Create mobile slideshow
    const slideshow = document.createElement('div');
    slideshow.className = 'mobile-product-slideshow';
    
    
    // Create slides
    this.images.forEach(image => {
      const slide = document.createElement('div');
      slide.className = 'mobile-slide';
      const img = document.createElement('img');
      img.src = image.src;
      img.alt = image.alt;
      img.addEventListener('click', () => Fancybox.show(this.images));
      slide.appendChild(img);
      slideshow.appendChild(slide);
    });
    
    // Insert slideshow before the original image grid
    container.parentNode.insertBefore(slideshow, container);
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
      el.classList.remove('invisible-before-load');
    });
    safeDom('#prod-desc', el => {
      el.innerHTML = this.product.descriptionHtml;
      el.classList.remove('invisible-before-load');
    });
    
    const images = this.product.images.edges;
    
    // Use the Fancybox lightbox if available
    if (window.productLightbox && images.length > 0) {
      // Update the images in the lightbox
      window.productLightbox.updateImages(images);
      
      // Setup the main product image
      safeDom('#prod-img-main', el => {
        if (images[0]?.node.url) {
          el.src = images[0].node.url;
          el.alt = images[0].node.altText || this.product.title;
          el.closest('.product-header4_lightbox-link').style.display = '';
        } else {
          el.closest('.product-header4_lightbox-link').style.display = 'none';
        }
        el.classList.remove('invisible-before-load');
      });
      
      // Setup thumbnail images
      ['prod-img-1', 'prod-img-2', 'prod-img-3'].forEach((id, index) => {
        // Calculate imgIndex to avoid duplicating the main image
        const imgIndex = index + 1;
        safeDom(`#${id}`, el => {
          if (imgIndex < images.length && images[imgIndex]?.node.url) {
            el.src = images[imgIndex].node.url;
            el.alt = images[imgIndex].node.altText || this.product.title;
            el.closest('.product-header4_lightbox-link').style.display = '';
          } else {
            el.closest('.product-header4_lightbox-link').style.display = 'none';
          }
          el.classList.remove('invisible-before-load');
        });
      });
      
      // Initialize the gallery
      window.productLightbox.createGallery();
    } else {
      // Fallback if Fancybox is not loaded
      if (images.length > 0) {
        safeDom('#prod-img-main', el => {
          if (images[0]?.node.url) {
            el.src = images[0].node.url;
            el.alt = images[0].node.altText || this.product.title;
            el.closest('.product-header4_lightbox-link').style.display = '';
          } else {
            el.closest('.product-header4_lightbox-link').style.display = 'none';
          }
          el.classList.remove('invisible-before-load');
        });
        
        ['prod-img-1', 'prod-img-2', 'prod-img-3'].forEach((id, index) => {
          // Calculate imgIndex to avoid duplicating the main image
          const imgIndex = index + 1;
          safeDom(`#${id}`, el => {
            if (imgIndex < images.length && images[imgIndex]?.node.url) {
              el.src = images[imgIndex].node.url;
              el.alt = images[imgIndex].node.altText || this.product.title;
              el.closest('.product-header4_lightbox-link').style.display = '';
            } else {
              el.closest('.product-header4_lightbox-link').style.display = 'none';
            }
            el.classList.remove('invisible-before-load');
          });
        });
      } else {
        // No images at all
        safeDom('#prod-img-main', el => {
          el.closest('.product-header4_lightbox-link').style.display = 'none';
        });
        ['prod-img-1', 'prod-img-2', 'prod-img-3'].forEach(id => {
          safeDom(`#${id}`, el => {
            el.closest('.product-header4_lightbox-link').style.display = 'none';
          });
        });
      }
    }
    
    this.renderVariantSelect();
    this.updateSelectedVariant();
    safeDom('#prod-price', el => el.classList.remove('invisible-before-load'));
  }

  renderVariantSelect() {
    const variants = this.product.variants.edges;
    if (variants.length === 0) return;
    safeDom('#size-select', container => {
      container.innerHTML = '';
      variants.forEach(({ node }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'variant-button' + (node.availableForSale ? '' : ' disabled');
        btn.textContent = node.title;
        btn.dataset.variantId = node.id;
        btn.disabled = !node.availableForSale;
        btn.addEventListener('click', () => {
          // Remove active from all
          container.querySelectorAll('.variant-button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          container.dataset.selectedVariant = node.id;
          this.updateSelectedVariant();
        });
        container.appendChild(btn);
      });
      // Select the first available by default
      const firstAvailable = container.querySelector('.variant-button:not(.disabled)');
      if (firstAvailable) {
        firstAvailable.classList.add('active');
        container.dataset.selectedVariant = firstAvailable.dataset.variantId;
      }
      this.updateSelectedVariant();
    });
  }

  updateSelectedVariant() {
    const variantContainer = $('#size-select');
    if (!variantContainer) return;
    const variantId = variantContainer.dataset.selectedVariant;
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
      // Display low stock warning if quantityAvailable data present
      const qty = this.selectedVariant.quantityAvailable;
      let warningEl = document.getElementById('stock-warning');
      if (!warningEl) {
        // create after price
        const priceEl = document.getElementById('prod-price');
        if (priceEl && priceEl.parentNode) {
          warningEl = document.createElement('div');
          warningEl.id = 'stock-warning';
          warningEl.style.color = '#c00';
          warningEl.style.marginTop = '4px';
          priceEl.parentNode.insertBefore(warningEl, priceEl.nextSibling);
        }
      }
      if (warningEl) {
        if (typeof qty === 'number' && qty > 0 && qty < 10) {
          warningEl.textContent = `Only ${qty} left in stock!`;
          warningEl.style.display = 'flex';
        } else {
          warningEl.style.display = 'none';
        }
      }
    }
  }

  setupAddToCartButton() {
    safeDom('#add-to-cart', button => {
      // Determine and store the original text
      if (!button.dataset.originalText) {
        button.dataset.originalText = 'Add to Cart';
      }
      
      // Ensure the button displays the original text on load
      button.textContent = button.dataset.originalText;
      
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
          button.textContent = button.dataset.originalText;
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

// Initialize product page functionality
document.addEventListener('DOMContentLoaded', () => {
  // Only run this code on product pages
  if ($('#product-embed')) {
    // Initialize ProductLightbox if Fancybox is available
    window.productLightbox = new ProductLightbox();
    
    // Initialize the product page (uses the global shopifyClient and shopifyCart)
    if (window.shopifyClient && window.shopifyCart) {
      const productPage = new ProductPage(window.shopifyClient, window.shopifyCart);
      productPage.init();
    }
  }
});
