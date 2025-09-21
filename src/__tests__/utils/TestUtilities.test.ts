/**
 * Test file to verify that all test utilities are working correctly
 */

import { TestDataFactory, MockHelpers, AssertionHelpers, customMatchers } from './index';

describe('Test Utilities', () => {
  describe('TestDataFactory', () => {
    it('should create valid appointments', () => {
      const appointments = TestDataFactory.createAppointments(3);
      
      expect(appointments).toHaveLength(3);
      appointments.forEach(appointment => {
        AssertionHelpers.assertValidAppointment(appointment);
      });
    });

    it('should create valid monitor config', () => {
      const config = TestDataFactory.createMonitorConfig();
      
      AssertionHelpers.assertValidMonitorConfig(config);
    });

    it('should create monitoring session', () => {
      const session = TestDataFactory.createMonitoringSession();
      
      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('startTime');
      expect(session).toHaveProperty('checksPerformed');
      expect(session).toHaveProperty('notificationsSent');
      expect(session).toHaveProperty('errors');
      expect(session).toHaveProperty('configuration');
    });

    it('should create notification record', () => {
      const record = TestDataFactory.createNotificationRecord();
      
      AssertionHelpers.assertValidNotificationRecord(record);
    });

    it('should create check result', () => {
      const result = TestDataFactory.createCheckResult();
      
      AssertionHelpers.assertValidCheckResult(result);
    });
  });

  describe('MockHelpers', () => {
    it('should setup file system mocks', () => {
      const mockFs = MockHelpers.setupFileSystemMocks();
      
      expect(mockFs.ensureDir).toBeDefined();
      expect(mockFs.pathExists).toBeDefined();
      expect(mockFs.readFile).toBeDefined();
      expect(mockFs.writeFile).toBeDefined();
    });

    it('should setup network mocks', () => {
      const { mockPuppeteer, mockBrowser, mockPage } = MockHelpers.setupNetworkMocks();
      
      expect(mockPuppeteer.launch).toBeDefined();
      expect(mockBrowser.newPage).toBeDefined();
      expect(mockPage.goto).toBeDefined();
    });

    it('should setup notification mocks', () => {
      const { mockNotifier, mockTelegramBot } = MockHelpers.setupNotificationMocks();
      
      expect(mockNotifier.notify).toBeDefined();
      expect(mockTelegramBot).toBeDefined();
    });

    it('should setup integration test mocks', () => {
      const mocks = MockHelpers.setupIntegrationTestMocks();
      
      expect(mocks.fs).toBeDefined();
      expect(mocks.network).toBeDefined();
      expect(mocks.notifications).toBeDefined();
      expect(mocks.console).toBeDefined();
      expect(mocks.process).toBeDefined();
      expect(mocks.timers).toBeDefined();
      expect(mocks.environment).toBeDefined();
      expect(mocks.restoreAll).toBeDefined();
      
      // Cleanup
      mocks.restoreAll();
    });
  });

  describe('AssertionHelpers', () => {
    it('should validate appointments correctly', () => {
      const validAppointment = TestDataFactory.createAppointments(1)[0];
      
      expect(() => {
        AssertionHelpers.assertValidAppointment(validAppointment);
      }).not.toThrow();
    });

    it('should validate monitor config correctly', () => {
      const validConfig = TestDataFactory.createMonitorConfig();
      
      expect(() => {
        AssertionHelpers.assertValidMonitorConfig(validConfig);
      }).not.toThrow();
    });

    it('should validate appointment filtering', () => {
      const config = TestDataFactory.createMonitorConfig({
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2]
      });
      
      const appointments = TestDataFactory.createAppointmentsForMonths([2]);
      
      expect(() => {
        AssertionHelpers.assertAppointmentsMatchConfig(appointments, config);
      }).not.toThrow();
    });

    it('should validate check results correctly', () => {
      const checkResult = TestDataFactory.createCheckResult();
      
      expect(() => {
        AssertionHelpers.assertValidCheckResult(checkResult);
      }).not.toThrow();
    });

    it('should validate notification records correctly', () => {
      const record = TestDataFactory.createNotificationRecord();
      
      expect(() => {
        AssertionHelpers.assertValidNotificationRecord(record);
      }).not.toThrow();
    });

    it('should compare appointment arrays correctly', () => {
      const appointments1 = TestDataFactory.createAppointments(2);
      const appointments2 = [...appointments1];
      
      expect(() => {
        AssertionHelpers.assertAppointmentArraysEqual(appointments1, appointments2);
      }).not.toThrow();
    });

    it('should handle error assertions', async () => {
      const errorFunction = () => {
        throw new Error('Test error');
      };
      
      await expect(AssertionHelpers.assertErrorHandling(
        errorFunction,
        'Test error'
      )).resolves.not.toThrow();
    });

    it('should validate mock call patterns', () => {
      const mockFn = jest.fn();
      mockFn('arg1', 'arg2');
      mockFn('arg3', 'arg4');
      
      expect(() => {
        AssertionHelpers.assertMockCallPatterns(mockFn, [
          { args: ['arg1', 'arg2'] },
          { args: ['arg3', 'arg4'] }
        ]);
      }).not.toThrow();
    });
  });

  describe('Custom Jest Matchers', () => {
    beforeAll(() => {
      // Extend Jest with custom matchers for this test
      expect.extend(customMatchers);
    });

    it('should extend Jest with custom matchers', () => {
      const appointment = TestDataFactory.createAppointments(1)[0];
      const config = TestDataFactory.createMonitorConfig();
      
      expect(appointment).toBeValidAppointment();
      expect(config).toBeValidMonitorConfig();
      
      const filteredAppointments = TestDataFactory.createAppointmentsForCities(['isfahan']);
      expect(filteredAppointments).toMatchAppointmentFilter(config);
    });
  });
});