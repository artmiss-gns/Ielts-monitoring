import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WebScraperService } from '../../services/WebScraperService';

describe('WebScraperService Enhanced Status Detection', () => {
  let service: WebScraperService;

  beforeEach(() => {
    // Use localhost test server for testing
    service = new WebScraperService('http://localhost:3001');
  });

  afterEach(async () => {
    await service.close();
  });

  const testFilters = {
    city: ['Isfahan'],
    examModel: ['IELTS'],
    months: [12]
  };

  it('should detect appointment statuses accurately', async () => {
    try {
      const checkResult = await service.fetchAppointmentsWithStatus(testFilters);
      
      expect(checkResult).toBeDefined();
      expect(checkResult.type).toMatch(/^(available|filled|no-slots)$/);
      expect(checkResult.appointmentCount).toBeGreaterThanOrEqual(0);
      expect(checkResult.availableCount).toBeGreaterThanOrEqual(0);
      expect(checkResult.filledCount).toBeGreaterThanOrEqual(0);
      expect(checkResult.appointments).toBeDefined();
      expect(Array.isArray(checkResult.appointments)).toBe(true);
      
      // Verify appointment status consistency
      const availableAppointments = checkResult.appointments.filter(apt => apt.status === 'available');
      const filledAppointments = checkResult.appointments.filter(apt => apt.status === 'filled');
      const pendingAppointments = checkResult.appointments.filter(apt => apt.status === 'pending');
      const notRegisterableAppointments = checkResult.appointments.filter(apt => apt.status === 'not-registerable');
      
      expect(availableAppointments.length).toBe(checkResult.availableCount);
      expect(filledAppointments.length + pendingAppointments.length + notRegisterableAppointments.length)
        .toBe(checkResult.filledCount);
      
      // Each appointment should have required fields
      checkResult.appointments.forEach(appointment => {
        expect(appointment.id).toBeDefined();
        expect(appointment.date).toBeDefined();
        expect(appointment.time).toBeDefined();
        expect(appointment.location).toBeDefined();
        expect(appointment.examType).toBeDefined();
        expect(appointment.city).toBeDefined();
        expect(appointment.status).toMatch(/^(available|filled|pending|not-registerable|unknown)$/);
      });
      
    } catch (error) {
      // If test server is not running, skip this test
      if ((error as Error).message.includes('ECONNREFUSED') || 
          (error as Error).message.includes('Network')) {
        console.log('Test server not available, skipping enhanced status detection test');
        return;
      }
      throw error;
    }
  }, 15000);

  it('should handle different appointment statuses correctly', async () => {
    try {
      const checkResult = await service.fetchAppointmentsWithStatus(testFilters);
      
      // Test that the service can handle various status types
      const statusTypes = new Set(checkResult.appointments.map(apt => apt.status));
      
      // Should only contain valid status types
      for (const status of statusTypes) {
        expect(['available', 'filled', 'pending', 'not-registerable', 'unknown']).toContain(status);
      }
      
      // If there are available appointments, the result type should reflect that
      if (checkResult.availableCount > 0) {
        expect(checkResult.type).toBe('available');
      }
      
    } catch (error) {
      // If test server is not running, skip this test
      if ((error as Error).message.includes('ECONNREFUSED') || 
          (error as Error).message.includes('Network')) {
        console.log('Test server not available, skipping status handling test');
        return;
      }
      throw error;
    }
  }, 15000);

  it('should provide detailed inspection data', async () => {
    try {
      const checkResult = await service.fetchAppointmentsWithStatus(testFilters);
      
      // The enhanced scraper should provide inspection data for debugging
      // This is saved internally by the DataInspectionService
      expect(checkResult.url).toBeDefined();
      expect(checkResult.timestamp).toBeDefined();
      expect(checkResult.timestamp instanceof Date).toBe(true);
      
    } catch (error) {
      // If test server is not running, skip this test
      if ((error as Error).message.includes('ECONNREFUSED') || 
          (error as Error).message.includes('Network')) {
        console.log('Test server not available, skipping inspection data test');
        return;
      }
      throw error;
    }
  }, 15000);
});