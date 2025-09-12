import { MockIELTSServer } from './MockIELTSServer';
import { TestDataFactory } from './TestDataFactory';

describe('Basic Integration Test', () => {
  let mockServer: MockIELTSServer;

  beforeAll(async () => {
    mockServer = new MockIELTSServer(3004);
    await mockServer.start();
  });

  afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });

  test('should create mock server and test data', async () => {
    // Test mock server
    expect(mockServer).toBeDefined();
    expect(mockServer.getUrl()).toBe('http://localhost:3004');

    // Test data factory
    const appointments = TestDataFactory.createAppointments(2);
    expect(appointments).toHaveLength(2);
    expect(appointments[0]).toHaveProperty('id');
    expect(appointments[0]).toHaveProperty('date');
    expect(appointments[0]).toHaveProperty('city');

    // Test mock server with appointments
    mockServer.setAppointments(appointments);
    const stats = mockServer.getStats();
    expect(stats.appointmentCount).toBe(2);
  });

  test('should create monitor configuration', () => {
    const config = TestDataFactory.createMonitorConfig();
    expect(config).toHaveProperty('city');
    expect(config).toHaveProperty('examModel');
    expect(config).toHaveProperty('months');
    expect(config).toHaveProperty('checkInterval');
    expect(config).toHaveProperty('notificationSettings');
  });
});