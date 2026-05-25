/**
 * Bitmind v7 Buy Bitminer Component
 * Handles product display and purchase flow for Bitminer devices
 */

class BitmindBuyBitminer {
    constructor() {
        this.ready = Promise.resolve(this.initialize());
        this.buyModal = null;
        this.paymentModal = null;
        this.isProcessing = false;
    }

    async initialize() {
        console.log('[BuyBitminer] Initializing buy bitminer component...');
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // Small delay to ensure all elements are loaded
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Setup modal elements
        this.setupElements();
        
        // Bind events
        this.bindEvents();
        
        console.log('[BuyBitminer] Buy bitminer component ready');
    }

    setupElements() {
        // Buy Bitminer modal elements
        this.buyModal = document.getElementById('buyBitminerModal');
        this.paymentModal = document.getElementById('paymentModal');
        this.buyBtn = document.getElementById('buyBitminerBtn');
        this.closeBuyBtn = document.getElementById('closeBuyModalBtn');
        this.cancelBuyBtn = document.getElementById('cancelBuyBtn');
        this.buyNowBtn = document.getElementById('buyNowBtn');
        
        // Debug: Check if elements are found
        console.log('🛒 DEBUG: Buy Bitminer elements found:');
        console.log('🛒 DEBUG: - buyModal:', this.buyModal);
        console.log('🛒 DEBUG: - buyBtn:', this.buyBtn);
        console.log('🛒 DEBUG: - paymentModal:', this.paymentModal);
        
        // Payment modal elements
        this.closePaymentModalBtn = document.getElementById('closePaymentModalBtn');
        this.closePaymentBtn = document.getElementById('closePaymentBtn');
        
        // UI elements
        this.buySpinner = document.getElementById('buySpinner');
        this.buyBtnText = document.getElementById('buyBtnText');
        
        // Newsletter elements
        this.newsletterInput = document.querySelector('.newsletter-input');
        this.newsletterBtn = document.querySelector('.newsletter-btn');
    }

    bindEvents() {
        // Buy Bitminer modal controls
        this.buyBtn.addEventListener('click', () => {
            console.log('🛒 DEBUG: Buy Bitminer button clicked!');
            this.openBuyModal();
        });
        this.closeBuyBtn.addEventListener('click', () => this.closeBuyModal());
        this.cancelBuyBtn.addEventListener('click', () => this.closeBuyModal());
        this.buyNowBtn.addEventListener('click', () => this.handleBuyNow());
        
        // Payment modal controls
        this.closePaymentModalBtn.addEventListener('click', () => this.closePaymentModal());
        this.closePaymentBtn.addEventListener('click', () => this.closePaymentModal());
        
        // Newsletter signup
        if (this.newsletterBtn && this.newsletterInput) {
            this.newsletterBtn.addEventListener('click', () => this.handleNewsletterSignup());
            this.newsletterInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleNewsletterSignup();
                }
            });
        }
        
        // Close modals on overlay click
        this.buyModal.addEventListener('click', (e) => {
            if (e.target === this.buyModal) {
                this.closeBuyModal();
            }
        });
        
        this.paymentModal.addEventListener('click', (e) => {
            if (e.target === this.paymentModal) {
                this.closePaymentModal();
            }
        });
        
        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.buyModal.classList.contains('open')) {
                    this.closeBuyModal();
                } else if (this.paymentModal.classList.contains('open')) {
                    this.closePaymentModal();
                }
            }
        });
    }

    openBuyModal() {
        console.log('🛒 DEBUG: Opening Buy Bitminer modal...');
        console.log('🛒 DEBUG: Modal element:', this.buyModal);
        console.log('🛒 DEBUG: Modal classes before:', this.buyModal.className);
        
        this.buyModal.classList.add('open');
        this.buyModal.classList.remove('hidden');
        
        console.log('🛒 DEBUG: Modal classes after:', this.buyModal.className);
        
        // Add entrance animation
        setTimeout(() => {
            this.buyModal.querySelector('.modal-content').classList.add('animate-in');
        }, 10);
    }

    closeBuyModal() {
        this.buyModal.classList.remove('open');
        setTimeout(() => {
            this.buyModal.classList.add('hidden');
            this.buyModal.querySelector('.modal-content').classList.remove('animate-in');
        }, 300);
    }

    openPaymentModal() {
        this.closeBuyModal();
        
        setTimeout(() => {
            this.paymentModal.classList.add('open');
            this.paymentModal.classList.remove('hidden');
            
            // Add entrance animation
            setTimeout(() => {
                this.paymentModal.querySelector('.modal-content').classList.add('animate-in');
            }, 10);
        }, 350);
    }

    closePaymentModal() {
        this.paymentModal.classList.remove('open');
        setTimeout(() => {
            this.paymentModal.classList.add('hidden');
            this.paymentModal.querySelector('.modal-content').classList.remove('animate-in');
        }, 300);
    }

    async handleBuyNow() {
        if (this.isProcessing) {
            return;
        }
        
        this.isProcessing = true;
        this.setLoadingState(true);
        
        try {
            // Simulate processing delay for UX
            await this.delay(1500);
            
            // Show payment coming soon modal
            this.openPaymentModal();
            
            console.log('[BuyBitminer] Buy Now clicked - showing payment modal');
            
        } catch (error) {
            console.error('[BuyBitminer] Error in buy flow:', error);
            this.showErrorNotification('Something went wrong. Please try again.');
        } finally {
            this.isProcessing = false;
            this.setLoadingState(false);
        }
    }

    handleNewsletterSignup() {
        const email = this.newsletterInput.value.trim();
        
        if (!email) {
            this.showErrorNotification('Please enter your email address');
            return;
        }
        
        if (!this.isValidEmail(email)) {
            this.showErrorNotification('Please enter a valid email address');
            return;
        }
        
        // Simulate newsletter signup
        this.newsletterBtn.disabled = true;
        this.newsletterBtn.textContent = 'Signing up...';
        
        setTimeout(() => {
            // Show success
            this.newsletterBtn.textContent = '✓ Subscribed!';
            this.newsletterBtn.classList.add('success');
            
            // Clear input
            this.newsletterInput.value = '';
            
            // Reset after delay
            setTimeout(() => {
                this.newsletterBtn.disabled = false;
                this.newsletterBtn.textContent = 'Notify Me';
                this.newsletterBtn.classList.remove('success');
            }, 2000);
            
            console.log('[BuyBitminer] Newsletter signup:', email);
        }, 1000);
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    setLoadingState(loading) {
        if (loading) {
            this.buySpinner.classList.remove('hidden');
            this.buyBtnText.textContent = 'Processing...';
            this.buyNowBtn.disabled = true;
        } else {
            this.buySpinner.classList.add('hidden');
            this.buyBtnText.textContent = 'Buy Now';
            this.buyNowBtn.disabled = false;
        }
    }

    showErrorNotification(message) {
        // Use existing notification system
        if (window.bitmindApp && window.bitmindApp.components.connectMiner) {
            window.bitmindApp.components.connectMiner.showErrorNotification(message);
        } else {
            // Fallback notification
            console.error('[BuyBitminer] Error:', message);
            alert(message);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public methods
    isBuyModalOpen() {
        return this.buyModal.classList.contains('open');
    }

    isPaymentModalOpen() {
        return this.paymentModal.classList.contains('open');
    }

    // Analytics and tracking (future-ready)
    trackView() {
        console.log('[BuyBitminer] Product page viewed');
        // Future: Add analytics tracking
    }

    trackAddToCart() {
        console.log('[BuyBitminer] Add to cart tracked');
        // Future: Add analytics tracking
    }

    trackPurchase() {
        console.log('[BuyBitminer] Purchase initiated');
        // Future: Add analytics tracking
    }

    destroy() {
        // Remove event listeners
        this.buyBtn.removeEventListener('click', this.openBuyModal);
        this.closeBuyBtn.removeEventListener('click', this.closeBuyModal);
        this.cancelBuyBtn.removeEventListener('click', this.closeBuyModal);
        this.buyNowBtn.removeEventListener('click', this.handleBuyNow);
        this.closePaymentModalBtn.removeEventListener('click', this.closePaymentModal);
        this.closePaymentBtn.removeEventListener('click', this.closePaymentModal);
        
        if (this.newsletterBtn) {
            this.newsletterBtn.removeEventListener('click', this.handleNewsletterSignup);
        }
        
        if (this.newsletterInput) {
            this.newsletterInput.removeEventListener('keypress', this.handleNewsletterSignup);
        }
    }
}

// Export for use in main app
window.BitmindBuyBitminer = BitmindBuyBitminer;
