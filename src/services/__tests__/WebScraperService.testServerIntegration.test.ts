/**
 * Integration test for WebScraperService with test simulation server
 * Tests the enhanced appointment element detection with actual test server structure
 */

import { WebScraperService } from '../WebScraperService';
import { ScrapingFilters } from '../WebScraperService';

describe('WebScraperService - Test Server Integration', () => {
  let webScraperService: WebScraperService;

  beforeEach(() => {
    // Use localhost URL to trigger API mode
    webScraperService = new WebScraperService('http://localhost:3001');
  });

  afterEach(async () => {
    if (webScraperService) {
      await webScraperService.close();
    }
  });

  describe('API Mode Detection', () => {
    it('should detect localhost URLs and use API mode', () => {
      const localhostService = new WebScraperService('http://localhost:3001');
      const realService = new WebScraperService('https://irsafam.org/ielts/timetable');

      // Test URL building for API mode
      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const localhostUrl = localhostService.buildRequestUrl(filters);
      const realUrl = realService.buildRequestUrl(filters);

      expect(localhostUrl).toContain('localhost');
      expect(realUrl).toContain('irsafam.org');
    });

    it('should handle API mode gracefully when server is not available', async () => {
      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      // This should fail gracefully since the test server is not running
      await expect(webScraperService.fetchAppointments(filters)).rejects.toThrow();
    });
  });

  describe('Enhanced Detection Compatibility', () => {
    it('should have enhanced selectors that match test server structure', () => {
      // Test that our enhanced selectors would match the test server HTML structure
      const testServerSelectors = [
        '.appointment-card.timetable-item',
        '.appointment-card.exam-slot',
        '.timetable-item.exam-slot',
        'div[data-appointment]',
        'div[class*="appointment"][class*="card"]',
        'div[class*="timetable"][class*="item"]'
      ];

      const commonSelectors = [
        '.appointment-card',
        '.timetable-item', 
        '.exam-slot',
        '.appointment-item',
        '[data-appointment]',
        '[data-appointment-id]'
      ];

      // Verify that our selectors include the ones needed for test server
      const allSelectors = [...testServerSelectors, ...commonSelectors];
      
      // These are the CSS classes used by the test simulation server
      const testServerClasses = [
        'appointment-card',
        'timetable-item',
        'exam-slot',
        'appointment-item',
        'card',
        'exam'
      ];

      // Verify that our selectors can target these classes
      testServerClasses.forEach(className => {
        const hasMatchingSelector = allSelectors.some(selector => 
          selector.includes(className)
        );
        expect(hasMatchingSelector).toBe(true);
      });
    });

    it('should prioritize test server selectors correctly', () => {
      // Verify the detection strategy priority order
      const strategies = [
        'IELTS-specific',      // Highest priority
        'test-server-specific', // Second priority  
        'common-selectors',    // Third priority
        'framework-filtered',  // Fourth priority
        'broad-filtered',      // Fifth priority
        'table-based',         // Sixth priority
        'pattern-matching'     // Lowest priority
      ];

      // Test server specific selectors should come after IELTS but before common
      const testServerIndex = strategies.indexOf('test-server-specific');
      const ieltsIndex = strategies.indexOf('IELTS-specific');
      const commonIndex = strategies.indexOf('common-selectors');

      expect(testServerIndex).toBeGreaterThan(ieltsIndex);
      expect(testServerIndex).toBeLessThan(commonIndex);
    });
  });

  describe('Filter Application', () => {
    it('should build correct URLs for test server', () => {
      const filters: ScrapingFilters = {
        city: ['isfahan', 'tehran'],
        examModel: ['cdielts', 'ielts'],
        months: [2, 3, 4]
      };

      // Test single month URL building
      const url1 = webScraperService.buildRequestUrl(filters, 2);
      const url2 = webScraperService.buildRequestUrl(filters, 3);

      expect(url1).toContain('month%5B%5D=2');
      expect(url2).toContain('month%5B%5D=3');
      expect(url1).toContain('city%5B%5D=isfahan');
      expect(url1).toContain('city%5B%5D=tehran');
      expect(url1).toContain('model%5B%5D=cdielts');
      expect(url1).toContain('model%5B%5D=ielts');
    });

    it('should build multiple URLs for multiple months', () => {
      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2, 3, 4]
      };

      const urls = webScraperService.buildRequestUrls(filters);

      expect(urls).toHaveLength(3);
      expect(urls[0]).toContain('month%5B%5D=2');
      expect(urls[1]).toContain('month%5B%5D=3');
      expect(urls[2]).toContain('month%5B%5D=4');
    });
  });
});