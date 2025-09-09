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
      goto: jest.fn(),
      waitForSelector: jest.fn(),
      evaluate: jest.fn(),
      close: jest.fn(),
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    };

    const puppeteer = require('puppeteer');
    puppeteer.launch.mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
      expect(url).toBe('https://irsafam.org/ielts-timetable');
    });

    it('should build URL with city filters', () => {
      const filters: ScrapingFilters = {
        city: ['isfahan', 'tehran'],
        examModel: [],
        months: []
      };

      const url = webScraperService.buildRequestUrl(filters);
      expect(url).toBe('https://irsafam.org/ielts-timetable?city%5B%5D=isfahan&city%5B%5D=tehran');
    });

    it('should build URL with exam model filters', () => {
      const filters: ScrapingFilters = {
        city: [],
        examModel: ['cdielts'],
        months: []
      };

      const url = webScraperService.buildRequestUrl(filters);
      expect(url).toBe('https://irsafam.org/ielts-timetable?exam_model%5B%5D=cdielts');
    });

    it('should build URL with month filters', () => {
      const filters: ScrapingFilters = {
        city: [],
        examModel: [],
        months: [12, 1, 2]
      };

      const url = webScraperService.buildRequestUrl(filters);
      expect(url).toBe('https://irsafam.org/ielts-timetable?month%5B%5D=12&month%5B%5D=1&month%5B%5D=2');
    });

    it('should build URL with all filters', () => {
      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [12]
      };

      const url = webScraperService.buildRequestUrl(filters);
      expect(url).toBe('https://irsafam.org/ielts-timetable?city%5B%5D=isfahan&exam_model%5B%5D=cdielts&month%5B%5D=12');
    });
  });

  describe('fetchAppointments', () => {
    it('should successfully fetch appointments', async () => {
      const mockAppointments: Appointment[] = [
        {
          id: 'appointment-1',
          date: '2025-02-15',
          time: '09:00-12:00',
          location: 'Isfahan Center',
          examType: 'CDIELTS',
          city: 'Isfahan',
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
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.setUserAgent).toHaveBeenCalled();
      expect(mockPage.setViewport).toHaveBeenCalledWith({ width: 1366, height: 768 });
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://irsafam.org/ielts-timetable?city%5B%5D=isfahan&exam_model%5B%5D=cdielts&month%5B%5D=2',
        { waitUntil: 'networkidle2', timeout: 30000 }
      );
      expect(mockPage.close).toHaveBeenCalled();
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockAppointments: Appointment[] = [
        {
          id: 'appointment-1',
          date: '2025-02-15',
          time: '09:00-12:00',
          location: 'Isfahan Center',
          examType: 'CDIELTS',
          city: 'Isfahan',
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
      expect(mockBrowser.newPage).toHaveBeenCalledTimes(2); // One for failed attempt, one for successful
    });

    it('should throw error after max retries', async () => {
      mockPage.goto.mockRejectedValue(new Error('Persistent network error'));

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      await expect(webScraperService.fetchAppointments(filters)).rejects.toThrow(
        'Failed to fetch appointments after 4 attempts'
      );

      expect(mockBrowser.newPage).toHaveBeenCalledTimes(4); // Initial attempt + 3 retries
    });

    it('should handle browser initialization error', async () => {
      const puppeteer = require('puppeteer');
      puppeteer.launch.mockRejectedValue(new Error('Browser launch failed'));

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      await expect(webScraperService.fetchAppointments(filters)).rejects.toThrow(
        'Browser launch failed'
      );
    });
  });

  describe('initialize and close', () => {
    it('should initialize browser', async () => {
      await webScraperService.initialize();

      const puppeteer = require('puppeteer');
      expect(puppeteer.launch).toHaveBeenCalledWith({
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
    });

    it('should not initialize browser twice', async () => {
      await webScraperService.initialize();
      await webScraperService.initialize();

      const puppeteer = require('puppeteer');
      expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    });

    it('should close browser', async () => {
      await webScraperService.initialize();
      await webScraperService.close();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle close when browser not initialized', async () => {
      await expect(webScraperService.close()).resolves.not.toThrow();
    });
  });

  describe('HTML parsing', () => {
    it('should parse appointment data from HTML elements', async () => {
      // Mock the page.evaluate function to simulate HTML parsing
      const mockHtmlParsingResult = [
        {
          id: 'appointment-123-0',
          date: '2025-02-15',
          time: '09:00-12:00',
          location: 'Isfahan Center',
          examType: 'CDIELTS',
          city: 'Isfahan',
          status: 'available',
          price: 5000000,
          registrationUrl: 'https://irsafam.org/register/123'
        },
        {
          id: 'appointment-124-1',
          date: '2025-02-16',
          time: '14:00-17:00',
          location: 'Tehran Center',
          examType: 'IELTS',
          city: 'Tehran',
          status: 'full',
          price: undefined,
          registrationUrl: undefined
        }
      ];

      mockPage.evaluate.mockResolvedValue(mockHtmlParsingResult);

      const filters: ScrapingFilters = {
        city: ['isfahan', 'tehran'],
        examModel: ['cdielts', 'ielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointments(filters);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        date: '2025-02-15',
        time: '09:00-12:00',
        location: 'Isfahan Center',
        examType: 'CDIELTS',
        city: 'Isfahan',
        status: 'available'
      });
      expect(result[1]).toMatchObject({
        date: '2025-02-16',
        time: '14:00-17:00',
        location: 'Tehran Center',
        examType: 'IELTS',
        city: 'Tehran',
        status: 'full'
      });
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
      mockPage.evaluate.mockRejectedValue(new Error('Parsing error'));

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
      mockPage.evaluate.mockResolvedValue([]);

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

    it('should add random delays', async () => {
      // Restore setTimeout to test actual delays
      jest.restoreAllMocks();
      
      // Re-setup mocks after restoring setTimeout
      mockPage = {
        setUserAgent: jest.fn(),
        setViewport: jest.fn(),
        goto: jest.fn(),
        waitForSelector: jest.fn(),
        evaluate: jest.fn().mockResolvedValue([]),
        close: jest.fn(),
      };

      mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn(),
      };

      const puppeteer = require('puppeteer');
      puppeteer.launch.mockResolvedValue(mockBrowser);
      
      const startTime = Date.now();
      
      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      await webScraperService.fetchAppointments(filters);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should take at least 1 second due to random delay (1-3 seconds)
      expect(duration).toBeGreaterThan(1000);
      
      // Re-mock setTimeout for other tests
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });
    });
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

    it('should handle selector wait timeout gracefully', async () => {
      mockPage.waitForSelector.mockRejectedValue(new Error('Selector timeout'));
      mockPage.evaluate.mockResolvedValue([]);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      // Should not throw error, should continue with parsing
      const result = await webScraperService.fetchAppointments(filters);
      expect(result).toEqual([]);
    });

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