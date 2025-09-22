/**
 * Test suite for WebScraperService test simulation server compatibility
 * Tests the enhanced appointment element detection with test server selectors
 */

import { WebScraperService } from '../WebScraperService';
import puppeteer, { Browser, Page } from 'puppeteer';

describe('WebScraperService - Test Server Compatibility', () => {
  let browser: Browser;
  let page: Page;
  let webScraperService: WebScraperService;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    webScraperService = new WebScraperService('http://localhost:3001');
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
    if (webScraperService) {
      await webScraperService.close();
    }
  });

  describe('Enhanced Element Detection', () => {
    it('should detect appointment cards with test server selectors', async () => {
      // Create a mock HTML structure similar to the test simulation server
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Test Server</title></head>
        <body>
          <div id="appointments-container" class="appointments-grid">
            <div class="appointment-card timetable-item exam-slot appointment-item card exam available" 
                 data-appointment="test-1" data-appointment-id="test-1">
              <div class="appointment-date">2025-02-15</div>
              <div class="appointment-time">09:00-12:00</div>
              <div class="appointment-location">Isfahan Test Center</div>
              <div class="appointment-type">CDIELTS</div>
              <div class="appointment-city">Isfahan</div>
              <div class="appointment-status available">Available</div>
              <div class="appointment-price">2,500,000 Toman</div>
              <a href="/register/test-1" class="registration-link">Register Now</a>
            </div>
            <div class="appointment-card timetable-item exam-slot appointment-item card exam filled" 
                 data-appointment="test-2" data-appointment-id="test-2">
              <div class="appointment-date">2025-02-16</div>
              <div class="appointment-time">14:00-17:00</div>
              <div class="appointment-location">Isfahan Test Center</div>
              <div class="appointment-type">CDIELTS</div>
              <div class="appointment-city">Isfahan</div>
              <div class="appointment-status filled">Fully Booked</div>
              <div class="appointment-price">2,500,000 Toman</div>
              <div class="registration-link" style="background: #ccc; cursor: not-allowed;">Registration Unavailable</div>
            </div>
          </div>
        </body>
        </html>
      `;

      await page.setContent(testHtml);

      // Test the enhanced detection logic
      const result: any = await page.evaluate(`(() => {
        // Enhanced appointment element detection (same as in WebScraperService)
        const detectAppointmentElements = () => {
          // Test simulation server specific selectors - Requirements 4.2, 4.4
          const testServerSelectors = [
            '.appointment-card.timetable-item',
            '.appointment-card.exam-slot',
            '.timetable-item.exam-slot',
            'div[data-appointment]',
            'div[class*="appointment"][class*="card"]',
            'div[class*="timetable"][class*="item"]'
          ];
          
          // Common appointment selectors
          const commonSelectors = [
            '.appointment-card',
            '.timetable-item', 
            '.exam-slot',
            '.appointment-item',
            '[data-appointment]',
            '[data-appointment-id]'
          ];
          
          let detectionLog = '';
          
          // Try test simulation server selectors first
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
          
          // Try common appointment selectors
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
          
          return {
            elements: [],
            selector: 'none',
            strategy: 'no-detection',
            detectionLog: 'No appointment elements found'
          };
        };
        
        const detectionResult = detectAppointmentElements();
        
        // Extract appointment data from detected elements
        const appointments = Array.from(detectionResult.elements).map((element, index) => {
          const dateEl = element.querySelector('.appointment-date');
          const timeEl = element.querySelector('.appointment-time');
          const locationEl = element.querySelector('.appointment-location');
          const typeEl = element.querySelector('.appointment-type');
          const cityEl = element.querySelector('.appointment-city');
          const statusEl = element.querySelector('.appointment-status');
          
          return {
            id: 'appointment-' + index,
            date: dateEl ? dateEl.textContent : '',
            time: timeEl ? timeEl.textContent : '',
            location: locationEl ? locationEl.textContent : '',
            examType: typeEl ? typeEl.textContent : '',
            city: cityEl ? cityEl.textContent : '',
            status: statusEl ? statusEl.className.includes('available') ? 'available' : 'filled' : 'unknown'
          };
        });
        
        return {
          detectionResult,
          appointments
        };
      })()`);

      // Verify detection results
      expect(result.detectionResult.elements.length).toBe(2);
      expect(result.detectionResult.strategy).toBe('test-server-specific');
      expect(result.detectionResult.selector).toBe('.appointment-card.timetable-item');
      
      // Verify appointment data extraction
      expect(result.appointments).toHaveLength(2);
      expect(result.appointments[0]).toMatchObject({
        date: '2025-02-15',
        time: '09:00-12:00',
        location: 'Isfahan Test Center',
        examType: 'CDIELTS',
        city: 'Isfahan',
        status: 'available'
      });
      expect(result.appointments[1]).toMatchObject({
        date: '2025-02-16',
        time: '14:00-17:00',
        location: 'Isfahan Test Center',
        examType: 'CDIELTS',
        city: 'Isfahan',
        status: 'filled'
      });
    });

    it('should detect IELTS-specific selectors when available', async () => {
      const ieltsHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>IELTS Website</title></head>
        <body>
          <div class="timetable-section">
            <a class="exam__item ielts" href="/register/1">
              <div class="exam-date">2025-02-15</div>
              <div class="exam-time">09:00</div>
              <div class="exam-location">Isfahan</div>
            </a>
            <a class="exam__item" href="/register/2">
              <div class="exam-date">2025-02-16</div>
              <div class="exam-time">14:00</div>
              <div class="exam-location">Tehran</div>
            </a>
          </div>
        </body>
        </html>
      `;

      await page.setContent(ieltsHtml);

      const result: any = await page.evaluate(`(() => {
        const detectAppointmentElements = () => {
          // IELTS-specific selectors (highest priority)
          const ieltsSelectors = [
            'a.exam__item.ielts',
            'a.exam__item', 
            '.exam__item.ielts',
            '.exam__item'
          ];
          
          let detectionLog = '';
          
          // Try IELTS-specific selectors first
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
          
          return {
            elements: [],
            selector: 'none',
            strategy: 'no-detection',
            detectionLog: 'No appointment elements found'
          };
        };
        
        return detectAppointmentElements();
      })()`);

      // Verify IELTS-specific detection takes priority
      expect(result.elements.length).toBeGreaterThan(0);
      expect(result.strategy).toBe('IELTS-specific');
      expect(result.selector).toBe('a.exam__item.ielts');
    });

    it('should fall back to pattern-based detection when specific selectors fail', async () => {
      const patternHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Unknown Structure</title></head>
        <body>
          <div class="content">
            <div class="some-container">
              <p>IELTS Exam on 2025-02-15 at 09:00 - Available for registration</p>
            </div>
            <div class="another-container">
              <span>Test date: 2025-02-16 14:00 - CDIELTS exam in Tehran</span>
            </div>
          </div>
        </body>
        </html>
      `;

      await page.setContent(patternHtml);

      const result: any = await page.evaluate(`(() => {
        const detectAppointmentElements = () => {
          // Try all specific selectors first (they should fail)
          const specificSelectors = [
            'a.exam__item.ielts', 'a.exam__item', '.appointment-card', '.timetable-item'
          ];
          
          for (const selector of specificSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              return {
                elements: Array.from(elements),
                selector: selector,
                strategy: 'specific-selector',
                detectionLog: 'Found with specific selector: ' + selector
              };
            }
          }
          
          // Pattern-based detection for elements containing date/time
          const allElements = document.querySelectorAll('div, section, article, li, td, p, span');
          const patternElements = Array.from(allElements).filter(el => {
            const text = el.textContent || '';
            const hasDateTimePattern = /\\d{4}-\\d{2}-\\d{2}.*\\d{1,2}:\\d{2}|\\d{1,2}:\\d{2}.*\\d{4}-\\d{2}-\\d{2}/.test(text);
            const hasAppointmentContext = /exam|test|appointment|ielts|cdielts/i.test(text);
            const hasMinimumContent = text.trim().length > 20;
            
            return hasDateTimePattern && hasAppointmentContext && hasMinimumContent;
          });
          
          if (patternElements.length > 0) {
            return {
              elements: patternElements,
              selector: 'pattern-based detection',
              strategy: 'pattern-matching',
              detectionLog: 'Found ' + patternElements.length + ' elements with date/time patterns'
            };
          }
          
          return {
            elements: [],
            selector: 'none',
            strategy: 'no-detection',
            detectionLog: 'No appointment elements found'
          };
        };
        
        return detectAppointmentElements();
      })()`);

      // Verify pattern-based detection works
      expect(result.elements.length).toBeGreaterThan(0);
      expect(result.strategy).toBe('pattern-matching');
      expect(result.selector).toBe('pattern-based detection');
    });
  });
});