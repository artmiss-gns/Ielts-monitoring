/**
 * Unit tests for validation functions
 */

import { validateAppointment, validateMonitorConfig, validateAppointments } from '../validation';
import { Appointment, MonitorConfig } from '../types';

describe('validateAppointment', () => {
  const validAppointment: Appointment = {
    id: 'test-id',
    date: '2025-02-15',
    time: '09:00-12:00',
    location: 'Isfahan Center',
    examType: 'CDIELTS',
    city: 'Isfahan',
    status: 'available',
    price: 150,
    registrationUrl: 'https://example.com/register'
  };

  it('should validate a correct appointment', () => {
    const result = validateAppointment(validAppointment);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject appointment with missing required fields', () => {
    const invalidAppointment = { ...validAppointment };
    delete (invalidAppointment as any).id;
    delete (invalidAppointment as any).date;

    const result = validateAppointment(invalidAppointment);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Appointment ID is required and must be a string');
    expect(result.errors).toContain('Appointment date is required and must be a string');
  });

  it('should reject appointment with invalid date format', () => {
    const invalidAppointment = { ...validAppointment, date: '2025/02/15' };
    const result = validateAppointment(invalidAppointment);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Appointment date must be in ISO format (YYYY-MM-DD)');
  });

  it('should reject appointment with invalid time format', () => {
    const invalidAppointment = { ...validAppointment, time: '9:00 AM - 12:00 PM' };
    const result = validateAppointment(invalidAppointment);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Appointment time must be in format "HH:MM-HH:MM"');
  });

  it('should reject appointment with invalid status', () => {
    const invalidAppointment = { ...validAppointment, status: 'invalid' as any };
    const result = validateAppointment(invalidAppointment);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Appointment status must be one of: available, full, pending');
  });

  it('should reject appointment with negative price', () => {
    const invalidAppointment = { ...validAppointment, price: -50 };
    const result = validateAppointment(invalidAppointment);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Appointment price must be a positive number');
  });

  it('should accept appointment without optional fields', () => {
    const minimalAppointment = {
      id: 'test-id',
      date: '2025-02-15',
      time: '09:00-12:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'Isfahan',
      status: 'available' as const
    };

    const result = validateAppointment(minimalAppointment);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('validateMonitorConfig', () => {
  const validConfig: MonitorConfig = {
    city: ['Isfahan'],
    examModel: ['CDIELTS'],
    months: [1, 2, 3],
    checkInterval: 30000,
    notificationSettings: {
      desktop: true,
      audio: true,
      logFile: true
    }
  };

  it('should validate a correct monitor config', () => {
    const result = validateMonitorConfig(validConfig);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject config with empty city array', () => {
    const invalidConfig = { ...validConfig, city: [] };
    const result = validateMonitorConfig(invalidConfig);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('City must be a non-empty array of strings');
  });

  it('should reject config with non-string city values', () => {
    const invalidConfig = { ...validConfig, city: ['Isfahan', 123] as any };
    const result = validateMonitorConfig(invalidConfig);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('All city values must be strings');
  });

  it('should reject config with invalid month values', () => {
    const invalidConfig = { ...validConfig, months: [0, 13, -1] };
    const result = validateMonitorConfig(invalidConfig);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('All month values must be numbers between 1 and 12');
  });

  it('should reject config with too short check interval', () => {
    const invalidConfig = { ...validConfig, checkInterval: 500 };
    const result = validateMonitorConfig(invalidConfig);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('CheckInterval must be a number greater than or equal to 1000 (1 second)');
  });

  it('should reject config with invalid notification settings', () => {
    const invalidConfig = {
      ...validConfig,
      notificationSettings: {
        desktop: 'yes',
        audio: true,
        logFile: true
      } as any
    };
    const result = validateMonitorConfig(invalidConfig);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('NotificationSettings.desktop must be a boolean');
  });
});

describe('validateAppointments', () => {
  const validAppointment: Appointment = {
    id: 'test-id',
    date: '2025-02-15',
    time: '09:00-12:00',
    location: 'Isfahan Center',
    examType: 'CDIELTS',
    city: 'Isfahan',
    status: 'available'
  };

  it('should validate array of valid appointments', () => {
    const appointments = [validAppointment, { ...validAppointment, id: 'test-id-2' }];
    const result = validateAppointments(appointments);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject non-array input', () => {
    const result = validateAppointments('not an array' as any);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Appointments must be an array');
  });

  it('should provide detailed errors for invalid appointments in array', () => {
    const invalidAppointment = { ...validAppointment };
    delete (invalidAppointment as any).id;
    
    const appointments = [validAppointment, invalidAppointment];
    const result = validateAppointments(appointments);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(error => error.includes('Appointment 1:'))).toBe(true);
  });

  it('should validate empty array', () => {
    const result = validateAppointments([]);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});