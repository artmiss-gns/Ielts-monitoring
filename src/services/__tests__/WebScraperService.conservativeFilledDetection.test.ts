import { WebScraperService, ScrapingFilters } from '../WebScraperService';

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

describe('WebScraperService Conservative Filled Detection', () => {
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

  describe('Priority-based Filled Detection', () => {
    it('should detect تکمیل ظرفیت as highest priority filled indicator', async () => {
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
            rawHtml: '<a class="exam__item ielts"><span class="btn">تکمیل ظرفیت</span></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found highest priority filled indicator: تکمیل ظرفیت - marking as filled'],
          rawAppointmentHtml: ['<a class="exam__item ielts"><span class="btn">تکمیل ظرفیت</span></a>']
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

    it('should detect disabled CSS class as filled indicator', async () => {
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
            rawHtml: '<a class="exam__item ielts disabled">IELTS Exam</a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found disabled CSS class: disabled - marking as filled'],
          rawAppointmentHtml: ['<a class="exam__item ielts disabled">IELTS Exam</a>']
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
      expect(result.appointments[0].rawHtml).toContain('disabled');
    });

    it('should detect btn disable class in button elements', async () => {
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
            rawHtml: '<a class="exam__item ielts"><span class="btn disable">تکمیل ظرفیت</span></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found btn disable class in button element - marking as filled'],
          rawAppointmentHtml: ['<a class="exam__item ielts"><span class="btn disable">تکمیل ظرفیت</span></a>']
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
      expect(result.appointments[0].rawHtml).toContain('btn disable');
    });

    it('should detect exam__item ielts disabled pattern', async () => {
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
            rawHtml: '<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found disabled CSS class: disabled - marking as filled'],
          rawAppointmentHtml: ['<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span></a>']
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
      expect(result.appointments[0].rawHtml).toContain('exam__item ielts disabled');
      expect(result.appointments[0].rawHtml).toContain('btn disable');
      expect(result.appointments[0].rawHtml).toContain('تکمیل ظرفیت');
    });
  });

  describe('Conservative Available Detection', () => {
    it('should detect قابل ثبت نام as available indicator', async () => {
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
            rawHtml: '<a class="exam__item ielts"><span class="btn">قابل ثبت نام</span></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found قابل ثبت نام text for available status - marking as available'],
          rawAppointmentHtml: ['<a class="exam__item ielts"><span class="btn">قابل ثبت نام</span></a>']
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
      expect(result.appointments[0].rawHtml).toContain('قابل ثبت نام');
    });

    it('should detect active registration buttons as available', async () => {
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
            rawHtml: '<a class="exam__item ielts"><button class="btn">Register</button></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found active registration button without disabled attributes - marking as available'],
          rawAppointmentHtml: ['<a class="exam__item ielts"><button class="btn">Register</button></a>']
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
      expect(result.appointments[0].rawHtml).toContain('<button class="btn">Register</button>');
    });
  });

  describe('Conservative Unknown Status Handling', () => {
    it('should mark appointments as unknown when no clear indicators are found', async () => {
      const mockCheckResult = {
        type: 'no-slots',
        appointmentCount: 1,
        availableCount: 0,
        filledCount: 0,
        appointments: [
          {
            id: 'appointment-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'unknown',
            rawHtml: '<a class="exam__item ielts">IELTS Exam - 2025-02-15</a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Has appointment data but no clear status indicators - conservative unknown status (CONSERVATIVE UNKNOWN)'],
          rawAppointmentHtml: ['<a class="exam__item ielts">IELTS Exam - 2025-02-15</a>']
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.appointmentCount).toBe(1);
      expect(result.appointments[0].status).toBe('unknown');
      expect(result.availableCount).toBe(0); // Unknown appointments should not be counted as available
    });

    it('should never default to available without explicit indicators', async () => {
      const mockCheckResult = {
        type: 'no-slots',
        appointmentCount: 2,
        availableCount: 0,
        filledCount: 0,
        appointments: [
          {
            id: 'appointment-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'unknown',
            rawHtml: '<div class="appointment-card">IELTS - 09:00</div>'
          },
          {
            id: 'appointment-2',
            date: '2025-02-16',
            time: '14:00-17:00',
            location: 'Tehran Center',
            examType: 'IELTS',
            city: 'Tehran',
            status: 'unknown',
            rawHtml: '<div class="exam-slot">Test Date: 2025-02-16</div>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with multiple selectors'],
          parsingNotes: [
            'Element 0: Has appointment data but no clear status indicators - conservative unknown status (CONSERVATIVE UNKNOWN)',
            'Element 1: Has appointment data but no clear status indicators - conservative unknown status (CONSERVATIVE UNKNOWN)'
          ],
          rawAppointmentHtml: [
            '<div class="appointment-card">IELTS - 09:00</div>',
            '<div class="exam-slot">Test Date: 2025-02-16</div>'
          ]
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan', 'tehran'],
        examModel: ['cdielts', 'ielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.appointmentCount).toBe(2);
      expect(result.availableCount).toBe(0); // No appointments should be marked as available
      expect(result.filledCount).toBe(0); // No appointments should be marked as filled
      expect(result.appointments.every(apt => apt.status === 'unknown')).toBe(true);
    });
  });

  describe('Immediate Filled Detection', () => {
    it('should immediately mark appointment as filled when any filled indicator is found', async () => {
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
            rawHtml: '<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span><button>Register</button></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found highest priority filled indicator: تکمیل ظرفیت - marking as filled'],
          rawAppointmentHtml: ['<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span><button>Register</button></a>']
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
      // Even though there's a register button, the filled indicators should take priority
      expect(result.appointments[0].rawHtml).toContain('تکمیل ظرفیت');
      expect(result.appointments[0].rawHtml).toContain('disabled');
      expect(result.appointments[0].rawHtml).toContain('btn disable');
    });
  });
});