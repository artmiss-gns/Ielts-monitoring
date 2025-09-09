import puppeteer, { Browser, Page } from 'puppeteer';
import { Appointment } from '../models/types';

/**
 * Configuration for web scraping filters
 */
export interface ScrapingFilters {
  city: string[];
  examModel: string[];
  months: number[];
}

/**
 * Configuration for retry logic
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

/**
 * Web scraping service for IELTS appointment monitoring
 */
export class WebScraperService {
  private browser: Browser | null = null;
  private baseUrl: string;
  private userAgents: string[] = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0'
  ];

  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 60000
  };

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || 'https://irsafam.org/ielts/timetable';
  }

  /**
   * Initialize the browser instance
   */
  async initialize(): Promise<void> {
    // Check if browser is still connected
    if (this.browser) {
      try {
        // Test if browser is still responsive
        await this.browser.version();
      } catch (error) {
        // Browser is not responsive, close it and create a new one
        try {
          await this.browser.close();
        } catch (closeError) {
          // Ignore close errors
        }
        this.browser = null;
      }
    }
    
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Build request URL with query parameters for filters
   */
  buildRequestUrl(filters: ScrapingFilters): string {
    const params = new URLSearchParams();

    // Add city filters
    if (filters.city && filters.city.length > 0) {
      filters.city.forEach(city => {
        params.append('city[]', city.toLowerCase());
      });
    }

    // Add exam model filters
    if (filters.examModel && filters.examModel.length > 0) {
      filters.examModel.forEach(model => {
        params.append('exam_model[]', model.toLowerCase());
      });
    }

    // Add month filters
    if (filters.months && filters.months.length > 0) {
      filters.months.forEach(month => {
        params.append('month[]', month.toString());
      });
    }

    const queryString = params.toString();
    return queryString ? `${this.baseUrl}?${queryString}` : this.baseUrl;
  }

  /**
   * Get a random user agent
   */
  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Add random delay to avoid detection
   */
  private async addRandomDelay(): Promise<void> {
    const delay = Math.floor(Math.random() * 2000) + 1000; // 1-3 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Fetch appointments with enhanced error handling and retry logic
   */
  async fetchAppointments(filters: ScrapingFilters): Promise<Appointment[]> {
    const url = this.buildRequestUrl(filters);
    
    // Log what we're about to scrape
    console.log(`🔍 Starting scrape operation:`);
    console.log(`   URL: ${url}`);
    console.log(`   Filters: Cities=[${filters.city.join(', ')}], Models=[${filters.examModel.join(', ')}], Months=[${filters.months.join(', ')}]`);
    
    // Check if we're using a test server (localhost)
    if (this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1')) {
      return this.fetchAppointmentsFromAPI(filters);
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Ensure browser is initialized before each attempt
        await this.initialize();
        
        const appointments = await this.scrapeAppointmentsFromUrl(url);
        
        // Log the results
        this.logScrapingResults(appointments, attempt);
        
        // Reset retry count on success
        if (attempt > 0) {
          console.log(`✅ Scraping succeeded after ${attempt + 1} attempts`);
        }
        
        return appointments;
      } catch (error) {
        lastError = error as Error;
        
        // If browser initialization failed, try to close and reinitialize
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('Browser not initialized') || 
            errorMessage.includes('Target closed') ||
            errorMessage.includes('Session closed')) {
          try {
            await this.close();
          } catch (closeError) {
            // Ignore close errors
          }
        }
        
        // Enhanced error categorization
        const isNetworkError = this.isNetworkError(error as Error);
        const isTimeoutError = this.isTimeoutError(error as Error);
        const isParsingError = this.isParsingError(error as Error);
        
        if (attempt < this.retryConfig.maxRetries) {
          let delay = this.retryConfig.baseDelay * Math.pow(2, attempt);
          
          // Adjust delay based on error type
          if (isNetworkError || isTimeoutError) {
            delay = Math.min(delay, this.retryConfig.maxDelay);
          } else if (isParsingError) {
            delay = Math.min(delay * 2, 30000); // Longer delay for parsing errors
          }
          
          console.log(`🔄 Scraping attempt ${attempt + 1} failed (${this.getErrorType(error as Error)}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`❌ All scraping attempts failed. Error type: ${this.getErrorType(error as Error)}`);
        }
      }
    }
    
    // Create enhanced error with context
    const enhancedErrorMessage = `Failed to fetch appointments after ${this.retryConfig.maxRetries + 1} attempts. ` +
      `Error type: ${this.getErrorType(lastError!)}. Last error: ${lastError?.message}`;
    
    throw new Error(enhancedErrorMessage);
  }



  /**
   * Parse appointment data from the page
   */
  private async parseAppointmentData(page: Page): Promise<Appointment[]> {
    const result = await page.evaluate(`(() => {
      const appointments = [];
      
      // Helper functions for data extraction
      const normalizeDate = (dateStr) => {
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            const year = parts[2];
            const month = parts[0].padStart(2, '0');
            const day = parts[1].padStart(2, '0');
            return year + '-' + month + '-' + day;
          }
        }
        return dateStr;
      };

      const extractLocation = (text) => {
        const locationPatterns = [
          /location[:\\s]+([^,\\n]+)/i,
          /center[:\\s]+([^,\\n]+)/i,
          /venue[:\\s]+([^,\\n]+)/i,
          /(isfahan|tehran|shiraz|mashhad|tabriz)/i
        ];
        
        for (const pattern of locationPatterns) {
          const match = text.match(pattern);
          if (match) {
            return match[1].trim();
          }
        }
        return 'Unknown Location';
      };

      const extractExamType = (text) => {
        if (text.toLowerCase().includes('cdielts')) return 'CDIELTS';
        if (text.toLowerCase().includes('ielts')) return 'IELTS';
        return 'IELTS';
      };

      const extractCity = (text) => {
        const cities = ['isfahan', 'tehran', 'shiraz', 'mashhad', 'tabriz'];
        const lowerText = text.toLowerCase();
        
        for (const city of cities) {
          if (lowerText.includes(city)) {
            return city.charAt(0).toUpperCase() + city.slice(1);
          }
        }
        return 'Isfahan';
      };

      const extractStatus = (text) => {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('full') || lowerText.includes('closed')) {
          return 'full';
        }
        if (lowerText.includes('pending') || lowerText.includes('waiting')) {
          return 'pending';
        }
        return 'available';
      };

      const extractPrice = (text) => {
        const priceMatch = text.match(/(\\d+(?:,\\d{3})*)\\s*(?:toman|rial|$)/i);
        if (priceMatch) {
          return parseInt(priceMatch[1].replace(/,/g, ''));
        }
        return undefined;
      };

      const extractRegistrationUrl = (element) => {
        const linkElement = element.querySelector('a[href]');
        if (linkElement) {
          const href = linkElement.getAttribute('href');
          if (href && (href.startsWith('http') || href.startsWith('/'))) {
            return href.startsWith('/') ? 'https://irsafam.org' + href : href;
          }
        }
        return undefined;
      };

      const extractAppointmentFromElement = (element, index) => {
        const textContent = element.textContent || '';
        
        const dateMatch = textContent.match(/(\\d{4}-\\d{2}-\\d{2}|\\d{2}\\/\\d{2}\\/\\d{4})/);
        const timeMatch = textContent.match(/(\\d{1,2}:\\d{2}(?:\\s*-\\s*\\d{1,2}:\\d{2})?)/);
        
        if (!dateMatch && !timeMatch) {
          return null;
        }
        
        return {
          id: 'appointment-' + Date.now() + '-' + index,
          date: dateMatch ? normalizeDate(dateMatch[1]) : new Date().toISOString().split('T')[0],
          time: timeMatch ? timeMatch[1] : 'TBD',
          location: extractLocation(textContent),
          examType: extractExamType(textContent),
          city: extractCity(textContent),
          status: extractStatus(textContent),
          price: extractPrice(textContent),
          registrationUrl: extractRegistrationUrl(element)
        };
      };
      
      // Try multiple possible selectors for appointment cards
      const selectors = [
        '.appointment-card',
        '.timetable-item', 
        '.exam-slot',
        '.appointment-item',
        '[data-appointment]',
        '.card'
      ];
      
      let appointmentElements = null;
      
      for (const selector of selectors) {
        appointmentElements = document.querySelectorAll(selector);
        if (appointmentElements.length > 0) {
          break;
        }
      }
      
      if (!appointmentElements || appointmentElements.length === 0) {
        appointmentElements = document.querySelectorAll('div[class*="appointment"], div[class*="exam"], div[class*="slot"]');
      }
      
      appointmentElements.forEach((element, index) => {
        try {
          const appointment = extractAppointmentFromElement(element, index);
          if (appointment) {
            appointments.push(appointment);
          }
        } catch (error) {
          console.warn('Failed to parse appointment element ' + index + ':', error);
        }
      });
      
      return appointments;
    })()`);
    
    return result as Appointment[];
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('network') || 
           message.includes('enotfound') || 
           message.includes('econnrefused') || 
           message.includes('econnreset') ||
           message.includes('socket hang up');
  }

  /**
   * Check if error is timeout-related
   */
  private isTimeoutError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('timeout') || 
           message.includes('timed out') ||
           message.includes('navigation timeout');
  }

  /**
   * Check if error is parsing-related
   */
  private isParsingError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('parse') || 
           message.includes('selector') || 
           message.includes('element not found') ||
           message.includes('waiting for selector');
  }

  /**
   * Get human-readable error type
   */
  private getErrorType(error: Error): string {
    if (this.isNetworkError(error)) return 'Network';
    if (this.isTimeoutError(error)) return 'Timeout';
    if (this.isParsingError(error)) return 'Parsing';
    return 'Unknown';
  }

  /**
   * Fetch appointments from API (for test server)
   */
  private async fetchAppointmentsFromAPI(filters: ScrapingFilters): Promise<Appointment[]> {
    try {
      console.log(`🔍 Fetching appointments from test server API: ${this.baseUrl}`);
      
      // Import axios dynamically to avoid issues if not installed
      const axios = await import('axios');
      
      // For test server, we use the /api/appointments endpoint
      const apiUrl = this.baseUrl.replace('/ielts/timetable', '') + '/api/appointments';
      const response = await axios.default.get(apiUrl);
      const appointments = response.data;

      // Apply filters to the appointments
      const filteredAppointments = this.applyFiltersToAppointments(appointments, filters);

      // Log the results using the same format as web scraping
      this.logScrapingResults(filteredAppointments, 0);
      
      return filteredAppointments;
    } catch (error) {
      console.error(`❌ API fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to fetch appointments from API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply filters to appointments (for API mode)
   */
  private applyFiltersToAppointments(appointments: Appointment[], filters: ScrapingFilters): Appointment[] {
    return appointments.filter(appointment => {
      // Filter by city
      if (filters.city && filters.city.length > 0) {
        const cityMatch = filters.city.some(city => 
          appointment.city.toLowerCase().includes(city.toLowerCase())
        );
        if (!cityMatch) return false;
      }

      // Filter by exam model
      if (filters.examModel && filters.examModel.length > 0) {
        const examMatch = filters.examModel.some(model => 
          appointment.examType.toLowerCase().includes(model.toLowerCase())
        );
        if (!examMatch) return false;
      }

      // Filter by months (check if appointment date falls in specified months)
      if (filters.months && filters.months.length > 0) {
        const appointmentDate = new Date(appointment.date);
        const appointmentMonth = appointmentDate.getMonth() + 1; // getMonth() returns 0-11
        if (!filters.months.includes(appointmentMonth)) return false;
      }

      return true;
    });
  }

  /**
   * Log scraping results with detailed information
   */
  private logScrapingResults(appointments: Appointment[], attempt: number): void {
    const timestamp = new Date().toLocaleTimeString();
    
    if (appointments.length === 0) {
      console.log(`📊 [${timestamp}] Scraping result: No appointments found`);
      console.log(`   Status: All time slots are filled or no appointments available`);
    } else {
      console.log(`📊 [${timestamp}] Scraping result: Found ${appointments.length} appointment(s)`);
      
      // Group appointments by status
      const statusCounts = appointments.reduce((acc, apt) => {
        acc[apt.status] = (acc[apt.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(`   Status breakdown: ${Object.entries(statusCounts)
        .map(([status, count]) => `${status}=${count}`)
        .join(', ')}`);
      
      // Show sample appointments (first 3)
      const sampleAppointments = appointments.slice(0, 3);
      console.log(`   Sample appointments:`);
      sampleAppointments.forEach((apt, index) => {
        console.log(`     ${index + 1}. ${apt.date} ${apt.time} - ${apt.city} (${apt.status})`);
      });
      
      if (appointments.length > 3) {
        console.log(`     ... and ${appointments.length - 3} more`);
      }
    }
    
    if (attempt > 0) {
      console.log(`   Note: Retrieved after ${attempt + 1} attempts`);
    }
  }

  /**
   * Enhanced scraping with timeout and error handling
   */
  private async scrapeAppointmentsFromUrl(url: string): Promise<Appointment[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      // Set timeouts
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);
      
      // Set random user agent
      await page.setUserAgent(this.getRandomUserAgent());
      
      // Set viewport
      await page.setViewport({ width: 1366, height: 768 });
      
      // Add random delay before navigation
      await this.addRandomDelay();
      
      // Navigate to the page with enhanced error handling
      try {
        await page.goto(url, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
      } catch (navigationError) {
        throw new Error(`Navigation failed: ${navigationError instanceof Error ? navigationError.message : 'Unknown navigation error'}`);
      }
      
      // Wait for appointment cards to load with better error handling
      try {
        await page.waitForSelector('.exam, .appointment, .timetable, table, [class*="exam"], [class*="appointment"]', { 
          timeout: 15000 
        });
        console.log('📄 Page loaded successfully, found expected content selectors');
      } catch (selectorError) {
        // Check if page loaded but no appointments found
        const pageContent = await page.content();
        console.log(`📄 Page content length: ${pageContent.length} characters`);
        
        if (pageContent.includes('no appointments') || 
            pageContent.includes('not found') ||
            pageContent.includes('هیچ آزمونی پیدا نشد') ||
            pageContent.includes('آزمونی پیدا نشد')) {
          console.log('ℹ️  Page explicitly states: No appointments found');
          return [];
        }
        
        if (pageContent.includes('full') || 
            pageContent.includes('filled') ||
            pageContent.includes('تکمیل') ||
            pageContent.includes('پر')) {
          console.log('ℹ️  Page indicates: All time slots are filled');
          return [];
        }
        
        // If page seems broken, throw parsing error
        if (pageContent.length < 1000) {
          throw new Error(`Page content too short, possible parsing issue. Content length: ${pageContent.length}`);
        }
        
        console.log('⚠️  Expected selectors not found, attempting to parse anyway...');
      }
      
      // Extract appointment data with error handling
      try {
        const appointments = await this.parseAppointmentData(page);
        return appointments;
      } catch (parseError) {
        throw new Error(`Appointment parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
      }
      
    } catch (error) {
      // Add context to the error
      const contextualError = new Error(`Scraping failed for URL ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof Error && error.stack) {
        contextualError.stack = error.stack;
      }
      throw contextualError;
    } finally {
      await page.close();
    }
  }}
