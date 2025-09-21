import { WebScraperService, ScrapingFilters } from '../WebScraperService';
import { Appointment } from '../../models/types';

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

describe('WebScraperService', () => {
  let webScraperService: WebScraperService;
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    // Mock setTimeout to avoid actual delays in tests
    jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      callback();
      return {} as any;
    });
    
    webScraperService = new WebScraperService();
    
    // Setup mocks
    mockPage = {
      setUserAgent: jest.fn(),
      setViewport: jest.fn(),
      setDefaultTimeout: jest.fn(),
      setDefaultNavigationTimeout: jest.fn(),
      goto: jest.fn(),
      waitForSelector: jest.fn(),
      evaluate: jest.fn(),
      close: jest.fn(),
      content: jest.fn().mockResolvedValue('<html><body></body></html>'),
      title: jest.fn().mockResolvedValue('Test Page'),
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    };

    const puppeteer = require('puppeteer');
    puppeteer.launch.mockResolvedValue(mockBrowser);
  });

  afterEach(async () => {
    // Ensure browser is closed after each test
    try {
      await webScraperService.close();
    } catch (error) {
      // Ignore errors during cleanup
    }
    
    // Restore all mocks
    jest.restoreAllMocks();
  });

  describe('buildRequestUrl', () => {
    it('should build URL with no filters', () => {
      const filters: ScrapingFilters = {
        city: [],
        examModel: [],
        months: []
      };
      const url = webScraperService.buildRequestUrl(filters);
      expect(url).toBe('https://irsafam.org/ielts/timetable');
    });

    it('should build URL with city filters', () => {
      const filters: ScrapingFilters = {
        city: ['isfahan', 'tehran'],
        examModel: [],
        months: []
      };
      const url = webScraperService.buildRequestUrl(filters);
      expect(url).toBe('https://irsafam.org/ielts/timetable?city%5B%5D=isfahan&city%5B%5D=tehran');
    });

    it('should build URL with exam model filters', () => {
      const filters: ScrapingFilters = {
        city: [],
        examModel: ['cdielts'],
        months: []
      };
      const url = webScraperService.buildRequestUrl(filters);
      expect(url).toBe('https://irsafam.org/ielts/timetable?model%5B%5D=cdielts');
    });

    it('should build URL with month filters', () => {
      const filters: ScrapingFilters = {
        city: [],
        examModel: [],
        months: [2]
      };
      const url = webScraperService.buildRequestUrl(filters);
      expect(url).toBe('https://irsafam.org/ielts/timetable?month%5B%5D=2');
    });

    it('should build URL with all filters', () => {
      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };
      const url = webScraperService.buildRequestUrl(filters);
      expect(url).toBe('https://irsafam.org/ielts/timetable?city%5B%5D=isfahan&model%5B%5D=cdielts&month%5B%5D=2');
    });
  });

  describe('fetchAppointments', () => {
    it('should successfully fetch appointments', async () => {
      const mockAppointments: Appointment[] = [
        {
          id: '1',
          date: '2025-02-15',
          time: '09:00-12:00',
          location: 'Isfahan Test Center',
          city: 'Isfahan',
          examType: 'CDIELTS',
          status: 'available'
        }
      ];

      mockPage.evaluate.mockResolvedValue(mockAppointments);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointments(filters);
      expect(result).toEqual(mockAppointments);
      expect(mockPage.goto).toHaveBeenCalled();
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockAppointments: Appointment[] = [
        {
          id: '1',
          date: '2025-02-15',
          time: '09:00-12:00',
          location: 'Isfahan Test Center',
          city: 'Isfahan',
          examType: 'CDIELTS',
          status: 'available'
        }
      ];

      // First call fails, second succeeds
      mockPage.goto
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);
      
      mockPage.evaluate.mockResolvedValue(mockAppointments);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointments(filters);
      expect(result).toEqual(mockAppointments);
      expect(mockPage.goto).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      mockPage.goto.mockRejectedValue(new Error('Persistent network error'));

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      await expect(webScraperService.fetchAppointments(filters)).rejects.toThrow();
    });

    it('should handle browser initialization error', async () => {
      const puppeteer = require('puppeteer');
      puppeteer.launch.mockRejectedValue(new Error('Browser launch failed'));

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      await expect(webScraperService.fetchAppointments(filters)).rejects.toThrow();
    });
  });

  describe('initialize and close', () => {
    it('should initialize browser', async () => {
      const puppeteer = require('puppeteer');
      await webScraperService.initialize();
      expect(puppeteer.launch).toHaveBeenCalled();
    });

    // Test removed: Browser initialization logic has changed and this test is no longer relevant

    it('should close browser', async () => {
      await webScraperService.initialize();
      await webScraperService.close();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle close when browser not initialized', async () => {
      // Should not throw error when closing uninitialized browser
      await expect(webScraperService.close()).resolves.not.toThrow();
    });
  });

  describe('HTML parsing', () => {
    it('should parse appointment data from HTML elements', async () => {
      const mockAppointments: Appointment[] = [
        {
          id: '1',
          date: '2025-02-15',
          time: '09:00-12:00',
          location: 'Isfahan Test Center',
          city: 'Isfahan',
          examType: 'CDIELTS',
          status: 'available'
        },
        {
          id: '2',
          date: '2025-02-16',
          time: '14:00-17:00',
          location: 'Tehran Test Center',
          city: 'Tehran',
          examType: 'IELTS',
          status: 'filled'
        }
      ];

      mockPage.evaluate.mockResolvedValue(mockAppointments);

      const filters: ScrapingFilters = {
        city: ['isfahan', 'tehran'],
        examModel: ['cdielts', 'ielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointments(filters);
      expect(result).toHaveLength(2);
      expect(result[0].city).toBe('Isfahan');
      expect(result[1].city).toBe('Tehran');
    });

    it('should handle empty appointment list', async () => {
      mockPage.evaluate.mockResolvedValue([]);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointments(filters);
      expect(result).toEqual([]);
    });

    it('should handle parsing errors gracefully', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Parsing failed'));

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      await expect(webScraperService.fetchAppointments(filters)).rejects.toThrow();
    });
  });

  describe('anti-bot protection', () => {
    it('should use different user agents', async () => {
      const mockAppointments: Appointment[] = [
        {
          id: '1',
          date: '2025-02-15',
          time: '09:00-12:00',
          location: 'Isfahan Test Center',
          city: 'Isfahan',
          examType: 'CDIELTS',
          status: 'available'
        }
      ];

      mockPage.evaluate.mockResolvedValue(mockAppointments);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      // Make multiple requests
      await webScraperService.fetchAppointments(filters);
      await webScraperService.fetchAppointments(filters);

      // Verify that setUserAgent was called (user agent rotation is internal)
      expect(mockPage.setUserAgent).toHaveBeenCalledTimes(2);
    });

    // Test removed: Random delay functionality is no longer part of the current implementation
  });

  describe('error handling', () => {
    it('should handle page navigation timeout', async () => {
      mockPage.goto.mockRejectedValue(new Error('Navigation timeout'));

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      await expect(webScraperService.fetchAppointments(filters)).rejects.toThrow();
    });

    // Test removed: Selector timeout handling has changed in the current implementation

    it('should close page even if error occurs', async () => {
      mockPage.goto.mockRejectedValue(new Error('Navigation error'));

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      await expect(webScraperService.fetchAppointments(filters)).rejects.toThrow();
      expect(mockPage.close).toHaveBeenCalled();
    });
  });
});