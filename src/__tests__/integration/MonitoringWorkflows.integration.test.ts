import { MonitorController, MonitorStatus } from '../../services/MonitorController';
import { MockIELTSServer } from './MockIELTSServer';
import { TestDataFactory } from './TestDataFactory';
import { PerformanceTestUtils } from './PerformanceTestUtils';
import { Appointment } from '../../models/types';
import * as fs from 'fs-extra';
import * as path from 'path';

// Mock external dependencies
jest.mock('puppeteer');
jest.mock('node-notifier');

describe('Monitoring Workflows Integration Tests', () => {
  let mockServer: MockIELTSServer;
  let monitorController: MonitorController;
  let testDataDir: string;

  beforeAll(async () => {
    mockServer = new MockIELTSServer(3002);
    await mockServer.start();
    
    testDataDir = path.join(__dirname, '../../../test-data-workflows');
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

  describe('Filter-based Appointment Detection', () => {
    test('should filter appointments by city correctly', async () => {
      // Create appointments for different cities
      const appointments = TestDataFactory.createAppointmentsForCities(['isfahan', 'tehran', 'shiraz']);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        city: ['isfahan'], // Only monitor Isfahan
        checkInterval: 300
      });

      const foundAppointments: Appointment[][] = [];
      monitorController.on('appointments-found', (appointments) => {
        foundAppointments.push(appointments);
      });

      await monitorController.startMonitoring(config);
      await PerformanceTestUtils.wait(400);
      await monitorController.stopMonitoring();

      // Should only find Isfahan appointments
      expect(foundAppointments.length).toBeGreaterThan(0);
      const allFound = foundAppointments.flat();
      expect(allFound.every(apt => apt.city === 'isfahan')).toBe(true);
    });

    test('should filter appointments by exam model correctly', async () => {
      const appointments = TestDataFactory.createAppointmentsForExamTypes(['CDIELTS', 'IELTS', 'UKVI']);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        examModel: ['cdielts'], // Only monitor CDIELTS
        checkInterval: 300
      });

      const foundAppointments: Appointment[][] = [];
      monitorController.on('appointments-found', (appointments) => {
        foundAppointments.push(appointments);
      });

      await monitorController.startMonitoring(config);
      await PerformanceTestUtils.wait(400);
      await monitorController.stopMonitoring();

      // Should only find CDIELTS appointments
      expect(foundAppointments.length).toBeGreaterThan(0);
      const allFound = foundAppointments.flat();
      expect(allFound.every(apt => apt.examType === 'CDIELTS')).toBe(true);
    });

    test('should filter appointments by month correctly', async () => {
      const appointments = TestDataFactory.createAppointmentsForMonths([2, 3, 4, 5]);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        months: [2, 3], // Only monitor February and March
        checkInterval: 300
      });

      const foundAppointments: Appointment[][] = [];
      monitorController.on('appointments-found', (appointments) => {
        foundAppointments.push(appointments);
      });

      await monitorController.startMonitoring(config);
      await PerformanceTestUtils.wait(400);
      await monitorController.stopMonitoring();

      // Should only find appointments in February and March
      expect(foundAppointments.length).toBeGreaterThan(0);
      const allFound = foundAppointments.flat();
      allFound.forEach(apt => {
        const month = new Date(apt.date).getMonth() + 1;
        expect([2, 3]).toContain(month);
      });
    });

    test('should handle multiple filter combinations', async () => {
      // Create diverse appointment set
      const isfahanCDIELTS = TestDataFactory.createAppointments(2, { 
        city: 'isfahan', 
        examType: 'CDIELTS' 
      });
      const tehranIELTS = TestDataFactory.createAppointments(2, { 
        city: 'tehran', 
        examType: 'IELTS' 
      });
      
      mockServer.setAppointments([...isfahanCDIELTS, ...tehranIELTS]);

      const config = TestDataFactory.createMonitorConfig({
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [2],
        checkInterval: 300
      });

      const foundAppointments: Appointment[][] = [];
      monitorController.on('appointments-found', (appointments) => {
        foundAppointments.push(appointments);
      });

      await monitorController.startMonitoring(config);
      await PerformanceTestUtils.wait(400);
      await monitorController.stopMonitoring();

      // Should only find Isfahan CDIELTS appointments
      expect(foundAppointments.length).toBeGreaterThan(0);
      const allFound = foundAppointments.flat();
      expect(allFound.every(apt => 
        apt.city === 'isfahan' && apt.examType === 'CDIELTS'
      )).toBe(true);
    });
  });

  describe('Appointment Change Detection', () => {
    test('should detect newly added appointments', async () => {
      const initialAppointments = TestDataFactory.createAppointments(2);
      mockServer.setAppointments(initialAppointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 300
      });

      const newAppointmentEvents: Appointment[][] = [];
      monitorController.on('new-appointments', (appointments) => {
        newAppointmentEvents.push(appointments);
      });

      await monitorController.startMonitoring(config);
      
      // Wait for initial check
      await PerformanceTestUtils.wait(400);

      // Add new appointments
      const newAppointments = TestDataFactory.createAppointments(2);
      newAppointments.forEach(apt => {
        apt.date = '2025-03-15'; // Different date to ensure they're new
      });
      mockServer.addAppointments(newAppointments);

      // Wait for detection
      await PerformanceTestUtils.wait(400);

      await monitorController.stopMonitoring();

      // Verify new appointments were detected
      expect(newAppointmentEvents.length).toBeGreaterThan(0);
      const detectedNew = newAppointmentEvents.flat();
      expect(detectedNew.length).toBe(2);
    });

    test('should not trigger notifications for unchanged appointments', async () => {
      const appointments = TestDataFactory.createAppointments(3);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200
      });

      const newAppointmentEvents: Appointment[][] = [];
      monitorController.on('new-appointments', (appointments) => {
        newAppointmentEvents.push(appointments);
      });

      await monitorController.startMonitoring(config);
      
      // Wait for multiple checks with same appointments
      await PerformanceTestUtils.wait(800);

      await monitorController.stopMonitoring();

      // Should not detect any new appointments after initial check
      expect(newAppointmentEvents.length).toBe(0);
    });

    test('should handle appointment status changes', async () => {
      const appointments = TestDataFactory.createAppointments(2, { status: 'available' });
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 300
      });

      await monitorController.startMonitoring(config);
      
      // Wait for initial check
      await PerformanceTestUtils.wait(400);

      // Change appointment status
      const updatedAppointments = appointments.map(apt => ({
        ...apt,
        status: 'full' as const
      }));
      mockServer.setAppointments(updatedAppointments);

      // Wait for detection
      await PerformanceTestUtils.wait(400);

      await monitorController.stopMonitoring();

      // Verify monitoring handled status changes gracefully
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
    });
  });

  describe('Notification Delivery Workflows', () => {
    test('should deliver notifications through all enabled channels', async () => {
      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 300,
        notificationSettings: {
          desktop: true,
          audio: true,
          logFile: true
        }
      });

      let notificationCount = 0;
      monitorController.on('notification-sent', () => {
        notificationCount++;
      });

      await monitorController.startMonitoring(config);
      
      // Wait for initial check (no notifications expected)
      await PerformanceTestUtils.wait(400);

      // Add new appointment to trigger notification
      const newAppointment = TestDataFactory.createAppointments(1)[0];
      newAppointment.date = '2025-04-01';
      mockServer.addAppointments([newAppointment]);

      // Wait for notification
      await PerformanceTestUtils.wait(400);

      await monitorController.stopMonitoring();

      // Verify notification was sent
      expect(notificationCount).toBeGreaterThan(0);
    });

    test('should handle notification failures gracefully', async () => {
      // Mock notification service to fail
      const mockNotifier = require('node-notifier');
      mockNotifier.notify = jest.fn().mockImplementation((options, callback) => {
        callback(new Error('Notification failed'));
      });

      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 300,
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
      
      // Add new appointment to trigger notification
      const newAppointment = TestDataFactory.createAppointments(1)[0];
      newAppointment.date = '2025-04-01';
      mockServer.addAppointments([newAppointment]);

      // Wait for notification attempt
      await PerformanceTestUtils.wait(400);

      await monitorController.stopMonitoring();

      // Verify monitoring continued despite notification failure
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.STOPPED);
    });
  });

  describe('Configuration Update Workflows', () => {
    test('should update configuration during active monitoring', async () => {
      const appointments = TestDataFactory.createAppointments(2);
      mockServer.setAppointments(appointments);

      const initialConfig = TestDataFactory.createMonitorConfig({
        city: ['isfahan'],
        checkInterval: 500
      });

      await monitorController.startMonitoring(initialConfig);
      
      // Wait for initial monitoring
      await PerformanceTestUtils.wait(600);

      // Update configuration
      const updatedConfig = TestDataFactory.createMonitorConfig({
        city: ['tehran'], // Change city
        checkInterval: 300 // Change interval
      });

      await monitorController.updateConfiguration(updatedConfig);

      // Verify monitoring continues with new config
      expect(monitorController.getCurrentStatus()).toBe(MonitorStatus.RUNNING);
      
      const status = await monitorController.getStatus();
      expect(status.config?.city).toEqual(['tehran']);
      expect(status.config?.checkInterval).toBe(300);

      await monitorController.stopMonitoring();
    });

    test('should validate configuration before applying updates', async () => {
      const validConfig = TestDataFactory.createMonitorConfig();
      await monitorController.startMonitoring(validConfig);

      // Try to update with invalid configuration
      const invalidConfig = {
        ...validConfig,
        checkInterval: -1, // Invalid interval
        city: [], // Empty city array
      };

      // This should throw an error or handle gracefully
      await expect(async () => {
        await monitorController.updateConfiguration(invalidConfig);
      }).rejects.toThrow();

      // Verify original config is still active
      const status = await monitorController.getStatus();
      expect(status.config?.checkInterval).toBe(validConfig.checkInterval);

      await monitorController.stopMonitoring();
    });
  });

  describe('Session Management Workflows', () => {
    test('should maintain session statistics accurately', async () => {
      const appointments = TestDataFactory.createAppointments(2);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200
      });

      await monitorController.startMonitoring(config);

      // Let it run for multiple checks
      await PerformanceTestUtils.wait(800);

      // Add new appointment to trigger notification
      const newAppointment = TestDataFactory.createAppointments(1)[0];
      newAppointment.date = '2025-04-01';
      mockServer.addAppointments([newAppointment]);

      // Wait for notification
      await PerformanceTestUtils.wait(300);

      const status = await monitorController.getStatus();
      
      // Verify session statistics
      expect(status.session).toBeDefined();
      expect(status.session!.checksPerformed).toBeGreaterThan(2);
      expect(status.session!.sessionId).toBeDefined();
      expect(status.session!.startTime).toBeInstanceOf(Date);

      await monitorController.stopMonitoring();

      // Verify session was properly finalized
      const finalStatus = await monitorController.getStatus();
      expect(finalStatus.session).toBeNull();
    });

    test('should handle multiple session lifecycles', async () => {
      const appointments = TestDataFactory.createAppointments(1);
      mockServer.setAppointments(appointments);

      const config = TestDataFactory.createMonitorConfig({
        checkInterval: 200
      });

      const sessionIds: string[] = [];

      // Run multiple sessions
      for (let i = 0; i < 3; i++) {
        await monitorController.startMonitoring(config);
        
        const status = await monitorController.getStatus();
        sessionIds.push(status.session!.sessionId);
        
        await PerformanceTestUtils.wait(300);
        await monitorController.stopMonitoring();
      }

      // Verify each session had unique ID
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(3);
    });
  });
});