/**
 * Bitmind v7 Connect Miner Component
 * Handles miner registration modal and API integration
 */

class BitmindConnectMiner {
    constructor() {
        this.ready = Promise.resolve(this.initialize());
        this.modal = null;
        this.form = null;
        this.isSubmitting = false;
        this.currentMinerId = null;
        this.devicePollingInterval = null;
    }

    async initialize() {
        console.log('[ConnectMiner] Initializing connect miner component...');
        
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
        
        // Generate initial miner ID
        this.generateMinerId();
        
        // Detect user's IP for stratum host
        this.detectStratumHost();
        
        // Start device polling
        this.startDevicePolling();
        
        console.log('[ConnectMiner] Connect miner component ready');
    }

    setupElements() {
        // Modal elements
        this.modal = document.getElementById('connectMinerModal');
        this.form = document.getElementById('minerRegistrationForm');
        this.connectBtn = document.getElementById('connectMinerBtn');
        this.closeBtn = document.getElementById('closeModalBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.registerBtn = document.getElementById('registerBtn');
        
        // Debug: Check if elements are found
        console.log('🔧 DEBUG: Connect Miner elements found:');
        console.log('🔧 DEBUG: - modal:', this.modal);
        console.log('🔧 DEBUG: - connectBtn:', this.connectBtn);
        console.log('🔧 DEBUG: - form:', this.form);
        
        // Form elements
        this.minerNameInput = document.getElementById('minerName');
        this.walletAddressInput = document.getElementById('walletAddress');
        this.workerNameInput = document.getElementById('workerName');
        this.generatedIdSpan = document.getElementById('generatedMinerId');
        this.regenerateBtn = document.getElementById('regenerateIdBtn');
        this.stratumHostSpan = document.getElementById('stratumHost');
        
        // UI elements
        this.registerSpinner = document.getElementById('registerSpinner');
        this.registerBtnText = document.getElementById('registerBtnText');
        this.successNotification = document.getElementById('successNotification');
        this.notificationMessage = document.getElementById('notificationMessage');
    }

    bindEvents() {
        // Modal controls
        this.connectBtn.addEventListener('click', () => {
            console.log('🔧 DEBUG: Connect Miner button clicked!');
            this.openModal();
        });
        this.closeBtn.addEventListener('click', () => this.closeModal());
        this.cancelBtn.addEventListener('click', () => this.closeModal());
        
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Regenerate ID
        this.regenerateBtn.addEventListener('click', () => this.generateMinerId());
        
        // Close modal on overlay click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('open')) {
                this.closeModal();
            }
        });
        
        // Form validation
        this.minerNameInput.addEventListener('input', () => this.validateForm());
        this.walletAddressInput.addEventListener('input', () => this.validateForm());
    }

    openModal() {
        console.log('🔧 DEBUG: Opening Connect Miner modal...');
        console.log('🔧 DEBUG: Modal element:', this.modal);
        console.log('🔧 DEBUG: Modal classes before:', this.modal.className);
        
        this.modal.classList.add('open');
        this.modal.classList.remove('hidden');
        
        console.log('🔧 DEBUG: Modal classes after:', this.modal.className);
        
        this.minerNameInput.focus();
        
        // Generate new ID for each modal open
        this.generateMinerId();
        
        // Reset form
        this.form.reset();
        this.validateForm();
    }

    closeModal() {
        this.modal.classList.remove('open');
        setTimeout(() => {
            this.modal.classList.add('hidden');
        }, 300);
    }

    generateMinerId() {
        // Generate UUID v4
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        
        this.currentMinerId = `miner-${uuid.substring(0, 8)}`;
        this.generatedIdSpan.textContent = this.currentMinerId;
        
        // Add animation
        this.generatedIdSpan.classList.add('regenerating');
        setTimeout(() => {
            this.generatedIdSpan.classList.remove('regenerating');
        }, 300);
    }

    async detectStratumHost() {
        try {
            // Try to get user's local IP
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            this.stratumHostSpan.textContent = data.ip;
        } catch (error) {
            // Fallback to localhost
            this.stratumHostSpan.textContent = 'localhost';
        }
    }

    validateForm() {
        const minerName = this.minerNameInput.value.trim();
        const walletAddress = this.walletAddressInput.value.trim();
        
        const isValid = minerName.length > 0 && walletAddress.length > 0;
        this.registerBtn.disabled = !isValid || this.isSubmitting;
        
        return isValid;
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm() || this.isSubmitting) {
            return;
        }
        
        this.isSubmitting = true;
        this.setLoadingState(true);
        
        try {
            const formData = {
                id: this.currentMinerId,
                name: this.minerNameInput.value.trim(),
                wallet: this.walletAddressInput.value.trim(),
                worker: this.workerNameInput.value.trim() || null
            };
            
            console.log('[ConnectMiner] Registering miner:', formData);
            
            // Call backend API
            const response = await fetch('http://localhost:3001/device/register/miner', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                throw new Error(`Registration failed: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('[ConnectMiner] Registration successful:', result);
            
            // Show success notification
            this.showSuccessNotification('Miner registered successfully!');
            
            // Close modal
            this.closeModal();
            
            // Refresh device list
            await this.refreshDeviceList();
            
        } catch (error) {
            console.error('[ConnectMiner] Registration failed:', error);
            this.showErrorNotification('Failed to register miner. Please try again.');
        } finally {
            this.isSubmitting = false;
            this.setLoadingState(false);
        }
    }

    setLoadingState(loading) {
        if (loading) {
            this.registerSpinner.classList.remove('hidden');
            this.registerBtnText.textContent = 'Registering...';
            this.registerBtn.disabled = true;
        } else {
            this.registerSpinner.classList.add('hidden');
            this.registerBtnText.textContent = 'Register Miner';
            this.validateForm();
        }
    }

    showSuccessNotification(message) {
        this.notificationMessage.textContent = message;
        this.successNotification.classList.add('show');
        
        setTimeout(() => {
            this.successNotification.classList.remove('show');
        }, 3000);
    }

    showErrorNotification(message) {
        this.notificationMessage.textContent = message;
        this.successNotification.classList.add('show', 'error');
        
        setTimeout(() => {
            this.successNotification.classList.remove('show', 'error');
        }, 3000);
    }

    async refreshDeviceList() {
        try {
            const response = await fetch('http://localhost:3001/mining/devices');
            if (response.ok) {
                const data = await response.json();
                console.log('[ConnectMiner] Device list refreshed:', data);
                
                // Update device network component if available
                if (window.bitmindApp && window.bitmindApp.components.devices) {
                    window.bitmindApp.components.devices.updateDeviceList(data.devices);
                }
            }
        } catch (error) {
            console.error('[ConnectMiner] Failed to refresh device list:', error);
        }
    }

    startDevicePolling() {
        // Poll devices every 5 seconds
        this.devicePollingInterval = setInterval(async () => {
            await this.refreshDeviceList();
        }, 5000);
    }

    stopDevicePolling() {
        if (this.devicePollingInterval) {
            clearInterval(this.devicePollingInterval);
            this.devicePollingInterval = null;
        }
    }

    // Public methods
    getCurrentMinerId() {
        return this.currentMinerId;
    }

    isModalOpen() {
        return this.modal.classList.contains('open');
    }

    destroy() {
        this.stopDevicePolling();
        
        // Remove event listeners
        this.connectBtn.removeEventListener('click', this.openModal);
        this.closeBtn.removeEventListener('click', this.closeModal);
        this.cancelBtn.removeEventListener('click', this.closeModal);
        this.form.removeEventListener('submit', this.handleFormSubmit);
        this.regenerateBtn.removeEventListener('click', this.generateMinerId);
    }
}

// Export for use in main app
window.BitmindConnectMiner = BitmindConnectMiner;
