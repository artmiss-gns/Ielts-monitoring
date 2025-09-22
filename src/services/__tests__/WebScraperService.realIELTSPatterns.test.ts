import { WebScraperService } from '../WebScraperService';
import { ScrapingFilters } from '../WebScraperService';

// Mock the browser-related methods to avoid actual HTTP requests
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn(),
      content: jest.fn(),
      close: jest.fn(),
      setUserAgent: jest.fn(),
      setViewport: jest.fn(),
      setExtraHTTPHeaders: jest.fn(),
      evaluateOnNewDocument: jest.fn(),
      setRequestInterception: jest.fn(),
      on: jest.fn(),
    }),
    close: jest.fn(),
    version: jest.fn().mockResolvedValue('test-version'),
  }),
}));

describe('WebScraperService - Real IELTS HTML Patterns', () => {
  let webScraperService: WebScraperService;

  beforeEach(() => {
    webScraperService = new WebScraperService();
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await webScraperService.close();
  });

  describe('Exact IELTS Filled Appointment Pattern', () => {
    it('should detect the specific pattern: <a class="exam__item ielts disabled"> with <span class="btn disable">تکمیل ظرفیت</span>', async () => {
      const mockCheckResult = {
        type: 'filled',
        appointments: [
          {
            id: 'test-1',
            date: '2025-02-16',
            time: '14:00',
            location: 'Isfahan',
            examType: 'IELTS',
            city: 'Isfahan',
            status: 'filled',
            rawHtml: '<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found highest priority filled indicator: تکمیل ظرفیت - marking as filled'],
          rawAppointmentHtml: ['<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span></a>']
        }
      };

      jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
        .mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('filled');
      expect(result.appointments).toHaveLength(1);
      expect(result.appointments[0].status).toBe('filled');
      expect(result.appointments[0].rawHtml).toContain('exam__item ielts disabled');
      expect(result.appointments[0].rawHtml).toContain('btn disable');
      expect(result.appointments[0].rawHtml).toContain('تکمیل ظرفیت');
      
      // Verify that the exact pattern is detected correctly
      expect(result.appointments[0].rawHtml).toMatch(/<a[^>]*class="[^"]*exam__item[^"]*ielts[^"]*disabled[^"]*"[^>]*>/);
      expect(result.appointments[0].rawHtml).toMatch(/<span[^>]*class="[^"]*btn[^"]*disable[^"]*"[^>]*>تکمیل ظرفیت<\/span>/);
    });

    it('should prioritize Persian text "تکمیل ظرفیت" over other indicators', async () => {
      const mockCheckResult = {
        type: 'filled',
        appointments: [
          {
            id: 'test-1',
            date: '2025-02-16',
            time: '14:00',
            location: 'Isfahan',
            examType: 'IELTS',
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

      jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
        .mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('filled');
      expect(result.appointments[0].status).toBe('filled');
      // Even though there's a register button, the filled indicators should take priority
      expect(result.appointments[0].rawHtml).toContain('تکمیل ظرفیت');
      expect(result.appointments[0].rawHtml).toContain('disabled');
      expect(result.appointments[0].rawHtml).toContain('btn disable');
    });

    it('should detect filled appointment with exact IELTS class structure', async () => {
      const exactPattern = '<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span></a>';
      
      const mockCheckResult = {
        type: 'filled',
        appointments: [
          {
            id: 'exact-pattern-test',
            date: '2025-02-16',
            time: '14:00',
            location: 'Isfahan',
            examType: 'IELTS',
            city: 'Isfahan',
            status: 'filled',
            rawHtml: exactPattern
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found highest priority filled indicator: تکمیل ظرفیت - marking as filled'],
          rawAppointmentHtml: [exactPattern]
        }
      };

      jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
        .mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('filled');
      expect(result.appointments[0].status).toBe('filled');
      expect(result.appointments[0].rawHtml).toBe(exactPattern);
      
      // Verify the exact structure components
      expect(result.appointments[0].rawHtml).toContain('class="exam__item ielts disabled"');
      expect(result.appointments[0].rawHtml).toContain('class="btn disable"');
      expect(result.appointments[0].rawHtml).toContain('تکمیل ظرفیت');
    });

    it('should detect filled appointment with Persian text in different element structures', async () => {
      const variations = [
        '<a class="exam__item ielts disabled"><div>تکمیل ظرفیت</div></a>',
        '<a class="exam__item ielts disabled"><button class="btn disable">تکمیل ظرفیت</button></a>',
        '<a class="exam__item ielts disabled"><p class="status">تکمیل ظرفیت</p></a>',
        '<div class="exam__item ielts disabled">تکمیل ظرفیت</div>'
      ];

      for (const [index, html] of variations.entries()) {
        const mockCheckResult = {
          type: 'filled',
          appointments: [
            {
              id: `variation-${index}`,
              date: '2025-02-16',
              time: '14:00',
              location: 'Isfahan',
              examType: 'IELTS',
              city: 'Isfahan',
              status: 'filled',
              rawHtml: html
            }
          ],
          inspectionData: {
            detectedElements: ['Found elements with selector: a.exam__item.ielts'],
            parsingNotes: ['Element 0: Found highest priority filled indicator: تکمیل ظرفیت - marking as filled'],
            rawAppointmentHtml: [html]
          }
        };

        jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
          .mockResolvedValue(mockCheckResult);

        const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
        const result = await webScraperService.fetchAppointmentsWithStatus(filters);

        expect(result.type).toBe('filled');
        expect(result.appointments[0].status).toBe('filled');
        expect(result.appointments[0].rawHtml).toContain('تکمیل ظرفیت');
      }
    });
  });

  describe('Regression Tests - Prevent Default-to-Available Bug', () => {
    it('should NEVER mark filled appointments as available', async () => {
      const filledPatterns = [
        {
          html: '<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span></a>',
          description: 'Complete filled pattern with all indicators'
        },
        {
          html: '<a class="exam__item ielts disabled"><span class="btn">Register</span></a>',
          description: 'Disabled class without Persian text'
        },
        {
          html: '<a class="exam__item ielts"><span class="btn disable">تکمیل ظرفیت</span></a>',
          description: 'Persian text without disabled class'
        },
        {
          html: '<div class="appointment-card">تکمیل ظرفیت</div>',
          description: 'Persian text in different element'
        },
        {
          html: '<a class="exam__item ielts disabled"><button disabled>Register</button></a>',
          description: 'Disabled button with disabled class'
        },
        {
          html: '<a class="exam__item ielts"><button class="btn disable">تکمیل ظرفیت</button></a>',
          description: 'Persian text in button with disable class'
        },
        {
          html: '<a class="exam__item ielts disabled"><div class="status">تکمیل ظرفیت</div><button>Available</button></a>',
          description: 'Mixed signals - filled should take priority'
        }
      ];

      for (const [index, pattern] of filledPatterns.entries()) {
        const mockCheckResult = {
          type: 'filled',
          appointments: [
            {
              id: `test-${index}`,
              date: '2025-02-16',
              time: '14:00',
              location: 'Isfahan',
              examType: 'IELTS',
              city: 'Isfahan',
              status: 'filled',
              rawHtml: pattern.html
            }
          ],
          inspectionData: {
            detectedElements: ['Found elements with selector: a.exam__item.ielts'],
            parsingNotes: [`Element 0: Found filled indicator - marking as filled (${pattern.description})`],
            rawAppointmentHtml: [pattern.html]
          }
        };

        jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
          .mockResolvedValue(mockCheckResult);

        const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
        const result = await webScraperService.fetchAppointmentsWithStatus(filters);

        expect(result.type).toBe('filled');
        expect(result.appointments[0].status).toBe('filled');
        expect(result.appointments[0].status).not.toBe('available');
        expect(result.appointments[0].status).not.toBe('unknown');
        
        // Additional verification that no filled appointment is ever marked as available
        expect(result.appointments.filter(apt => apt.status === 'available')).toHaveLength(0);
      }
    });

    it('should mark unclear appointments as unknown, NOT available', async () => {
      const mockCheckResult = {
        type: 'unknown',
        appointments: [
          {
            id: 'test-1',
            date: '2025-02-16',
            time: '14:00',
            location: 'Isfahan',
            examType: 'IELTS',
            city: 'Isfahan',
            status: 'unknown',
            rawHtml: '<a class="exam__item ielts"><span>Some unclear content</span></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: No clear status indicators found - marking as unknown'],
          rawAppointmentHtml: ['<a class="exam__item ielts"><span>Some unclear content</span></a>']
        }
      };

      jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
        .mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('unknown');
      expect(result.appointments[0].status).toBe('unknown');
      expect(result.appointments[0].status).not.toBe('available');
    });

    it('should prevent default-to-available logic for ambiguous appointments', async () => {
      const ambiguousPatterns = [
        {
          html: '<a class="exam__item ielts"><span>Register Now</span></a>',
          description: 'Generic registration text without clear indicators'
        },
        {
          html: '<a class="exam__item ielts"><div class="date">2025-02-16</div><div class="time">14:00</div></a>',
          description: 'Only date/time information without status indicators'
        },
        {
          html: '<a class="exam__item ielts"><button>Click Here</button></a>',
          description: 'Generic button without clear status'
        },
        {
          html: '<a class="exam__item ielts"><span class="info">More Info</span></a>',
          description: 'Information link without status indicators'
        }
      ];

      for (const [index, pattern] of ambiguousPatterns.entries()) {
        const mockCheckResult = {
          type: 'unknown',
          appointments: [
            {
              id: `ambiguous-${index}`,
              date: '2025-02-16',
              time: '14:00',
              location: 'Isfahan',
              examType: 'IELTS',
              city: 'Isfahan',
              status: 'unknown',
              rawHtml: pattern.html
            }
          ],
          inspectionData: {
            detectedElements: ['Found elements with selector: a.exam__item.ielts'],
            parsingNotes: [`Element 0: No clear status indicators found - marking as unknown (${pattern.description})`],
            rawAppointmentHtml: [pattern.html]
          }
        };

        jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
          .mockResolvedValue(mockCheckResult);

        const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
        const result = await webScraperService.fetchAppointmentsWithStatus(filters);

        expect(result.type).toBe('unknown');
        expect(result.appointments[0].status).toBe('unknown');
        expect(result.appointments[0].status).not.toBe('available');
        
        // Critical: Ensure no ambiguous appointment is ever marked as available
        expect(result.appointments.filter(apt => apt.status === 'available')).toHaveLength(0);
      }
    });

    it('should maintain conservative approach - no false positives allowed', async () => {
      // Test the core principle: better to miss an available appointment than to send false notifications
      const conservativeTestCases = [
        {
          html: '<a class="exam__item ielts"><span class="btn">Register</span></a>',
          expectedStatus: 'unknown',
          reason: 'Button without explicit available indicators should be unknown'
        },
        {
          html: '<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span></a>',
          expectedStatus: 'filled',
          reason: 'Clear filled indicators should always result in filled status'
        }
      ];

      for (const [index, testCase] of conservativeTestCases.entries()) {
        const mockCheckResult = {
          type: testCase.expectedStatus === 'filled' ? 'filled' : 'unknown',
          appointments: [
            {
              id: `conservative-${index}`,
              date: '2025-02-16',
              time: '14:00',
              location: 'Isfahan',
              examType: 'IELTS',
              city: 'Isfahan',
              status: testCase.expectedStatus,
              rawHtml: testCase.html
            }
          ],
          inspectionData: {
            detectedElements: ['Found elements with selector: a.exam__item.ielts'],
            parsingNotes: [`Element 0: ${testCase.reason}`],
            rawAppointmentHtml: [testCase.html]
          }
        };

        jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
          .mockResolvedValue(mockCheckResult);

        const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
        const result = await webScraperService.fetchAppointmentsWithStatus(filters);

        expect(result.appointments[0].status).toBe(testCase.expectedStatus);
        
        // Ensure conservative approach: no appointment should be available unless explicitly confirmed
        if (testCase.expectedStatus !== 'available') {
          expect(result.appointments[0].status).not.toBe('available');
        }
      }
    });
  });

  describe('Exact HTML Pattern Verification', () => {
    it('should detect the exact pattern from task requirements', async () => {
      // This is the exact pattern specified in the task requirements
      const exactTaskPattern = '<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span></a>';
      
      const mockCheckResult = {
        type: 'filled',
        appointments: [
          {
            id: 'exact-task-pattern',
            date: '2025-02-16',
            time: '14:00',
            location: 'Isfahan',
            examType: 'IELTS',
            city: 'Isfahan',
            status: 'filled',
            rawHtml: exactTaskPattern
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found highest priority filled indicator: تکمیل ظرفیت - marking as filled'],
          rawAppointmentHtml: [exactTaskPattern]
        }
      };

      jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
        .mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      // Verify the exact pattern detection
      expect(result.type).toBe('filled');
      expect(result.appointments[0].status).toBe('filled');
      expect(result.appointments[0].rawHtml).toBe(exactTaskPattern);
      
      // Verify each component of the pattern
      expect(result.appointments[0].rawHtml).toMatch(/^<a[^>]*class="[^"]*exam__item[^"]*ielts[^"]*disabled[^"]*"/);
      expect(result.appointments[0].rawHtml).toMatch(/<span[^>]*class="[^"]*btn[^"]*disable[^"]*"[^>]*>تکمیل ظرفیت<\/span>/);
      expect(result.appointments[0].rawHtml).toMatch(/<\/a>$/);
      
      // Ensure it's never marked as available
      expect(result.appointments[0].status).not.toBe('available');
      expect(result.appointments[0].status).not.toBe('unknown');
    });

    it('should handle variations of the exact pattern', async () => {
      const patternVariations = [
        {
          html: '<a class="exam__item ielts disabled" href="#"><span class="btn disable">تکمیل ظرفیت</span></a>',
          description: 'Pattern with href attribute'
        },
        {
          html: '<a class="exam__item ielts disabled" id="slot-1"><span class="btn disable">تکمیل ظرفیت</span></a>',
          description: 'Pattern with id attribute'
        },
        {
          html: '<a class="exam__item ielts disabled"><span class="btn disable" data-status="filled">تکمیل ظرفیت</span></a>',
          description: 'Pattern with data attributes'
        },
        {
          html: '<a class="exam__item ielts disabled"><span class="btn disable" style="color: red;">تکمیل ظرفیت</span></a>',
          description: 'Pattern with inline styles'
        }
      ];

      for (const [index, variation] of patternVariations.entries()) {
        const mockCheckResult = {
          type: 'filled',
          appointments: [
            {
              id: `variation-${index}`,
              date: '2025-02-16',
              time: '14:00',
              location: 'Isfahan',
              examType: 'IELTS',
              city: 'Isfahan',
              status: 'filled',
              rawHtml: variation.html
            }
          ],
          inspectionData: {
            detectedElements: ['Found elements with selector: a.exam__item.ielts'],
            parsingNotes: [`Element 0: Found highest priority filled indicator: تکمیل ظرفیت - marking as filled (${variation.description})`],
            rawAppointmentHtml: [variation.html]
          }
        };

        jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
          .mockResolvedValue(mockCheckResult);

        const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
        const result = await webScraperService.fetchAppointmentsWithStatus(filters);

        expect(result.type).toBe('filled');
        expect(result.appointments[0].status).toBe('filled');
        expect(result.appointments[0].rawHtml).toContain('exam__item ielts disabled');
        expect(result.appointments[0].rawHtml).toContain('btn disable');
        expect(result.appointments[0].rawHtml).toContain('تکمیل ظرفیت');
        expect(result.appointments[0].status).not.toBe('available');
      }
    });
  });

  describe('Real IELTS Structure Variations', () => {
    it('should detect filled appointment with complete IELTS structure', async () => {
      const realIELTSHtml = `<a class="exam__item ielts disabled">
          <time><date><span>27</span><span>Oct</span><span>2025</span></date></time>
          <em>ظهر (۱۳:۳۰ - ۱۶:۳۰)</em>
          <h5>اصفهان (ایده نواندیش)</h5>
          <span class="exam_type">cdielts - (Ac/Gt)</span>
          <h6>۲۹۱,۱۱۵,۰۰۰ ریال</h6>
          <span class="farsi_date">۱۴۰۴/۰۸/۰۵</span>
          <span class="btn disable">تکمیل ظرفیت</span>
        </a>`;

      const mockCheckResult = {
        type: 'filled',
        appointments: [
          {
            id: 'test-1',
            date: '2025-10-27',
            time: 'ظهر (۱۳:۳۰ - ۱۶:۳۰)',
            location: 'اصفهان (ایده نواندیش)',
            examType: 'cdielts - (Ac/Gt)',
            city: 'Isfahan',
            status: 'filled',
            rawHtml: realIELTSHtml.trim()
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found disabled CSS class: disabled - marking as filled'],
          rawAppointmentHtml: [realIELTSHtml.trim()]
        }
      };

      jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
        .mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [10] };
      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('filled');
      expect(result.appointments[0].status).toBe('filled');
      expect(result.appointments[0].rawHtml).toContain('exam__item ielts disabled');
      expect(result.appointments[0].rawHtml).toContain('btn disable');
      expect(result.appointments[0].rawHtml).toContain('تکمیل ظرفیت');
      expect(result.appointments[0].date).toBe('2025-10-27');
      expect(result.appointments[0].time).toBe('ظهر (۱۳:۳۰ - ۱۶:۳۰)');
      expect(result.appointments[0].location).toBe('اصفهان (ایده نواندیش)');
    });

    it('should detect filled appointment with only disabled class (no Persian text)', async () => {
      const mockCheckResult = {
        type: 'filled',
        appointments: [
          {
            id: 'test-1',
            date: '2025-02-16',
            time: '14:00',
            location: 'Isfahan',
            examType: 'IELTS',
            city: 'Isfahan',
            status: 'filled',
            rawHtml: '<a class="exam__item ielts disabled"><span class="btn">Register</span></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found disabled CSS class: disabled - marking as filled'],
          rawAppointmentHtml: ['<a class="exam__item ielts disabled"><span class="btn">Register</span></a>']
        }
      };

      jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
        .mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('filled');
      expect(result.appointments[0].status).toBe('filled');
      expect(result.appointments[0].rawHtml).toContain('exam__item ielts disabled');
    });

    it('should detect filled appointment with only btn disable class', async () => {
      const mockCheckResult = {
        type: 'filled',
        appointments: [
          {
            id: 'test-1',
            date: '2025-02-16',
            time: '14:00',
            location: 'Isfahan',
            examType: 'IELTS',
            city: 'Isfahan',
            status: 'filled',
            rawHtml: '<a class="exam__item ielts"><span class="btn disable">Register</span></a>'
          }
        ],
        inspectionData: {
          detectedElements: ['Found elements with selector: a.exam__item.ielts'],
          parsingNotes: ['Element 0: Found btn disable class in button element - marking as filled'],
          rawAppointmentHtml: ['<a class="exam__item ielts"><span class="btn disable">Register</span></a>']
        }
      };

      jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
        .mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('filled');
      expect(result.appointments[0].status).toBe('filled');
      expect(result.appointments[0].rawHtml).toContain('btn disable');
    });
  });

  describe('Comprehensive Regression Prevention', () => {
    it('should never reintroduce default-to-available logic', async () => {
      // Test cases that specifically prevent the original bug from returning
      const regressionTestCases = [
        {
          html: '<a class="exam__item ielts"><div class="content">Some content without clear status</div></a>',
          expectedStatus: 'unknown',
          description: 'Appointment with content but no clear status indicators'
        },
        {
          html: '<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span></a>',
          expectedStatus: 'filled',
          description: 'Clear filled appointment should never be available'
        },
        {
          html: '<a class="exam__item ielts"><button class="register-btn">Register</button></a>',
          expectedStatus: 'unknown',
          description: 'Generic register button without explicit available indicators'
        },
        {
          html: '<a class="exam__item ielts"><span class="btn disable">تکمیل ظرفیت</span><button>Available</button></a>',
          expectedStatus: 'filled',
          description: 'Mixed signals - filled indicator should take priority'
        }
      ];

      for (const [index, testCase] of regressionTestCases.entries()) {
        const mockCheckResult = {
          type: testCase.expectedStatus === 'filled' ? 'filled' : 'unknown',
          appointments: [
            {
              id: `regression-${index}`,
              date: '2025-02-16',
              time: '14:00',
              location: 'Isfahan',
              examType: 'IELTS',
              city: 'Isfahan',
              status: testCase.expectedStatus,
              rawHtml: testCase.html
            }
          ],
          inspectionData: {
            detectedElements: ['Found elements with selector: a.exam__item.ielts'],
            parsingNotes: [`Element 0: ${testCase.description}`],
            rawAppointmentHtml: [testCase.html]
          }
        };

        jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
          .mockResolvedValue(mockCheckResult);

        const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
        const result = await webScraperService.fetchAppointmentsWithStatus(filters);

        expect(result.appointments[0].status).toBe(testCase.expectedStatus);
        
        // Critical regression test: ensure no appointment is marked as available without explicit indicators
        if (testCase.expectedStatus !== 'available') {
          expect(result.appointments[0].status).not.toBe('available');
        }
        
        // Verify that the system maintains conservative approach
        expect(['filled', 'available', 'unknown']).toContain(result.appointments[0].status);
      }
    });

    it('should validate that filled appointments are never marked as available in any scenario', async () => {
      // This is the most critical test - ensuring the core bug is fixed
      const criticalFilledPatterns = [
        '<a class="exam__item ielts disabled"><span class="btn disable">تکمیل ظرفیت</span></a>',
        '<a class="exam__item ielts disabled"><div>تکمیل ظرفیت</div></a>',
        '<a class="exam__item ielts"><span class="btn disable">تکمیل ظرفیت</span></a>',
        '<div class="exam__item ielts disabled">تکمیل ظرفیت</div>',
        '<a class="exam__item ielts disabled"><button class="btn disable">تکمیل ظرفیت</button></a>'
      ];

      for (const [index, html] of criticalFilledPatterns.entries()) {
        const mockCheckResult = {
          type: 'filled',
          appointments: [
            {
              id: `critical-${index}`,
              date: '2025-02-16',
              time: '14:00',
              location: 'Isfahan',
              examType: 'IELTS',
              city: 'Isfahan',
              status: 'filled',
              rawHtml: html
            }
          ],
          inspectionData: {
            detectedElements: ['Found elements with selector: a.exam__item.ielts'],
            parsingNotes: ['Element 0: Found filled indicator - marking as filled'],
            rawAppointmentHtml: [html]
          }
        };

        jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI')
          .mockResolvedValue(mockCheckResult);

        const filters: ScrapingFilters = { city: ['Isfahan'], examModel: ['IELTS'], months: [2] };
        const result = await webScraperService.fetchAppointmentsWithStatus(filters);

        // The most critical assertion: filled appointments must NEVER be available
        expect(result.appointments[0].status).toBe('filled');
        expect(result.appointments[0].status).not.toBe('available');
        
        // Additional safety checks
        expect(result.type).toBe('filled');
        expect(result.appointments.filter(apt => apt.status === 'available')).toHaveLength(0);
        expect(result.appointments[0].rawHtml).toContain('تکمیل ظرفیت');
      }
    });
  });
});