import { Appointment, MonitorConfig, NotificationSettings } from '../../models/types';
import { generateId } from '../../models/utils';

/**
 * Factory for creating test data
 */
export class TestDataFactory {
  /**
   * Create sample appointments for testing
   */
  static createAppointments(count: number = 3, options?: {
    city?: string;
    examType?: string;
    month?: number;
    status?: 'available' | 'filled' | 'pending';
  }): Appointment[] {
    const appointments: Appointment[] = [];
    const baseDate = new Date('2025-02-01');

    for (let i = 0; i < count; i++) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + i * 7); // Weekly intervals

      appointments.push({
        id: generateId(),
        date: date.toISOString().split('T')[0],
        time: i % 2 === 0 ? '09:00-12:00' : '14:00-17:00',
        location: `${options?.city || 'Isfahan'} Test Center ${i + 1}`,
        examType: options?.examType || 'CDIELTS',
        city: options?.city || 'isfahan',
        status: options?.status || 'available',
        price: 2500000 + (i * 100000),
        registrationUrl: `https://irsafam.org/register/${generateId()}`
      });
    }

    return appointments;
  }

  /**
   * Create a test monitor configuration
   */
  static createMonitorConfig(overrides?: Partial<MonitorConfig>): MonitorConfig {
    const defaultConfig: MonitorConfig = {
      city: ['isfahan'],
      examModel: ['cdielts'],
      months: [2, 3, 4],
      checkInterval: 1000, // 1 second for fast testing
      notificationSettings: {
        desktop: false, // Disable for testing
        audio: false,   // Disable for testing
        logFile: true
      }
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Create notification settings for testing
   */
  static createNotificationSettings(overrides?: Partial<NotificationSettings>): NotificationSettings {
    const defaultSettings: NotificationSettings = {
      desktop: false,
      audio: false,
      logFile: true
    };

    return { ...defaultSettings, ...overrides };
  }

  /**
   * Create appointments with specific dates for month filtering tests
   */
  static createAppointmentsForMonths(months: number[]): Appointment[] {
    const appointments: Appointment[] = [];
    
    months.forEach((month, index) => {
      const date = new Date(2025, month - 1, 15); // 15th of each month
      appointments.push({
        id: generateId(),
        date: date.toISOString().split('T')[0],
        time: '09:00-12:00',
        location: `Isfahan Test Center ${index + 1}`,
        examType: 'CDIELTS',
        city: 'isfahan',
        status: 'available',
        price: 2500000
      });
    });

    return appointments;
  }

  /**
   * Create appointments for different cities
   */
  static createAppointmentsForCities(cities: string[]): Appointment[] {
    const appointments: Appointment[] = [];
    
    cities.forEach((city) => {
      appointments.push({
        id: generateId(),
        date: '2025-02-15',
        time: '09:00-12:00',
        location: `${city} Test Center`,
        examType: 'CDIELTS',
        city: city.toLowerCase(),
        status: 'available',
        price: 2500000
      });
    });

    return appointments;
  }

  /**
   * Create appointments for different exam types
   */
  static createAppointmentsForExamTypes(examTypes: string[]): Appointment[] {
    const appointments: Appointment[] = [];
    
    examTypes.forEach((examType) => {
      appointments.push({
        id: generateId(),
        date: '2025-02-15',
        time: '09:00-12:00',
        location: 'Isfahan Test Center',
        examType: examType,
        city: 'isfahan',
        status: 'available',
        price: 2500000
      });
    });

    return appointments;
  }

  /**
   * Create a sequence of appointment changes for testing detection
   */
  static createAppointmentSequence(): {
    initial: Appointment[];
    updated: Appointment[];
    newAppointments: Appointment[];
  } {
    const initial = TestDataFactory.createAppointments(2);
    const newAppointment = TestDataFactory.createAppointments(1)[0];
    newAppointment.date = '2025-03-01';
    
    const updated = [...initial, newAppointment];

    return {
      initial,
      updated,
      newAppointments: [newAppointment]
    };
  }

  /**
   * Create test configuration with mock server URL
   */
  static createTestConfig(_mockServerUrl: string, overrides?: Partial<MonitorConfig>): MonitorConfig {
    const config = TestDataFactory.createMonitorConfig(overrides);
    
    // In a real implementation, we'd need to modify the WebScraperService
    // to accept a custom URL for testing. For now, this is a placeholder.
    return config;
  }
}