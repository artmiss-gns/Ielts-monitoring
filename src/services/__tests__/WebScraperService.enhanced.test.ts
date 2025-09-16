import { WebScraperService, ScrapingFilters } from '../WebScraperService';

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

describe('WebScraperService Enhanced Status Detection', () => {
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

  describe('Persian Text Detection', () => {
    it('should detect Persian filled indicator "تکمیل ظرفیت"', async () => {
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
            rawHtml: '<div class="appointment-card">تکمیل ظرفیت</div>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: .appointment-card'],
          parsingNotes: ['Found Persian filled indicator: تکمیل ظرفیت'],
          rawAppointmentHtml: ['<div class="appointment-card">تکمیل ظرفیت</div>']
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
      expect(result.appointments[0].rawHtml).toContain('تکمیل ظرفیت');
    });

    it('should detect Persian no-appointments indicator', async () => {
      const mockCheckResult = {
        type: 'no-slots',
        appointmentCount: 0,
        availableCount: 0,
        filledCount: 0,
        appointments: [],
        inspectionData: {
          detectedElements: ['Total elements found: 0'],
          parsingNotes: ['Found Persian no-appointments indicator'],
          rawAppointmentHtml: []
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('no-slots');
      expect(result.appointmentCount).toBe(0);
    });
  });

  describe('Status Categorization', () => {
    it('should categorize mixed appointments correctly', async () => {
      const mockCheckResult = {
        type: 'available',
        appointmentCount: 3,
        availableCount: 1,
        filledCount: 2,
        appointments: [
          {
            id: 'appointment-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'available',
            rawHtml: '<div class="appointment-card"><button>Register</button></div>'
          },
          {
            id: 'appointment-2',
            date: '2025-02-16',
            time: '14:00-17:00',
            location: 'Tehran Center',
            examType: 'IELTS',
            city: 'Tehran',
            status: 'filled',
            rawHtml: '<div class="appointment-card">تکمیل ظرفیت</div>'
          },
          {
            id: 'appointment-3',
            date: '2025-02-17',
            time: '10:00-13:00',
            location: 'Shiraz Center',
            examType: 'IELTS',
            city: 'Shiraz',
            status: 'pending',
            rawHtml: '<div class="appointment-card">در انتظار</div>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: .appointment-card'],
          parsingNotes: ['Status summary: available=1, filled=1, pending=1'],
          rawAppointmentHtml: []
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan', 'tehran', 'shiraz'],
        examModel: ['cdielts', 'ielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('available');
      expect(result.appointmentCount).toBe(3);
      expect(result.availableCount).toBe(1);
      expect(result.filledCount).toBe(2); // filled + pending

      // Verify individual appointment statuses
      const statusCounts = result.appointments.reduce((acc, apt) => {
        acc[apt.status] = (acc[apt.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(statusCounts.available).toBe(1);
      expect(statusCounts.filled).toBe(1);
      expect(statusCounts.pending).toBe(1);
    });

    it('should prioritize available when mixed statuses exist', async () => {
      const mockCheckResult = {
        type: 'available',
        appointmentCount: 2,
        availableCount: 1,
        filledCount: 1,
        appointments: [
          {
            id: 'appointment-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'available',
            rawHtml: '<div class="appointment-card">Available</div>'
          },
          {
            id: 'appointment-2',
            date: '2025-02-16',
            time: '14:00-17:00',
            location: 'Tehran Center',
            examType: 'IELTS',
            city: 'Tehran',
            status: 'filled',
            rawHtml: '<div class="appointment-card">Full</div>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: .appointment-card'],
          parsingNotes: ['Status summary: available=1, filled=1, pending=0'],
          rawAppointmentHtml: []
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan', 'tehran'],
        examModel: ['cdielts', 'ielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('available');
      expect(result.availableCount).toBeGreaterThan(0);
    });
  });

  describe('Raw HTML Capture', () => {
    it('should capture raw HTML for inspection', async () => {
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
            rawHtml: '<div class="appointment-card"><h3>IELTS Exam</h3><p>Date: 2025-02-15</p><button class="register-btn">Register Now</button></div>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: .appointment-card'],
          parsingNotes: ['Found registration button/link - marking as available'],
          rawAppointmentHtml: ['<div class="appointment-card"><h3>IELTS Exam</h3><p>Date: 2025-02-15</p><button class="register-btn">Register Now</button></div>']
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.appointments[0].rawHtml).toBeDefined();
      expect(result.appointments[0].rawHtml).toContain('<h3>IELTS Exam</h3>');
      expect(result.appointments[0].rawHtml).toContain('<button class="register-btn">Register Now</button>');
      expect(result.appointments[0].rawHtml).toContain('Date: 2025-02-15');
    });
  });
});