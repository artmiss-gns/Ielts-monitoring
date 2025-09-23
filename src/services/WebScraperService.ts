import puppeteer, { Browser, Page } from 'puppeteer';
import { 
  Appointment, 
  CheckResult, 
  EnhancedInspectionData,
  DetectionStrategy
} from '../models/types';
import { DataInspectionService } from './DataInspectionService';
import { EnhancedInspectionService } from './EnhancedInspectionService';

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
  private dataInspectionService: DataInspectionService;
  private enhancedInspectionService: EnhancedInspectionService;
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
    this.dataInspectionService = new DataInspectionService();
    this.enhancedInspectionService = new EnhancedInspectionService();
  }

  /**
   * Initialize the browser instance with better error handling
   */
  async initialize(): Promise<void> {
    // Check if browser is still connected
    if (this.browser) {
      try {
        // Test if browser is still responsive
        await this.browser.version();
        return; // Browser is working, no need to reinitialize
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
      try {
        // Try to launch browser with multiple fallback options
        this.browser = await this.launchBrowserWithFallbacks();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to initialize browser: ${errorMessage}\n\n` +
          `Possible solutions:\n` +
          `1. Install Chromium: sudo apt-get install chromium-browser (Linux) or brew install chromium (macOS)\n` +
          `2. Install Chrome: Download from https://www.google.com/chrome/\n` +
          `3. Set PUPPETEER_EXECUTABLE_PATH environment variable to your browser path\n` +
          `4. Use --test-server flag to test against local simulation server instead`
        );
      }
    }
  }

  /**
   * Launch browser with multiple fallback options
   */
  private async launchBrowserWithFallbacks(): Promise<Browser> {
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    };

    // Try different browser executable paths
    const possiblePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ].filter(Boolean);

    // First try default puppeteer launch (uses bundled Chromium)
    try {
      return await puppeteer.launch(launchOptions);
    } catch (defaultError) {
      console.warn('Default browser launch failed, trying alternative paths...');
    }

    // Try each possible browser path
    for (const executablePath of possiblePaths) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(executablePath as string)) {
          return await puppeteer.launch({
            ...launchOptions,
            executablePath: executablePath as string
          });
        }
      } catch (error) {
        console.warn(`Failed to launch browser at ${executablePath}:`, error);
        continue;
      }
    }

    throw new Error('No suitable browser executable found');
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        // Ignore close errors
        console.warn('Warning: Error closing browser:', error);
      }
      this.browser = null;
    }
  }

  /**
   * Check if browser is available without initializing
   */
  static async checkBrowserAvailability(): Promise<{
    available: boolean;
    error?: string;
    suggestions: string[];
  }> {
    try {
      // Try to launch a browser instance briefly
      const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: '/usr/bin/chromium',
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
      await browser.close();
      
      return {
        available: true,
        suggestions: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const suggestions = [
        'Install Chromium: sudo apt-get install chromium-browser (Linux) or brew install chromium (macOS)',
        'Install Chrome: Download from https://www.google.com/chrome/',
        'Set PUPPETEER_EXECUTABLE_PATH environment variable to your browser path',
        'Use --test-server flag to test against local simulation server instead'
      ];

      return {
        available: false,
        error: errorMessage,
        suggestions
      };
    }
  }

  /**
   * Build request URL with query parameters for filters
   * Note: The website only accepts one month at a time, so this builds URL for single combinations
   */
  buildRequestUrl(filters: ScrapingFilters, specificMonth?: number): string {
    const params = new URLSearchParams();

    // Add city filters
    if (filters.city && filters.city.length > 0) {
      filters.city.forEach(city => {
        params.append('city[]', city.toLowerCase());
      });
    }

    // Add exam model filters (corrected parameter name from exam_model to model)
    if (filters.examModel && filters.examModel.length > 0) {
      filters.examModel.forEach(model => {
        params.append('model[]', model.toLowerCase());
      });
    }

    // Add month filter (only one month at a time)
    if (specificMonth) {
      params.append('month[]', specificMonth.toString());
    } else if (filters.months && filters.months.length > 0) {
      // Use the first month if no specific month is provided
      params.append('month[]', filters.months[0].toString());
    }

    const queryString = params.toString();
    return queryString ? `${this.baseUrl}?${queryString}` : this.baseUrl;
  }

  /**
   * Build multiple URLs for each month combination since website only accepts one month at a time
   */
  buildRequestUrls(filters: ScrapingFilters): string[] {
    const urls: string[] = [];
    
    if (filters.months && filters.months.length > 0) {
      filters.months.forEach(month => {
        const url = this.buildRequestUrl(filters, month);
        urls.push(url);
      });
    } else {
      // If no months specified, use the base URL
      urls.push(this.buildRequestUrl(filters));
    }
    
    return urls;
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
   * Enhanced method to fetch appointments with detailed status detection
   * Handles multiple months by making separate requests for each month
   */
  async fetchAppointmentsWithStatus(filters: ScrapingFilters): Promise<CheckResult> {
    console.log(`🔍 Starting enhanced scrape operation:`);
    console.log(`   Filters: Cities=[${filters.city.join(', ')}], Models=[${filters.examModel.join(', ')}], Months=[${filters.months.join(', ')}]`);
    
    // Check if we're using a test server (localhost)
    if (this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1')) {
      return this.fetchAppointmentsWithStatusFromAPI(filters);
    }

    // Build URLs for each month (since website only accepts one month at a time)
    const urls = this.buildRequestUrls(filters);
    console.log(`🔍 Will check ${urls.length} URL(s) (one per month):`);
    urls.forEach((url, index) => {
      console.log(`   ${index + 1}. ${url}`);
    });

    let allAppointments: Appointment[] = [];
    let totalAvailable = 0;
    let totalFilled = 0;
    let hasAnySlots = false;

    // Process each URL (month) separately
    for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
      const url = urls[urlIndex];
      const monthNumber = filters.months[urlIndex];
      const monthName = this.getMonthName(monthNumber);
      
      console.log(`\n🔍 Checking ${monthName} (${urlIndex + 1}/${urls.length})...`);
      
      for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
        try {
          await this.initialize();
          
          const checkResult = await this.scrapeAppointmentsWithStatusFromUrl(url);
          
          // Merge results
          allAppointments = allAppointments.concat(checkResult.appointments);
          totalAvailable += checkResult.availableCount;
          totalFilled += checkResult.filledCount;
          
          if (checkResult.appointmentCount > 0) {
            hasAnySlots = true;
          }
          
          console.log(`   ✅ ${monthName}: ${checkResult.appointmentCount} appointments (${checkResult.availableCount} available, ${checkResult.filledCount} filled)`);
          
          if (attempt > 0) {
            console.log(`   ✅ Succeeded after ${attempt + 1} attempts`);
          }
          
          break; // Success, move to next URL
          
        } catch (error) {
          
          if ((error as Error).message.includes('Browser not initialized') || 
              (error as Error).message.includes('Target closed') ||
              (error as Error).message.includes('Session closed')) {
            try {
              await this.close();
            } catch (closeError) {
              // Ignore close errors
            }
          }
          
          const isNetworkError = this.isNetworkError(error as Error);
          const isTimeoutError = this.isTimeoutError(error as Error);
          const isParsingError = this.isParsingError(error as Error);
          
          if (attempt < this.retryConfig.maxRetries) {
            let delay = this.retryConfig.baseDelay * Math.pow(2, attempt);
            
            if (isNetworkError || isTimeoutError) {
              delay = Math.min(delay, this.retryConfig.maxDelay);
            } else if (isParsingError) {
              delay = Math.min(delay * 2, 30000);
            }
            
            console.log(`   🔄 ${monthName} attempt ${attempt + 1} failed (${this.getErrorType(error as Error)}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error(`   ❌ ${monthName} failed after all attempts. Error type: ${this.getErrorType(error as Error)}`);
            // Continue with other months even if one fails
          }
        }
      }
    }

    // Create combined result
    const combinedResult: CheckResult = {
      type: hasAnySlots ? (totalAvailable > 0 ? 'available' : 'filled') : 'no-slots',
      appointmentCount: allAppointments.length,
      availableCount: totalAvailable,
      filledCount: totalFilled,
      timestamp: new Date(),
      url: urls.length === 1 ? urls[0] : `${this.baseUrl} (${urls.length} requests)`,
      appointments: allAppointments
    };

    this.logEnhancedScrapingResults(combinedResult, 0);
    
    return combinedResult;
  }

  /**
   * Get month name from number
   */
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || `Month ${month}`;
  }

  /**
   * Create detection strategies from selector results for enhanced inspection
   * Requirement 2.4: Provide summary of detection patterns and results
   */
  private createDetectionStrategies(selectorResults: any[]): DetectionStrategy[] {
    const strategies: DetectionStrategy[] = [];
    
    // Group selector results by strategy
    const strategyGroups = selectorResults.reduce((groups: Record<string, any[]>, result: any) => {
      const strategy = result.strategy || 'unknown';
      if (!groups[strategy]) {
        groups[strategy] = [];
      }
      groups[strategy].push(result);
      return groups;
    }, {} as Record<string, any[]>);
    
    // Create detection strategy objects
    Object.entries(strategyGroups).forEach(([strategyName, results], index) => {
      const totalElements = results.reduce((sum: number, r: any) => sum + (r.elementCount || 0), 0);
      const totalTime = results.reduce((sum: number, r: any) => sum + (r.processingTime || 0), 0);
      const successfulSelectors = results.filter((r: any) => (r.elementCount || 0) > 0);
      
      strategies.push({
        name: strategyName,
        priority: index + 1,
        selectors: results.map((r: any) => r.selector || ''),
        elementsFound: totalElements,
        successRate: results.length > 0 ? successfulSelectors.length / results.length : 0,
        processingTime: totalTime
      });
    });
    
    return strategies;
  }

  /**
   * Validate detection results and create validation checks
   * Requirement 6.4: Document decision-making process and fallback logic
   */
  private validateDetectionResults(appointments: Appointment[], statusDecisions: any[]): {
    check: string;
    passed: boolean;
    details: string;
  }[] {
    const validationChecks = [];

    // Check 1: Verify appointments have valid status
    const validStatuses = ['available', 'filled', 'pending', 'not-registerable', 'unknown'];
    const invalidStatusCount = appointments.filter(apt => !validStatuses.includes(apt.status)).length;
    validationChecks.push({
      check: 'Valid Status Assignment',
      passed: invalidStatusCount === 0,
      details: invalidStatusCount === 0 
        ? 'All appointments have valid status values'
        : `${invalidStatusCount} appointments have invalid status values`
    });

    // Check 2: Verify confidence scores are reasonable (for enhanced appointments)
    const enhancedAppointments = appointments.filter(apt => 'confidenceScore' in apt) as any[];
    const lowConfidenceCount = enhancedAppointments.filter(apt => apt.confidenceScore < 0.3).length;
    validationChecks.push({
      check: 'Confidence Score Validation',
      passed: lowConfidenceCount === 0,
      details: lowConfidenceCount === 0
        ? 'All appointments have reasonable confidence scores'
        : `${lowConfidenceCount} appointments have low confidence scores (<0.3)`
    });

    // Check 3: Verify status decisions were made
    validationChecks.push({
      check: 'Status Decision Coverage',
      passed: statusDecisions.length === appointments.length,
      details: statusDecisions.length === appointments.length
        ? 'Status decisions recorded for all appointments'
        : `Status decisions: ${statusDecisions.length}, Appointments: ${appointments.length}`
    });

    // Check 4: Verify appointments have required data
    const incompleteAppointments = appointments.filter(apt => 
      !apt.date || !apt.time || !apt.location || !apt.examType
    ).length;
    validationChecks.push({
      check: 'Complete Appointment Data',
      passed: incompleteAppointments === 0,
      details: incompleteAppointments === 0
        ? 'All appointments have complete data'
        : `${incompleteAppointments} appointments are missing required data`
    });

    // Check 5: Verify fallback usage is reasonable
    const fallbackDecisions = statusDecisions.filter(d => d.fallbackUsed).length;
    const fallbackRate = statusDecisions.length > 0 ? fallbackDecisions / statusDecisions.length : 0;
    validationChecks.push({
      check: 'Fallback Usage Rate',
      passed: fallbackRate <= 0.5, // Less than 50% fallback usage is acceptable
      details: `Fallback used in ${fallbackDecisions}/${statusDecisions.length} decisions (${Math.round(fallbackRate * 100)}%)`
    });

    return validationChecks;
  }

  /**
   * Parse appointment data from the page (legacy method for backward compatibility)
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
        
        if (lowerText.includes('full') || lowerText.includes('closed') || lowerText.includes('filled')) {
          return 'filled';
        }
        if (lowerText.includes('pending') || lowerText.includes('waiting')) {
          return 'pending';
        }
        // Conservative approach: Don't default to available without explicit indicators
        return 'unknown';
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
      
      // Enhanced appointment element detection with detailed logging and performance tracking
      const detectAppointmentElements = () => {
        const elementDetectionStart = performance.now();
        // IELTS-specific selectors (highest priority)
        const ieltsSelectors = [
          'a.exam__item.ielts',
          'a.exam__item', 
          '.exam__item.ielts',
          '.exam__item'
        ];
        
        // Common appointment selectors
        const commonSelectors = [
          '.appointment-card',
          '.timetable-item', 
          '.exam-slot',
          '.appointment-item',
          '[data-appointment]',
          '[data-appointment-id]',
          '.card.appointment',
          '.card.exam',
          '.exam-card',
          '.slot-card',
          '.appointment',
          '.exam-time',
          '.time-slot'
        ];
        
        // Test simulation server specific selectors
        const testServerSelectors = [
          '.appointment-card.timetable-item',
          '.appointment-card.exam-slot',
          '.timetable-item.exam-slot',
          'div[data-appointment]',
          'div[class*="appointment"][class*="card"]',
          'div[class*="timetable"][class*="item"]'
        ];
        
        // Try IELTS-specific selectors first
        for (const selector of ieltsSelectors) {
          const selectorStart = performance.now();
          const elements = document.querySelectorAll(selector);
          const selectorEnd = performance.now();
          
          inspectionData.selectorResults.push({
            selector: selector,
            elementCount: elements.length,
            strategy: 'IELTS-specific',
            processingTime: selectorEnd - selectorStart,
            sampleHtml: elements.length > 0 ? elements[0].outerHTML.substring(0, 200) + '...' : undefined
          });
          
          if (elements.length > 0) {
            inspectionData.detectedElements.push('IELTS-specific selector "' + selector + '" found ' + elements.length + ' elements');
            const elementDetectionEnd = performance.now();
            inspectionData.performanceMetrics.elementDetectionTime += (elementDetectionEnd - elementDetectionStart);
            return Array.from(elements);
          }
        }
        
        // Try test simulation server selectors
        for (const selector of testServerSelectors) {
          const selectorStart = performance.now();
          const elements = document.querySelectorAll(selector);
          const selectorEnd = performance.now();
          
          inspectionData.selectorResults.push({
            selector: selector,
            elementCount: elements.length,
            strategy: 'test-server',
            processingTime: selectorEnd - selectorStart,
            sampleHtml: elements.length > 0 ? elements[0].outerHTML.substring(0, 200) + '...' : undefined
          });
          
          if (elements.length > 0) {
            inspectionData.detectedElements.push('Test server selector "' + selector + '" found ' + elements.length + ' elements');
            const elementDetectionEnd = performance.now();
            inspectionData.performanceMetrics.elementDetectionTime += (elementDetectionEnd - elementDetectionStart);
            return Array.from(elements);
          }
        }
        
        // Try common appointment selectors
        for (const selector of commonSelectors) {
          const selectorStart = performance.now();
          const elements = document.querySelectorAll(selector);
          const selectorEnd = performance.now();
          
          inspectionData.selectorResults.push({
            selector: selector,
            elementCount: elements.length,
            strategy: 'common-appointment',
            processingTime: selectorEnd - selectorStart,
            sampleHtml: elements.length > 0 ? elements[0].outerHTML.substring(0, 200) + '...' : undefined
          });
          
          if (elements.length > 0) {
            inspectionData.detectedElements.push('Common selector "' + selector + '" found ' + elements.length + ' elements');
            const elementDetectionEnd = performance.now();
            inspectionData.performanceMetrics.elementDetectionTime += (elementDetectionEnd - elementDetectionStart);
            return Array.from(elements);
          }
        }
        
        // Fallback to broader selectors with content filtering
        const broadSelectors = [
          'div[class*="appointment"], div[class*="exam"], div[class*="slot"]',
          '.row .col, .row > div',
          'div[class*="card"], div[class*="item"]'
        ];
        
        for (const selector of broadSelectors) {
          const selectorStart = performance.now();
          const elements = document.querySelectorAll(selector);
          const filteredElements = Array.from(elements).filter(el => {
            const text = el.textContent || '';
            const hasDate = /\\d{4}-\\d{2}-\\d{2}|\\d{2}\\/\\d{2}\\/\\d{4}/.test(text);
            const hasTime = /\\d{1,2}:\\d{2}/.test(text);
            const hasAppointmentKeywords = /exam|test|appointment|slot|ielts|cdielts/i.test(text);
            return hasDate || hasTime || hasAppointmentKeywords;
          });
          const selectorEnd = performance.now();
          
          inspectionData.selectorResults.push({
            selector: selector,
            elementCount: filteredElements.length,
            strategy: 'broad-fallback',
            processingTime: selectorEnd - selectorStart,
            sampleHtml: filteredElements.length > 0 ? filteredElements[0].outerHTML.substring(0, 200) + '...' : undefined
          });
          
          if (filteredElements.length > 0) {
            inspectionData.detectedElements.push('Broad fallback selector "' + selector + '" found ' + filteredElements.length + ' filtered elements');
            const elementDetectionEnd = performance.now();
            inspectionData.performanceMetrics.elementDetectionTime += (elementDetectionEnd - elementDetectionStart);
            return filteredElements;
          }
        }
        
        // No elements found
        inspectionData.detectedElements.push('No appointment elements found by any selector strategy');
        const elementDetectionEnd = performance.now();
        inspectionData.performanceMetrics.elementDetectionTime += (elementDetectionEnd - elementDetectionStart);
        return [];
      };
      
      const appointmentElements = detectAppointmentElements();
      
      appointmentElements.forEach((element, index) => {
        const parsingStart = performance.now();
        try {
          const appointment = extractAppointmentFromElement(element, index);
          if (appointment) {
            appointments.push(appointment);
          }
          const parsingEnd = performance.now();
          inspectionData.performanceMetrics.parsingTime += (parsingEnd - parsingStart);
        } catch (error) {
          const parsingEnd = performance.now();
          inspectionData.performanceMetrics.parsingTime += (parsingEnd - parsingStart);
          
          // Capture detailed error information
          const errorDetails = {
            timestamp: new Date(),
            error: error.message || 'Unknown parsing error',
            context: 'Failed to parse appointment element ' + index,
            elementIndex: index,
            rawHtml: element.outerHTML || ''
          };
          
          inspectionData.errorLog.push(errorDetails);
          inspectionData.parsingNotes.push('ERROR parsing element ' + index + ': ' + errorDetails.error);
          
          console.warn('Failed to parse appointment element ' + index + ':', error);
        }
      });
      
      return appointments;
    })()`);
    
    return result as Appointment[];
  }


  /**
   * Enhanced appointment parsing with status detection and raw HTML capture
   */
  private async parseAppointmentDataWithStatus(page: Page, url: string): Promise<CheckResult> {
    const result = await page.evaluate(`(() => {
      const appointments = [];
      const inspectionData = {
        detectedElements: [],
        parsingNotes: [],
        rawAppointmentHtml: [],
        statusDecisions: [],
        selectorResults: [],
        errorLog: [],
        performanceMetrics: {
          totalProcessingTime: 0,
          elementDetectionTime: 0,
          statusDetectionTime: 0,
          parsingTime: 0
        }
      };
      
      const startTime = performance.now();
      
      // Helper functions for enhanced data extraction
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

      const extractCity = (text, element) => {
        // First try to extract from h5 tag (IELTS-specific structure)
        const h5Element = element ? element.querySelector('h5') : null;
        if (h5Element) {
          const h5Text = h5Element.textContent || '';
          const cities = ['isfahan', 'tehran', 'shiraz', 'mashhad', 'tabriz', 'اصفهان', 'تهران', 'شیراز', 'مشهد', 'تبریز'];
          const lowerH5Text = h5Text.toLowerCase();
          
          for (const city of cities) {
            if (lowerH5Text.includes(city.toLowerCase())) {
              // Map Persian city names to English
              const cityMap = {
                'اصفهان': 'Isfahan',
                'تهران': 'Tehran', 
                'شیراز': 'Shiraz',
                'مشهد': 'Mashhad',
                'تبریز': 'Tabriz'
              };
              const mappedCity = cityMap[city] || city.charAt(0).toUpperCase() + city.slice(1);
              inspectionData.parsingNotes.push('Extracted city from h5 element: ' + mappedCity);
              return mappedCity;
            }
          }
        }
        
        // Fallback to text matching
        const cities = ['isfahan', 'tehran', 'shiraz', 'mashhad', 'tabriz'];
        const lowerText = text.toLowerCase();
        
        for (const city of cities) {
          if (lowerText.includes(city)) {
            return city.charAt(0).toUpperCase() + city.slice(1);
          }
        }
        return 'Isfahan';
      };

      // Conservative filled appointment detection - prioritizes identifying filled appointments first
      // Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2, 7.4
      const detectAppointmentStatus = (element, elementIndex) => {
        const statusDetectionStart = performance.now();
        const text = element.textContent || '';
        const html = element.innerHTML || '';
        const lowerText = text.toLowerCase();
        const classList = element.classList || [];
        const classNames = Array.from(classList).join(' ').toLowerCase();
        
        // Initialize status detection tracking
        const statusIndicators = [];
        let finalStatus = 'unknown';
        let confidence = 0.0;
        let reasoning = '';
        let fallbackUsed = false;
        
        // STEP 1: PRIORITY-BASED FILLED DETECTION (HIGHEST PRIORITY)
        // Requirement 1.2: "تکمیل ظرفیت" text detection as highest priority filled indicator
        if (text.includes('تکمیل ظرفیت') || 
            html.includes('تکمیل ظرفیت')) {
          
          statusIndicators.push({
            type: 'text-content',
            value: 'Persian: تکمیل ظرفیت',
            weight: 1.0,
            source: 'element'
          });
          
          finalStatus = 'filled';
          confidence = 1.0;
          reasoning = 'Found highest priority filled indicator: تکمیل ظرفیت';
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          // Enhanced filled status logging - Requirement 2.1, 2.2
          const filledStatusDetails = {
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed,
            // Additional filled status analysis
            detectionDetails: {
              detectedText: 'تکمیل ظرفیت',
              detectionMethod: 'Persian text content',
              priority: 'highest',
              elementClasses: Array.from(element.classList || []),
              textContent: text.substring(0, 200) + (text.length > 200 ? '...' : '')
            }
          };
          
          inspectionData.statusDecisions.push(filledStatusDetails);
          
          // Enhanced logging message - Requirement 2.1, 2.2
          const filledLogMessage = 'Element ' + elementIndex + ': ' + reasoning + ' - marking as filled (HIGHEST PRIORITY) - ' +
            'Classes: [' + Array.from(element.classList || []).join(', ') + ']';
          
          inspectionData.parsingNotes.push(filledLogMessage);
          
          // Log to console for immediate debugging - Requirement 2.2
          console.log('✅ Filled Status Detection (Highest Priority):', {
            elementIndex,
            reasoning,
            detectedText: 'تکمیل ظرفیت',
            confidence,
            elementClasses: Array.from(element.classList || [])
          });
          
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        // Requirement 1.3: Check for "disabled" CSS class
        if (classList.contains('disabled') || 
            classNames.includes('exam__item ielts disabled')) {
          
          const foundClass = classList.contains('disabled') ? 'disabled' : 'exam__item ielts disabled';
          
          statusIndicators.push({
            type: 'css-class',
            value: foundClass,
            weight: 0.95,
            source: 'element'
          });
          
          finalStatus = 'filled';
          confidence = 0.95;
          reasoning = 'Found disabled CSS class: ' + foundClass;
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          inspectionData.statusDecisions.push({
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed
          });
          
          inspectionData.parsingNotes.push('Element ' + elementIndex + ': ' + reasoning + ' - marking as filled');
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        // Requirement 1.4: Check for "btn disable" class in button elements
        const hasDisableButtonClass = element.querySelector(
          '.btn.disable, ' +
          'span.btn.disable, ' +
          'button.disable, ' +
          '.disable'
        ) !== null;
        
        if (hasDisableButtonClass) {
          statusIndicators.push({
            type: 'button-class',
            value: 'btn disable',
            weight: 0.95,
            source: 'button-element'
          });
          
          finalStatus = 'filled';
          confidence = 0.95;
          reasoning = 'Found btn disable class in button element';
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          inspectionData.statusDecisions.push({
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed
          });
          
          inspectionData.parsingNotes.push('Element ' + elementIndex + ': ' + reasoning + ' - marking as filled');
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        // Additional filled indicators (lower priority but still immediate)
        if (classList.contains('inactive') ||
            classList.contains('unavailable') ||
            classList.contains('full') ||
            classList.contains('closed') ||
            classList.contains('filled') ||
            classList.contains('sold-out') ||
            classNames.includes('btn-disabled')) {
          
          const filledClasses = ['inactive', 'unavailable', 'full', 'closed', 'filled', 'sold-out'];
          const foundClass = Array.from(classList).find(cls => filledClasses.includes(cls)) || 'btn-disabled';
          
          statusIndicators.push({
            type: 'css-class',
            value: foundClass,
            weight: 0.9,
            source: 'element'
          });
          
          finalStatus = 'filled';
          confidence = 0.9;
          reasoning = 'Found filled CSS class: ' + foundClass;
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          inspectionData.statusDecisions.push({
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed
          });
          
          inspectionData.parsingNotes.push('Element ' + elementIndex + ': ' + reasoning + ' - marking as filled');
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        // Additional Persian filled text detection
        if (text.includes('تکمیل') || 
            text.includes('پر شده') ||
            text.includes('بسته شده') ||
            text.includes('تمام شده') ||
            text.includes('موجود نیست') ||
            text.includes('پر') ||
            html.includes('تکمیل')) {
          
          const persianFilledTexts = ['تکمیل', 'پر شده', 'بسته شده', 'تمام شده', 'موجود نیست', 'پر'];
          const foundText = persianFilledTexts.find(t => text.includes(t) || html.includes(t));
          
          statusIndicators.push({
            type: 'text-content',
            value: 'Persian: ' + foundText,
            weight: 0.9,
            source: 'element'
          });
          
          finalStatus = 'filled';
          confidence = 0.9;
          reasoning = 'Found Persian filled indicator: ' + foundText;
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          inspectionData.statusDecisions.push({
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed
          });
          
          inspectionData.parsingNotes.push('Element ' + elementIndex + ': ' + reasoning + ' - marking as filled');
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        // English filled indicators
        if (lowerText.includes('full') || 
            lowerText.includes('closed') ||
            lowerText.includes('filled') ||
            lowerText.includes('capacity full') ||
            lowerText.includes('sold out') ||
            lowerText.includes('booked') ||
            lowerText.includes('unavailable') ||
            lowerText.includes('no spaces') ||
            lowerText.includes('no slots') ||
            lowerText.includes('completed')) {
          
          const englishFilledTexts = ['full', 'closed', 'filled', 'capacity full', 'sold out', 'booked', 'unavailable', 'no spaces', 'no slots', 'completed'];
          const foundText = englishFilledTexts.find(t => lowerText.includes(t));
          
          statusIndicators.push({
            type: 'text-content',
            value: 'English: ' + foundText,
            weight: 0.9,
            source: 'element'
          });
          
          finalStatus = 'filled';
          confidence = 0.9;
          reasoning = 'Found English filled indicator: ' + foundText;
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          inspectionData.statusDecisions.push({
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed
          });
          
          inspectionData.parsingNotes.push('Element ' + elementIndex + ': ' + reasoning + ' - marking as filled');
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        // Disabled button detection
        const hasDisabledButton = element.querySelector(
          'button[disabled], ' +
          'button.disabled, ' +
          '.btn[disabled], ' +
          '.btn.disabled, ' +
          '.btn.btn-disabled, ' +
          '.disabled button, ' +
          '.disabled .btn, ' +
          'input[disabled]'
        ) !== null;
        
        if (hasDisabledButton) {
          statusIndicators.push({
            type: 'interactive-element',
            value: 'disabled button',
            weight: 0.9,
            source: 'element'
          });
          
          finalStatus = 'filled';
          confidence = 0.9;
          reasoning = 'Found disabled button element';
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          inspectionData.statusDecisions.push({
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed
          });
          
          inspectionData.parsingNotes.push('Element ' + elementIndex + ': ' + reasoning + ' - marking as filled');
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        // STEP 2: EXPLICIT AVAILABLE DETECTION (ONLY AFTER CONFIRMING NOT FILLED)
        // Requirement 5.3, 5.4: Only check for available indicators after confirming appointment is NOT filled
        
        // CSS class detection for available states
        if (classList.contains('enabled') || 
            classList.contains('available') || 
            classList.contains('active') ||
            classList.contains('bookable') ||
            classList.contains('open') ||
            classNames.includes('enable')) {
          
          const foundClass = Array.from(classList).find(cls => 
            ['enabled', 'available', 'active', 'bookable', 'open'].includes(cls)
          ) || 'enable';
          
          statusIndicators.push({
            type: 'css-class',
            value: foundClass,
            weight: 0.9,
            source: 'element'
          });
          
          finalStatus = 'available';
          confidence = 0.9;
          reasoning = 'Found available CSS class: ' + foundClass;
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          inspectionData.statusDecisions.push({
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed
          });
          
          inspectionData.parsingNotes.push('Element ' + elementIndex + ': ' + reasoning + ' - marking as available');
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        // Check for near-full class (indicates available with limited capacity)
        if (classList.contains('near-full') || 
            classList.contains('limited') ||
            classList.contains('few-spots')) {
          
          const foundClass = Array.from(classList).find(cls => 
            ['near-full', 'limited', 'few-spots'].includes(cls)
          );
          
          statusIndicators.push({
            type: 'css-class',
            value: foundClass,
            weight: 0.8,
            source: 'element'
          });
          
          finalStatus = 'available';
          confidence = 0.8;
          reasoning = 'Found near-full/limited class: ' + foundClass + ' (available with limited capacity)';
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          inspectionData.statusDecisions.push({
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed
          });
          
          inspectionData.parsingNotes.push('Element ' + elementIndex + ': ' + reasoning);
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        // Clickable element detection (indicates bookable appointment)
        const hasOnclickAttribute = element.hasAttribute('onclick') || 
                                   element.hasAttribute('data-onclick') ||
                                   element.hasAttribute('data-action');
        
        // Active registration button detection (without disabled attributes)
        const hasRegistrationButton = element.querySelector(
          'button:not([disabled]):not(.disabled):not(.btn-disabled), ' +
          '.btn:not([disabled]):not(.disabled):not(.btn-disabled), ' +
          '.register:not([disabled]):not(.disabled), ' +
          '.book:not([disabled]):not(.disabled), ' +
          '.reserve:not([disabled]):not(.disabled), ' +
          'input[type="submit"]:not([disabled]):not(.disabled), ' +
          'input[type="button"]:not([disabled]):not(.disabled)'
        ) !== null;
        
        // Registration link detection
        const hasRegistrationLink = element.querySelector(
          'a[href*="register"]:not(.disabled), ' +
          'a[href*="book"]:not(.disabled), ' +
          'a[href*="signup"]:not(.disabled), ' +
          'a[href*="reserve"]:not(.disabled), ' +
          'a[href*="appointment"]:not(.disabled), ' +
          'a[onclick]:not(.disabled)'
        ) !== null;
        
        // "قابل ثبت نام" text detection for available status
        const hasPersianAvailableText = text.includes('قابل ثبت نام') ||
                                       html.includes('قابل ثبت نام');
        
        // Additional Persian available text detection
        const hasOtherPersianAvailableText = text.includes('ثبت نام') ||
                                            text.includes('رزرو') ||
                                            text.includes('موجود') ||
                                            text.includes('آزاد') ||
                                            text.includes('باز') ||
                                            html.includes('رزرو');
        
        // English available text detection
        const hasEnglishAvailableText = lowerText.includes('available') || 
                                       lowerText.includes('register now') ||
                                       lowerText.includes('book now') ||
                                       lowerText.includes('reserve now') ||
                                       lowerText.includes('sign up') ||
                                       lowerText.includes('enroll') ||
                                       lowerText.includes('open for registration');
        
        // Check for explicit available indicators (highest priority first)
        if (hasPersianAvailableText) {
          statusIndicators.push({
            type: 'text-content',
            value: 'Persian: قابل ثبت نام',
            weight: 0.95,
            source: 'element'
          });
          
          finalStatus = 'available';
          confidence = 0.95;
          reasoning = 'Found قابل ثبت نام text for available status';
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          // Enhanced available status logging - Requirement 2.1, 2.2
          const availableStatusDetails = {
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed,
            // Additional available status analysis
            detectionDetails: {
              detectedText: 'قابل ثبت نام',
              detectionMethod: 'Persian text content',
              priority: 'high',
              elementClasses: Array.from(element.classList || []),
              textContent: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
              hasActiveButton: hasActiveRegistrationButton,
              hasAvailableText: hasPersianAvailableText
            }
          };
          
          inspectionData.statusDecisions.push(availableStatusDetails);
          
          // Enhanced logging message - Requirement 2.1, 2.2
          const availableLogMessage = 'Element ' + elementIndex + ': ' + reasoning + ' - marking as available (EXPLICIT AVAILABLE) - ' +
            'Classes: [' + Array.from(element.classList || []).join(', ') + '], Active button: ' + hasActiveRegistrationButton;
          
          inspectionData.parsingNotes.push(availableLogMessage);
          
          // Log to console for immediate debugging - Requirement 2.2
          console.log('✅ Available Status Detection (Explicit):', {
            elementIndex,
            reasoning,
            detectedText: 'قابل ثبت نام',
            confidence,
            elementClasses: Array.from(element.classList || []),
            hasActiveButton: hasActiveRegistrationButton
          });
          
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        if (hasRegistrationButton) {
          statusIndicators.push({
            type: 'interactive-element',
            value: 'active registration button',
            weight: 0.9,
            source: 'element'
          });
          
          finalStatus = 'available';
          confidence = 0.9;
          reasoning = 'Found active registration button without disabled attributes';
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          inspectionData.statusDecisions.push({
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed
          });
          
          inspectionData.parsingNotes.push('Element ' + elementIndex + ': ' + reasoning + ' - marking as available');
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        if (hasRegistrationLink || hasOtherPersianAvailableText || hasEnglishAvailableText || hasOnclickAttribute) {
          
          // Determine which indicator was found and add to status indicators
          if (hasRegistrationLink) {
            statusIndicators.push({
              type: 'interactive-element',
              value: 'registration link',
              weight: 0.85,
              source: 'element'
            });
            reasoning = 'Found registration link';
          } else if (hasOtherPersianAvailableText) {
            const persianTexts = ['ثبت نام', 'رزرو', 'موجود', 'آزاد', 'باز'];
            const foundText = persianTexts.find(t => text.includes(t) || html.includes(t));
            statusIndicators.push({
              type: 'text-content',
              value: 'Persian: ' + foundText,
              weight: 0.8,
              source: 'element'
            });
            reasoning = 'Found Persian available text: ' + foundText;
          } else if (hasEnglishAvailableText) {
            const englishTexts = ['available', 'register now', 'book now', 'reserve now', 'sign up', 'enroll', 'open for registration'];
            const foundText = englishTexts.find(t => lowerText.includes(t));
            statusIndicators.push({
              type: 'text-content',
              value: 'English: ' + foundText,
              weight: 0.8,
              source: 'element'
            });
            reasoning = 'Found English available text: ' + foundText;
          } else if (hasOnclickAttribute) {
            statusIndicators.push({
              type: 'interactive-element',
              value: 'onclick attribute',
              weight: 0.75,
              source: 'element'
            });
            reasoning = 'Found onclick attribute indicating clickable appointment';
          }
          
          finalStatus = 'available';
          confidence = Math.max(...statusIndicators.map(i => i.weight));
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          inspectionData.statusDecisions.push({
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed
          });
          
          inspectionData.parsingNotes.push('Element ' + elementIndex + ': ' + reasoning + ' - marking as available');
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        // STEP 3: CONSERVATIVE UNKNOWN STATUS HANDLING
        // If no filled or available indicators found, mark as unknown for safety
        
        // Check for not-registerable status (different from filled)
        if (lowerText.includes('not registerable') ||
            lowerText.includes('registration closed') ||
            lowerText.includes('expired') ||
            lowerText.includes('deadline passed') ||
            text.includes('قابل ثبت نام نیست') ||
            text.includes('مهلت ثبت نام گذشته') ||
            text.includes('منقضی شده')) {
          
          statusIndicators.push({
            type: 'text-content',
            value: 'not-registerable indicator',
            weight: 0.9,
            source: 'element'
          });
          
          finalStatus = 'not-registerable';
          confidence = 0.9;
          reasoning = 'Found not-registerable indicator';
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          inspectionData.statusDecisions.push({
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed
          });
          
          inspectionData.parsingNotes.push('Element ' + elementIndex + ': ' + reasoning);
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        // Check for pending/waiting status
        if (lowerText.includes('pending') || 
            lowerText.includes('waiting') ||
            lowerText.includes('in progress') ||
            lowerText.includes('processing') ||
            text.includes('در انتظار') ||
            text.includes('در حال بررسی') ||
            text.includes('در حال پردازش')) {
          
          statusIndicators.push({
            type: 'text-content',
            value: 'pending/waiting indicator',
            weight: 0.8,
            source: 'element'
          });
          
          finalStatus = 'pending';
          confidence = 0.8;
          reasoning = 'Found pending/waiting indicator';
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          inspectionData.statusDecisions.push({
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed
          });
          
          inspectionData.parsingNotes.push('Element ' + elementIndex + ': ' + reasoning);
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        // Conservative contextual analysis - only for appointment-like elements
        const hasDateInfo = /\\d{4}-\\d{2}-\\d{2}|\\d{2}\\/\\d{2}\\/\\d{4}|\\d{1,2}\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(text);
        const hasTimeInfo = /\\d{1,2}:\\d{2}/.test(text);
        const hasPersianDate = /\\d{4}\\/\\d{1,2}\\/\\d{1,2}|\\d{1,2}\\s+(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)/.test(text);
        const hasAppointmentContent = lowerText.includes('ielts') ||
                                     lowerText.includes('exam') ||
                                     lowerText.includes('test') ||
                                     text.includes('آزمون') ||
                                     text.includes('امتحان');
        
        if (hasDateInfo || hasTimeInfo || hasPersianDate || hasAppointmentContent) {
          // Conservative approach: Mark as unknown when no clear status indicators are found
          // Requirement 6.1, 6.2: Never default to available without explicit indicators
          statusIndicators.push({
            type: 'contextual',
            value: 'appointment data present, no clear status indicators',
            weight: 0.1,
            source: 'element'
          });
          
          finalStatus = 'unknown';
          confidence = 0.1;
          reasoning = 'Has appointment data but no clear status indicators - conservative unknown status';
          fallbackUsed = true;
          
          const statusDetectionEnd = performance.now();
          inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
          
          // Enhanced unknown status logging - Requirement 2.1, 2.2, 2.4
          const unknownStatusDetails = {
            elementIndex,
            finalStatus,
            indicators: statusIndicators,
            reasoning,
            confidenceScore: confidence,
            rawHtml: element.outerHTML || '',
            fallbackUsed,
            // Additional unknown status analysis - Requirement 2.4
            detectedContent: {
              hasDateInfo,
              hasTimeInfo,
              hasPersianDate,
              hasAppointmentContent,
              textContent: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
              elementClasses: Array.from(element.classList || []),
              childElementCount: element.children ? element.children.length : 0
            },
            // Capture complete HTML structure for analysis - Task requirement
            completeHtmlStructure: {
              outerHTML: element.outerHTML || '',
              innerHTML: element.innerHTML || '',
              tagName: element.tagName || '',
              attributes: element.attributes ? Array.from(element.attributes).map(attr => ({
                name: attr.name,
                value: attr.value
              })) : [],
              parentElement: element.parentElement ? {
                tagName: element.parentElement.tagName,
                className: element.parentElement.className,
                outerHTML: element.parentElement.outerHTML.substring(0, 300) + '...'
              } : null
            }
          };
          
          inspectionData.statusDecisions.push(unknownStatusDetails);
          
          // Enhanced logging for unknown appointments - Requirement 2.1, 2.2
          const unknownLogMessage = 'Element ' + elementIndex + ': ' + reasoning + ' (CONSERVATIVE UNKNOWN) - ' +
            'Content indicators: date=' + hasDateInfo + ', time=' + hasTimeInfo + ', persian=' + hasPersianDate + 
            ', appointment=' + hasAppointmentContent + ' - Classes: [' + Array.from(element.classList || []).join(', ') + ']';
          
          inspectionData.parsingNotes.push(unknownLogMessage);
          
          // Log to console for immediate debugging - Requirement 2.2
          console.log('🔍 Unknown Status Detection:', {
            elementIndex,
            reasoning,
            detectedIndicators: {
              hasDateInfo,
              hasTimeInfo,
              hasPersianDate,
              hasAppointmentContent
            },
            elementClasses: Array.from(element.classList || []),
            textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
          });
          
          return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
        }
        
        // Final unknown status for any other elements
        finalStatus = 'unknown';
        confidence = 0.0;
        reasoning = 'Could not determine status from any indicators - conservative unknown';
        fallbackUsed = true;
        
        const statusDetectionEnd = performance.now();
        inspectionData.performanceMetrics.statusDetectionTime += (statusDetectionEnd - statusDetectionStart);
        
        // Enhanced final unknown status logging - Requirement 2.1, 2.2, 2.4
        const finalUnknownDetails = {
          elementIndex,
          finalStatus,
          indicators: statusIndicators,
          reasoning,
          confidenceScore: confidence,
          rawHtml: element.outerHTML || '',
          fallbackUsed,
          // Complete analysis for final unknown status
          analysisDetails: {
            textContent: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            elementClasses: Array.from(element.classList || []),
            childElementCount: element.children ? element.children.length : 0,
            hasAnyContent: text.length > 0,
            elementType: element.tagName || 'unknown'
          },
          // Capture complete HTML structure for analysis - Task requirement
          completeHtmlStructure: {
            outerHTML: element.outerHTML || '',
            innerHTML: element.innerHTML || '',
            tagName: element.tagName || '',
            attributes: element.attributes ? Array.from(element.attributes).map(attr => ({
              name: attr.name,
              value: attr.value
            })) : [],
            parentElement: element.parentElement ? {
              tagName: element.parentElement.tagName,
              className: element.parentElement.className,
              outerHTML: element.parentElement.outerHTML.substring(0, 300) + '...'
            } : null,
            siblingElements: element.parentElement ? Array.from(element.parentElement.children).map((sibling, idx) => ({
              index: idx,
              tagName: sibling.tagName,
              className: sibling.className,
              textContent: sibling.textContent ? sibling.textContent.substring(0, 50) + '...' : ''
            })) : []
          }
        };
        
        inspectionData.statusDecisions.push(finalUnknownDetails);
        
        // Enhanced logging for final unknown status - Requirement 2.1, 2.2
        const finalUnknownLogMessage = 'Element ' + elementIndex + ': ' + reasoning + ' - ' +
          'Element type: ' + (element.tagName || 'unknown') + ', Classes: [' + 
          Array.from(element.classList || []).join(', ') + '], Content length: ' + text.length;
        
        inspectionData.parsingNotes.push(finalUnknownLogMessage);
        
        // Log to console for immediate debugging - Requirement 2.2
        console.log('🔍 Final Unknown Status:', {
          elementIndex,
          reasoning,
          elementType: element.tagName || 'unknown',
          elementClasses: Array.from(element.classList || []),
          contentLength: text.length,
          hasContent: text.length > 0
        });
        
        return { status: finalStatus, confidence, indicators: statusIndicators, reasoning, fallbackUsed };
      };

      const extractPrice = (text, element) => {
        // First try to extract from h6 tag (IELTS-specific structure)
        const h6Element = element ? element.querySelector('h6') : null;
        if (h6Element) {
          const h6Text = h6Element.textContent || '';
          const priceMatch = h6Text.match(/(\\d+(?:,\\d{3})*)\\s*(?:ریال|تومان|toman|rial|$)/i);
          if (priceMatch) {
            const price = parseInt(priceMatch[1].replace(/,/g, ''));
            inspectionData.parsingNotes.push('Extracted price from h6 element: ' + price);
            return price;
          }
        }
        
        // Fallback to text matching
        const priceMatch = text.match(/(\\d+(?:,\\d{3})*)\\s*(?:ریال|تومان|toman|rial|$)/i);
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
        const rawHtml = element.outerHTML || '';
        
        // Store raw HTML for inspection
        inspectionData.rawAppointmentHtml.push(rawHtml);
        
        // Enhanced date extraction for IELTS-specific structure
        let extractedDate = '';
        let extractedTime = '';
        
        // Try to extract date from <time><date><span> structure first
        const timeElement = element.querySelector('time date span');
        if (timeElement) {
          const dateSpans = element.querySelectorAll('time date span');
          if (dateSpans.length >= 2) {
            const dayMonth = dateSpans[0].textContent?.trim() || '';
            const year = dateSpans[1].textContent?.trim() || '';
            
            // Parse "27 Oct" format
            const dayMonthMatch = dayMonth.match(/(\\d{1,2})\\s+(\\w{3})/);
            if (dayMonthMatch && year) {
              const day = dayMonthMatch[1].padStart(2, '0');
              const monthName = dayMonthMatch[2];
              const monthMap = {
                'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
              };
              const month = monthMap[monthName] || '01';
              extractedDate = year + '-' + month + '-' + day;
              inspectionData.parsingNotes.push('Extracted date from time/date/span structure: ' + extractedDate);
            }
          }
        }
        
        // Try to extract time from <em> tag with Persian time format
        const emElement = element.querySelector('em');
        if (emElement) {
          const emText = emElement.textContent || '';
          // Match Persian time format like "ظهر (۱۳:۳۰ - ۱۶:۳۰)" or "صبح (۰۹:۰۰ - ۱۲:۰۰)"
          const persianTimeMatch = emText.match(/([^(]+)\\s*\\(([^)]+)\\)/);
          if (persianTimeMatch) {
            const timePeriod = persianTimeMatch[1].trim(); // ظهر, صبح, etc.
            const timeRange = persianTimeMatch[2].trim(); // ۱۳:۳۰ - ۱۶:۳۰
            
            // Convert Persian digits to English
            const convertPersianDigits = (str) => {
              const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
              const englishDigits = '0123456789';
              return str.replace(/[۰-۹]/g, (char) => {
                return englishDigits[persianDigits.indexOf(char)];
              });
            };
            
            const englishTimeRange = convertPersianDigits(timeRange);
            extractedTime = timePeriod + ' (' + englishTimeRange + ')';
            inspectionData.parsingNotes.push('Extracted Persian time from em element: ' + extractedTime);
          }
        }
        
        // Fallback to regex-based extraction if structured extraction failed
        if (!extractedDate) {
          const dateMatch = textContent.match(/(\\d{4}-\\d{2}-\\d{2}|\\d{2}\\/\\d{2}\\/\\d{4})/);
          extractedDate = dateMatch ? normalizeDate(dateMatch[1]) : new Date().toISOString().split('T')[0];
        }
        
        if (!extractedTime) {
          const timeMatch = textContent.match(/(\\d{1,2}:\\d{2}(?:\\s*-\\s*\\d{1,2}:\\d{2})?)/);
          extractedTime = timeMatch ? timeMatch[1] : 'TBD';
        }
        
        // Enhanced status detection with detailed logging
        const statusResult = detectAppointmentStatus(element, index);
        
        if (!extractedDate && !extractedTime && statusResult.status === 'unknown') {
          return null;
        }
        
        return {
          id: 'appointment-' + Date.now() + '-' + index,
          date: extractedDate,
          time: extractedTime,
          location: extractLocation(textContent, element),
          examType: extractExamType(textContent, element),
          city: extractCity(textContent, element),
          status: statusResult.status,
          price: extractPrice(textContent, element),
          registrationUrl: extractRegistrationUrl(element),
          rawHtml: rawHtml,
          // Enhanced appointment metadata
          detectionMethod: 'enhanced-multi-strategy',
          statusIndicators: statusResult.indicators.map(i => i.type + ':' + i.value),
          confidenceScore: statusResult.confidence,
          parsingNotes: ['Status: ' + statusResult.reasoning],
          elementIndex: index
        };
      };
      
      // Check for "no appointments" indicators first
      const pageText = document.body.textContent || '';
      const pageHtml = document.body.innerHTML || '';
      
      // Persian indicators for no appointments
      if (pageText.includes('هیچ آزمونی پیدا نشد') || 
          pageText.includes('آزمونی پیدا نشد') ||
          pageText.includes('موردی یافت نشد')) {
        inspectionData.parsingNotes.push('Found Persian no-appointments indicator');
        return {
          type: 'no-slots',
          appointmentCount: 0,
          availableCount: 0,
          filledCount: 0,
          appointments: [],
          inspectionData: inspectionData
        };
      }
      
      // English indicators for no appointments
      if (pageText.toLowerCase().includes('no appointments found') || 
          pageText.toLowerCase().includes('no exams available') ||
          pageText.toLowerCase().includes('not found')) {
        inspectionData.parsingNotes.push('Found English no-appointments indicator');
        return {
          type: 'no-slots',
          appointmentCount: 0,
          availableCount: 0,
          filledCount: 0,
          appointments: [],
          inspectionData: inspectionData
        };
      }
      
      // Enhanced appointment element detection with IELTS-specific selectors and fallback chain
      const detectAppointmentElements = () => {
        // IELTS-specific selectors (highest priority) - Requirements 3.1, 4.1
        const ieltsSelectors = [
          'a.exam__item.ielts',
          'a.exam__item', 
          '.exam__item.ielts',
          '.exam__item'
        ];
        
        // Common appointment selectors - Requirements 3.2
        const commonSelectors = [
          '.appointment-card',
          '.timetable-item', 
          '.exam-slot',
          '.appointment-item',
          '[data-appointment]',
          '[data-appointment-id]',
          '.card.appointment',
          '.card.exam',
          '.exam-card',
          '.slot-card',
          '.appointment',
          '.exam-time',
          '.time-slot'
        ];
        
        // Framework-based selectors - Requirements 3.2
        const frameworkSelectors = [
          '.card-body',
          '.list-group-item',
          '.panel-body',
          '.content-item',
          '.item'
        ];
        
        // Test simulation server specific selectors - Requirements 4.2, 4.4
        const testServerSelectors = [
          '.appointment-card.timetable-item',
          '.appointment-card.exam-slot',
          '.timetable-item.exam-slot',
          'div[data-appointment]',
          'div[class*="appointment"][class*="card"]',
          'div[class*="timetable"][class*="item"]'
        ];
        
        let detectionLog = '';
        
        // Strategy 1: Try IELTS-specific selectors first
        for (const selector of ieltsSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            detectionLog = 'Found ' + elements.length + ' elements with IELTS-specific selector: ' + selector;
            return {
              elements: Array.from(elements),
              selector: selector,
              strategy: 'IELTS-specific',
              detectionLog: detectionLog
            };
          }
        }
        
        // Strategy 2: Try test simulation server selectors
        for (const selector of testServerSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            detectionLog = 'Found ' + elements.length + ' elements with test server selector: ' + selector;
            return {
              elements: Array.from(elements),
              selector: selector,
              strategy: 'test-server-specific',
              detectionLog: detectionLog
            };
          }
        }
        
        // Strategy 3: Try common appointment selectors
        for (const selector of commonSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            detectionLog = 'Found ' + elements.length + ' elements with common selector: ' + selector;
            return {
              elements: Array.from(elements),
              selector: selector,
              strategy: 'common-selectors',
              detectionLog: detectionLog
            };
          }
        }
        
        // Strategy 4: Try framework-based selectors with content filtering
        for (const selector of frameworkSelectors) {
          const elements = document.querySelectorAll(selector);
          const filteredElements = Array.from(elements).filter(el => {
            const text = el.textContent || '';
            const hasAppointmentKeywords = /exam|test|appointment|slot|ielts|cdielts|تست|آزمون|قرار ملاقات/i.test(text);
            const hasDateInfo = /\\d{4}-\\d{2}-\\d{2}|\\d{2}\\/\\d{2}\\/\\d{4}|\\d{1,2}\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(text);
            const hasTimeInfo = /\\d{1,2}:\\d{2}/.test(text);
            return hasAppointmentKeywords || hasDateInfo || hasTimeInfo;
          });
          
          if (filteredElements.length > 0) {
            detectionLog = 'Found ' + filteredElements.length + ' elements with framework selector (filtered): ' + selector;
            return {
              elements: filteredElements,
              selector: selector + ' (filtered)',
              strategy: 'framework-filtered',
              detectionLog: detectionLog
            };
          }
        }
        
        // Strategy 5: Broader selectors with content filtering - Requirements 3.3
        const broadSelectors = [
          'div[class*="appointment"], div[class*="exam"], div[class*="slot"]',
          '.row .col, .row > div',
          'div[class*="card"], div[class*="item"]',
          'li, .list-item'
        ];
        
        for (const selector of broadSelectors) {
          const elements = document.querySelectorAll(selector);
          const filteredElements = Array.from(elements).filter(el => {
            const text = el.textContent || '';
            const hasDate = /\\d{4}-\\d{2}-\\d{2}|\\d{2}\\/\\d{2}\\/\\d{4}/.test(text);
            const hasTime = /\\d{1,2}:\\d{2}/.test(text);
            const hasAppointmentKeywords = /exam|test|appointment|slot|ielts|cdielts|تست|آزمون/i.test(text);
            return hasDate || hasTime || hasAppointmentKeywords;
          });
          
          if (filteredElements.length > 0) {
            detectionLog = 'Found ' + filteredElements.length + ' elements with broad selector (filtered): ' + selector;
            return {
              elements: filteredElements,
              selector: selector + ' (filtered)',
              strategy: 'broad-filtered',
              detectionLog: detectionLog
            };
          }
        }
        
        // Strategy 6: Table-based detection - Requirements 3.3
        const tableRows = document.querySelectorAll('table tr, tbody tr, .table tr');
        const appointmentRows = Array.from(tableRows).filter(row => {
          const text = row.textContent || '';
          const hasDate = /\\d{4}-\\d{2}-\\d{2}|\\d{2}\\/\\d{2}\\/\\d{4}/.test(text);
          const hasTime = /\\d{1,2}:\\d{2}/.test(text);
          const hasAppointmentKeywords = /exam|test|appointment|ielts|cdielts/i.test(text);
          return (hasDate && hasTime) || hasAppointmentKeywords;
        });
        
        if (appointmentRows.length > 0) {
          detectionLog = 'Found ' + appointmentRows.length + ' appointment rows in tables';
          return {
            elements: appointmentRows,
            selector: 'table rows (filtered)',
            strategy: 'table-based',
            detectionLog: detectionLog
          };
        }
        
        // Strategy 7: Pattern-based detection for elements containing date/time - Requirements 3.3
        const allElements = document.querySelectorAll('div, section, article, li, td');
        const patternElements = Array.from(allElements).filter(el => {
          const text = el.textContent || '';
          const hasDateTimePattern = /\\d{4}-\\d{2}-\\d{2}.*\\d{1,2}:\\d{2}|\\d{1,2}:\\d{2}.*\\d{4}-\\d{2}-\\d{2}/.test(text);
          const hasAppointmentContext = /exam|test|appointment|ielts|cdielts/i.test(text);
          const hasMinimumContent = text.trim().length > 20; // Avoid empty or very short elements
          
          return hasDateTimePattern && hasAppointmentContext && hasMinimumContent;
        });
        
        if (patternElements.length > 0) {
          detectionLog = 'Found ' + patternElements.length + ' elements with date/time patterns';
          return {
            elements: patternElements,
            selector: 'pattern-based detection',
            strategy: 'pattern-matching',
            detectionLog: detectionLog
          };
        }
        
        // No elements found
        detectionLog = 'No appointment elements found with any detection strategy';
        return {
          elements: [],
          selector: 'none',
          strategy: 'no-detection',
          detectionLog: detectionLog
        };
      };
      
      const detectionResult = detectAppointmentElements();
      
      let appointmentElements = detectionResult.elements;
      let usedSelector = detectionResult.selector;
      
      // Log detection results
      inspectionData.detectedElements.push(detectionResult.detectionLog);
      inspectionData.parsingNotes.push('Detection strategy: ' + detectionResult.strategy);
      inspectionData.parsingNotes.push('Elements found: ' + detectionResult.elements.length + ' with selector: ' + detectionResult.selector);
      
      inspectionData.detectedElements.push('Total elements found: ' + (appointmentElements ? appointmentElements.length : 0));
      
      if (!appointmentElements || appointmentElements.length === 0) {
        // Check if page indicates all slots are filled
        if (pageText.includes('تکمیل ظرفیت') || 
            pageText.toLowerCase().includes('all slots filled') ||
            pageText.toLowerCase().includes('fully booked')) {
          inspectionData.parsingNotes.push('Page indicates all slots are filled');
          return {
            type: 'filled',
            appointmentCount: 0,
            availableCount: 0,
            filledCount: 1, // Indicate that there were slots but they're filled
            appointments: [],
            inspectionData: inspectionData
          };
        }
        
        inspectionData.parsingNotes.push('No appointment elements found - assuming no slots available');
        return {
          type: 'no-slots',
          appointmentCount: 0,
          availableCount: 0,
          filledCount: 0,
          appointments: [],
          inspectionData: inspectionData
        };
      }
      
      // Parse each appointment element
      appointmentElements.forEach((element, index) => {
        try {
          const appointment = extractAppointmentFromElement(element, index);
          if (appointment) {
            appointments.push(appointment);
          }
        } catch (error) {
          inspectionData.parsingNotes.push('Failed to parse appointment element ' + index + ': ' + error.message);
        }
      });
      
      // Calculate status counts
      const availableCount = appointments.filter(apt => apt.status === 'available').length;
      const filledCount = appointments.filter(apt => apt.status === 'filled').length;
      const pendingCount = appointments.filter(apt => apt.status === 'pending').length;
      
      // Determine overall result type
      let resultType = 'no-slots';
      if (availableCount > 0) {
        resultType = 'available';
      } else if (filledCount > 0 || pendingCount > 0) {
        resultType = 'filled';
      }
      
      // Calculate final performance metrics
      const endTime = performance.now();
      inspectionData.performanceMetrics.totalProcessingTime = endTime - startTime;
      
      inspectionData.parsingNotes.push('Status summary: available=' + availableCount + ', filled=' + filledCount + ', pending=' + pendingCount);
      inspectionData.parsingNotes.push('Performance: total=' + Math.round(inspectionData.performanceMetrics.totalProcessingTime) + 'ms, ' +
        'detection=' + Math.round(inspectionData.performanceMetrics.elementDetectionTime) + 'ms, ' +
        'status=' + Math.round(inspectionData.performanceMetrics.statusDetectionTime) + 'ms, ' +
        'parsing=' + Math.round(inspectionData.performanceMetrics.parsingTime) + 'ms');
      
      return {
        type: resultType,
        appointmentCount: appointments.length,
        availableCount: availableCount,
        filledCount: filledCount + pendingCount,
        appointments: appointments,
        inspectionData: inspectionData
      };
    })()`);
    
    // Add metadata to the result
    const resultData = result as any;
    const checkResult: CheckResult = {
      type: resultData.type as 'available' | 'filled' | 'no-slots',
      appointmentCount: resultData.appointmentCount,
      availableCount: resultData.availableCount,
      filledCount: resultData.filledCount,
      timestamp: new Date(),
      url: url,
      appointments: resultData.appointments as Appointment[]
    };

    // Save enhanced inspection data for debugging and verification
    try {
      const pageTitle = await page.title();
      
      // Create enhanced inspection data with detailed status detection reasoning
      const enhancedInspectionData: EnhancedInspectionData = {
        // Basic inspection data
        url: url,
        pageTitle: pageTitle,
        detectedElements: resultData.inspectionData?.detectedElements || [],
        parsingNotes: resultData.inspectionData?.parsingNotes?.join('; ') || 'No parsing notes available',
        rawAppointmentHtml: resultData.inspectionData?.rawAppointmentHtml || [],
        checkResult: checkResult,
        
        // Enhanced detection details
        detectionStrategies: this.createDetectionStrategies(resultData.inspectionData?.selectorResults || []),
        statusDecisions: resultData.inspectionData?.statusDecisions || [],
        selectorResults: resultData.inspectionData?.selectorResults || [],
        validationChecks: this.validateDetectionResults(checkResult.appointments, resultData.inspectionData?.statusDecisions || []),
        errorLog: resultData.inspectionData?.errorLog || [],
        performanceMetrics: resultData.inspectionData?.performanceMetrics || {
          totalProcessingTime: 0,
          elementDetectionTime: 0,
          statusDetectionTime: 0,
          parsingTime: 0
        }
      };
      
      // Save both basic and enhanced inspection data
      await this.dataInspectionService.saveInspectionData({
        url: enhancedInspectionData.url,
        pageTitle: enhancedInspectionData.pageTitle,
        detectedElements: enhancedInspectionData.detectedElements,
        parsingNotes: enhancedInspectionData.parsingNotes,
        rawAppointmentHtml: enhancedInspectionData.rawAppointmentHtml,
        checkResult: enhancedInspectionData.checkResult
      });
      
      const enhancedInspectionId = await this.enhancedInspectionService.saveEnhancedInspectionData(enhancedInspectionData);
      
      console.log(`🔍 Enhanced inspection data saved (ID: ${enhancedInspectionId}) for ${checkResult.type} result with ${checkResult.appointmentCount} appointments`);
      console.log(`📊 Detection summary: ${resultData.inspectionData?.statusDecisions?.length || 0} status decisions, ${resultData.inspectionData?.errorLog?.length || 0} errors, ${Math.round(enhancedInspectionData.performanceMetrics.totalProcessingTime)}ms total time`);
    } catch (inspectionError) {
      console.warn('⚠️  Failed to save inspection data:', inspectionError instanceof Error ? inspectionError.message : inspectionError);
    }
    
    return checkResult;
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
   * Enhanced scraping method with status detection
   */
  private async scrapeAppointmentsWithStatusFromUrl(url: string): Promise<CheckResult> {
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
      
      // Wait for content to load with better error handling
      try {
        await page.waitForSelector('body', { timeout: 15000 });
        console.log('📄 Page loaded successfully');
      } catch (selectorError) {
        console.log('⚠️  Page load timeout, attempting to parse anyway...');
      }
      
      // Extract appointment data with enhanced status detection
      try {
        const checkResult = await this.parseAppointmentDataWithStatus(page, url);
        return checkResult;
      } catch (parseError) {
        throw new Error(`Enhanced appointment parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
      }
      
    } catch (error) {
      const contextualError = new Error(`Enhanced scraping failed for URL ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof Error && error.stack) {
        contextualError.stack = error.stack;
      }
      throw contextualError;
    } finally {
      await page.close();
    }
  }

  /**
   * Fetch appointments with status from API (for test server)
   */
  private async fetchAppointmentsWithStatusFromAPI(filters: ScrapingFilters): Promise<CheckResult> {
    try {
      console.log(`🔍 Fetching appointments with status from test server API: ${this.baseUrl}`);
      
      const axios = await import('axios');
      
      const apiUrl = this.baseUrl.replace('/ielts/timetable', '') + '/api/appointments';
      const response = await axios.default.get(apiUrl);
      let appointments = response.data;

      // Ensure appointments is an array
      if (!Array.isArray(appointments)) {
        console.log(`⚠️  API returned non-array data:`, typeof appointments);
        // If it's an object with appointments property, extract it
        if (appointments && appointments.appointments && Array.isArray(appointments.appointments)) {
          appointments = appointments.appointments;
        } else {
          // If no valid appointments found, return empty array
          appointments = [];
        }
      }

      // Apply filters to the appointments
      const filteredAppointments = this.applyFiltersToAppointments(appointments, filters);

      // Calculate status counts
      const availableCount = filteredAppointments.filter(apt => apt.status === 'available').length;
      const filledCount = filteredAppointments.filter(apt => apt.status === 'filled' || apt.status === 'pending').length;
      
      // Determine result type
      let resultType: 'available' | 'filled' | 'no-slots' = 'no-slots';
      if (availableCount > 0) {
        resultType = 'available';
      } else if (filledCount > 0) {
        resultType = 'filled';
      }

      const checkResult: CheckResult = {
        type: resultType,
        appointmentCount: filteredAppointments.length,
        availableCount: availableCount,
        filledCount: filledCount,
        timestamp: new Date(),
        url: this.buildRequestUrl(filters),
        appointments: filteredAppointments
      };

      this.logEnhancedScrapingResults(checkResult, 0);
      
      return checkResult;
    } catch (error) {
      console.error(`❌ Enhanced API fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to fetch appointments with status from API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Log enhanced scraping results with detailed status information
   */
  private logEnhancedScrapingResults(checkResult: CheckResult, attempt: number): void {
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`📊 [${timestamp}] Enhanced scraping result:`);
    console.log(`   Type: ${checkResult.type}`);
    console.log(`   Total appointments: ${checkResult.appointmentCount}`);
    console.log(`   Available: ${checkResult.availableCount}`);
    console.log(`   Filled/Pending: ${checkResult.filledCount}`);
    
    if (checkResult.appointments.length > 0) {
      // Show sample appointments (first 3)
      const sampleAppointments = checkResult.appointments.slice(0, 3);
      console.log(`   Sample appointments:`);
      sampleAppointments.forEach((apt, index) => {
        console.log(`     ${index + 1}. ${apt.date} ${apt.time} - ${apt.city} (${apt.status})`);
      });
      
      if (checkResult.appointments.length > 3) {
        console.log(`     ... and ${checkResult.appointments.length - 3} more`);
      }
    } else {
      if (checkResult.type === 'no-slots') {
        console.log(`   Status: No appointment slots available`);
      } else if (checkResult.type === 'filled') {
        console.log(`   Status: All appointment slots are filled`);
      }
    }
    
    if (attempt > 0) {
      console.log(`   Note: Retrieved after ${attempt + 1} attempts`);
    }
  }

  /**
   * Enhanced scraping with timeout and error handling (legacy method)
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
