/**
 * Utility functions for appointment data manipulation
 */

import { Appointment, AppointmentComparison } from './types';

/**
 * Generates a unique ID string
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

/**
 * Generates a unique ID for an appointment based on its key properties
 */
export function generateAppointmentId(appointment: Omit<Appointment, 'id'>): string {
  const { date, time, location, examType, city } = appointment;
  const baseString = `${date}-${time}-${location}-${examType}-${city}`;
  
  // Create a simple hash from the base string
  let hash = 0;
  for (let i = 0; i < baseString.length; i++) {
    const char = baseString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string
  return Math.abs(hash).toString(16);
}

/**
 * Creates a complete appointment object with generated ID
 */
export function createAppointment(appointmentData: Omit<Appointment, 'id'>): Appointment {
  return {
    ...appointmentData,
    id: generateAppointmentId(appointmentData)
  };
}

/**
 * Compares two arrays of appointments and returns the differences
 */
export function compareAppointments(
  currentAppointments: Appointment[],
  previousAppointments: Appointment[]
): AppointmentComparison {
  const currentIds = new Set(currentAppointments.map(apt => apt.id));
  const previousIds = new Set(previousAppointments.map(apt => apt.id));

  // Find new appointments (in current but not in previous)
  const newAppointments = currentAppointments.filter(apt => !previousIds.has(apt.id));

  // Find removed appointments (in previous but not in current)
  const removedAppointments = previousAppointments.filter(apt => !currentIds.has(apt.id));

  // Find unchanged appointments (in both current and previous)
  const unchangedAppointments = currentAppointments.filter(apt => previousIds.has(apt.id));

  return {
    newAppointments,
    removedAppointments,
    unchangedAppointments
  };
}

/**
 * Filters appointments based on criteria
 */
export function filterAppointments(
  appointments: Appointment[],
  criteria: {
    cities?: string[];
    examTypes?: string[];
    months?: number[];
    status?: string[];
  }
): Appointment[] {
  return appointments.filter(appointment => {
    // Filter by cities
    if (criteria.cities && criteria.cities.length > 0) {
      if (!criteria.cities.some(city => 
        appointment.city.toLowerCase().includes(city.toLowerCase())
      )) {
        return false;
      }
    }

    // Filter by exam types
    if (criteria.examTypes && criteria.examTypes.length > 0) {
      if (!criteria.examTypes.some(type => 
        appointment.examType.toLowerCase().includes(type.toLowerCase())
      )) {
        return false;
      }
    }

    // Filter by months
    if (criteria.months && criteria.months.length > 0) {
      const appointmentMonth = new Date(appointment.date).getMonth() + 1; // getMonth() returns 0-11
      if (!criteria.months.includes(appointmentMonth)) {
        return false;
      }
    }

    // Filter by status
    if (criteria.status && criteria.status.length > 0) {
      if (!criteria.status.includes(appointment.status)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sorts appointments by date and time
 */
export function sortAppointments(appointments: Appointment[]): Appointment[] {
  return [...appointments].sort((a, b) => {
    // First sort by date
    const dateComparison = a.date.localeCompare(b.date);
    if (dateComparison !== 0) {
      return dateComparison;
    }

    // Then sort by time (start time)
    const aStartTime = a.time.split('-')[0];
    const bStartTime = b.time.split('-')[0];
    return aStartTime.localeCompare(bStartTime);
  });
}

/**
 * Groups appointments by date
 */
export function groupAppointmentsByDate(appointments: Appointment[]): Record<string, Appointment[]> {
  return appointments.reduce((groups, appointment) => {
    const date = appointment.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(appointment);
    return groups;
  }, {} as Record<string, Appointment[]>);
}

/**
 * Checks if two appointments are equivalent (same content, possibly different IDs)
 */
export function areAppointmentsEquivalent(apt1: Appointment, apt2: Appointment): boolean {
  return (
    apt1.date === apt2.date &&
    apt1.time === apt2.time &&
    apt1.location === apt2.location &&
    apt1.examType === apt2.examType &&
    apt1.city === apt2.city &&
    apt1.status === apt2.status &&
    apt1.price === apt2.price &&
    apt1.registrationUrl === apt2.registrationUrl
  );
}

/**
 * Removes duplicate appointments from an array
 */
export function removeDuplicateAppointments(appointments: Appointment[]): Appointment[] {
  const seen = new Set<string>();
  return appointments.filter(appointment => {
    if (seen.has(appointment.id)) {
      return false;
    }
    seen.add(appointment.id);
    return true;
  });
}