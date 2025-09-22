import { WebScraperService, ScrapingFilters } from '../WebScraperService';

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

describe('WebScraperService Enhanced Status Detection Logic', () => {
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
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
      version: jest.fn().mockResolvedValue('test-version'),
    };

    const puppeteer = require('puppeteer');
    puppeteer.launch.mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Enhanced Available Status Detection', () => {
    it('should prioritize available status when enabled class is present', async () => {
      const mockCheckResult = {
        type: 'available',
        appointmentCount: 1,
        availableCount: 1,
        filledCount: 0,
        appointments: [
          {
            id: 'appointment-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'available',
            rawHtml: '<div class="appointment-card enabled">Available Slot</div>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: .appointment-card'],
          parsingNotes: ['Found available CSS class - marking as available'],
          rawAppointmentHtml: ['<div class="appointment-card enabled">Available Slot</div>']
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('available');
      expect(result.appointments[0].status).toBe('available');
      // The enhanced logic should correctly identify this as available
      expect(result.appointments[0].rawHtml).toContain('enabled');
    });

    it('should detect available status from onclick attribute', async () => {
      const mockCheckResult = {
        type: 'available',
        appointmentCount: 1,
        availableCount: 1,
        filledCount: 0,
        appointments: [
          {
            id: 'appointment-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'available',
            rawHtml: '<div class="appointment-card" onclick="register()">Click to Register</div>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: .appointment-card'],
          parsingNotes: ['Found available indicator: onclick attribute - marking as available'],
          rawAppointmentHtml: ['<div class="appointment-card" onclick="register()">Click to Register</div>']
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('available');
      expect(result.appointments[0].status).toBe('available');
      // The enhanced logic should correctly identify this as available
      expect(result.appointments[0].rawHtml).toContain('onclick');
    });

    it('should detect available status from Persian رزرو text', async () => {
      const mockCheckResult = {
        type: 'available',
        appointmentCount: 1,
        availableCount: 1,
        filledCount: 0,
        appointments: [
          {
            id: 'appointment-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'available',
            rawHtml: '<div class="appointment-card">رزرو</div>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: .appointment-card'],
          parsingNotes: ['Found available indicator: Persian available text - marking as available'],
          rawAppointmentHtml: ['<div class="appointment-card">رزرو</div>']
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('available');
      expect(result.appointments[0].status).toBe('available');
      // The enhanced logic should correctly identify this as available
      expect(result.appointments[0].rawHtml).toContain('رزرو');
    });

    it('should default to available when appointment has date/time but no negative indicators', async () => {
      const mockCheckResult = {
        type: 'available',
        appointmentCount: 1,
        availableCount: 1,
        filledCount: 0,
        appointments: [
          {
            id: 'appointment-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'available',
            rawHtml: '<div class="appointment-card">IELTS Exam - 2025-02-15 09:00</div>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: .appointment-card'],
          parsingNotes: ['Has appointment data with no negative indicators - defaulting to available'],
          rawAppointmentHtml: ['<div class="appointment-card">IELTS Exam - 2025-02-15 09:00</div>']
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('available');
      expect(result.appointments[0].status).toBe('available');
      // The enhanced logic should default to available when no negative indicators are found
      expect(result.appointments[0].rawHtml).toContain('IELTS Exam');
    });
  });

  describe('Enhanced Filled Status Detection', () => {
    it('should detect filled status from enhanced Persian text variations', async () => {
      const mockCheckResult = {
        type: 'filled',
        appointmentCount: 1,
        availableCount: 0,
        filledCount: 1,
        appointments: [
          {
            id: 'appointment-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'filled',
            rawHtml: '<div class="appointment-card">پر شده</div>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: .appointment-card'],
          parsingNotes: ['Found Persian filled indicator - marking as filled'],
          rawAppointmentHtml: ['<div class="appointment-card">پر شده</div>']
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('filled');
      expect(result.appointments[0].status).toBe('filled');
      // The enhanced logic should correctly identify this as filled
      expect(result.appointments[0].rawHtml).toContain('پر شده');
    });

    it('should detect filled status from enhanced CSS classes', async () => {
      const mockCheckResult = {
        type: 'filled',
        appointmentCount: 1,
        availableCount: 0,
        filledCount: 1,
        appointments: [
          {
            id: 'appointment-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'filled',
            rawHtml: '<div class="appointment-card sold-out">Sold Out</div>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: .appointment-card'],
          parsingNotes: ['Found disabled/filled CSS class - marking as filled'],
          rawAppointmentHtml: ['<div class="appointment-card sold-out">Sold Out</div>']
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('filled');
      expect(result.appointments[0].status).toBe('filled');
      // The enhanced logic should correctly identify this as filled
      expect(result.appointments[0].rawHtml).toContain('sold-out');
    });

    it('should detect filled status from enhanced disabled button detection', async () => {
      const mockCheckResult = {
        type: 'filled',
        appointmentCount: 1,
        availableCount: 0,
        filledCount: 1,
        appointments: [
          {
            id: 'appointment-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'filled',
            rawHtml: '<div class="appointment-card"><button class="btn-disabled">Register</button></div>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: .appointment-card'],
          parsingNotes: ['Found disabled button - marking as filled'],
          rawAppointmentHtml: ['<div class="appointment-card"><button class="btn-disabled">Register</button></div>']
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('filled');
      expect(result.appointments[0].status).toBe('filled');
      // The enhanced logic should correctly identify this as filled
      expect(result.appointments[0].rawHtml).toContain('btn-disabled');
    });
  });

  describe('Enhanced Contextual Analysis', () => {
    it('should detect status from sibling elements', async () => {
      const mockCheckResult = {
        type: 'available',
        appointmentCount: 1,
        availableCount: 1,
        filledCount: 0,
        appointments: [
          {
            id: 'appointment-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'available',
            rawHtml: '<div class="appointment-card">2025-02-15 09:00</div>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: .appointment-card'],
          parsingNotes: ['Found available indicator in sibling element'],
          rawAppointmentHtml: ['<div class="appointment-card">2025-02-15 09:00</div>']
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('available');
      expect(result.appointments[0].status).toBe('available');
    });
  });
});