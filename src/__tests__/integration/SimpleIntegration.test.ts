import { MockIELTSServer } from './MockIELTSServer';
import { TestDataFactory } from './TestDataFactory';
import { PerformanceTestUtils } from './PerformanceTestUtils';

// Mock all external dependencies
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn(),
      content: jest.fn().mockResolvedValue('<html><body></body></html>'),
      close: jest.fn()
    }),
    close: jest.fn()
  })
}));

jest.mock('node-notifier', () => ({
  notify: jest.fn((_options, callback) => callback && callback())
}));

jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  appendFile: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('{}'),
  pathExists: jest.fn().mockResolvedValue(false),
  remove: jest.fn().mockResolvedValue(undefined),
  emptyDir: jest.fn().mockResolvedValue(undefined)
}));

describe('Simple Integration Tests', () => {
  let mockServer: MockIELTSServer;

  beforeAll(async () => {
    mockServer = new MockIELTSServer(3005);
    await mockServer.start();
  });

  afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });

  beforeEach(() => {
    mockServer.reset();
  });

  describe('Mock Server Integration', () => {
    test('should start and stop mock server successfully', async () => {
      expect(mockServer.getUrl()).toBe('http://localhost:3005');
      
      const stats = mockServer.getStats();
      expect(stats.requestCount).toBe(0);
      expect(stats.appointmentCount).toBe(0);
    });

    test('should handle appointment data correctly', () => {
      const appointments = TestDataFactory.createAppointments(3);
      mockServer.setAppointments(appointments);
      
      const stats = mockServer.getStats();
      expect(stats.appointmentCount).toBe(3);
    });

    test('should simulate failures correctly', () => {
      mockServer.setFailure(true, 'network');
      
      const stats = mockServer.getStats();
      expect(stats).toHaveProperty('requestCount');
      expect(stats).toHaveProperty('appointmentCount');
    });
  });

  describe('Test Data Factory', () => {
    test('should create valid appointments', () => {
      const appointments = TestDataFactory.createAppointments(5);
      
      expect(appointments).toHaveLength(5);
      appointments.forEach(apt => {
        expect(apt).toHaveProperty('id');
        expect(apt).toHaveProperty('date');
        expect(apt).toHaveProperty('time');
        expect(apt).toHaveProperty('location');
        expect(apt).toHaveProperty('examType');
        expect(apt).toHaveProperty('city');
        expect(apt).toHaveProperty('status');
      });
    });

    test('should create valid monitor configuration', () => {
      const config = TestDataFactory.createMonitorConfig();
      
      expect(config).toHaveProperty('city');
      expect(config).toHaveProperty('examModel');
      expect(config).toHaveProperty('months');
      expect(config).toHaveProperty('checkInterval');
      expect(config).toHaveProperty('notificationSettings');
      
      expect(Array.isArray(config.city)).toBe(true);
      expect(Array.isArray(config.examModel)).toBe(true);
      expect(Array.isArray(config.months)).toBe(true);
      expect(typeof config.checkInterval).toBe('number');
    });

    test('should create appointments for different cities', () => {
      const cities = ['isfahan', 'tehran', 'shiraz'];
      const appointments = TestDataFactory.createAppointmentsForCities(cities);
      
      expect(appointments).toHaveLength(3);
      expect(appointments.map(apt => apt.city)).toEqual(['isfahan', 'tehran', 'shiraz']);
    });

    test('should create appointments for different months', () => {
      const months = [2, 3, 4];
      const appointments = TestDataFactory.createAppointmentsForMonths(months);
      
      expect(appointments).toHaveLength(3);
      appointments.forEach((apt, index) => {
        const aptMonth = new Date(apt.date).getMonth() + 1;
        expect(aptMonth).toBe(months[index]);
      });
    });
  });

  describe('Performance Test Utils', () => {
    test('should take memory snapshots', () => {
      const snapshot = PerformanceTestUtils.takeMemorySnapshot();
      
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('heapUsed');
      expect(snapshot).toHaveProperty('heapTotal');
      expect(snapshot).toHaveProperty('external');
      expect(snapshot).toHaveProperty('rss');
      
      expect(typeof snapshot.timestamp).toBe('number');
      expect(typeof snapshot.heapUsed).toBe('number');
      expect(typeof snapshot.heapTotal).toBe('number');
    });

    test('should format memory sizes correctly', () => {
      const bytes = 1024 * 1024; // 1 MB
      const formatted = PerformanceTestUtils.formatMemory(bytes);
      
      expect(formatted).toBe('1.00 MB');
    });

    test('should measure execution time', async () => {
      const testFunction = async () => {
        await PerformanceTestUtils.wait(100);
        return 'completed';
      };

      const { result, executionTime } = await PerformanceTestUtils.measureExecutionTime(testFunction);
      
      expect(result).toBe('completed');
      expect(executionTime).toBeGreaterThan(90); // Should be around 100ms
      expect(executionTime).toBeLessThan(200);   // Allow some variance
    });

    test('should monitor memory usage during function execution', async () => {
      const testFunction = async () => {
        // Simulate some work
        const data = new Array(1000).fill('test');
        await PerformanceTestUtils.wait(50);
        return data.length;
      };

      const { result, metrics, snapshots } = await PerformanceTestUtils.monitorMemoryUsage(
        testFunction,
        { sampleInterval: 10, maxSamples: 10 }
      );

      expect(result).toBe(1000);
      expect(metrics).toHaveProperty('duration');
      expect(metrics).toHaveProperty('memoryGrowth');
      expect(metrics).toHaveProperty('peakMemory');
      expect(snapshots.length).toBeGreaterThan(1);
    });
  });

  describe('Integration Workflow Simulation', () => {
    test('should simulate appointment detection workflow', () => {
      // Create initial appointments
      const initialAppointments = TestDataFactory.createAppointments(2);
      mockServer.setAppointments(initialAppointments);
      
      // Verify initial state
      let stats = mockServer.getStats();
      expect(stats.appointmentCount).toBe(2);
      
      // Add new appointments
      const newAppointments = TestDataFactory.createAppointments(1);
      newAppointments[0].date = '2025-03-15'; // Different date
      mockServer.addAppointments(newAppointments);
      
      // Verify updated state
      stats = mockServer.getStats();
      expect(stats.appointmentCount).toBe(3);
    });

    test('should simulate error recovery workflow', () => {
      // Start with normal operation
      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);
      
      // Simulate failure
      mockServer.setFailure(true, 'network');
      
      // Verify failure state
      // In a real test, we would make requests and verify they fail
      
      // Recover from failure
      mockServer.setFailure(false);
      
      // Verify recovery
      const stats = mockServer.getStats();
      expect(stats.appointmentCount).toBe(1);
    });

    test('should simulate configuration management', () => {
      const config1 = TestDataFactory.createMonitorConfig({
        city: ['isfahan'],
        checkInterval: 1000
      });
      
      const config2 = TestDataFactory.createMonitorConfig({
        city: ['tehran'],
        checkInterval: 2000
      });
      
      // Verify configurations are different
      expect(config1.city).toEqual(['isfahan']);
      expect(config2.city).toEqual(['tehran']);
      expect(config1.checkInterval).toBe(1000);
      expect(config2.checkInterval).toBe(2000);
    });
  });

  describe('Data Validation', () => {
    test('should validate appointment data structure', () => {
      const appointments = TestDataFactory.createAppointments(1);
      const appointment = appointments[0];
      
      // Validate required fields
      expect(typeof appointment.id).toBe('string');
      expect(appointment.id.length).toBeGreaterThan(0);
      
      expect(typeof appointment.date).toBe('string');
      expect(appointment.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      expect(typeof appointment.time).toBe('string');
      expect(appointment.time).toMatch(/^\d{2}:\d{2}-\d{2}:\d{2}$/);
      
      expect(['available', 'full', 'pending']).toContain(appointment.status);
    });

    test('should validate configuration data structure', () => {
      const config = TestDataFactory.createMonitorConfig();
      
      expect(Array.isArray(config.city)).toBe(true);
      expect(config.city.length).toBeGreaterThan(0);
      
      expect(Array.isArray(config.examModel)).toBe(true);
      expect(config.examModel.length).toBeGreaterThan(0);
      
      expect(Array.isArray(config.months)).toBe(true);
      expect(config.months.length).toBeGreaterThan(0);
      
      expect(typeof config.checkInterval).toBe('number');
      expect(config.checkInterval).toBeGreaterThan(0);
      
      expect(typeof config.notificationSettings).toBe('object');
      expect(typeof config.notificationSettings.desktop).toBe('boolean');
      expect(typeof config.notificationSettings.audio).toBe('boolean');
      expect(typeof config.notificationSettings.logFile).toBe('boolean');
    });
  });
});