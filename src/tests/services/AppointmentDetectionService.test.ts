import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { AppointmentDetectionService } from '../../services/AppointmentDetectionService';
import { Appointment, CheckResult } from '../../models/types';

describe('AppointmentDetectionService', () => {
  let service: AppointmentDetectionService;
  let testDataDir: string;
  let testTrackingFile: string;

  beforeEach(async () => {
    // Create a temporary directory for test data
    testDataDir = path.join(__dirname, '../../test-data');
    testTrackingFile = path.join(testDataDir, 'test-appointment-tracking.json');
    
    await fs.mkdir(testDataDir, { recursive: true });
    
    service = new AppointmentDetectionService({
      trackingDataFile: testTrackingFile,
      maxTrackingDays: 30,
      statusChangeThreshold: 5
    });
    
    await service.initialize();
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.unlink(testTrackingFile);
      await fs.rmdir(testDataDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  const createMockAppointment = (id: string, status: 'available' | 'filled' | 'pending' | 'not-registerable' = 'available'): Appointment => ({
    id,
    date: '2024-12-15',
    time: '09:00-12:00',
    location: 'Test Center',
    examType: 'IELTS',
    city: 'Isfahan',
    status,
    price: 5000000
  });

  const createMockCheckResult = (appointments: Appointment[]): CheckResult => ({
    type: appointments.some(apt => apt.status === 'available') ? 'available' : 'filled',
    appointmentCount: appointments.length,
    availableCount: appointments.filter(apt => apt.status === 'available').length,
    filledCount: appointments.filter(apt => apt.status !== 'available').length,
    timestamp: new Date(),
    url: 'https://test.com',
    appointments
  });

  describe('processAppointments', () => {
    it('should detect new available appointments', async () => {
      const appointments = [
        createMockAppointment('apt-1', 'available'),
        createMockAppointment('apt-2', 'filled')
      ];
      
      const checkResult = createMockCheckResult(appointments);
      const result = await service.processAppointments(checkResult);
      
      expect(result.newAvailableAppointments).toHaveLength(1);
      expect(result.newAvailableAppointments[0].id).toBe('apt-1');
      expect(result.statusChangedAppointments).toHaveLength(0);
      expect(result.removedAppointments).toHaveLength(0);
    });

    it('should detect status changes from filled to available', async () => {
      // First check - appointment is filled
      const filledAppointment = createMockAppointment('apt-1', 'filled');
      const firstCheck = createMockCheckResult([filledAppointment]);
      await service.processAppointments(firstCheck);
      
      // Second check - same appointment becomes available
      const availableAppointment = createMockAppointment('apt-1', 'available');
      const secondCheck = createMockCheckResult([availableAppointment]);
      const result = await service.processAppointments(secondCheck);
      
      expect(result.newAvailableAppointments).toHaveLength(1);
      expect(result.statusChangedAppointments).toHaveLength(1);
      expect(result.statusChangedAppointments[0].status).toBe('available');
    });

    it('should detect status changes from available to filled', async () => {
      // First check - appointment is available
      const availableAppointment = createMockAppointment('apt-1', 'available');
      const firstCheck = createMockCheckResult([availableAppointment]);
      await service.processAppointments(firstCheck);
      
      // Second check - same appointment becomes filled
      const filledAppointment = createMockAppointment('apt-1', 'filled');
      const secondCheck = createMockCheckResult([filledAppointment]);
      const result = await service.processAppointments(secondCheck);
      
      expect(result.newAvailableAppointments).toHaveLength(0);
      expect(result.statusChangedAppointments).toHaveLength(1);
      expect(result.statusChangedAppointments[0].status).toBe('filled');
    });

    it('should detect removed appointments', async () => {
      // First check - two appointments
      const appointments = [
        createMockAppointment('apt-1', 'available'),
        createMockAppointment('apt-2', 'filled')
      ];
      const firstCheck = createMockCheckResult(appointments);
      await service.processAppointments(firstCheck);
      
      // Second check - only one appointment remains
      const remainingAppointments = [createMockAppointment('apt-1', 'available')];
      const secondCheck = createMockCheckResult(remainingAppointments);
      const result = await service.processAppointments(secondCheck);
      
      expect(result.removedAppointments).toHaveLength(1);
      expect(result.removedAppointments[0].id).toBe('apt-2');
    });

    it('should not mark filled appointments as new available', async () => {
      const appointments = [
        createMockAppointment('apt-1', 'filled'),
        createMockAppointment('apt-2', 'pending'),
        createMockAppointment('apt-3', 'not-registerable')
      ];
      
      const checkResult = createMockCheckResult(appointments);
      const result = await service.processAppointments(checkResult);
      
      expect(result.newAvailableAppointments).toHaveLength(0);
    });
  });

  describe('getNotifiableAppointments', () => {
    it('should return appointments that have not been notified', async () => {
      const appointment = createMockAppointment('apt-1', 'available');
      const checkResult = createMockCheckResult([appointment]);
      await service.processAppointments(checkResult);
      
      const notifiable = service.getNotifiableAppointments([appointment]);
      expect(notifiable).toHaveLength(1);
    });

    it('should not return appointments that have already been notified', async () => {
      const appointment = createMockAppointment('apt-1', 'available');
      const checkResult = createMockCheckResult([appointment]);
      await service.processAppointments(checkResult);
      
      // Mark as notified
      await service.markAsNotified(['apt-1']);
      
      const notifiable = service.getNotifiableAppointments([appointment]);
      expect(notifiable).toHaveLength(0);
    });

    it('should not return non-available appointments', async () => {
      const appointments = [
        createMockAppointment('apt-1', 'filled'),
        createMockAppointment('apt-2', 'pending')
      ];
      
      const notifiable = service.getNotifiableAppointments(appointments);
      expect(notifiable).toHaveLength(0);
    });
  });

  describe('getTrackingStatistics', () => {
    it('should return correct statistics', async () => {
      const appointments = [
        createMockAppointment('apt-1', 'available'),
        createMockAppointment('apt-2', 'filled'),
        createMockAppointment('apt-3', 'pending')
      ];
      
      const checkResult = createMockCheckResult(appointments);
      await service.processAppointments(checkResult);
      
      const stats = service.getTrackingStatistics();
      expect(stats.totalTracked).toBe(3);
      expect(stats.availableCount).toBe(1);
      expect(stats.filledCount).toBe(1);
      expect(stats.pendingCount).toBe(1);
      expect(stats.totalNotificationsSent).toBe(0);
    });
  });

  describe('markAsNotified', () => {
    it('should increment notification count for tracked appointments', async () => {
      const appointment = createMockAppointment('apt-1', 'available');
      const checkResult = createMockCheckResult([appointment]);
      await service.processAppointments(checkResult);
      
      await service.markAsNotified(['apt-1']);
      
      const stats = service.getTrackingStatistics();
      expect(stats.totalNotificationsSent).toBe(1);
    });
  });

  describe('getRecentStatusChanges', () => {
    it('should return recent status changes', async () => {
      // First check - appointment is filled
      const filledAppointment = createMockAppointment('apt-1', 'filled');
      const firstCheck = createMockCheckResult([filledAppointment]);
      await service.processAppointments(firstCheck);
      
      // Second check - appointment becomes available
      const availableAppointment = createMockAppointment('apt-1', 'available');
      const secondCheck = createMockCheckResult([availableAppointment]);
      await service.processAppointments(secondCheck);
      
      const recentChanges = service.getRecentStatusChanges(60);
      expect(recentChanges.length).toBeGreaterThan(0);
      
      // Should have the status change from filled to available
      const statusChange = recentChanges.find(change => 
        change.previousStatus === 'filled' && change.newStatus === 'available'
      );
      expect(statusChange).toBeDefined();
    });
  });

  describe('persistence', () => {
    it('should persist tracking data between service instances', async () => {
      // First service instance
      const appointment = createMockAppointment('apt-1', 'available');
      const checkResult = createMockCheckResult([appointment]);
      await service.processAppointments(checkResult);
      await service.markAsNotified(['apt-1']);
      
      // Create new service instance
      const newService = new AppointmentDetectionService({
        trackingDataFile: testTrackingFile,
        maxTrackingDays: 30,
        statusChangeThreshold: 5
      });
      await newService.initialize();
      
      const stats = newService.getTrackingStatistics();
      expect(stats.totalTracked).toBe(1);
      expect(stats.totalNotificationsSent).toBe(1);
    });
  });
});