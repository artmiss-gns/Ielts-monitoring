import { promises as fs } from 'fs';
import path from 'path';
import { DataStorageService, AppointmentSnapshot } from '../DataStorageService';
import { Appointment, NotificationRecord } from '../../models/types';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('DataStorageService', () => {
  let service: DataStorageService;
  const testDataDir = 'test-data';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DataStorageService({
      dataDirectory: testDataDir,
      maxHistoryDays: 7
    });
  });

  describe('constructor', () => {
    it('should use default configuration when no config provided', () => {
      const defaultService = new DataStorageService();
      expect(defaultService).toBeInstanceOf(DataStorageService);
    });

    it('should merge provided config with defaults', () => {
      const customService = new DataStorageService({
        dataDirectory: 'custom-data',
        maxHistoryDays: 14
      });
      expect(customService).toBeInstanceOf(DataStorageService);
    });
  });

  describe('saveAppointments', () => {
    const mockAppointments: Appointment[] = [
      {
        id: 'apt-1',
        date: '2025-02-15',
        time: '09:00-12:00',
        location: 'Isfahan Center',
        examType: 'CDIELTS',
        city: 'Isfahan',
        status: 'available'
      },
      {
        id: 'apt-2',
        date: '2025-02-16',
        time: '14:00-17:00',
        location: 'Tehran Center',
        examType: 'CDIELTS',
        city: 'Tehran',
        status: 'available'
      }
    ];

    it('should create data directory if it does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory does not exist'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();

      await service.saveAppointments(mockAppointments);

      expect(mockFs.mkdir).toHaveBeenCalledWith(testDataDir, { recursive: true });
    });

    it('should save appointments with timestamp', async () => {
      mockFs.access.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();

      const mockDate = new Date('2025-01-15T10:30:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      await service.saveAppointments(mockAppointments);

      const expectedSnapshot: AppointmentSnapshot = {
        timestamp: '2025-01-15T10:30:00.000Z',
        appointments: mockAppointments
      };

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testDataDir, 'appointments.json'),
        JSON.stringify(expectedSnapshot, null, 2),
        'utf-8'
      );

      jest.restoreAllMocks();
    });
  });

  describe('getLastAppointments', () => {
    it('should return appointments from saved file', async () => {
      const mockSnapshot: AppointmentSnapshot = {
        timestamp: '2025-01-15T10:30:00Z',
        appointments: [
          {
            id: 'apt-1',
            date: '2025-02-15',
            time: '09:00-12:00',
            location: 'Isfahan Center',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'available'
          }
        ]
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSnapshot));

      const result = await service.getLastAppointments();

      expect(result).toEqual(mockSnapshot.appointments);
      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(testDataDir, 'appointments.json'),
        'utf-8'
      );
    });

    it('should return empty array when file does not exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await service.getLastAppointments();

      expect(result).toEqual([]);
    });

    it('should return empty array when file contains invalid JSON', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');

      const result = await service.getLastAppointments();

      expect(result).toEqual([]);
    });
  });

  describe('detectNewAppointments', () => {
    const previousAppointments: Appointment[] = [
      {
        id: 'apt-1',
        date: '2025-02-15',
        time: '09:00-12:00',
        location: 'Isfahan Center',
        examType: 'CDIELTS',
        city: 'Isfahan',
        status: 'available'
      },
      {
        id: 'apt-2',
        date: '2025-02-16',
        time: '14:00-17:00',
        location: 'Tehran Center',
        examType: 'CDIELTS',
        city: 'Tehran',
        status: 'available'
      }
    ];

    it('should detect new appointments', () => {
      const currentAppointments: Appointment[] = [
        ...previousAppointments,
        {
          id: 'apt-3',
          date: '2025-02-17',
          time: '09:00-12:00',
          location: 'Shiraz Center',
          examType: 'CDIELTS',
          city: 'Shiraz',
          status: 'available'
        }
      ];

      const result = service.detectNewAppointments(currentAppointments, previousAppointments);

      expect(result.newAppointments).toHaveLength(1);
      expect(result.newAppointments[0].id).toBe('apt-3');
      expect(result.removedAppointments).toHaveLength(0);
      expect(result.unchangedAppointments).toHaveLength(2);
    });

    it('should detect removed appointments', () => {
      const currentAppointments: Appointment[] = [previousAppointments[0]];

      const result = service.detectNewAppointments(currentAppointments, previousAppointments);

      expect(result.newAppointments).toHaveLength(0);
      expect(result.removedAppointments).toHaveLength(1);
      expect(result.removedAppointments[0].id).toBe('apt-2');
      expect(result.unchangedAppointments).toHaveLength(1);
    });

    it('should handle empty previous appointments', () => {
      const currentAppointments: Appointment[] = [previousAppointments[0]];

      const result = service.detectNewAppointments(currentAppointments, []);

      expect(result.newAppointments).toHaveLength(1);
      expect(result.removedAppointments).toHaveLength(0);
      expect(result.unchangedAppointments).toHaveLength(0);
    });

    it('should handle empty current appointments', () => {
      const result = service.detectNewAppointments([], previousAppointments);

      expect(result.newAppointments).toHaveLength(0);
      expect(result.removedAppointments).toHaveLength(2);
      expect(result.unchangedAppointments).toHaveLength(0);
    });
  });

  describe('saveNotificationRecord', () => {
    const mockNotification: NotificationRecord = {
      timestamp: new Date('2025-01-15T10:30:00Z'),
      appointmentCount: 2,
      appointments: [],
      channels: ['desktop', 'audio'],
      deliveryStatus: 'success'
    };

    it('should create data directory and save notification', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory does not exist'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue();

      await service.saveNotificationRecord(mockNotification);

      expect(mockFs.mkdir).toHaveBeenCalledWith(testDataDir, { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testDataDir, 'notifications.json'),
        JSON.stringify([mockNotification], null, 2),
        'utf-8'
      );
    });

    it('should append to existing notifications', async () => {
      const existingNotifications = [mockNotification];
      mockFs.access.mockResolvedValue();
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingNotifications));
      mockFs.writeFile.mockResolvedValue();

      const newNotification: NotificationRecord = {
        ...mockNotification,
        timestamp: new Date('2025-01-15T11:00:00Z')
      };

      await service.saveNotificationRecord(newNotification);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testDataDir, 'notifications.json'),
        JSON.stringify([mockNotification, newNotification], null, 2),
        'utf-8'
      );
    });
  });

  describe('getNotificationHistory', () => {
    it('should return notification history', async () => {
      const mockNotifications: NotificationRecord[] = [
        {
          timestamp: new Date('2025-01-15T10:30:00Z'),
          appointmentCount: 1,
          appointments: [],
          channels: ['desktop'],
          deliveryStatus: 'success'
        }
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockNotifications));

      const result = await service.getNotificationHistory();

      expect(result).toEqual(mockNotifications);
    });

    it('should return empty array when file does not exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await service.getNotificationHistory();

      expect(result).toEqual([]);
    });
  });

  describe('getNotificationHistoryByDateRange', () => {
    const mockNotifications: NotificationRecord[] = [
      {
        timestamp: new Date('2025-01-10T10:00:00Z'),
        appointmentCount: 1,
        appointments: [],
        channels: ['desktop'],
        deliveryStatus: 'success'
      },
      {
        timestamp: new Date('2025-01-15T10:00:00Z'),
        appointmentCount: 2,
        appointments: [],
        channels: ['desktop', 'audio'],
        deliveryStatus: 'success'
      },
      {
        timestamp: new Date('2025-01-20T10:00:00Z'),
        appointmentCount: 1,
        appointments: [],
        channels: ['desktop'],
        deliveryStatus: 'success'
      }
    ];

    it('should filter notifications by date range', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockNotifications));

      const startDate = new Date('2025-01-12T00:00:00Z');
      const endDate = new Date('2025-01-18T23:59:59Z');

      const result = await service.getNotificationHistoryByDateRange(startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toEqual(new Date('2025-01-15T10:00:00Z'));
    });
  });

  describe('cleanupOldRecords', () => {
    it('should remove old notification records', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3); // 3 days ago

      const mockNotifications: NotificationRecord[] = [
        {
          timestamp: oldDate,
          appointmentCount: 1,
          appointments: [],
          channels: ['desktop'],
          deliveryStatus: 'success'
        },
        {
          timestamp: recentDate,
          appointmentCount: 2,
          appointments: [],
          channels: ['desktop'],
          deliveryStatus: 'success'
        }
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockNotifications));
      mockFs.writeFile.mockResolvedValue();

      await service.cleanupOldRecords();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testDataDir, 'notifications.json'),
        JSON.stringify([mockNotifications[1]], null, 2),
        'utf-8'
      );
    });

    it('should not write file if no cleanup needed', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);

      const mockNotifications: NotificationRecord[] = [
        {
          timestamp: recentDate,
          appointmentCount: 1,
          appointments: [],
          channels: ['desktop'],
          deliveryStatus: 'success'
        }
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockNotifications));

      await service.cleanupOldRecords();

      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('getStorageStats', () => {
    it('should return storage statistics', async () => {
      const mockSnapshot: AppointmentSnapshot = {
        timestamp: '2025-01-15T10:30:00Z',
        appointments: []
      };

      const mockNotifications: NotificationRecord[] = [
        {
          timestamp: new Date('2025-01-15T10:00:00Z'),
          appointmentCount: 1,
          appointments: [],
          channels: ['desktop'],
          deliveryStatus: 'success'
        }
      ];

      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockNotifications))
        .mockResolvedValueOnce(JSON.stringify(mockSnapshot));

      mockFs.readdir.mockResolvedValue(['appointments.json', 'notifications.json'] as any);
      mockFs.stat.mockResolvedValue({ size: 1024 } as any);

      const result = await service.getStorageStats();

      expect(result.totalNotifications).toBe(1);
      expect(result.lastAppointmentCheck).toBe('2025-01-15T10:30:00Z');
      expect(result.dataDirectorySize).toBe(2048); // 2 files × 1024 bytes
    });
  });

  describe('clearAllData', () => {
    it('should remove all data files', async () => {
      mockFs.unlink.mockResolvedValue();

      await service.clearAllData();

      expect(mockFs.unlink).toHaveBeenCalledWith(path.join(testDataDir, 'appointments.json'));
      expect(mockFs.unlink).toHaveBeenCalledWith(path.join(testDataDir, 'notifications.json'));
    });

    it('should handle missing files gracefully', async () => {
      mockFs.unlink.mockRejectedValue(new Error('File not found'));

      await expect(service.clearAllData()).resolves.not.toThrow();
    });
  });
});