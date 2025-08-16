import { Component } from './component.js';
import { ThemeEvents, CartUpdateEvent } from './events.js';

/**
 * Gift Guide Grid Component
 * Handles the product grid with interactive hotspots, popup functionality, and cart integration
 */
class GiftGuideGridComponent extends Component {
  constructor() {
    super();
    this.requiredRefs = ['productsGrid', 'popupOverlay', 'popup', 'popupContent', 'popupClose'];
    this.currentProduct = null;
    this.selectedVariants = {};
  }

  connectedCallback() {
    super.connectedCallback();
    this.setupEventListeners();
  }

  /**
   * Sets up event listeners for hotspots and popup interactions
   */
  setupEventListeners() {
    // Hotspot click handlers
    const hotspots = this.querySelectorAll('.gift-guide-grid__hotspot');
    hotspots.forEach(hotspot => {
      hotspot.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleHotspotClick(hotspot);
      });
    });

    // Popup close handler
    if (this.refs.popupClose) {
      const closeBtn = Array.isArray(this.refs.popupClose) ? this.refs.popupClose[0] : this.refs.popupClose;
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.closePopup();
        });
      }
    }

    // Popup overlay click handler
    if (this.refs.popupOverlay) {
      const overlay = Array.isArray(this.refs.popupOverlay) ? this.refs.popupOverlay[0] : this.refs.popupOverlay;
      if (overlay) {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            this.closePopup();
          }
        });
      }
    }

    // Escape key handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isPopupOpen()) {
        this.closePopup();
      }
    });
  }

  /**
   * Handles hotspot click to open product popup
   */
  async handleHotspotClick(hotspot) {
    const productHandle = hotspot.dataset.productHandle;
    const productId = hotspot.dataset.productId;

    // Always use API call to get complete product data with options_with_values
    if (!productHandle && !productId) {
      console.warn('No product handle or ID found for hotspot');
      return;
    }

    try {
      await this.loadProduct(productHandle || productId);
      this.openPopup();
    } catch (error) {
      console.error('Error loading product:', error);
      this.openPopup();
    }
  }

  /**
   * Loads product data from Shopify API
   */
  async loadProduct(productIdentifier) {
    try {
      let url;
      
      // Determine if it's a handle or ID
      if (productIdentifier.includes('/') || productIdentifier.includes('-')) {
        // It's likely a handle - use Shopify's public product API
        url = `/products/${productIdentifier}.js`;
      } else {
        // It's likely an ID - try the public API first
        url = `/products/${productIdentifier}.js`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load product: ${response.status}`);
      }

      const product = await response.json();
      this.currentProduct = product;
      this.initializeVariants();
      this.renderProductPopup();
    } catch (error) {
      console.error('Error loading product:', error);
      throw error;
    }
  }

  /**
   * Initializes variant selection
   */
  initializeVariants() {
    this.selectedVariants = {};
    
    if (this.currentProduct.variants && this.currentProduct.variants.length > 0) {
      const firstAvailableVariant = this.currentProduct.variants.find(v => v.available) || this.currentProduct.variants[0];
      
      if (firstAvailableVariant) {
        // Handle new Shopify structure
        if (this.currentProduct.options_with_values && this.currentProduct.options_with_values.length > 0) {
          this.currentProduct.options_with_values.forEach((option, index) => {
            const optionValue = firstAvailableVariant[`option${index + 1}`];
            if (optionValue) {
              this.selectedVariants[option.name] = optionValue;
            }
          });
        } else if (this.currentProduct.options && this.currentProduct.options.length > 0) {
          // Handle legacy structure
          if (firstAvailableVariant.option1) this.selectedVariants[this.currentProduct.options[0]?.name || 'Option 1'] = firstAvailableVariant.option1;
          if (firstAvailableVariant.option2) this.selectedVariants[this.currentProduct.options[1]?.name || 'Option 2'] = firstAvailableVariant.option2;
          if (firstAvailableVariant.option3) this.selectedVariants[this.currentProduct.options[2]?.name || 'Option 3'] = firstAvailableVariant.option3;
        }
      }
    }
  }





  /**
   * Renders the product popup content
   */
  renderProductPopup() {
    if (!this.currentProduct || !this.refs.popupContent) return;

    const product = this.currentProduct;
    const selectedVariant = this.getSelectedVariant();
    const productImage = this.getProductImage(product, selectedVariant);

    const popupHTML = `
      <div class="gift-guide-grid__popup-product">
        <div class="gift-guide-grid__popup-image-container">
          <img 
            src="${productImage}" 
            alt="${product.title}"
            class="gift-guide-grid__popup-image"
            loading="lazy"
          >
        </div>
        
        <div class="gift-guide-grid__popup-details">
          <h3 class="gift-guide-grid__popup-title">${product.title}</h3>
          <div class="gift-guide-grid__popup-price">
            ${this.formatPrice(selectedVariant?.price || product.price)}
          </div>
          
          ${product.body_html ? `
            <div class="gift-guide-grid__popup-description">
              ${this.stripHtml(product.body_html)}
            </div>
          ` : ''}
          
          ${this.renderVariantOptions()}
          
          <button 
            class="gift-guide-grid__popup-add-to-cart" 
            ${!selectedVariant?.available ? 'disabled' : ''}
            data-variant-id="${selectedVariant?.id || ''}"
          >
            ${selectedVariant?.available ? 'ADD TO CART' : 'OUT OF STOCK'}
          </button>
        </div>
      </div>
    `;

    const popupContent = Array.isArray(this.refs.popupContent) ? this.refs.popupContent[0] : this.refs.popupContent;
    if (popupContent) {
      popupContent.innerHTML = popupHTML;
    }

    // Add event listeners to variant options and add to cart button
    this.setupPopupEventListeners();
  }

  /**
   * Gets the appropriate product image for display
   * @param {Object} product - The product object
   * @param {string} [product.featured_image] - The product's featured image URL
   * @param {Array<Object>} [product.images] - Array of product images
   * @param {Object} selectedVariant - The selected variant object
   * @param {string} [selectedVariant.featured_image] - The variant's featured image URL
   * @param {number} [selectedVariant.featured_image_id] - The variant's featured image ID
   * @returns {string} The image URL
   */
  getProductImage(product, selectedVariant) {
    // If we have a selected variant with an image, use that
    if (selectedVariant && selectedVariant.featured_image) {
      return selectedVariant.featured_image;
    }
    
    // If we have a selected variant with an image ID, find the image
    if (selectedVariant && selectedVariant.featured_image_id && product.images) {
      const variantImage = product.images.find((img) => img.id === selectedVariant.featured_image_id);
      if (variantImage) {
        return variantImage.src;
      }
    }
    
    // Use the product's featured image
    if (product.featured_image) {
      return product.featured_image;
    }
    
    // Use the first image from the images array
    if (product.images && product.images.length > 0) {
      return product.images[0].src;
    }
    
    // Fallback placeholder
    return 'https://via.placeholder.com/400x400?text=Product+Image';
  }

  /**
   * Renders variant options for the product
   */
  renderVariantOptions() {
    if (!this.currentProduct) return '';

    // Check if we have options_with_values (new Shopify structure)
    if (this.currentProduct.options_with_values && this.currentProduct.options_with_values.length > 0) {
      return this.renderVariantOptionsWithValues();
    }
    
    // Fallback to old structure
    if (this.currentProduct.options && this.currentProduct.options.length > 0) {
      return this.renderVariantOptionsLegacy();
    }

    return '';
  }

  /**
   * Renders variant options using the new Shopify options_with_values structure
   */
  renderVariantOptionsWithValues() {
    const options = this.currentProduct.options_with_values;
    const variants = this.currentProduct.variants;

    return `
      <div class="gift-guide-grid__popup-variants">
        ${options.map((option, index) => {
          const optionName = option.name;
          
          return `
            <div class="gift-guide-grid__popup-variant-group">
              <label class="gift-guide-grid__popup-variant-label">${optionName}</label>
              <div class="gift-guide-grid__popup-variant-options">
                ${option.values.map(optionValue => {
                  const value = optionValue.name || optionValue;
                  const isSelected = this.selectedVariants[optionName] === value;
                  const isAvailable = optionValue.available !== false;
                  
                  return `
                    <button 
                      class="gift-guide-grid__popup-variant-option ${isSelected ? 'selected' : ''} ${!isAvailable ? 'disabled' : ''}"
                      data-option="${optionName}"
                      data-value="${value}"
                      ${!isAvailable ? 'disabled' : ''}
                    >
                      ${value}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Renders variant options using the legacy structure
   */
  renderVariantOptionsLegacy() {
    const options = this.currentProduct.options;
    const variants = this.currentProduct.variants;

    return `
      <div class="gift-guide-grid__popup-variants">
        ${options.map((option, index) => {
          const optionName = option.name;
          const optionValues = [...new Set(variants.map(v => v[`option${index + 1}`]).filter(Boolean))];
          
          return `
            <div class="gift-guide-grid__popup-variant-group">
              <label class="gift-guide-grid__popup-variant-label">${optionName}</label>
              <div class="gift-guide-grid__popup-variant-options">
                ${optionValues.map(value => {
                  const isSelected = this.selectedVariants[optionName] === value;
                  const isAvailable = this.isVariantAvailable(optionName, value);
                  
                  return `
                    <button 
                      class="gift-guide-grid__popup-variant-option ${isSelected ? 'selected' : ''} ${!isAvailable ? 'disabled' : ''}"
                      data-option="${optionName}"
                      data-value="${value}"
                      ${!isAvailable ? 'disabled' : ''}
                    >
                      ${value}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Sets up event listeners for popup interactions
   */
  setupPopupEventListeners() {
    // Variant option click handlers
    const variantOptions = this.querySelectorAll('.gift-guide-grid__popup-variant-option:not(.disabled)');
    variantOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleVariantSelection(option);
      });
    });

    // Add to cart button handler
    const addToCartBtn = this.querySelector('.gift-guide-grid__popup-add-to-cart');
    if (addToCartBtn) {
      addToCartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleAddToCart();
      });
    }
  }

  /**
   * Handles variant selection in the popup
   */
  handleVariantSelection(optionElement) {
    const optionName = optionElement.dataset.option;
    const optionValue = optionElement.dataset.value;

    // Update selected variants
    this.selectedVariants[optionName] = optionValue;

    // Update UI
    const optionGroup = optionElement.closest('.gift-guide-grid__popup-variant-group');
    optionGroup.querySelectorAll('.gift-guide-grid__popup-variant-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    optionElement.classList.add('selected');

    // Re-render popup to update price, image, and availability
    this.renderProductPopup();
  }

  /**
   * Gets the currently selected variant
   */
  getSelectedVariant() {
    if (!this.currentProduct || !this.currentProduct.variants) return null;

    return this.currentProduct.variants.find(variant => {
      // Handle new Shopify structure
      if (this.currentProduct.options_with_values && this.currentProduct.options_with_values.length > 0) {
        return this.currentProduct.options_with_values.every((option, index) => {
          const selectedValue = this.selectedVariants[option.name];
          return !selectedValue || variant[`option${index + 1}`] === selectedValue;
        });
      }
      
      // Handle legacy structure
      if (this.currentProduct.options && this.currentProduct.options.length > 0) {
        return this.currentProduct.options.every((option, index) => {
          const selectedValue = this.selectedVariants[option.name];
          return !selectedValue || variant[`option${index + 1}`] === selectedValue;
        });
      }
      
      return false;
    });
  }

  /**
   * Checks if a specific variant option combination is available
   */
  isVariantAvailable(optionName, optionValue) {
    if (!this.currentProduct || !this.currentProduct.variants) return false;

    // Handle new Shopify structure
    if (this.currentProduct.options_with_values && this.currentProduct.options_with_values.length > 0) {
      return this.currentProduct.variants.some(variant => {
        const optionIndex = this.currentProduct.options_with_values.findIndex(opt => opt.name === optionName);
        if (optionIndex === -1) return false;

        // Check if this variant has the selected option value
        const variantOptionValue = variant[`option${optionIndex + 1}`];
        if (variantOptionValue !== optionValue) return false;

        // Check if all other selected options match
        return this.currentProduct.options_with_values.every((option, index) => {
          if (option.name === optionName) return true; // Skip the option we're checking
          const selectedValue = this.selectedVariants[option.name];
          return !selectedValue || variant[`option${index + 1}`] === selectedValue;
        });
      });
    }
    
    // Handle legacy structure
    if (this.currentProduct.options && this.currentProduct.options.length > 0) {
      return this.currentProduct.variants.some(variant => {
        const optionIndex = this.currentProduct.options.findIndex(opt => opt.name === optionName);
        if (optionIndex === -1) return false;

        // Check if this variant has the selected option value
        const variantOptionValue = variant[`option${optionIndex + 1}`];
        if (variantOptionValue !== optionValue) return false;

        // Check if all other selected options match
        return this.currentProduct.options.every((option, index) => {
          if (option.name === optionName) return true; // Skip the option we're checking
          const selectedValue = this.selectedVariants[option.name];
          return !selectedValue || variant[`option${index + 1}`] === selectedValue;
        });
      });
    }

    return false;
  }

  /**
   * Handles adding product to cart
   */
  async handleAddToCart() {
    const selectedVariant = this.getSelectedVariant();
    if (!selectedVariant || !selectedVariant.available) return;

    try {
      // Add the selected product to cart
      await this.addToCart(selectedVariant.id, 1);

      // Check if we need to auto-add the Dark Winter Jacket
      if (this.shouldAutoAddDarkWinterJacket(selectedVariant)) {
        await this.addDarkWinterJacketToCart();
      }

      this.closePopup();
      this.showSuccessMessage('Product added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      this.showErrorMessage('Failed to add product to cart');
    }
  }

  /**
   * Checks if the Dark Winter Jacket should be auto-added
   */
  shouldAutoAddDarkWinterJacket(variant) {
    // Check if the variant has "Black" and "Medium" options
    // Check all option values for both "Black" and "Medium" (case insensitive)
    const allOptions = [variant.option1, variant.option2, variant.option3].filter(Boolean);
    
    const hasBlack = allOptions.some(option => 
      option && option.toLowerCase().includes('black')
    );
    const hasMedium = allOptions.some(option => 
      option && (option.toLowerCase().includes('medium') || option.toLowerCase() === 'm')
    );
    
    return hasBlack && hasMedium;
  }

  /**
   * Adds the Dark Winter Jacket to cart
   */
  async addDarkWinterJacketToCart() {
    try {
      // Use the specific variant ID from the URL
      const darkWinterJacketVariantId = 52160865337711;
      
      await this.addToCart(darkWinterJacketVariantId, 1);
      this.showSuccessMessage('Dark Winter Jacket automatically added to cart!');
    } catch (error) {
      console.error('Error adding Dark Winter Jacket to cart:', error);
    }
  }

  /**
   * Adds a product to the cart using Shopify's AJAX API
   */
  async addToCart(variantId, quantity) {
    const formData = {
      id: variantId,
      quantity: quantity
    };

    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.description || `Failed to add to cart: ${response.status}`);
      }

      const result = await response.json();
      
      // Update cart count and trigger cart update events
      this.updateCartCount();
      this.triggerCartUpdate();
      
      return result;
    } catch (error) {
      console.error('Add to cart error:', error);
      throw error;
    }
  }

  /**
   * Updates cart count in the header
   */
  updateCartCount() {
    // Find cart icon and update count
    const cartIcon = document.querySelector('.cart-icon-bubble');
    if (cartIcon) {
      // Fetch current cart to get item count
      fetch('/cart.js')
        .then(response => response.json())
        .then(cart => {
          const count = cart.item_count || 0;
          cartIcon.textContent = count;
          cartIcon.style.display = count > 0 ? 'block' : 'none';
        })
        .catch(error => {
          console.warn('Could not update cart count:', error);
        });
    }
  }

  /**
   * Triggers cart update events for other components
   */
  triggerCartUpdate() {
    // Fetch current cart to get updated data
    fetch('/cart.js')
      .then(response => response.json())
      .then(cart => {
        // Dispatch proper cart update event
        const cartUpdateEvent = new CartUpdateEvent(cart, this.id, {
          source: 'gift-guide-grid',
          itemCount: cart.item_count
        });
        document.dispatchEvent(cartUpdateEvent);
      })
      .catch(error => {
        console.warn('Could not fetch cart for update event:', error);
      });
  }



  /**
   * Opens the popup
   */
  openPopup() {
    if (this.refs.popupOverlay) {
      this.refs.popupOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Closes the popup
   */
  closePopup() {
    if (this.refs.popupOverlay) {
      this.refs.popupOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  /**
   * Checks if popup is currently open
   */
  isPopupOpen() {
    return this.refs.popupOverlay?.classList.contains('active') || false;
  }

  /**
   * Formats price for display
   */
  formatPrice(price) {
    if (!price) return '';
    
    // Handle different price formats
    const priceValue = typeof price === 'string' ? parseFloat(price) : price;
    const priceInCents = priceValue > 1000 ? priceValue : priceValue * 100; // Assume it's already in cents if > 1000
    
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(priceInCents / 100);
    } catch (error) {
      // Fallback formatting
      return `$${(priceInCents / 100).toFixed(2)}`;
    }
  }

  /**
   * Strips HTML tags from text
   */
  stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  /**
   * Shows a success message
   */
  showSuccessMessage(message) {
    // Create a toast notification
    const toast = document.createElement('div');
    toast.className = 'gift-guide-toast gift-guide-toast--success';
    toast.innerHTML = `
      <div class="gift-guide-toast__content">
        <span class="gift-guide-toast__icon">✓</span>
        <span class="gift-guide-toast__message">${message}</span>
      </div>
    `;
    
    // Add styles
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      max-width: 300px;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Shows an error message
   */
  showErrorMessage(message) {
    // Create a toast notification
    const toast = document.createElement('div');
    toast.className = 'gift-guide-toast gift-guide-toast--error';
    toast.innerHTML = `
      <div class="gift-guide-toast__content">
        <span class="gift-guide-toast__icon">✕</span>
        <span class="gift-guide-toast__message">${message}</span>
      </div>
    `;
    
    // Add styles
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      max-width: 300px;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }
}

// Register the custom element
customElements.define('gift-guide-grid-component', GiftGuideGridComponent); 