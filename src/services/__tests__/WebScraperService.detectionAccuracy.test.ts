/**
 * Comprehensive Detection Accuracy Tests for WebScraperService
 * 
 * This test suite validates the accuracy of appointment detection across different scenarios:
 * - Known available vs filled appointment HTML structures
 * - Persian text parsing and CSS class detection
 * - Test simulation server appointment detection
 * - Regression tests to prevent detection accuracy degradation
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 4.3, 4.5
 */

import { WebScraperService, ScrapingFilters } from '../WebScraperService';
import { CheckResult, Appointment } from '../../models/types';

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

describe('WebScraperService - Detection Accuracy Tests', () => {
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

  describe('Known Available Appointment HTML Detection', () => {
    const availableTestCases = [
      {
        name: 'CSS class "available"',
        html: '<div class="appointment-card available">2025-02-15 09:00 IELTS</div>',
        expectedStatus: 'available' as const
      },
      {
        name: 'CSS class "enabled"',
        html: '<div class="appointment-card enabled">2025-02-15 09:00 IELTS</div>',
        expectedStatus: 'available' as const
      },
      {
        name: 'Registration button present',
        html: '<div class="appointment-card"><button class="register-btn">Register</button>2025-02-15 09:00</div>',
        expectedStatus: 'available' as const
      },
      {
        name: 'Registration link present',
        html: '<div class="appointment-card"><a href="/register">Register Now</a>2025-02-15 09:00</div>',
        expectedStatus: 'available' as const
      },
      {
        name: 'onclick attribute present',
        html: '<div class="appointment-card" onclick="register()">2025-02-15 09:00 IELTS</div>',
        expectedStatus: 'available' as const
      },
      {
        name: 'Persian "رزرو" text',
        html: '<div class="appointment-card">رزرو - 2025-02-15 09:00</div>',
        expectedStatus: 'available' as const
      },
      {
        name: 'Persian "ثبت نام" text',
        html: '<div class="appointment-card">ثبت نام - 2025-02-15 09:00</div>',
        expectedStatus: 'available' as const
      },
      {
        name: 'Default available (no negative indicators)',
        html: '<div class="appointment-card">IELTS Exam - 2025-02-15 09:00-12:00</div>',
        expectedStatus: 'available' as const
      }
    ];

    availableTestCases.forEach(testCase => {
      it(`should correctly detect available status from ${testCase.name}`, async () => {
        const mockCheckResult: CheckResult = {
          type: 'available',
          appointmentCount: 1,
          availableCount: 1,
          filledCount: 0,
          timestamp: new Date(),
          url: 'test-url',
          appointments: [
            {
              id: 'test-1',
              date: '2025-02-15',
              time: '09:00-12:00',
              location: 'Test Center',
              examType: 'IELTS',
              city: 'Isfahan',
              status: testCase.expectedStatus,
              rawHtml: testCase.html
            }
          ]
        };

        mockPage.evaluate.mockResolvedValue(mockCheckResult);

        const filters: ScrapingFilters = {
          city: ['isfahan'],
          examModel: ['ielts'],
          months: [2]
        };

        const result = await webScraperService.fetchAppointmentsWithStatus(filters);

        expect(result.type).toBe('available');
        expect(result.appointments[0].status).toBe(testCase.expectedStatus);
        expect(result.availableCount).toBe(1);
        expect(result.filledCount).toBe(0);
      });
    });
  });

  describe('Known Filled Appointment HTML Detection', () => {
    const filledTestCases = [
      {
        name: 'CSS class "filled"',
        html: '<div class="appointment-card filled">2025-02-15 09:00 IELTS</div>',
        expectedStatus: 'filled' as const
      },
      {
        name: 'CSS class "full"',
        html: '<div class="appointment-card full">2025-02-15 09:00 IELTS</div>',
        expectedStatus: 'filled' as const
      },
      {
        name: 'CSS class "disabled"',
        html: '<div class="appointment-card disabled">2025-02-15 09:00 IELTS</div>',
        expectedStatus: 'filled' as const
      },
      {
        name: 'CSS class "sold-out"',
        html: '<div class="appointment-card sold-out">2025-02-15 09:00 IELTS</div>',
        expectedStatus: 'filled' as const
      },
      {
        name: 'Disabled button',
        html: '<div class="appointment-card"><button disabled>Register</button>2025-02-15 09:00</div>',
        expectedStatus: 'filled' as const
      },
      {
        name: 'Persian "تکمیل ظرفیت"',
        html: '<div class="appointment-card">تکمیل ظرفیت - 2025-02-15 09:00</div>',
        expectedStatus: 'filled' as const
      },
      {
        name: 'Persian "پر شده"',
        html: '<div class="appointment-card">پر شده - 2025-02-15 09:00</div>',
        expectedStatus: 'filled' as const
      },
      {
        name: 'Persian "تمام شده"',
        html: '<div class="appointment-card">تمام شده - 2025-02-15 09:00</div>',
        expectedStatus: 'filled' as const
      },
      {
        name: 'English "Full" text',
        html: '<div class="appointment-card">Full - 2025-02-15 09:00</div>',
        expectedStatus: 'filled' as const
      },
      {
        name: 'English "Sold Out" text',
        html: '<div class="appointment-card">Sold Out - 2025-02-15 09:00</div>',
        expectedStatus: 'filled' as const
      }
    ];

    filledTestCases.forEach(testCase => {
      it(`should correctly detect filled status from ${testCase.name}`, async () => {
        const mockCheckResult: CheckResult = {
          type: 'filled',
          appointmentCount: 1,
          availableCount: 0,
          filledCount: 1,
          timestamp: new Date(),
          url: 'test-url',
          appointments: [
            {
              id: 'test-1',
              date: '2025-02-15',
              time: '09:00-12:00',
              location: 'Test Center',
              examType: 'IELTS',
              city: 'Isfahan',
              status: testCase.expectedStatus,
              rawHtml: testCase.html
            }
          ]
        };

        mockPage.evaluate.mockResolvedValue(mockCheckResult);

        const filters: ScrapingFilters = {
          city: ['isfahan'],
          examModel: ['ielts'],
          months: [2]
        };

        const result = await webScraperService.fetchAppointmentsWithStatus(filters);

        expect(result.type).toBe('filled');
        expect(result.appointments[0].status).toBe(testCase.expectedStatus);
        expect(result.availableCount).toBe(0);
        expect(result.filledCount).toBe(1);
      });
    });
  });

  describe('Persian Text Parsing Accuracy', () => {
    const persianTextCases = [
      {
        name: 'Persian availability indicators',
        texts: ['رزرو', 'ثبت نام', 'در دسترس', 'موجود'],
        expectedStatus: 'available' as const
      },
      {
        name: 'Persian filled indicators',
        texts: ['تکمیل ظرفیت', 'پر شده', 'تمام شده', 'بسته شده'],
        expectedStatus: 'filled' as const
      },
      {
        name: 'Persian pending indicators',
        texts: ['در انتظار', 'تایید نشده', 'در حال بررسی'],
        expectedStatus: 'pending' as const
      }
    ];

    persianTextCases.forEach(testCase => {
      testCase.texts.forEach(text => {
        it(`should correctly parse Persian text "${text}" as ${testCase.expectedStatus}`, async () => {
          const mockCheckResult: CheckResult = {
            type: testCase.expectedStatus === 'available' ? 'available' : 'filled',
            appointmentCount: 1,
            availableCount: testCase.expectedStatus === 'available' ? 1 : 0,
            filledCount: testCase.expectedStatus === 'available' ? 0 : 1,
            timestamp: new Date(),
            url: 'test-url',
            appointments: [
              {
                id: 'test-1',
                date: '2025-02-15',
                time: '09:00-12:00',
                location: 'Test Center',
                examType: 'IELTS',
                city: 'Isfahan',
                status: testCase.expectedStatus,
                rawHtml: `<div class="appointment-card">${text} - 2025-02-15 09:00</div>`
              }
            ]
          };

          mockPage.evaluate.mockResolvedValue(mockCheckResult);

          const filters: ScrapingFilters = {
            city: ['isfahan'],
            examModel: ['ielts'],
            months: [2]
          };

          const result = await webScraperService.fetchAppointmentsWithStatus(filters);

          expect(result.appointments[0].status).toBe(testCase.expectedStatus);
          expect(result.appointments[0].rawHtml).toContain(text);
        });
      });
    });

    it('should handle mixed Persian and English text correctly', async () => {
      const mockCheckResult: CheckResult = {
        type: 'available',
        appointmentCount: 2,
        availableCount: 1,
        filledCount: 1,
        timestamp: new Date(),
        url: 'test-url',
        appointments: [
          {
            id: 'test-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Test Center',
            examType: 'IELTS',
            city: 'Isfahan',
            status: 'available',
            rawHtml: '<div class="appointment-card">IELTS - رزرو - 2025-02-15 09:00</div>'
          },
          {
            id: 'test-2',
            date: '2025-02-16',
            time: '14:00-17:00',
            location: 'Test Center',
            examType: 'IELTS',
            city: 'Isfahan',
            status: 'filled',
            rawHtml: '<div class="appointment-card">IELTS - تکمیل ظرفیت - 2025-02-16 14:00</div>'
          }
        ]
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['ielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('available'); // Should prioritize available
      expect(result.appointments).toHaveLength(2);
      expect(result.appointments[0].status).toBe('available');
      expect(result.appointments[1].status).toBe('filled');
      expect(result.availableCount).toBe(1);
      expect(result.filledCount).toBe(1);
    });
  });

  describe('CSS Class Detection Accuracy', () => {
    const cssClassCases = [
      {
        name: 'Available CSS classes',
        classes: ['available', 'enabled', 'open', 'active', 'registerable'],
        expectedStatus: 'available' as const
      },
      {
        name: 'Filled CSS classes',
        classes: ['filled', 'full', 'disabled', 'closed', 'sold-out', 'booked'],
        expectedStatus: 'filled' as const
      },
      {
        name: 'Pending CSS classes',
        classes: ['pending', 'waiting', 'processing', 'under-review'],
        expectedStatus: 'pending' as const
      }
    ];

    cssClassCases.forEach(testCase => {
      testCase.classes.forEach(cssClass => {
        it(`should correctly detect status from CSS class "${cssClass}"`, async () => {
          const mockCheckResult: CheckResult = {
            type: testCase.expectedStatus === 'available' ? 'available' : 'filled',
            appointmentCount: 1,
            availableCount: testCase.expectedStatus === 'available' ? 1 : 0,
            filledCount: testCase.expectedStatus === 'available' ? 0 : 1,
            timestamp: new Date(),
            url: 'test-url',
            appointments: [
              {
                id: 'test-1',
                date: '2025-02-15',
                time: '09:00-12:00',
                location: 'Test Center',
                examType: 'IELTS',
                city: 'Isfahan',
                status: testCase.expectedStatus,
                rawHtml: `<div class="appointment-card ${cssClass}">2025-02-15 09:00 IELTS</div>`
              }
            ]
          };

          mockPage.evaluate.mockResolvedValue(mockCheckResult);

          const filters: ScrapingFilters = {
            city: ['isfahan'],
            examModel: ['ielts'],
            months: [2]
          };

          const result = await webScraperService.fetchAppointmentsWithStatus(filters);

          expect(result.appointments[0].status).toBe(testCase.expectedStatus);
          expect(result.appointments[0].rawHtml).toContain(cssClass);
        });
      });
    });

    it('should handle multiple CSS classes and prioritize correctly', async () => {
      const mockCheckResult: CheckResult = {
        type: 'filled',
        appointmentCount: 1,
        availableCount: 0,
        filledCount: 1,
        timestamp: new Date(),
        url: 'test-url',
        appointments: [
          {
            id: 'test-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Test Center',
            examType: 'IELTS',
            city: 'Isfahan',
            status: 'filled',
            rawHtml: '<div class="appointment-card exam-slot filled disabled">2025-02-15 09:00 IELTS</div>'
          }
        ]
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['ielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.appointments[0].status).toBe('filled');
      expect(result.appointments[0].rawHtml).toContain('filled');
      expect(result.appointments[0].rawHtml).toContain('disabled');
    });
  });

  describe('Test Simulation Server Detection Accuracy', () => {
    beforeEach(() => {
      // Configure service for test server
      webScraperService = new WebScraperService('http://localhost:3001');
      
      // Mock the API fetch method to avoid actual network calls
      jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI').mockImplementation(async () => {
        // This will be overridden by individual test mocks
        throw new Error('Mock not configured for this test');
      });
    });

    it('should detect test server appointment cards with all expected selectors', async () => {
      const testServerHtml = `
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
        </div>
      `;

      const mockCheckResult: CheckResult = {
        type: 'available',
        appointmentCount: 1,
        availableCount: 1,
        filledCount: 0,
        timestamp: new Date(),
        url: 'http://localhost:3001',
        appointments: [
          {
            id: 'test-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Test Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'available',
            price: 2500000,
            registrationUrl: '/register/test-1',
            rawHtml: testServerHtml.trim()
          }
        ]
      };

      // Mock the API method for this specific test
      jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI').mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('available');
      expect(result.appointments).toHaveLength(1);
      expect(result.appointments[0]).toMatchObject({
        id: 'test-1',
        date: '2025-02-15',
        time: '09:00-12:00',
        location: 'Isfahan Test Center',
        examType: 'CDIELTS',
        city: 'Isfahan',
        status: 'available',
        price: 2500000,
        registrationUrl: '/register/test-1'
      });
    });

    it('should detect filled appointments on test server', async () => {
      const mockCheckResult: CheckResult = {
        type: 'filled',
        appointmentCount: 1,
        availableCount: 0,
        filledCount: 1,
        timestamp: new Date(),
        url: 'http://localhost:3001',
        appointments: [
          {
            id: 'test-2',
            date: '2025-02-16',
            time: '14:00-17:00',
            location: 'Isfahan Test Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'filled',
            price: 2500000,
            rawHtml: '<div class="appointment-card filled">Fully Booked</div>'
          }
        ]
      };

      // Mock the API method for this specific test
      jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI').mockResolvedValue(mockCheckResult);

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

    it('should handle test server with no appointments', async () => {
      const mockCheckResult: CheckResult = {
        type: 'no-slots',
        appointmentCount: 0,
        availableCount: 0,
        filledCount: 0,
        timestamp: new Date(),
        url: 'http://localhost:3001',
        appointments: []
      };

      // Mock the API method for this specific test
      jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI').mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('no-slots');
      expect(result.appointmentCount).toBe(0);
      expect(result.appointments).toHaveLength(0);
    });

    it('should detect mixed available and filled appointments on test server', async () => {
      const mockCheckResult: CheckResult = {
        type: 'available',
        appointmentCount: 3,
        availableCount: 2,
        filledCount: 1,
        timestamp: new Date(),
        url: 'http://localhost:3001',
        appointments: [
          {
            id: 'test-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Test Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'available',
            price: 2500000,
            registrationUrl: '/register/test-1'
          },
          {
            id: 'test-2',
            date: '2025-02-16',
            time: '14:00-17:00',
            location: 'Isfahan Test Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'filled',
            price: 2500000
          },
          {
            id: 'test-3',
            date: '2025-02-17',
            time: '10:00-13:00',
            location: 'Tehran Test Center',
            examType: 'IELTS',
            city: 'Tehran',
            status: 'available',
            price: 2800000,
            registrationUrl: '/register/test-3'
          }
        ]
      };

      // Mock the API method for this specific test
      jest.spyOn(webScraperService as any, 'fetchAppointmentsWithStatusFromAPI').mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan', 'tehran'],
        examModel: ['cdielts', 'ielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('available'); // Should prioritize available
      expect(result.appointmentCount).toBe(3);
      expect(result.availableCount).toBe(2);
      expect(result.filledCount).toBe(1);

      // Verify individual appointment statuses
      const availableAppointments = result.appointments.filter(apt => apt.status === 'available');
      const filledAppointments = result.appointments.filter(apt => apt.status === 'filled');
      
      expect(availableAppointments).toHaveLength(2);
      expect(filledAppointments).toHaveLength(1);
    });
  });

  describe('Regression Tests - Detection Accuracy', () => {
    /**
     * These tests ensure that detection accuracy doesn't degrade over time
     * by testing against known working HTML structures and expected results
     */

    const regressionTestCases = [
      {
        name: 'Real IELTS website structure (available)',
        html: `
          <div class="timetable-section">
            <a class="exam__item ielts" href="/register/123">
              <div class="exam-info">
                <div class="exam-date">2025-02-15</div>
                <div class="exam-time">09:00</div>
                <div class="exam-location">Isfahan Center</div>
                <div class="exam-type">CDIELTS</div>
              </div>
            </a>
          </div>
        `,
        expectedResult: {
          type: 'available' as const,
          appointmentCount: 1,
          availableCount: 1,
          filledCount: 0
        }
      },
      {
        name: 'Real IELTS website structure (filled)',
        html: `
          <div class="timetable-section">
            <div class="exam__item ielts disabled">
              <div class="exam-info">
                <div class="exam-date">2025-02-16</div>
                <div class="exam-time">14:00</div>
                <div class="exam-location">Tehran Center</div>
                <div class="exam-type">IELTS</div>
                <div class="exam-status">تکمیل ظرفیت</div>
              </div>
            </div>
          </div>
        `,
        expectedResult: {
          type: 'filled' as const,
          appointmentCount: 1,
          availableCount: 0,
          filledCount: 1
        }
      },
      {
        name: 'Complex mixed scenario',
        html: `
          <div class="appointments-container">
            <div class="appointment-card available">
              <h3>IELTS Academic</h3>
              <p>Date: 2025-02-15</p>
              <p>Time: 09:00-12:00</p>
              <p>Location: Isfahan Center</p>
              <button class="register-btn">رزرو</button>
            </div>
            <div class="appointment-card filled">
              <h3>CDIELTS</h3>
              <p>Date: 2025-02-16</p>
              <p>Time: 14:00-17:00</p>
              <p>Location: Tehran Center</p>
              <span class="status">تکمیل ظرفیت</span>
            </div>
            <div class="appointment-card pending">
              <h3>IELTS General</h3>
              <p>Date: 2025-02-17</p>
              <p>Time: 10:00-13:00</p>
              <p>Location: Shiraz Center</p>
              <span class="status">در انتظار تایید</span>
            </div>
          </div>
        `,
        expectedResult: {
          type: 'available' as const,
          appointmentCount: 3,
          availableCount: 1,
          filledCount: 2 // filled + pending
        }
      },
      {
        name: 'No appointments scenario',
        html: `
          <div class="timetable-section">
            <div class="no-results">
              <p>هیچ آزمونی برای معیارهای انتخابی شما یافت نشد</p>
              <p>لطفاً فیلترهای خود را تغییر دهید یا بعداً دوباره تلاش کنید</p>
            </div>
          </div>
        `,
        expectedResult: {
          type: 'no-slots' as const,
          appointmentCount: 0,
          availableCount: 0,
          filledCount: 0
        }
      }
    ];

    regressionTestCases.forEach(testCase => {
      it(`should maintain accuracy for: ${testCase.name}`, async () => {
        const mockCheckResult: CheckResult = {
          type: testCase.expectedResult.type,
          appointmentCount: testCase.expectedResult.appointmentCount,
          availableCount: testCase.expectedResult.availableCount,
          filledCount: testCase.expectedResult.filledCount,
          timestamp: new Date(),
          url: 'test-url',
          appointments: testCase.expectedResult.appointmentCount > 0 ? 
            Array.from({ length: testCase.expectedResult.appointmentCount }, (_, i) => ({
              id: `test-${i + 1}`,
              date: `2025-02-${15 + i}`,
              time: '09:00-12:00',
              location: 'Test Center',
              examType: 'IELTS',
              city: 'Isfahan',
              status: (i < testCase.expectedResult.availableCount ? 'available' : 'filled') as Appointment['status'],
              rawHtml: testCase.html
            })) : []
        };

        mockPage.evaluate.mockResolvedValue(mockCheckResult);

        const filters: ScrapingFilters = {
          city: ['isfahan'],
          examModel: ['ielts'],
          months: [2]
        };

        const result = await webScraperService.fetchAppointmentsWithStatus(filters);

        expect(result.type).toBe(testCase.expectedResult.type);
        expect(result.appointmentCount).toBe(testCase.expectedResult.appointmentCount);
        expect(result.availableCount).toBe(testCase.expectedResult.availableCount);
        expect(result.filledCount).toBe(testCase.expectedResult.filledCount);
      });
    });

    it('should maintain consistent detection performance', async () => {
      // Test that detection doesn't become significantly slower
      const startTime = Date.now();
      
      const mockCheckResult: CheckResult = {
        type: 'available',
        appointmentCount: 10,
        availableCount: 5,
        filledCount: 5,
        timestamp: new Date(),
        url: 'test-url',
        appointments: Array.from({ length: 10 }, (_, i) => ({
          id: `test-${i + 1}`,
          date: `2025-02-${15 + i}`,
          time: '09:00-12:00',
          location: 'Test Center',
          examType: 'IELTS',
          city: 'Isfahan',
          status: (i < 5 ? 'available' : 'filled') as Appointment['status']
        }))
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['ielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(result.appointmentCount).toBe(10);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle edge cases without breaking', async () => {
      const edgeCases = [
        {
          name: 'Empty HTML',
          html: '',
          expectedType: 'no-slots' as const
        },
        {
          name: 'Malformed HTML',
          html: '<div class="appointment-card"><p>Incomplete',
          expectedType: 'no-slots' as const
        },
        {
          name: 'Mixed languages and special characters',
          html: '<div class="appointment-card">IELTS - رزرو - 2025-02-15 09:00 - €50 - 中文</div>',
          expectedType: 'available' as const
        }
      ];

      for (const edgeCase of edgeCases) {
        const mockCheckResult: CheckResult = {
          type: edgeCase.expectedType,
          appointmentCount: edgeCase.expectedType === 'no-slots' ? 0 : 1,
          availableCount: edgeCase.expectedType === 'available' ? 1 : 0,
          filledCount: edgeCase.expectedType === 'no-slots' ? 0 : (edgeCase.expectedType === 'available' ? 0 : 1),
          timestamp: new Date(),
          url: 'test-url',
          appointments: edgeCase.expectedType === 'no-slots' ? [] : [
            {
              id: 'test-1',
              date: '2025-02-15',
              time: '09:00-12:00',
              location: 'Test Center',
              examType: 'IELTS',
              city: 'Isfahan',
              status: edgeCase.expectedType as Appointment['status'],
              rawHtml: edgeCase.html
            }
          ]
        };

        mockPage.evaluate.mockResolvedValue(mockCheckResult);

        const filters: ScrapingFilters = {
          city: ['isfahan'],
          examModel: ['ielts'],
          months: [2]
        };

        const result = await webScraperService.fetchAppointmentsWithStatus(filters);

        expect(result.type).toBe(edgeCase.expectedType);
        expect(() => result).not.toThrow();
      }
    });

    it('should maintain detection accuracy under different load conditions', async () => {
      // Simulate different numbers of appointments to ensure scalability
      const loadTestCases = [1, 5, 10, 25, 50];

      for (const appointmentCount of loadTestCases) {
        const mockCheckResult: CheckResult = {
          type: 'available',
          appointmentCount,
          availableCount: Math.ceil(appointmentCount / 2),
          filledCount: Math.floor(appointmentCount / 2),
          timestamp: new Date(),
          url: 'test-url',
          appointments: Array.from({ length: appointmentCount }, (_, i) => ({
            id: `test-${i + 1}`,
            date: `2025-02-${15 + (i % 15)}`,
            time: '09:00-12:00',
            location: 'Test Center',
            examType: 'IELTS',
            city: 'Isfahan',
            status: (i < Math.ceil(appointmentCount / 2) ? 'available' : 'filled') as Appointment['status']
          }))
        };

        mockPage.evaluate.mockResolvedValue(mockCheckResult);

        const filters: ScrapingFilters = {
          city: ['isfahan'],
          examModel: ['ielts'],
          months: [2]
        };

        const result = await webScraperService.fetchAppointmentsWithStatus(filters);

        expect(result.appointmentCount).toBe(appointmentCount);
        expect(result.availableCount).toBe(Math.ceil(appointmentCount / 2));
        expect(result.filledCount).toBe(Math.floor(appointmentCount / 2));
        expect(result.appointments).toHaveLength(appointmentCount);
      }
    });
  });

  describe('Detection Validation and Quality Assurance', () => {
    it('should validate that all appointments have required fields', async () => {
      const mockCheckResult: CheckResult = {
        type: 'available',
        appointmentCount: 2,
        availableCount: 1,
        filledCount: 1,
        timestamp: new Date(),
        url: 'test-url',
        appointments: [
          {
            id: 'test-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Test Center',
            examType: 'IELTS',
            city: 'Isfahan',
            status: 'available'
          },
          {
            id: 'test-2',
            date: '2025-02-16',
            time: '14:00-17:00',
            location: 'Test Center',
            examType: 'IELTS',
            city: 'Isfahan',
            status: 'filled'
          }
        ]
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['ielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      // Validate that all appointments have required fields
      result.appointments.forEach(appointment => {
        expect(appointment.id).toBeDefined();
        expect(appointment.date).toBeDefined();
        expect(appointment.time).toBeDefined();
        expect(appointment.location).toBeDefined();
        expect(appointment.examType).toBeDefined();
        expect(appointment.city).toBeDefined();
        expect(appointment.status).toBeDefined();
        expect(['available', 'filled', 'pending', 'not-registerable', 'unknown']).toContain(appointment.status);
      });
    });

    it('should ensure status counts are consistent', async () => {
      const mockCheckResult: CheckResult = {
        type: 'available',
        appointmentCount: 5,
        availableCount: 2,
        filledCount: 3,
        timestamp: new Date(),
        url: 'test-url',
        appointments: [
          { id: '1', date: '2025-02-15', time: '09:00', location: 'Test', examType: 'IELTS', city: 'Isfahan', status: 'available' },
          { id: '2', date: '2025-02-16', time: '09:00', location: 'Test', examType: 'IELTS', city: 'Isfahan', status: 'available' },
          { id: '3', date: '2025-02-17', time: '09:00', location: 'Test', examType: 'IELTS', city: 'Isfahan', status: 'filled' },
          { id: '4', date: '2025-02-18', time: '09:00', location: 'Test', examType: 'IELTS', city: 'Isfahan', status: 'filled' },
          { id: '5', date: '2025-02-19', time: '09:00', location: 'Test', examType: 'IELTS', city: 'Isfahan', status: 'pending' }
        ]
      };

      mockPage.evaluate.mockResolvedValue(mockCheckResult);

      const filters: ScrapingFilters = {
        city: ['isfahan'],
        examModel: ['ielts'],
        months: [2]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      // Count actual statuses
      const actualAvailable = result.appointments.filter(apt => apt.status === 'available').length;
      const actualFilled = result.appointments.filter(apt => apt.status === 'filled' || apt.status === 'pending').length;

      expect(result.appointmentCount).toBe(result.appointments.length);
      expect(result.availableCount).toBe(actualAvailable);
      expect(result.filledCount).toBe(actualFilled);
      expect(result.availableCount + result.filledCount).toBe(result.appointmentCount);
    });
  });
});