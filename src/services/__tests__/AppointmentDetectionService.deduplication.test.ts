import { AppointmentDetectionService } from '../AppointmentDetectionService';
import { Appointment } from '../../models/types';
import { promises as fs } from 'fs';

describe('AppointmentDetectionService - Notification Deduplication', () => {
  let service: AppointmentDetectionService;
  const testDataFile = 'test-data/appointment-tracking-dedup.json';
  const testNotificationFile = 'test-data/notified-appointments-dedup.json';

  beforeEach(async () => {
    // Clean up test data files
    try {
      await fs.unlink(testDataFile);
    } catch (error) {
      // File doesn't exist, that's fine
    }
    try {
      await fs.unlink(testNotificationFile);
    } catch (error) {
      // File doesn't exist, that's fine
    }

    service = new AppointmentDetectionService({
      trackingDataFile: testDataFile,
      notificationTrackingFile: testNotificationFile,
      maxTrackingDays: 30,
      statusChangeThreshold: 5
    });
    
    await service.initialize();
  });

  afterEach(async () => {
    // Clean up test data files
    try {
      await fs.unlink(testDataFile);
    } catch (error) {
      // File doesn't exist, that's fine
    }
    try {
      await fs.unlink(testNotificationFile);
    } catch (error) {
      // File doesn't exist, that's fine
    }
  });

  const createMockAppointment = (
    id: string, 
    status: string, 
    date: string = '2025-02-15',
    time: string = '09:00-12:00',
    location: string = 'Isfahan',
    examType: string = 'CDIELTS'
  ): Appointment => ({
    id,
    date,
    time,
    location,
    examType,
    city: location,
    status: status as any
  });



  describe('Appointment Key Generation', () => {
    it('should generate consistent keys for appointments with same core attributes', () => {
      const appointment1 = createMockAppointment('apt-1', 'available');
      const appointment2 = createMockAppointment('apt-2', 'available'); // Different ID, same attributes
      
      // Use reflection to access private method for testing
      const generateKey = (service as any).generateAppointmentKey.bind(service);
      
      const key1 = generateKey(appointment1);
      const key2 = generateKey(appointment2);
      
      expect(key1).toBe(key2);
      expect(key1).toBe('2025-02-15-09:00-12:00-Isfahan-CDIELTS');
    });

    it('should generate different keys for appointments with different attributes', () => {
      const appointment1 = createMockAppointment('apt-1', 'available', '2025-02-15', '09:00-12:00');
      const appointment2 = createMockAppointment('apt-2', 'available', '2025-02-16', '09:00-12:00'); // Different date
      
      const generateKey = (service as any).generateAppointmentKey.bind(service);
      
      const key1 = generateKey(appointment1);
      const key2 = generateKey(appointment2);
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Notification Deduplication', () => {
    it('should allow notification for new available appointments', () => {
      const appointment = createMockAppointment('apt-1', 'available');
      
      const notifiable = service.getNotifiableAppointments([appointment]);
      
      expect(notifiable).toHaveLength(1);
      expect(notifiable[0]).toBe(appointment);
    });

    it('should prevent duplicate notifications for same appointment key', async () => {
      const appointment1 = createMockAppointment('apt-1', 'available');
      const appointment2 = createMockAppointment('apt-2', 'available'); // Same attributes, different ID
      
      // First check - should be notifiable
      let notifiable = service.getNotifiableAppointments([appointment1]);
      expect(notifiable).toHaveLength(1);
      
      // Mark as notified
      await service.markAsNotified([appointment1]);
      
      // Second check with same appointment - should not be notifiable
      notifiable = service.getNotifiableAppointments([appointment1]);
      expect(notifiable).toHaveLength(0);
      
      // Third check with different ID but same attributes - should not be notifiable
      notifiable = service.getNotifiableAppointments([appointment2]);
      expect(notifiable).toHaveLength(0);
    });

    it('should not notify for non-available appointments', () => {
      const appointment = createMockAppointment('apt-1', 'filled');
      
      const notifiable = service.getNotifiableAppointments([appointment]);
      
      expect(notifiable).toHaveLength(0);
    });

    it('should handle multiple appointments with mixed notification status', async () => {
      const appointment1 = createMockAppointment('apt-1', 'available', '2025-02-15', '09:00-12:00');
      const appointment2 = createMockAppointment('apt-2', 'available', '2025-02-16', '09:00-12:00');
      const appointment3 = createMockAppointment('apt-3', 'available', '2025-02-15', '09:00-12:00'); // Same as apt-1
      
      // Mark first appointment as notified
      await service.markAsNotified([appointment1]);
      
      // Check which appointments are notifiable
      const notifiable = service.getNotifiableAppointments([appointment1, appointment2, appointment3]);
      
      // Should only include appointment2 (appointment1 and appointment3 have same key)
      expect(notifiable).toHaveLength(1);
      expect(notifiable[0]).toBe(appointment2);
    });
  });

  describe('Persistence', () => {
    it('should persist notified appointment keys across service restarts', async () => {
      const appointment = createMockAppointment('apt-1', 'available');
      
      // Mark as notified
      await service.markAsNotified([appointment]);
      
      // Create new service instance
      const newService = new AppointmentDetectionService({
        trackingDataFile: testDataFile,
        notificationTrackingFile: testNotificationFile,
        maxTrackingDays: 30,
        statusChangeThreshold: 5
      });
      await newService.initialize();
      
      // Should not be notifiable in new service instance
      const notifiable = newService.getNotifiableAppointments([appointment]);
      expect(notifiable).toHaveLength(0);
    });

    it('should include notified keys count in statistics', async () => {
      const appointment1 = createMockAppointment('apt-1', 'available', '2025-02-15', '09:00-12:00');
      const appointment2 = createMockAppointment('apt-2', 'available', '2025-02-16', '09:00-12:00');
      
      await service.markAsNotified([appointment1, appointment2]);
      
      const stats = service.getTrackingStatistics();
      expect(stats.notifiedAppointmentKeysCount).toBe(2);
    });
  });

  const createMockCheckResult = (appointments: Appointment[]): any => {
    const availableCount = appointments.filter(apt => apt.status === 'available').length;
    const filledCount = appointments.filter(apt => apt.status === 'filled').length;
    
    return {
      type: availableCount > 0 ? 'available' : 'filled',
      appointmentCount: appointments.length,
      availableCount,
      filledCount,
      timestamp: new Date(),
      url: 'https://test.example.com',
      appointments
    };
  };

  describe('Status Transition Handling', () => {
    it('should allow re-notification when appointment becomes available again after being unavailable', async () => {
      const appointment = createMockAppointment('apt-1', 'available');
      
      // Process initial available appointment
      await service.processAppointments(createMockCheckResult([appointment]));
      
      // Should be notifiable initially
      let notifiable = service.getNotifiableAppointments([appointment]);
      expect(notifiable).toHaveLength(1);
      
      // Mark as notified
      await service.markAsNotified([appointment]);
      
      // Should not be notifiable after being marked as notified
      notifiable = service.getNotifiableAppointments([appointment]);
      expect(notifiable).toHaveLength(0);
      
      // Wait a bit to ensure timestamp differences
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Change status to unavailable
      const unavailableAppointment = { ...appointment, status: 'filled' as any };
      await service.processAppointments(createMockCheckResult([unavailableAppointment]));
      
      // Should still not be notifiable when unavailable
      notifiable = service.getNotifiableAppointments([unavailableAppointment]);
      expect(notifiable).toHaveLength(0);
      
      // Wait a bit to ensure timestamp differences
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Change status back to available
      const availableAgainAppointment = { ...appointment, status: 'available' as any };
      await service.processAppointments(createMockCheckResult([availableAgainAppointment]));
      

      
      // Should be notifiable again after status transition
      notifiable = service.getNotifiableAppointments([availableAgainAppointment]);
      expect(notifiable).toHaveLength(1);
    });

    it('should not re-notify if appointment remains continuously available', async () => {
      const appointment = createMockAppointment('apt-1', 'available');
      
      // Process and notify
      await service.processAppointments(createMockCheckResult([appointment]));
      await service.markAsNotified([appointment]);
      
      // Process again with same status
      await service.processAppointments(createMockCheckResult([appointment]));
      
      // Should not be notifiable
      const notifiable = service.getNotifiableAppointments([appointment]);
      expect(notifiable).toHaveLength(0);
    });

    it('should track multiple status transitions correctly', async () => {
      const appointment = createMockAppointment('apt-1', 'available');
      
      // Initial available
      await service.processAppointments(createMockCheckResult([appointment]));
      await service.markAsNotified([appointment]);
      
      // Wait to ensure timestamp differences
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Goes unavailable
      const unavailable = { ...appointment, status: 'filled' as any };
      await service.processAppointments(createMockCheckResult([unavailable]));
      
      // Wait to ensure timestamp differences
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Becomes available again
      const availableAgain = { ...appointment, status: 'available' as any };
      await service.processAppointments(createMockCheckResult([availableAgain]));
      
      // Mark as notified again
      await service.markAsNotified([availableAgain]);
      
      // Wait to ensure timestamp differences
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Goes unavailable again
      const unavailableAgain = { ...appointment, status: 'pending' as any };
      await service.processAppointments(createMockCheckResult([unavailableAgain]));
      
      // Wait to ensure timestamp differences
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Becomes available once more
      const availableOnceMore = { ...appointment, status: 'available' as any };
      await service.processAppointments(createMockCheckResult([availableOnceMore]));
      
      // Should be notifiable again due to second transition
      const notifiable = service.getNotifiableAppointments([availableOnceMore]);
      expect(notifiable).toHaveLength(1);
      
      // Check tracking statistics
      const history = service.getAppointmentHistory(appointment.id);
      expect(history).toBeTruthy();
      expect(history!.statusHistory.length).toBeGreaterThan(4); // Multiple transitions
    });

    it('should provide detailed notification decision information', async () => {
      const appointment1 = createMockAppointment('apt-1', 'available');
      const appointment2 = createMockAppointment('apt-2', 'filled');
      
      // Process appointments
      await service.processAppointments(createMockCheckResult([appointment1]));
      await service.markAsNotified([appointment1]);
      
      // Get decision details
      const decisions = service.getNotificationDecisionDetails([appointment1, appointment2]);
      
      expect(decisions).toHaveLength(2);
      
      // First appointment should not be notifiable (already notified, no status change)
      expect(decisions[0].shouldNotify).toBe(false);
      expect(decisions[0].reason).toContain('Already notified');
      expect(decisions[0].notificationCount).toBe(1);
      
      // Second appointment should not be notifiable (not available)
      expect(decisions[1].shouldNotify).toBe(false);
      expect(decisions[1].reason).toContain("status is 'filled'");
      expect(decisions[1].notificationCount).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should clean up old notified appointment keys', async () => {
      const appointment = createMockAppointment('apt-1', 'available');
      
      // Mark as notified
      await service.markAsNotified([appointment]);
      
      // Manually set the notification timestamp to be old
      const notifiedKeys = (service as any).notifiedAppointmentKeys;
      const key = (service as any).generateAppointmentKey(appointment);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago
      notifiedKeys.set(key, oldDate);
      
      // Trigger cleanup
      await (service as any).cleanupOldTracking();
      
      // Should be notifiable again after cleanup
      const notifiable = service.getNotifiableAppointments([appointment]);
      expect(notifiable).toHaveLength(1);
    });
  });
});