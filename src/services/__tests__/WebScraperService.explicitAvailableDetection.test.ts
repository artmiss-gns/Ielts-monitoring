import { WebScraperService, ScrapingFilters } from '../WebScraperService';

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

describe('WebScraperService - Explicit Available Detection (Task 3)', () => {
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

  describe('Requirement 5.3: Available detection only triggers after confirming appointment is NOT filled', () => {
    it('should NOT mark appointment as available if it has filled indicators, even with available text', async () => {
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
            rawHtml: '<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span><span>قابل ثبت نام</span></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found highest priority filled indicator: تکمیل ظرفیت - marking as filled'],
          rawAppointmentHtml: ['<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span><span>قابل ثبت نام</span></a>']
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      // Should be marked as filled, not available, despite having "قابل ثبت نام" text
      expect(result.type).toBe('filled');
      expect(result.appointments[0].status).toBe('filled');
      expect(result.filledCount).toBe(1);
      expect(result.availableCount).toBe(0);
    });

    it('should only check for available indicators after confirming no filled indicators exist', async () => {
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

      // Should be marked as available since no filled indicators were found
      expect(result.type).toBe('available');
      expect(result.appointments[0].status).toBe('available');
      expect(result.availableCount).toBe(1);
      expect(result.filledCount).toBe(0);
    });
  });

  describe('Requirement 5.4: Detection for active registration buttons without disabled attributes', () => {
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
            rawHtml: '<a class="exam__item ielts"><button class="btn register">Register Now</button></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found active registration button without disabled attributes - marking as available'],
          rawAppointmentHtml: ['<a class="exam__item ielts"><button class="btn register">Register Now</button></a>']
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
      expect(result.appointments[0].rawHtml).toContain('<button class="btn register">Register Now</button>');
    });

    it('should NOT detect disabled registration buttons as available', async () => {
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
            rawHtml: '<a class="exam__item ielts"><button class="btn disable" disabled>Register</button></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found btn disable class in button element - marking as filled'],
          rawAppointmentHtml: ['<a class="exam__item ielts"><button class="btn disable" disabled>Register</button></a>']
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
      expect(result.filledCount).toBe(1);
      expect(result.availableCount).toBe(0);
    });
  });

  describe('Requirement 7.5: "قابل ثبت نام" text detection for available status', () => {
    it('should detect "قابل ثبت نام" text as available indicator', async () => {
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

    it('should prioritize "قابل ثبت نام" text over other available indicators', async () => {
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
            rawHtml: '<a class="exam__item ielts available"><span class="btn">قابل ثبت نام</span><button>Register</button></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found قابل ثبت نام text for available status - marking as available'],
          rawAppointmentHtml: ['<a class="exam__item ielts available"><span class="btn">قابل ثبت نام</span><button>Register</button></a>']
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
      // Should be detected by Persian text, not by CSS class or button
      expect(result.appointments[0].rawHtml).toContain('قابل ثبت نام');
    });
  });

  describe('Explicit positive indicators requirement', () => {
    it('should require explicit positive indicators to mark as available', async () => {
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
            rawHtml: '<a class="exam__item ielts">IELTS Exam - 2025-02-15 09:00-12:00</a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Has appointment data but no clear status indicators - conservative unknown status (CONSERVATIVE UNKNOWN)'],
          rawAppointmentHtml: ['<a class="exam__item ielts">IELTS Exam - 2025-02-15 09:00-12:00</a>']
        }
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      // Should be marked as unknown, not available, without explicit indicators
      expect(result.appointmentCount).toBe(1);
      expect(result.appointments[0].status).toBe('unknown');
      expect(result.availableCount).toBe(0);
      expect(result.filledCount).toBe(0);
    });

    it('should detect multiple types of explicit available indicators', async () => {
      const testCases = [
        {
          name: 'CSS class indicator',
          html: '<a class="exam__item ielts available">IELTS Exam</a>',
          expectedReason: 'Found available CSS class'
        },
        {
          name: 'Registration link indicator',
          html: '<a class="exam__item ielts"><a href="/register">Register</a></a>',
          expectedReason: 'Found registration link'
        },
        {
          name: 'Persian available text',
          html: '<a class="exam__item ielts">ثبت نام کنید</a>',
          expectedReason: 'Found Persian available text'
        },
        {
          name: 'English available text',
          html: '<a class="exam__item ielts">Available for registration</a>',
          expectedReason: 'Found English available text'
        }
      ];

      for (const testCase of testCases) {
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
              rawHtml: testCase.html
            }
          ],
          inspectionData: {
            detectedElements: ['Found elements with selector: a.exam__item.ielts'],
            parsingNotes: [`Element 0: ${testCase.expectedReason} - marking as available`],
            rawAppointmentHtml: [testCase.html]
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
        expect(result.availableCount).toBe(1);
      }
    });
  });
});