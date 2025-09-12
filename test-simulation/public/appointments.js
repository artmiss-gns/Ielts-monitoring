/**
 * IELTS Test Simulation - Client-side Appointment Management
 * 
 * This script handles dynamic appointment rendering, polling for updates,
 * and DOM manipulation for the test simulation server.
 * 
 * Requirements implemented:
 * - 2.2: Dynamic appointment updates when triggered
 * - 2.3: Real-time detection of appointment changes
 * - 5.4: Persistent changes until manually modified
 */

class AppointmentManager {
    constructor() {
        this.appointments = [];
        this.isPolling = false;
        this.pollInterval = null;
        this.lastUpdateTime = null;
        this.errorCount = 0;
        this.maxRetries = 3;
        
        // DOM elements
        this.appointmentsContainer = null;
        this.noAppointmentsElement = null;
        this.updateTimeElement = null;
        this.refreshButton = null;
        
        // Configuration
        this.config = {
            pollIntervalMs: 5000, // Poll every 5 seconds
            retryDelayMs: 2000,   // Wait 2 seconds before retry
            maxRetries: 3,        // Maximum retry attempts
            apiEndpoint: '/api/appointments'
        };
        
        this.init();
    }
    
    /**
     * Initialize the appointment manager
     */
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupDOM());
        } else {
            this.setupDOM();
        }
    }
    
    /**
     * Set up DOM elements and event listeners
     */
    setupDOM() {
        // Get DOM elements
        this.appointmentsContainer = document.getElementById('appointments-container');
        this.noAppointmentsElement = document.getElementById('no-appointments');
        this.updateTimeElement = document.getElementById('update-time');
        this.refreshButton = document.getElementById('refresh-btn');
        
        if (!this.appointmentsContainer) {
            console.error('Appointments container not found');
            return;
        }
        
        // Set up event listeners
        if (this.refreshButton) {
            this.refreshButton.addEventListener('click', () => this.fetchAppointments(true));
        }
        
        // Set up filter functionality
        this.setupFilters();
        
        // Initial load
        this.fetchAppointments(true);
        
        // Start polling
        this.startPolling();
        
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopPolling();
            } else {
                this.startPolling();
                this.fetchAppointments();
            }
        });
        
        // Handle window focus/blur
        window.addEventListener('focus', () => {
            this.fetchAppointments();
        });
    }
    
    /**
     * Set up filter functionality
     */
    setupFilters() {
        const cityFilter = document.getElementById('city-filter');
        const examTypeFilter = document.getElementById('exam-type-filter');
        const filterButton = document.getElementById('filter-btn');
        
        if (filterButton) {
            filterButton.addEventListener('click', () => {
                this.applyFilters();
            });
        }
        
        // Auto-apply filters on change
        if (cityFilter) {
            cityFilter.addEventListener('change', () => this.applyFilters());
        }
        
        if (examTypeFilter) {
            examTypeFilter.addEventListener('change', () => this.applyFilters());
        }
    }
    
    /**
     * Apply current filter settings to displayed appointments
     */
    applyFilters() {
        const cityFilter = document.getElementById('city-filter');
        const examTypeFilter = document.getElementById('exam-type-filter');
        
        const selectedCity = cityFilter ? cityFilter.value.toLowerCase() : '';
        const selectedExamType = examTypeFilter ? examTypeFilter.value.toLowerCase() : '';
        
        const filteredAppointments = this.appointments.filter(appointment => {
            const cityMatch = !selectedCity || appointment.city.toLowerCase().includes(selectedCity);
            const examTypeMatch = !selectedExamType || appointment.examType.toLowerCase().includes(selectedExamType);
            
            return cityMatch && examTypeMatch;
        });
        
        this.renderAppointments(filteredAppointments);
    }
    
    /**
     * Start polling for appointment updates
     */
    startPolling() {
        if (this.isPolling) return;
        
        this.isPolling = true;
        this.pollInterval = setInterval(() => {
            this.fetchAppointments();
        }, this.config.pollIntervalMs);
        
        console.log('Started polling for appointment updates');
    }
    
    /**
     * Stop polling for appointment updates
     */
    stopPolling() {
        if (!this.isPolling) return;
        
        this.isPolling = false;
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        
        console.log('Stopped polling for appointment updates');
    }
    
    /**
     * Fetch appointments from the API
     * @param {boolean} showLoading - Whether to show loading state
     */
    async fetchAppointments(showLoading = false) {
        try {
            if (showLoading) {
                this.showLoading();
            }
            
            const response = await fetch(this.config.apiEndpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const appointments = await response.json();
            
            // Check if appointments have changed
            const appointmentsChanged = this.hasAppointmentsChanged(appointments);
            
            if (appointmentsChanged || showLoading) {
                this.appointments = appointments;
                this.applyFilters(); // This will call renderAppointments with filtered data
                this.updateLastUpdateTime();
                
                if (appointmentsChanged) {
                    console.log('Appointments updated:', appointments.length, 'appointments found');
                }
            }
            
            // Reset error count on successful fetch
            this.errorCount = 0;
            
        } catch (error) {
            this.handleFetchError(error);
        }
    }
    
    /**
     * Check if appointments have changed since last fetch
     * @param {Array} newAppointments - New appointments data
     * @returns {boolean} - True if appointments have changed
     */
    hasAppointmentsChanged(newAppointments) {
        if (this.appointments.length !== newAppointments.length) {
            return true;
        }
        
        // Simple comparison - in production, you might want a more sophisticated diff
        const currentIds = this.appointments.map(apt => apt.id).sort();
        const newIds = newAppointments.map(apt => apt.id).sort();
        
        return JSON.stringify(currentIds) !== JSON.stringify(newIds);
    }
    
    /**
     * Handle fetch errors with retry logic
     * @param {Error} error - The error that occurred
     */
    handleFetchError(error) {
        this.errorCount++;
        console.error(`Error fetching appointments (attempt ${this.errorCount}):`, error);
        
        if (this.errorCount <= this.config.maxRetries) {
            // Show error message but continue trying
            this.showError(`Connection error. Retrying... (${this.errorCount}/${this.config.maxRetries})`);
            
            // Retry after delay
            setTimeout(() => {
                this.fetchAppointments();
            }, this.config.retryDelayMs);
        } else {
            // Max retries reached
            this.showError('Unable to connect to server. Please check your connection and refresh the page.');
            this.stopPolling();
        }
    }
    
    /**
     * Render appointments in the DOM
     * @param {Array} appointments - Array of appointment objects to render
     */
    renderAppointments(appointments) {
        if (!this.appointmentsContainer) return;
        
        // Clear existing content
        this.appointmentsContainer.innerHTML = '';
        
        if (!appointments || appointments.length === 0) {
            this.showNoAppointments();
            return;
        }
        
        // Hide no appointments message
        if (this.noAppointmentsElement) {
            this.noAppointmentsElement.style.display = 'none';
        }
        
        // Render each appointment
        appointments.forEach(appointment => {
            const appointmentElement = this.createAppointmentCard(appointment);
            this.appointmentsContainer.appendChild(appointmentElement);
        });
        
        console.log(`Rendered ${appointments.length} appointments`);
    }
    
    /**
     * Create an appointment card element
     * @param {Object} appointment - Appointment data
     * @returns {HTMLElement} - The appointment card element
     */
    createAppointmentCard(appointment) {
        const card = document.createElement('div');
        
        // Add all the CSS classes that the scraper looks for
        card.className = `appointment-card timetable-item exam-slot appointment-item card exam ${appointment.status}`;
        card.setAttribute('data-appointment', appointment.id);
        card.setAttribute('data-appointment-id', appointment.id);
        
        // Format the appointment data
        const formattedDate = this.formatDate(appointment.date);
        const formattedPrice = this.formatPrice(appointment.price);
        const statusText = this.getStatusText(appointment.status);
        
        card.innerHTML = `
            <div class="appointment-date">${formattedDate}</div>
            <div class="appointment-time">${appointment.time}</div>
            <div class="appointment-location">${appointment.location}</div>
            <div class="appointment-type">${appointment.examType}</div>
            <div class="appointment-city">${appointment.city}</div>
            <div class="appointment-status ${appointment.status}">${statusText}</div>
            ${appointment.price ? `<div class="appointment-price">${formattedPrice}</div>` : ''}
            ${appointment.registrationUrl ? 
                `<a href="${appointment.registrationUrl}" class="registration-link" target="_blank">Register Now</a>` : 
                '<div class="registration-link" style="background: #ccc; cursor: not-allowed;">Registration Unavailable</div>'
            }
        `;
        
        return card;
    }
    
    /**
     * Format date for display
     * @param {string} dateString - Date in YYYY-MM-DD format
     * @returns {string} - Formatted date string
     */
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            return dateString; // Return original if formatting fails
        }
    }
    
    /**
     * Format price for display
     * @param {number} price - Price in Toman
     * @returns {string} - Formatted price string
     */
    formatPrice(price) {
        if (!price) return 'Price not available';
        
        try {
            return new Intl.NumberFormat('fa-IR').format(price) + ' Toman';
        } catch (error) {
            return `${price.toLocaleString()} Toman`;
        }
    }
    
    /**
     * Get human-readable status text
     * @param {string} status - Status code
     * @returns {string} - Human-readable status
     */
    getStatusText(status) {
        const statusMap = {
            'available': 'Available',
            'full': 'Fully Booked',
            'pending': 'Pending Confirmation'
        };
        
        return statusMap[status] || status;
    }
    
    /**
     * Show loading state
     */
    showLoading() {
        if (!this.appointmentsContainer) return;
        
        this.appointmentsContainer.innerHTML = `
            <div class="loading-message">
                <p>Loading appointments...</p>
                <div class="loading-spinner"></div>
            </div>
        `;
        
        if (this.noAppointmentsElement) {
            this.noAppointmentsElement.style.display = 'none';
        }
    }
    
    /**
     * Show no appointments state
     */
    showNoAppointments() {
        if (this.noAppointmentsElement) {
            this.noAppointmentsElement.style.display = 'block';
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        if (!this.appointmentsContainer) return;
        
        this.appointmentsContainer.innerHTML = `
            <div class="error-message" style="
                grid-column: 1 / -1;
                text-align: center;
                padding: 2rem;
                background: #ffebee;
                border: 2px solid #f44336;
                border-radius: 8px;
                color: #c62828;
            ">
                <h3>Connection Error</h3>
                <p>${message}</p>
                <button onclick="window.appointmentManager.fetchAppointments(true)" style="
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-top: 1rem;
                ">Try Again</button>
            </div>
        `;
    }
    
    /**
     * Update the last update time display
     */
    updateLastUpdateTime() {
        this.lastUpdateTime = new Date();
        
        if (this.updateTimeElement) {
            this.updateTimeElement.textContent = this.lastUpdateTime.toLocaleTimeString();
        }
    }
    
    /**
     * Get current appointments (for external access)
     * @returns {Array} - Current appointments array
     */
    getAppointments() {
        return [...this.appointments];
    }
    
    /**
     * Manually refresh appointments
     */
    refresh() {
        this.fetchAppointments(true);
    }
    
    /**
     * Destroy the appointment manager (cleanup)
     */
    destroy() {
        this.stopPolling();
        
        // Remove event listeners
        if (this.refreshButton) {
            this.refreshButton.removeEventListener('click', this.refresh);
        }
        
        console.log('Appointment manager destroyed');
    }
}

// Initialize the appointment manager when the script loads
let appointmentManager;

// Make it globally accessible for debugging and external control
window.appointmentManager = null;

// Auto-initialize
(function() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAppointmentManager);
    } else {
        initializeAppointmentManager();
    }
    
    function initializeAppointmentManager() {
        try {
            appointmentManager = new AppointmentManager();
            window.appointmentManager = appointmentManager;
            console.log('Appointment manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize appointment manager:', error);
        }
    }
})();

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (appointmentManager) {
        appointmentManager.destroy();
    }
});

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppointmentManager;
}