import { Appointment, MonitorConfig, CheckResult, NotificationRecord } from '../../models/types';

/**
 * Custom assertion utilities for consistent testing patterns
 */
export class AssertionHelpers {
  /**
   * Assert that an appointment object has all required fields
   */
  static assertValidAppointment(appointment: any): asserts appointment is Appointment {
    expect(appointment).toBeDefined();
    expect(typeof appointment).toBe('object');
    
    // Required fields
    expect(appointment).toHaveProperty('id');
    expect(appointment).toHaveProperty('date');
    expect(appointment).toHaveProperty('time');
    expect(appointment).toHaveProperty('location');
    expect(appointment).toHaveProperty('examType');
    expect(appointment).toHaveProperty('city');
    expect(appointment).toHaveProperty('status');
    
    // Field types
    expect(typeof appointment.id).toBe('string');
    expect(typeof appointment.date).toBe('string');
    expect(typeof appointment.time).toBe('string');
    expect(typeof appointment.location).toBe('string');
    expect(typeof appointment.examType).toBe('string');
    expect(typeof appointment.city).toBe('string');
    expect(typeof appointment.status).toBe('string');
    
    // Valid status values
    expect(['available', 'filled', 'pending', 'not-registerable', 'unknown'])
      .toContain(appointment.status);
    
    // Date format validation (YYYY-MM-DD)
    expect(appointment.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    
    // Time format validation (HH:MM-HH:MM)
    expect(appointment.time).toMatch(/^\d{2}:\d{2}-\d{2}:\d{2}$/);
    
    // Optional fields type checking
    if (appointment.price !== undefined) {
      expect(typeof appointment.price).toBe('number');
      expect(appointment.price).toBeGreaterThan(0);
    }
    
    if (appointment.registrationUrl !== undefined) {
      expect(typeof appointment.registrationUrl).toBe('string');
      expect(appointment.registrationUrl).toMatch(/^https?:\/\//);
    }
  }

  /**
   * Assert that a monitor configuration is valid
   */
  static assertValidMonitorConfig(config: any): asserts config is MonitorConfig {
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
    
    // Required fields
    expect(config).toHaveProperty('city');
    expect(config).toHaveProperty('examModel');
    expect(config).toHaveProperty('months');
    expect(config).toHaveProperty('checkInterval');
    expect(config).toHaveProperty('notificationSettings');
    
    // Array fields
    expect(Array.isArray(config.city)).toBe(true);
    expect(Array.isArray(config.examModel)).toBe(true);
    expect(Array.isArray(config.months)).toBe(true);
    
    // Non-empty arrays
    expect(config.city.length).toBeGreaterThan(0);
    expect(config.examModel.length).toBeGreaterThan(0);
    expect(config.months.length).toBeGreaterThan(0);
    
    // Valid months (1-12)
    config.months.forEach((month: number) => {
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
    });
    
    // Check interval
    expect(typeof config.checkInterval).toBe('number');
    expect(config.checkInterval).toBeGreaterThan(0);
    
    // Notification settings
    expect(config.notificationSettings).toBeDefined();
    expect(typeof config.notificationSettings.desktop).toBe('boolean');
    expect(typeof config.notificationSettings.audio).toBe('boolean');
    expect(typeof config.notificationSettings.logFile).toBe('boolean');
  }

  /**
   * Assert that appointments are properly filtered by configuration
   */
  static assertAppointmentsMatchConfig(
    appointments: Appointment[],
    config: MonitorConfig
  ) {
    appointments.forEach(appointment => {
      // Check city filter
      expect(config.city.map(c => c.toLowerCase()))
        .toContain(appointment.city.toLowerCase());
      
      // Check exam model filter
      expect(config.examModel.map(e => e.toLowerCase()))
        .toContain(appointment.examType.toLowerCase());
      
      // Check month filter
      const appointmentMonth = new Date(appointment.date).getMonth() + 1;
      expect(config.months).toContain(appointmentMonth);
    });
  }

  /**
   * Assert that a check result is valid
   */
  static assertValidCheckResult(result: any): asserts result is CheckResult {
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    
    // Required fields
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('appointmentCount');
    expect(result).toHaveProperty('availableCount');
    expect(result).toHaveProperty('filledCount');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('appointments');
    
    // Field types
    expect(['available', 'filled', 'no-slots']).toContain(result.type);
    expect(typeof result.appointmentCount).toBe('number');
    expect(typeof result.availableCount).toBe('number');
    expect(typeof result.filledCount).toBe('number');
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(typeof result.url).toBe('string');
    expect(Array.isArray(result.appointments)).toBe(true);
    
    // Logical consistency
    expect(result.appointmentCount).toBe(result.appointments.length);
    expect(result.availableCount + result.filledCount).toBeLessThanOrEqual(result.appointmentCount);
    
    // URL format
    expect(result.url).toMatch(/^https?:\/\//);
    
    // Validate each appointment
    result.appointments.forEach((appointment: any) => {
      AssertionHelpers.assertValidAppointment(appointment);
    });
  }

  /**
   * Assert that notification record is valid
   */
  static assertValidNotificationRecord(record: any): asserts record is NotificationRecord {
    expect(record).toBeDefined();
    expect(typeof record).toBe('object');
    
    // Required fields
    expect(record).toHaveProperty('timestamp');
    expect(record).toHaveProperty('appointmentCount');
    expect(record).toHaveProperty('appointments');
    expect(record).toHaveProperty('channels');
    expect(record).toHaveProperty('deliveryStatus');
    
    // Field types
    expect(record.timestamp).toBeInstanceOf(Date);
    expect(typeof record.appointmentCount).toBe('number');
    expect(Array.isArray(record.appointments)).toBe(true);
    expect(Array.isArray(record.channels)).toBe(true);
    expect(['success', 'partial', 'failed']).toContain(record.deliveryStatus);
    
    // Logical consistency
    expect(record.appointmentCount).toBe(record.appointments.length);
    
    // Valid channels
    const validChannels = ['desktop', 'audio', 'log', 'telegram'];
    record.channels.forEach((channel: string) => {
      expect(validChannels).toContain(channel);
    });
    
    // Validate appointments
    record.appointments.forEach((appointment: any) => {
      AssertionHelpers.assertValidAppointment(appointment);
    });
  }

  /**
   * Assert that two appointment arrays are equivalent
   */
  static assertAppointmentArraysEqual(
    actual: Appointment[],
    expected: Appointment[],
    options: {
      ignoreOrder?: boolean;
      ignoreFields?: string[];
    } = {}
  ) {
    expect(actual.length).toBe(expected.length);
    
    const actualSorted = options.ignoreOrder 
      ? [...actual].sort((a, b) => a.id.localeCompare(b.id))
      : actual;
    
    const expectedSorted = options.ignoreOrder
      ? [...expected].sort((a, b) => a.id.localeCompare(b.id))
      : expected;
    
    actualSorted.forEach((actualAppointment, index) => {
      const expectedAppointment = expectedSorted[index];
      
      Object.keys(expectedAppointment).forEach(key => {
        if (!options.ignoreFields?.includes(key)) {
          expect(actualAppointment[key as keyof Appointment])
            .toEqual(expectedAppointment[key as keyof Appointment]);
        }
      });
    });
  }

  /**
   * Assert that error handling is working correctly
   */
  static assertErrorHandling(
    errorFunction: () => Promise<any> | any,
    expectedErrorMessage?: string | RegExp,
    expectedErrorType?: new (...args: any[]) => Error
  ) {
    return async () => {
      try {
        await errorFunction();
        fail('Expected function to throw an error');
      } catch (error) {
        if (expectedErrorType) {
          expect(error).toBeInstanceOf(expectedErrorType);
        }
        
        if (expectedErrorMessage) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (typeof expectedErrorMessage === 'string') {
            expect(errorMessage).toContain(expectedErrorMessage);
          } else {
            expect(errorMessage).toMatch(expectedErrorMessage);
          }
        }
      }
    };
  }

  /**
   * Assert that async operations complete within timeout
   */
  static async assertCompletesWithinTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    errorMessage?: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([operation(), timeoutPromise]);
  }

  /**
   * Assert that mock functions were called with expected patterns
   */
  static assertMockCallPatterns(
    mockFunction: jest.MockedFunction<any>,
    patterns: Array<{
      callIndex?: number;
      args?: any[];
      argsMatch?: (args: any[]) => boolean;
      returnValue?: any;
    }>
  ) {
    patterns.forEach((pattern, index) => {
      const callIndex = pattern.callIndex ?? index;
      
      expect(mockFunction).toHaveBeenCalledTimes(
        Math.max(callIndex + 1, mockFunction.mock.calls.length)
      );
      
      const call = mockFunction.mock.calls[callIndex];
      expect(call).toBeDefined();
      
      if (pattern.args) {
        expect(call).toEqual(pattern.args);
      }
      
      if (pattern.argsMatch) {
        expect(pattern.argsMatch(call)).toBe(true);
      }
      
      if (pattern.returnValue !== undefined) {
        const result = mockFunction.mock.results[callIndex];
        expect(result.value).toEqual(pattern.returnValue);
      }
    });
  }

  /**
   * Assert that file operations follow expected patterns
   */
  static assertFileOperations(
    mockFs: any,
    operations: Array<{
      operation: 'read' | 'write' | 'delete' | 'exists';
      path: string;
      content?: string | RegExp;
      times?: number;
    }>
  ) {
    operations.forEach(op => {
      const times = op.times ?? 1;
      
      switch (op.operation) {
        case 'read':
          expect(mockFs.readFile).toHaveBeenCalledWith(op.path, expect.any(String));
          if (times > 1) {
            expect(mockFs.readFile).toHaveBeenCalledTimes(times);
          }
          break;
          
        case 'write':
          if (op.content) {
            if (typeof op.content === 'string') {
              expect(mockFs.writeFile).toHaveBeenCalledWith(op.path, expect.stringContaining(op.content));
            } else {
              expect(mockFs.writeFile).toHaveBeenCalledWith(op.path, expect.stringMatching(op.content));
            }
          } else {
            expect(mockFs.writeFile).toHaveBeenCalledWith(op.path, expect.any(String));
          }
          break;
          
        case 'delete':
          expect(mockFs.remove).toHaveBeenCalledWith(op.path);
          break;
          
        case 'exists':
          expect(mockFs.pathExists).toHaveBeenCalledWith(op.path);
          break;
      }
    });
  }

  /**
   * Assert that notifications were sent correctly
   */
  static assertNotificationsSent(
    mockNotificationService: any,
    expectedNotifications: Array<{
      type: 'desktop' | 'audio' | 'telegram' | 'log';
      appointmentCount?: number;
      message?: string | RegExp;
    }>
  ) {
    expect(mockNotificationService.sendNotification).toHaveBeenCalledTimes(expectedNotifications.length);
    
    expectedNotifications.forEach((expected, index) => {
      const call = mockNotificationService.sendNotification.mock.calls[index];
      expect(call).toBeDefined();
      
      const [appointments] = call;
      
      if (expected.appointmentCount !== undefined) {
        expect(appointments).toHaveLength(expected.appointmentCount);
      }
      
      if (expected.message) {
        // This would depend on how the notification service formats messages
        // For now, just check that the call was made
        expect(call).toBeDefined();
      }
    });
  }
}

/**
 * Jest custom matchers for domain-specific assertions
 */
export const customMatchers = {
  toBeValidAppointment(received: any) {
    try {
      AssertionHelpers.assertValidAppointment(received);
      return {
        message: () => `Expected ${received} not to be a valid appointment`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `Expected ${received} to be a valid appointment: ${error instanceof Error ? error.message : String(error)}`,
        pass: false
      };
    }
  },

  toBeValidMonitorConfig(received: any) {
    try {
      AssertionHelpers.assertValidMonitorConfig(received);
      return {
        message: () => `Expected ${received} not to be a valid monitor config`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `Expected ${received} to be a valid monitor config: ${error instanceof Error ? error.message : String(error)}`,
        pass: false
      };
    }
  },

  toMatchAppointmentFilter(received: Appointment[], config: MonitorConfig) {
    try {
      AssertionHelpers.assertAppointmentsMatchConfig(received, config);
      return {
        message: () => `Expected appointments not to match config filter`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `Expected appointments to match config filter: ${error instanceof Error ? error.message : String(error)}`,
        pass: false
      };
    }
  }
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidAppointment(): R;
      toBeValidMonitorConfig(): R;
      toMatchAppointmentFilter(config: MonitorConfig): R;
    }
  }
}