/**
 * Data validation functions for IELTS Appointment Monitor
 */

import type { ValidationResult } from './types';

/**
 * Validates an appointment object
 */
export function validateAppointment(appointment: any): ValidationResult {
  const errors: string[] = [];

  // Check required fields
  if (!appointment.id || typeof appointment.id !== 'string') {
    errors.push('Appointment ID is required and must be a string');
  }

  if (!appointment.date || typeof appointment.date !== 'string') {
    errors.push('Appointment date is required and must be a string');
  } else if (!isValidDateFormat(appointment.date)) {
    errors.push('Appointment date must be in ISO format (YYYY-MM-DD)');
  }

  if (!appointment.time || typeof appointment.time !== 'string') {
    errors.push('Appointment time is required and must be a string');
  } else if (!isValidTimeRange(appointment.time)) {
    errors.push('Appointment time must be in format "HH:MM-HH:MM"');
  }

  if (!appointment.location || typeof appointment.location !== 'string') {
    errors.push('Appointment location is required and must be a string');
  }

  if (!appointment.examType || typeof appointment.examType !== 'string') {
    errors.push('Appointment examType is required and must be a string');
  }

  if (!appointment.city || typeof appointment.city !== 'string') {
    errors.push('Appointment city is required and must be a string');
  }

  if (!appointment.status || !['available', 'full', 'pending'].includes(appointment.status)) {
    errors.push('Appointment status must be one of: available, full, pending');
  }

  // Check optional fields
  if (appointment.price !== undefined && (typeof appointment.price !== 'number' || appointment.price < 0)) {
    errors.push('Appointment price must be a positive number');
  }

  if (appointment.registrationUrl !== undefined && typeof appointment.registrationUrl !== 'string') {
    errors.push('Appointment registrationUrl must be a string');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates monitor configuration
 */
export function validateMonitorConfig(config: any): ValidationResult {
  const errors: string[] = [];

  if (!config.city || !Array.isArray(config.city) || config.city.length === 0) {
    errors.push('City must be a non-empty array of strings');
  } else if (!config.city.every((city: any) => typeof city === 'string')) {
    errors.push('All city values must be strings');
  }

  if (!config.examModel || !Array.isArray(config.examModel) || config.examModel.length === 0) {
    errors.push('ExamModel must be a non-empty array of strings');
  } else if (!config.examModel.every((model: any) => typeof model === 'string')) {
    errors.push('All examModel values must be strings');
  }

  if (!config.months || !Array.isArray(config.months) || config.months.length === 0) {
    errors.push('Months must be a non-empty array of numbers');
  } else if (!config.months.every((month: any) => typeof month === 'number' && month >= 1 && month <= 12)) {
    errors.push('All month values must be numbers between 1 and 12');
  }

  if (typeof config.checkInterval !== 'number' || config.checkInterval < 1000) {
    errors.push('CheckInterval must be a number greater than or equal to 1000 (1 second)');
  }

  if (!config.notificationSettings || typeof config.notificationSettings !== 'object') {
    errors.push('NotificationSettings must be an object');
  } else {
    const { desktop, audio, logFile } = config.notificationSettings;
    if (typeof desktop !== 'boolean') {
      errors.push('NotificationSettings.desktop must be a boolean');
    }
    if (typeof audio !== 'boolean') {
      errors.push('NotificationSettings.audio must be a boolean');
    }
    if (typeof logFile !== 'boolean') {
      errors.push('NotificationSettings.logFile must be a boolean');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates array of appointments
 */
export function validateAppointments(appointments: any[]): ValidationResult {
  if (!Array.isArray(appointments)) {
    return {
      isValid: false,
      errors: ['Appointments must be an array']
    };
  }

  const allErrors: string[] = [];
  
  appointments.forEach((appointment, index) => {
    const result = validateAppointment(appointment);
    if (!result.isValid) {
      result.errors.forEach(error => {
        allErrors.push(`Appointment ${index}: ${error}`);
      });
    }
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
}

/**
 * Checks if a date string is in valid ISO format (YYYY-MM-DD)
 */
function isValidDateFormat(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime()) && date.toISOString().startsWith(dateString);
}

/**
 * Checks if a time string is in valid range format (HH:MM-HH:MM)
 */
function isValidTimeRange(timeString: string): boolean {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString);
}