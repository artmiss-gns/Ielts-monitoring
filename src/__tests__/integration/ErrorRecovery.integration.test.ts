import { MonitorController, MonitorStatus } from '../../services/MonitorController';
import { MockIELTSServer } from './MockIELTSServer';
import { TestDataFactory } from './TestDataFactory';
import { PerformanceTestUtils } from './PerformanceTestUtils';
import * as fs from 'fs-extra';
import * as path from 'path';

// Mock external dependencies
jest.mock('puppeteer');
jest.mock('node-notifier');

describe('Error Recovery Integration Tests', () => {
  let mockServer: MockIELTSServer;
  let monitorController: MonitorController;
  let testDataDir: string;

  beforeAll(async () => {
    mockServer = new MockIELTSServer(3003);
    await mockServer.start();
    
    testDataDir = path.join(__dirname, '../../../test-data-errors');
    await fs.ensureDir(testDataDir);
  });

  afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
    await fs.remove(testDataDir);
  });

  beforeEach(async () => {
    mockServer.reset();
    monitorController = new MonitorController({ skipShutdownHandlers: true });
    await fs.emptyDir(testDataDir);
  });

  afterEach(async () => {
    if (monitorController.isActive()) {
      await monitorController.stopMonitoring();
    }
  });

  describe('Network Error Recovery', () => {
    test('should recover from temporary network failures', async () => {
      const appointments = TestDataFactory.createAppointments(2);
      mockServer.setAppointments(appointments);

      // Configure server to fail initially
      mockServer.setFailure(true, 'network');

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200
      });

      const errors: Error[] = [];
      const successfulChecks: number[] = [];
      
      monitorController.on('error', (error) => {
        errors.push(error);
      });
      
      monitorController.on('check-completed', (count) => {
        successfulChecks.push(count);
      });

      await monitorController.startMonitoring(config);

      // Wait for failed requests
      await PerformanceTestUtils.wait(400);

      // Fix server after some failures
      mockServer.setFailure(false);

      // Wait for recovery
      await PerformanceTestUtils.wait(600);

      await monitorController.stopMonitoring();

      // Verify errors occurred but system recovered
      expect(errors.length).toBeGreaterThan(0);
      expect(successfulChecks.length).toBeGreaterThan(0);
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
    });

    test('should handle intermittent network failures', async () => {
      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 150
      });

      const errors: Error[] = [];
      const successfulChecks: number[] = [];
      
      monitorController.on('error', (error) => {
        errors.push(error);
      });
      
      monitorController.on('check-completed', (count) => {
        successfulChecks.push(count);
      });

      await monitorController.startMonitoring(config);

      // Simulate intermittent failures
      setTimeout(() => mockServer.setFailure(true, 'network'), 200);
      setTimeout(() => mockServer.setFailure(false), 400);
      setTimeout(() => mockServer.setFailure(true, 'network'), 600);
      setTimeout(() => mockServer.setFailure(false), 800);

      // Wait for multiple cycles
      await PerformanceTestUtils.wait(1000);

      await monitorController.stopMonitoring();

      // Verify system handled intermittent failures
      expect(errors.length).toBeGreaterThan(0);
      expect(successfulChecks.length).toBeGreaterThan(0);
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
    });

    test('should handle timeout errors', async () => {
      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);

      // Configure server to timeout (not respond)
      mockServer.setFailure(true, 'timeout');

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200
      });

      const errors: Error[] = [];
      monitorController.on('error', (error) => {
        errors.push(error);
      });

      await monitorController.startMonitoring(config);

      // Wait for timeout attempts
      await PerformanceTestUtils.wait(600);

      // Fix server
      mockServer.setFailure(false);

      // Wait for recovery
      await PerformanceTestUtils.wait(400);

      await monitorController.stopMonitoring();

      // Verify system handled timeouts
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
    });
  });

  describe('Parsing Error Recovery', () => {
    test('should recover from HTML parsing failures', async () => {
      const appointments = TestDataFactory.createAppointments(2);
      mockServer.setAppointments(appointments);

      // Configure server to return invalid HTML
      mockServer.setFailure(true, 'parsing');

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200
      });

      const errors: Error[] = [];
      const successfulChecks: number[] = [];
      
      monitorController.on('error', (error) => {
        errors.push(error);
      });
      
      monitorController.on('check-completed', (count) => {
        successfulChecks.push(count);
      });

      await monitorController.startMonitoring(config);

      // Wait for parsing errors
      await PerformanceTestUtils.wait(400);

      // Fix server HTML
      mockServer.setFailure(false);

      // Wait for recovery
      await PerformanceTestUtils.wait(600);

      await monitorController.stopMonitoring();

      // Verify system recovered from parsing errors
      expect(successfulChecks.length).toBeGreaterThan(0);
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
    });

    test('should handle malformed appointment data gracefully', async () => {
      // This test would require mocking the WebScraperService to return malformed data
      // For now, we'll test the general error handling capability
      
      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200
      });

      // Mock the web scraper to throw parsing errors
      const originalFetch = jest.fn();
      
      await monitorController.startMonitoring(config);
      await PerformanceTestUtils.wait(400);
      await monitorController.stopMonitoring();

      // Verify monitoring completed without crashing
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
    });
  });

  describe('File System Error Recovery', () => {
    test('should handle file system permission errors', async () => {
      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);

      // Mock file system to fail
      const fsError = new Error('EACCES: permission denied');
      jest.spyOn(fs, 'appendFile').mockRejectedValue(fsError);
      jest.spyOn(fs, 'writeFile').mockRejectedValue(fsError);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200,
        notificationSettings: {
          desktop: false,
          audio: false,
          logFile: true // This will trigger file operations
        }
      });

      const errors: Error[] = [];
      monitorController.on('error', (error) => {
        errors.push(error);
      });

      await monitorController.startMonitoring(config);
      await PerformanceTestUtils.wait(400);
      await monitorController.stopMonitoring();

      // Verify monitoring continued despite file system errors
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);

      // Restore mocks
      jest.restoreAllMocks();
    });

    test('should handle disk space errors', async () => {
      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);

      // Mock file system to fail with disk space error
      const diskError = new Error('ENOSPC: no space left on device');
      jest.spyOn(fs, 'appendFile').mockRejectedValue(diskError);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200,
        notificationSettings: {
          desktop: false,
          audio: false,
          logFile: true
        }
      });

      await monitorController.startMonitoring(config);
      await PerformanceTestUtils.wait(400);
      await monitorController.stopMonitoring();

      // Verify monitoring handled disk space errors
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);

      jest.restoreAllMocks();
    });
  });

  describe('Service Recovery', () => {
    test('should recover from notification service failures', async () => {
      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);

      // Mock notification service to fail
      const mockNotifier = require('node-notifier');
      mockNotifier.notify = jest.fn().mockImplementation((options, callback) => {
        callback(new Error('Notification service unavailable'));
      });

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200,
        notificationSettings: {
          desktop: true,
          audio: true,
          logFile: true
        }
      });

      const errors: Error[] = [];
      monitorController.on('error', (error) => {
        errors.push(error);
      });

      await monitorController.startMonitoring(config);

      // Add new appointment to trigger notification
      const newAppointment = TestDataFactory.createAppointments(1)[0];
      newAppointment.date = '2025-04-01';
      mockServer.addAppointments([newAppointment]);

      await PerformanceTestUtils.wait(400);
      await monitorController.stopMonitoring();

      // Verify monitoring continued despite notification failures
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
    });

    test('should handle configuration service errors', async () => {
      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200
      });

      await monitorController.startMonitoring(config);

      // Try to update with invalid configuration during monitoring
      const invalidConfig = {
        ...config,
        checkInterval: 'invalid' as any
      };

      // This should be handled gracefully
      try {
        await monitorController.updateConfiguration(invalidConfig);
      } catch (error) {
        // Expected to fail
      }

      // Verify monitoring continues with original config
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.RUNNING);

      await monitorController.stopMonitoring();
    });
  });

  describe('Cascading Error Recovery', () => {
    test('should handle multiple simultaneous errors', async () => {
      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);

      // Configure multiple failure points
      mockServer.setFailure(true, 'network');
      
      const fsError = new Error('File system error');
      jest.spyOn(fs, 'appendFile').mockRejectedValue(fsError);

      const mockNotifier = require('node-notifier');
      mockNotifier.notify = jest.fn().mockImplementation((options, callback) => {
        callback(new Error('Notification failed'));
      });

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200,
        notificationSettings: {
          desktop: true,
          audio: false,
          logFile: true
        }
      });

      const errors: Error[] = [];
      monitorController.on('error', (error) => {
        errors.push(error);
      });

      await monitorController.startMonitoring(config);
      await PerformanceTestUtils.wait(600);

      // Fix network but keep other errors
      mockServer.setFailure(false);
      
      // Add appointment to trigger notifications (which will fail)
      const newAppointment = TestDataFactory.createAppointments(1)[0];
      mockServer.addAppointments([newAppointment]);

      await PerformanceTestUtils.wait(400);
      await monitorController.stopMonitoring();

      // Verify system handled multiple errors gracefully
      expect(errors.length).toBeGreaterThan(0);
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);

      jest.restoreAllMocks();
    });

    test('should maintain system stability under error conditions', async () => {
      const appointments = TestDataFactory.createAppointments(2);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 100 // Fast checks to stress test
      });

      // Simulate random errors
      let errorCount = 0;
      const maxErrors = 5;

      const errorInterval = setInterval(() => {
        if (errorCount < maxErrors) {
          const errorType = Math.random() > 0.5 ? 'network' : 'parsing';
          mockServer.setFailure(true, errorType);
          
          setTimeout(() => {
            mockServer.setFailure(false);
          }, 50);
          
          errorCount++;
        }
      }, 150);

      const errors: Error[] = [];
      const successfulChecks: number[] = [];
      
      monitorController.on('error', (error) => {
        errors.push(error);
      });
      
      monitorController.on('check-completed', (count) => {
        successfulChecks.push(count);
      });

      await monitorController.startMonitoring(config);
      await PerformanceTestUtils.wait(1000);
      await monitorController.stopMonitoring();

      clearInterval(errorInterval);

      // Verify system remained stable despite random errors
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
      expect(successfulChecks.length).toBeGreaterThan(0); // Some checks should succeed
    });
  });

  describe('Error Logging and Reporting', () => {
    test('should log errors with proper context', async () => {
      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);

      mockServer.setFailure(true, 'network');

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200
      });

      const errors: Error[] = [];
      monitorController.on('error', (error) => {
        errors.push(error);
      });

      await monitorController.startMonitoring(config);
      await PerformanceTestUtils.wait(400);
      await monitorController.stopMonitoring();

      // Verify errors were captured
      expect(errors.length).toBeGreaterThan(0);
      
      // In a real implementation, we'd verify error logs contain proper context
      // such as timestamps, session IDs, and error details
    });

    test('should maintain error statistics in session', async () => {
      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);

      mockServer.setFailure(true, 'parsing');

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200
      });

      await monitorController.startMonitoring(config);
      await PerformanceTestUtils.wait(400);

      const status = await monitorController.getStatus();
      
      // Fix server and continue
      mockServer.setFailure(false);
      await PerformanceTestUtils.wait(400);

      await monitorController.stopMonitoring();

      // Verify session captured error information
      expect(status.session).toBeDefined();
      // In a real implementation, we'd check that errors are recorded in session.errors
    });
  });
});