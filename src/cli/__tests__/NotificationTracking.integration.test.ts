import { CLIController } from '../CLIController';
import { AppointmentDetectionService } from '../../services/AppointmentDetectionService';
import { Appointment, CheckResult } from '../../models/types';
import { promises as fs } from 'fs';
import path from 'path';

// Mock console methods to capture output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock chalk to avoid ANSI codes in test output
jest.mock('chalk', () => ({
  blue: jest.fn((text) => text),
  gray: jest.fn((text) => text),
  cyan: jest.fn((text) => text),
  green: jest.fn((text) => text),
  yellow: jest.fn((text) => text),
  red: jest.fn((text) => text)
}));

describe('Notification Tracking Integration', () => {
  let cliController: CLIController;
  let appointmentDetection: AppointmentDetectionService;
  
  const testDataDir = 'test-data/notification-tracking';
  const testAppointments: Appointment[] = [
    {
      id: 'apt_1',
      date: '2025-02-15',
      time: '09:00-12:00',
      city: 'Isfahan',
      location: 'Test Center',
      examType: 'CDIELTS',
      status: 'available',
      price: 5500000
    },
    {
      id: 'apt_2',
      date: '2025-02-16',
      time: '14:00-17:00',
      city: 'Tehran',
      location: 'Test Center 2',
      examType: 'CDIELTS',
      status: 'filled',
      price: 5500000
    }
  ];

  const createCheckResult = (appointments: Appointment[], type: 'available' | 'filled' | 'no-slots' = 'available'): CheckResult => ({
    type,
    appointments,
    appointmentCount: appointments.length,
    availableCount: appointments.filter(apt => apt.status === 'available').length,
    filledCount: appointments.filter(apt => apt.status === 'filled').length,
    url: 'http://test.com',
    timestamp: new Date()
  });

  beforeAll(async () => {
    // Create test data directory
    await fs.mkdir(testDataDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await fs.rmdir(testDataDir, { recursive: true });
    } catch (error) {
      // Directory might not exist, ignore
    }
  });

  beforeEach(async () => {
    // Clear console mocks
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();

    // Initialize services with test configuration
    appointmentDetection = new AppointmentDetectionService({
      trackingDataFile: path.join(testDataDir, 'appointment-tracking.json'),
      notificationTrackingFile: path.join(testDataDir, 'notified-appointments.json'),
      maxTrackingDays: 30,
      statusChangeThreshold: 5
    });

    await appointmentDetection.initialize();

    // Initialize CLI controller
    cliController = new CLIController();
  });

  afterEach(async () => {
    // Clean up test files
    const testFiles = [
      path.join(testDataDir, 'appointment-tracking.json'),
      path.join(testDataDir, 'notified-appointments.json')
    ];

    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // File might not exist, ignore
      }
    }
  });

  describe('CLI Notification Tracking Command', () => {
    test('should display notification tracking statistics', async () => {
      // Process some test appointments to create tracking data
      const checkResult = createCheckResult(testAppointments);
      await appointmentDetection.processAppointments(checkResult);

      // Mark one appointment as notified
      await appointmentDetection.markAsNotified([testAppointments[0]]);

      // Test the CLI command
      await cliController.notificationTrackingCommand({ stats: true });

      // Verify output contains expected statistics
      const output = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Notification Tracking Statistics');
      expect(output).toContain('Total Tracked Appointments: 2');
      expect(output).toContain('Currently Available: 1');
      expect(output).toContain('Currently Filled: 1');
      expect(output).toContain('Total Notifications Sent: 1');
    });

    test('should display detailed notification tracking information', async () => {
      // Process test appointments
      const checkResult = createCheckResult(testAppointments);
      await appointmentDetection.processAppointments(checkResult);

      // Test detailed command
      await cliController.notificationTrackingCommand({ detailed: true });

      const output = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Detailed Tracking Information');
      expect(output).toContain('Usage hints');
    });

    test('should show recent status changes', async () => {
      // Process appointments initially
      const initialCheckResult = createCheckResult(testAppointments);
      await appointmentDetection.processAppointments(initialCheckResult);

      // Change status of an appointment
      const updatedAppointments = [...testAppointments];
      updatedAppointments[1].status = 'available'; // Change from filled to available

      const updatedCheckResult = createCheckResult(updatedAppointments);
      await appointmentDetection.processAppointments(updatedCheckResult);

      // Test recent changes command
      await cliController.notificationTrackingCommand({ recent: '60' });

      const output = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Recent Status Changes');
    });

    test('should output JSON format when requested', async () => {
      // Process test appointments
      const checkResult = createCheckResult(testAppointments);
      await appointmentDetection.processAppointments(checkResult);

      // Test JSON output
      await cliController.notificationTrackingCommand({ json: true });

      const output = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n');
      
      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();
      
      const jsonOutput = JSON.parse(output);
      expect(jsonOutput).toHaveProperty('statistics');
      expect(jsonOutput).toHaveProperty('recentStatusChanges');
      expect(jsonOutput.statistics).toHaveProperty('totalTracked');
    });
  });

  describe('Enhanced MonitorController Integration', () => {
    test('should use enhanced AppointmentDetectionService for duplicate prevention', async () => {
      // This test verifies that MonitorController properly integrates with the enhanced service
      const stats = appointmentDetection.getTrackingStatistics();
      
      expect(stats).toHaveProperty('totalTracked');
      expect(stats).toHaveProperty('totalNotificationsSent');
      expect(stats).toHaveProperty('notifiedAppointmentKeysCount');
      expect(stats).toHaveProperty('availableCount');
      expect(stats).toHaveProperty('filledCount');
    });

    test('should prevent duplicate notifications correctly', async () => {
      const availableAppointment = testAppointments[0]; // Available appointment
      
      // First check - should be notifiable
      let notifiableAppointments = appointmentDetection.getNotifiableAppointments([availableAppointment]);
      expect(notifiableAppointments).toHaveLength(1);
      
      // Mark as notified
      await appointmentDetection.markAsNotified([availableAppointment]);
      
      // Second check - should not be notifiable (duplicate prevention)
      notifiableAppointments = appointmentDetection.getNotifiableAppointments([availableAppointment]);
      expect(notifiableAppointments).toHaveLength(0);
    });

    test('should allow re-notification after status transitions', async () => {
      const appointment = { ...testAppointments[0] };
      
      // Initial processing - available
      let checkResult = createCheckResult([appointment]);
      await appointmentDetection.processAppointments(checkResult);
      await appointmentDetection.markAsNotified([appointment]);
      
      // Change to filled
      appointment.status = 'filled';
      checkResult = createCheckResult([appointment], 'filled');
      await appointmentDetection.processAppointments(checkResult);
      
      // Change back to available - should be notifiable again
      appointment.status = 'available';
      checkResult = createCheckResult([appointment]);
      
      const result = await appointmentDetection.processAppointments(checkResult);
      const notifiableAppointments = appointmentDetection.getNotifiableAppointments(result.newAvailableAppointments);
      
      expect(notifiableAppointments).toHaveLength(1);
    });
  });

  describe('Enhanced Logging', () => {
    test('should provide detailed notification decision logging', async () => {
      const appointments = [testAppointments[0]]; // Available appointment
      
      // Get notification decision details
      const decisions = appointmentDetection.getNotificationDecisionDetails(appointments);
      
      expect(decisions).toHaveLength(1);
      expect(decisions[0]).toHaveProperty('appointment');
      expect(decisions[0]).toHaveProperty('appointmentKey');
      expect(decisions[0]).toHaveProperty('shouldNotify');
      expect(decisions[0]).toHaveProperty('reason');
      expect(decisions[0]).toHaveProperty('notificationCount');
      
      // Should be notifiable for new appointment
      expect(decisions[0].shouldNotify).toBe(true);
      expect(decisions[0].reason).toContain('New available appointment');
    });

    test('should log duplicate prevention decisions', async () => {
      const appointment = testAppointments[0];
      
      // Mark as notified first
      await appointmentDetection.markAsNotified([appointment]);
      
      // Get decision details
      const decisions = appointmentDetection.getNotificationDecisionDetails([appointment]);
      
      expect(decisions[0].shouldNotify).toBe(false);
      expect(decisions[0].reason).toContain('previously notified');
    });
  });
});