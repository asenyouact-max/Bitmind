/**
 * Bitmind v7 Animations Component
 * Event-driven UI animations for the mining control room
 */

class BitmindAnimations {
    constructor() {
        this.ready = Promise.resolve(this.initialize());
        this.activeAnimations = new Map();
        this.animationQueue = [];
        this.isProcessing = false;
    }

    async initialize() {
        console.log('[Animations] Initializing animations component...');
        
        // Setup CSS animations
        this.setupCSSAnimations();
        
        // Bind animation events
        this.bindEvents();
        
        console.log('[Animations] Animations component ready');
    }

    setupCSSAnimations() {
        // Add custom CSS animations if not already present
        if (!document.getElementById('bitmind-animations')) {
            const style = document.createElement('style');
            style.id = 'bitmind-animations';
            style.textContent = `
                @keyframes pulse-glow {
                    0% { box-shadow: 0 0 5px currentColor; }
                    50% { box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
                    100% { box-shadow: 0 0 5px currentColor; }
                }
                
                @keyframes slide-in-right {
                    0% { transform: translateX(100%); opacity: 0; }
                    100% { transform: translateX(0); opacity: 1; }
                }
                
                @keyframes slide-in-top {
                    0% { transform: translateY(-100%); opacity: 0; }
                    100% { transform: translateY(0); opacity: 1; }
                }
                
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                
                @keyframes flash-green {
                    0%, 100% { background-color: transparent; }
                    50% { background-color: rgba(0, 255, 0, 0.3); }
                }
                
                @keyframes flash-red {
                    0%, 100% { background-color: transparent; }
                    50% { background-color: rgba(255, 51, 51, 0.3); }
                }
                
                @keyframes flash-blue {
                    0%, 100% { background-color: transparent; }
                    50% { background-color: rgba(0, 170, 255, 0.3); }
                }
                
                @keyframes flash-yellow {
                    0%, 100% { background-color: transparent; }
                    50% { background-color: rgba(255, 170, 0, 0.3); }
                }
                
                @keyframes ripple {
                    0% { transform: scale(0); opacity: 1; }
                    100% { transform: scale(4); opacity: 0; }
                }
                
                @keyframes notification-slide {
                    0% { transform: translateY(-20px); opacity: 0; }
                    10% { transform: translateY(0); opacity: 1; }
                    90% { transform: translateY(0); opacity: 1; }
                    100% { transform: translateY(-20px); opacity: 0; }
                }
                
                .animating {
                    pointer-events: none;
                }
                
                .pulse-glow {
                    animation: pulse-glow 1s ease-in-out;
                }
                
                .slide-in-right {
                    animation: slide-in-right 0.5s ease-out;
                }
                
                .slide-in-top {
                    animation: slide-in-top 0.5s ease-out;
                }
                
                .shake {
                    animation: shake 0.5s ease-in-out;
                }
                
                .flash-green {
                    animation: flash-green 0.6s ease-in-out;
                }
                
                .flash-red {
                    animation: flash-red 0.6s ease-in-out;
                }
                
                .flash-blue {
                    animation: flash-blue 0.6s ease-in-out;
                }
                
                .flash-yellow {
                    animation: flash-yellow 0.6s ease-in-out;
                }
                
                .ripple-effect {
                    position: relative;
                    overflow: hidden;
                }
                
                .ripple-effect::before {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 0;
                    height: 0;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.5);
                    transform: translate(-50%, -50%);
                    animation: ripple 0.6s ease-out;
                }
                
                .notification-toast {
                    animation: notification-slide 2s ease-in-out;
                }
            `;
            document.head.appendChild(style);
        }
    }

    bindEvents() {
        // Listen for state changes to trigger animations
        if (window.bitmindState) {
            window.bitmindState.subscribe('ui.animations', (animations) => {
                Object.keys(animations).forEach(animationType => {
                    if (animations[animationType]) {
                        this.trigger(animationType);
                    }
                });
            });
        }
    }

    trigger(animationType, options = {}) {
        const animation = this.getAnimationConfig(animationType);
        if (!animation) {
            console.warn(`[Animations] Unknown animation type: ${animationType}`);
            return;
        }

        // Queue animation if processing
        if (this.isProcessing) {
            this.animationQueue.push({ type: animationType, options });
            return;
        }

        this.executeAnimation(animation, options);
    }

    getAnimationConfig(type) {
        const animations = {
            jobUpdate: {
                targets: ['.mining-job', '.job-id'],
                className: 'flash-blue',
                duration: 1000,
                sound: 'job_update'
            },
            blockUpdate: {
                targets: ['.system-overview', '.block-height'],
                className: 'flash-yellow',
                duration: 800,
                sound: 'block_update',
                ripple: true
            },
            shareAccepted: {
                targets: null, // Will be determined by device
                className: 'flash-green',
                duration: 600,
                sound: 'share_accepted',
                particle: true
            },
            shareRejected: {
                targets: null, // Will be determined by device
                className: 'flash-red',
                duration: 600,
                sound: 'share_rejected',
                shake: true
            },
            deviceOnline: {
                targets: null, // Will be determined by device
                className: 'slide-in-right',
                duration: 500,
                sound: 'device_online'
            },
            deviceOffline: {
                targets: null, // Will be determined by device
                className: 'slide-in-right',
                duration: 500,
                sound: 'device_offline'
            },
            connectionLost: {
                targets: ['.connection-status'],
                className: 'flash-red',
                duration: 1000,
                sound: 'connection_lost'
            },
            connectionRestored: {
                targets: ['.connection-status'],
                className: 'flash-green',
                duration: 1000,
                sound: 'connection_restored'
            },
            systemError: {
                targets: ['.control-room'],
                className: 'shake',
                duration: 500,
                sound: 'system_error'
            }
        };

        return animations[type];
    }

    executeAnimation(animation, options) {
        this.isProcessing = true;

        try {
            // Determine targets
            const targets = this.resolveTargets(animation.targets, options);
            
            // Apply animation to targets
            targets.forEach(target => {
                this.applyAnimation(target, animation, options);
            });
            
            // Create ripple effect if specified
            if (animation.ripple && options.event) {
                this.createRippleEffect(options.event);
            }
            
            // Create particle effect if specified
            if (animation.particle && options.event) {
                this.createParticleEffect(options.event);
            }
            
            // Play sound if specified
            if (animation.sound) {
                this.playSound(animation.sound);
            }
            
            // Show notification if specified
            if (options.notification) {
                this.showNotification(options.notification);
            }
            
        } catch (error) {
            console.error('[Animations] Error executing animation:', error);
        } finally {
            // Mark as complete after duration
            setTimeout(() => {
                this.isProcessing = false;
                this.processQueue();
            }, animation.duration);
        }
    }

    resolveTargets(targets, options) {
        if (options.deviceId) {
            // Device-specific animation
            const deviceNode = document.getElementById(`device-${options.deviceId}`);
            return deviceNode ? [deviceNode] : [];
        }
        
        if (options.element) {
            return [options.element];
        }
        
        if (targets) {
            return document.querySelectorAll(targets.join(', '));
        }
        
        return [];
    }

    applyAnimation(target, animation, options) {
        // Add animation class
        target.classList.add('animating', animation.className);
        
        // Add shake effect if specified
        if (animation.shake) {
            target.classList.add('shake');
        }
        
        // Add pulse glow effect
        if (animation.pulse) {
            target.classList.add('pulse-glow');
        }
        
        // Remove animation classes after duration
        setTimeout(() => {
            target.classList.remove('animating', animation.className, 'shake', 'pulse-glow');
        }, animation.duration);
        
        // Track active animation
        const animationId = Date.now() + Math.random();
        this.activeAnimations.set(animationId, {
            target,
            animation,
            startTime: Date.now()
        });
        
        // Clean up after animation
        setTimeout(() => {
            this.activeAnimations.delete(animationId);
        }, animation.duration);
    }

    createRippleEffect(event) {
        const target = event.target.closest('.panel');
        if (!target) return;
        
        target.classList.add('ripple-effect');
        
        setTimeout(() => {
            target.classList.remove('ripple-effect');
        }, 600);
    }

    createParticleEffect(event) {
        const target = event.target.closest('.device-node');
        if (!target) return;
        
        // Create particle elements
        for (let i = 0; i < 5; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.cssText = `
                position: absolute;
                width: 4px;
                height: 4px;
                background: ${event.type === 'share_accepted' ? '#00ff00' : '#ff3333'};
                border-radius: 50%;
                pointer-events: none;
                animation: particle-float 1s ease-out forwards;
            `;
            
            target.appendChild(particle);
            
            setTimeout(() => {
                particle.remove();
            }, 1000);
        }
        
        // Add particle animation CSS if not present
        if (!document.getElementById('particle-animations')) {
            const style = document.createElement('style');
            style.id = 'particle-animations';
            style.textContent = `
                @keyframes particle-float {
                    0% {
                        transform: translate(0, 0);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(${Math.random() * 40 - 20}px, -20px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    playSound(soundName) {
        // Create simple sound effects using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Configure sound based on type
            const soundConfig = this.getSoundConfig(soundName);
            oscillator.frequency.value = soundConfig.frequency;
            oscillator.type = soundConfig.type;
            
            gainNode.gain.setValueAtTime(soundConfig.volume, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            
        } catch (error) {
            console.warn('[Animations] Failed to play sound:', error);
        }
    }

    getSoundConfig(soundName) {
        const sounds = {
            job_update: { frequency: 800, type: 'sine', volume: 0.1 },
            block_update: { frequency: 600, type: 'square', volume: 0.1 },
            share_accepted: { frequency: 1200, type: 'sine', volume: 0.1 },
            share_rejected: { frequency: 300, type: 'sawtooth', volume: 0.1 },
            device_online: { frequency: 1000, type: 'sine', volume: 0.1 },
            device_offline: { frequency: 400, type: 'square', volume: 0.1 },
            connection_lost: { frequency: 200, type: 'sawtooth', volume: 0.2 },
            connection_restored: { frequency: 1000, type: 'sine', volume: 0.1 },
            system_error: { frequency: 150, type: 'square', volume: 0.3 }
        };
        
        return sounds[soundName] || { frequency: 440, type: 'sine', volume: 0.1 };
    }

    showNotification(options) {
        const notification = document.createElement('div');
        notification.className = 'notification-toast';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${options.icon || '📢'}</div>
                <div class="notification-message">${options.message}</div>
            </div>
        `;
        
        // Position notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid #00ff00;
            border-radius: 4px;
            padding: 12px 16px;
            color: #00ff00;
            font-family: monospace;
            font-size: 14px;
            z-index: 10000;
            backdrop-filter: blur(10px);
        `;
        
        document.body.appendChild(notification);
        
        // Remove after animation
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }

    processQueue() {
        if (this.animationQueue.length > 0) {
            const next = this.animationQueue.shift();
            this.trigger(next.type, next.options);
        }
    }

    // Custom animation methods
    animateValue(element, start, end, duration = 1000) {
        const startTime = Date.now();
        
        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const value = start + (end - start) * this.easeOutQuad(progress);
            element.textContent = Math.round(value);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    easeOutQuad(t) {
        return t * (2 - t);
    }

    // Get active animations
    getActiveAnimations() {
        return Array.from(this.activeAnimations.values());
    }

    // Clear all animations
    clearAnimations() {
        // Remove all animation classes
        document.querySelectorAll('.animating').forEach(element => {
            element.classList.remove('animating');
        });
        
        // Clear active animations
        this.activeAnimations.clear();
        
        // Clear queue
        this.animationQueue = [];
        
        this.isProcessing = false;
    }
}

// Export for use in main app
window.BitmindAnimations = BitmindAnimations;
