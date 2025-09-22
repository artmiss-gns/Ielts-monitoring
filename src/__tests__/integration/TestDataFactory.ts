/**
 * Test data factory for integration tests
 */

export class TestDataFactory {
  static createMockAppointment() {
    return {
      id: 'test-appointment-1',
      date: '2024-01-15',
      time: '09:00-12:00',
      location: 'Test Center',
      examType: 'IELTS',
      city: 'Isfahan',
      status: 'available' as const,
      price: 5000000,
      registrationUrl: 'https://example.com/register'
    };
  }

  static createAppointments(count: number) {
    const appointments = [];
    for (let i = 0; i < count; i++) {
      appointments.push({
        ...this.createMockAppointment(),
        id: `test-appointment-${i + 1}`,
        date: `2024-01-${(15 + i).toString().padStart(2, '0')}`
      });
    }
    return appointments;
  }

  static createMonitorConfig() {
    return {
      city: ['Isfahan'],
      examModel: ['IELTS'],
      months: [1, 2, 3],
      checkInterval: 30000,
      notificationSettings: this.createNotificationSettings(),
      baseUrl: 'https://example.com'
    };
  }

  static createNotificationSettings() {
    return {
      desktop: true,
      audio: false,
      logFile: true,
      telegram: false
    };
  }

  static createMockStatistics() {
    return {
      totalChecks: 10,
      appointmentsFound: 5,
      notificationsSent: 2,
      uptime: 3600000,
      lastCheck: new Date(),
      averageResponseTime: 1500
    };
  }

  static createMockFileStructure() {
    return {
      'config/monitor-config.json': JSON.stringify(this.createMonitorConfig()),
      'data/appointments.json': JSON.stringify([this.createMockAppointment()]),
      'logs/monitor.log': 'Test log entry\n'
    };
  }

  static createMockCheckResult() {
    return {
      type: 'available' as const,
      appointmentCount: 1,
      availableCount: 1,
      filledCount: 0,
      timestamp: new Date(),
      url: 'https://example.com',
      appointments: [this.createMockAppointment()]
    };
  }
}