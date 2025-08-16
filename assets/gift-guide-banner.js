import { Component } from './component.js';

/**
 * Gift Guide Banner Component
 * Handles the banner section with animated buttons and interactions
 */
class GiftGuideBannerComponent extends Component {
  constructor() {
    super();
    this.requiredRefs = ['chooseGiftBtn', 'shopNowBtn'];
  }

  connectedCallback() {
    super.connectedCallback();
    this.setupEventListeners();
  }

  /**
   * Sets up event listeners for button interactions
   */
  setupEventListeners() {
    // Choose Gift button click handler
    if (this.refs.chooseGiftBtn) {
      this.refs.chooseGiftBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleChooseGiftClick();
      });
    }

    // Shop Now button click handler
    if (this.refs.shopNowBtn) {
      this.refs.shopNowBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleShopNowClick();
      });
    }
  }

  /**
   * Handles the Choose Gift button click
   * Scrolls to the product grid section
   */
  handleChooseGiftClick() {
    const productGrid = document.querySelector('.gift-guide-grid');
    if (productGrid) {
      productGrid.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  /**
   * Handles the Shop Now button click
   * Navigates to the shop page or triggers a custom action
   */
  handleShopNowClick() {
    // You can customize this to navigate to a specific collection or page
    const shopUrl = '/collections/all';
    window.location.href = shopUrl;
  }
}

// Register the custom element
customElements.define('gift-guide-banner-component', GiftGuideBannerComponent); 