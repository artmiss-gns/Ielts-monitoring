/**
 * Unit tests for utility functions
 */

import {
  generateAppointmentId,
  createAppointment,
  compareAppointments,
  filterAppointments,
  sortAppointments,
  groupAppointmentsByDate,
  areAppointmentsEquivalent,
  removeDuplicateAppointments
} from '../utils';
import { Appointment } from '../types';

describe('generateAppointmentId', () => {
  it('should generate consistent IDs for identical appointment data', () => {
    const appointmentData = {
      date: '2025-02-15',
      time: '09:00-12:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'Isfahan',
      status: 'available' as const
    };

    const id1 = generateAppointmentId(appointmentData);
    const id2 = generateAppointmentId(appointmentData);
    
    expect(id1).toBe(id2);
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
  });

  it('should generate different IDs for different appointment data', () => {
    const appointment1 = {
      date: '2025-02-15',
      time: '09:00-12:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'Isfahan',
      status: 'available' as const
    };

    const appointment2 = {
      ...appointment1,
      time: '13:00-16:00'
    };

    const id1 = generateAppointmentId(appointment1);
    const id2 = generateAppointmentId(appointment2);
    
    expect(id1).not.toBe(id2);
  });
});

describe('createAppointment', () => {
  it('should create appointment with generated ID', () => {
    const appointmentData = {
      date: '2025-02-15',
      time: '09:00-12:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'Isfahan',
      status: 'available' as const,
      price: 150
    };

    const appointment = createAppointment(appointmentData);
    
    expect(appointment).toMatchObject(appointmentData);
    expect(appointment.id).toBeDefined();
    expect(typeof appointment.id).toBe('string');
  });
});

describe('compareAppointments', () => {
  const appointment1: Appointment = {
    id: '1',
    date: '2025-02-15',
    time: '09:00-12:00',
    location: 'Isfahan Center',
    examType: 'CDIELTS',
    city: 'Isfahan',
    status: 'available'
  };

  const appointment2: Appointment = {
    id: '2',
    date: '2025-02-16',
    time: '13:00-16:00',
    location: 'Tehran Center',
    examType: 'CDIELTS',
    city: 'Tehran',
    status: 'available'
  };

  const appointment3: Appointment = {
    id: '3',
    date: '2025-02-17',
    time: '09:00-12:00',
    location: 'Shiraz Center',
    examType: 'CDIELTS',
    city: 'Shiraz',
    status: 'available'
  };

  it('should identify new appointments', () => {
    const current = [appointment1, appointment2, appointment3];
    const previous = [appointment1, appointment2];

    const result = compareAppointments(current, previous);

    expect(result.newAppointments).toHaveLength(1);
    expect(result.newAppointments[0]).toEqual(appointment3);
    expect(result.removedAppointments).toHaveLength(0);
    expect(result.unchangedAppointments).toHaveLength(2);
  });

  it('should identify removed appointments', () => {
    const current = [appointment1];
    const previous = [appointment1, appointment2, appointment3];

    const result = compareAppointments(current, previous);

    expect(result.newAppointments).toHaveLength(0);
    expect(result.removedAppointments).toHaveLength(2);
    expect(result.unchangedAppointments).toHaveLength(1);
    expect(result.unchangedAppointments[0]).toEqual(appointment1);
  });

  it('should handle empty arrays', () => {
    const result1 = compareAppointments([], [appointment1]);
    expect(result1.newAppointments).toHaveLength(0);
    expect(result1.removedAppointments).toHaveLength(1);
    expect(result1.unchangedAppointments).toHaveLength(0);

    const result2 = compareAppointments([appointment1], []);
    expect(result2.newAppointments).toHaveLength(1);
    expect(result2.removedAppointments).toHaveLength(0);
    expect(result2.unchangedAppointments).toHaveLength(0);
  });
});

describe('filterAppointments', () => {
  const appointments: Appointment[] = [
    {
      id: '1',
      date: '2025-01-15',
      time: '09:00-12:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'Isfahan',
      status: 'available'
    },
    {
      id: '2',
      date: '2025-02-16',
      time: '13:00-16:00',
      location: 'Tehran Center',
      examType: 'IELTS Academic',
      city: 'Tehran',
      status: 'full'
    },
    {
      id: '3',
      date: '2025-03-17',
      time: '09:00-12:00',
      location: 'Shiraz Center',
      examType: 'CDIELTS',
      city: 'Shiraz',
      status: 'available'
    }
  ];

  it('should filter by cities', () => {
    const result = filterAppointments(appointments, { cities: ['Isfahan', 'Tehran'] });
    expect(result).toHaveLength(2);
    expect(result.map(apt => apt.city)).toEqual(['Isfahan', 'Tehran']);
  });

  it('should filter by exam types', () => {
    const result = filterAppointments(appointments, { examTypes: ['CDIELTS'] });
    expect(result).toHaveLength(2);
    expect(result.every(apt => apt.examType === 'CDIELTS')).toBe(true);
  });

  it('should filter by months', () => {
    const result = filterAppointments(appointments, { months: [1, 3] }); // January and March
    expect(result).toHaveLength(2);
    expect(result.map(apt => apt.id)).toEqual(['1', '3']);
  });

  it('should filter by status', () => {
    const result = filterAppointments(appointments, { status: ['available'] });
    expect(result).toHaveLength(2);
    expect(result.every(apt => apt.status === 'available')).toBe(true);
  });

  it('should apply multiple filters', () => {
    const result = filterAppointments(appointments, {
      cities: ['Isfahan', 'Shiraz'],
      status: ['available']
    });
    expect(result).toHaveLength(2);
    expect(result.map(apt => apt.city)).toEqual(['Isfahan', 'Shiraz']);
  });

  it('should return all appointments when no criteria provided', () => {
    const result = filterAppointments(appointments, {});
    expect(result).toHaveLength(3);
  });
});

describe('sortAppointments', () => {
  const appointments: Appointment[] = [
    {
      id: '1',
      date: '2025-02-16',
      time: '13:00-16:00',
      location: 'Center B',
      examType: 'CDIELTS',
      city: 'City',
      status: 'available'
    },
    {
      id: '2',
      date: '2025-02-15',
      time: '09:00-12:00',
      location: 'Center A',
      examType: 'CDIELTS',
      city: 'City',
      status: 'available'
    },
    {
      id: '3',
      date: '2025-02-15',
      time: '13:00-16:00',
      location: 'Center C',
      examType: 'CDIELTS',
      city: 'City',
      status: 'available'
    }
  ];

  it('should sort appointments by date and time', () => {
    const result = sortAppointments(appointments);
    
    expect(result[0].id).toBe('2'); // 2025-02-15 09:00
    expect(result[1].id).toBe('3'); // 2025-02-15 13:00
    expect(result[2].id).toBe('1'); // 2025-02-16 13:00
  });

  it('should not mutate original array', () => {
    const original = [...appointments];
    sortAppointments(appointments);
    expect(appointments).toEqual(original);
  });
});

describe('groupAppointmentsByDate', () => {
  const appointments: Appointment[] = [
    {
      id: '1',
      date: '2025-02-15',
      time: '09:00-12:00',
      location: 'Center A',
      examType: 'CDIELTS',
      city: 'City',
      status: 'available'
    },
    {
      id: '2',
      date: '2025-02-15',
      time: '13:00-16:00',
      location: 'Center B',
      examType: 'CDIELTS',
      city: 'City',
      status: 'available'
    },
    {
      id: '3',
      date: '2025-02-16',
      time: '09:00-12:00',
      location: 'Center C',
      examType: 'CDIELTS',
      city: 'City',
      status: 'available'
    }
  ];

  it('should group appointments by date', () => {
    const result = groupAppointmentsByDate(appointments);
    
    expect(Object.keys(result)).toEqual(['2025-02-15', '2025-02-16']);
    expect(result['2025-02-15']).toHaveLength(2);
    expect(result['2025-02-16']).toHaveLength(1);
  });
});

describe('areAppointmentsEquivalent', () => {
  const appointment1: Appointment = {
    id: '1',
    date: '2025-02-15',
    time: '09:00-12:00',
    location: 'Isfahan Center',
    examType: 'CDIELTS',
    city: 'Isfahan',
    status: 'available',
    price: 150
  };

  it('should return true for equivalent appointments with different IDs', () => {
    const appointment2 = { ...appointment1, id: '2' };
    expect(areAppointmentsEquivalent(appointment1, appointment2)).toBe(true);
  });

  it('should return false for appointments with different content', () => {
    const appointment2 = { ...appointment1, time: '13:00-16:00' };
    expect(areAppointmentsEquivalent(appointment1, appointment2)).toBe(false);
  });

  it('should handle undefined optional fields', () => {
    const appointment2 = { ...appointment1 };
    delete appointment2.price;
    expect(areAppointmentsEquivalent(appointment1, appointment2)).toBe(false);
  });
});

describe('removeDuplicateAppointments', () => {
  it('should remove appointments with duplicate IDs', () => {
    const appointments: Appointment[] = [
      {
        id: '1',
        date: '2025-02-15',
        time: '09:00-12:00',
        location: 'Center A',
        examType: 'CDIELTS',
        city: 'City',
        status: 'available'
      },
      {
        id: '2',
        date: '2025-02-16',
        time: '13:00-16:00',
        location: 'Center B',
        examType: 'CDIELTS',
        city: 'City',
        status: 'available'
      },
      {
        id: '1', // Duplicate ID
        date: '2025-02-17',
        time: '09:00-12:00',
        location: 'Center C',
        examType: 'CDIELTS',
        city: 'City',
        status: 'available'
      }
    ];

    const result = removeDuplicateAppointments(appointments);
    expect(result).toHaveLength(2);
    expect(result.map(apt => apt.id)).toEqual(['1', '2']);
  });

  it('should return empty array for empty input', () => {
    const result = removeDuplicateAppointments([]);
    expect(result).toEqual([]);
  });
});