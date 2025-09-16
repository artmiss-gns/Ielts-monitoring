import { DataInspectionService, DataInspectionConfig } from '../DataInspectionService';
import { InspectionData, CheckResult, Appointment } from '../../models/types';
import { promises as fs } from 'fs';
import path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('DataInspectionService', () => {
  let service: DataInspectionService;
  let testConfig: DataInspectionConfig;
  let mockInspectionData: InspectionData;
  let mockCheckResult: CheckResult;
  let mockAppointments: Appointment[];

  beforeEach(() => {
    jest.clearAllMocks();
    
    testConfig = {
      dataDirectory: 'test-data',
      inspectionFile: 'test-inspection.json',
      maxInspectionRecords: 10,
      cleanupIntervalHours: 1
    };

    mockAppointments = [
      {
        id: 'apt-1',
        date: '2025-02-15',
        time: '09:00-12:00',
        location: 'Isfahan Center',
        examType: 'CDIELTS',
        city: 'Isfahan',
        status: 'available',
        rawHtml: '<div class="appointment-card">Available slot</div>'
      },
      {
        id: 'apt-2',
        date: '2025-02-16',
        time: '14:00-17:00',
        location: 'Isfahan Center',
        examType: 'CDIELTS',
        city: 'Isfahan',
        status: 'filled',
        rawHtml: '<div class="appointment-card">تکمیل ظرفیت</div>'
      }
    ];

    mockCheckResult = {
      type: 'available',
      appointmentCount: 2,
      availableCount: 1,
      filledCount: 1,
      timestamp: new Date('2025-01-15T10:30:00Z'),
      url: 'https://irsafam.org/ielts/timetable?city=isfahan',
      appointments: mockAppointments
    };

    mockInspectionData = {
      url: 'https://irsafam.org/ielts/timetable?city=isfahan',
      pageTitle: 'IELTS Timetable',
      detectedElements: ['Found elements with selector: .appointment-card', 'Total elements found: 2'],
      parsingNotes: 'Found Persian filled indicator: تکمیل ظرفیت; Status summary: available=1, filled=1, pending=0',
      rawAppointmentHtml: [
        '<div class="appointment-card">Available slot</div>',
        '<div class="appointment-card">تکمیل ظرفیت</div>'
      ],
      checkResult: mockCheckResult
    };

    service = new DataInspectionService(testConfig);
  });

  describe('constructor', () => {
    it('should use default configuration when none provided', () => {
      const defaultService = new DataInspectionService();
      expect(defaultService).toBeInstanceOf(DataInspectionService);
    });

    it('should merge provided configuration with defaults', () => {
      const customConfig = { maxInspectionRecords: 25 };
      const customService = new DataInspectionService(customConfig);
      expect(customService).toBeInstanceOf(DataInspectionService);
    });
  });

  describe('saveInspectionData', () => {
    it('should save inspection data successfully', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);

      const inspectionId = await service.saveInspectionData(mockInspectionData);

      expect(inspectionId).toMatch(/^inspection_\d+_[a-z0-9]+$/);
      expect(mockFs.mkdir).toHaveBeenCalledWith('test-data', { recursive: true });
      
      const writeCall = mockFs.writeFile.mock.calls[0];
      expect(writeCall[0]).toBe(path.join('test-data', 'test-inspection.json'));
      expect(writeCall[1]).toContain('https://irsafam.org/ielts/timetable?city=isfahan');
      expect(writeCall[2]).toBe('utf-8');
    });

    it('should append to existing inspection records', async () => {
      const existingRecords = [
        {
          id: 'existing-1',
          timestamp: '2025-01-14T10:00:00Z',
          data: mockInspectionData
        }
      ];

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingRecords));
      mockFs.writeFile.mockResolvedValue(undefined);

      await service.saveInspectionData(mockInspectionData);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      
      expect(writtenData).toHaveLength(2);
      expect(writtenData[0].data.url).toBe(mockInspectionData.url);
      expect(writtenData[0].data.pageTitle).toBe(mockInspectionData.pageTitle);
      expect(writtenData[1].id).toBe(existingRecords[0].id);
      expect(writtenData[1].data.url).toBe(existingRecords[0].data.url);
    });

    it('should limit records to maxInspectionRecords', async () => {
      const existingRecords = Array.from({ length: 12 }, (_, i) => ({
        id: `existing-${i}`,
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
        data: mockInspectionData
      }));

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingRecords));
      mockFs.writeFile.mockResolvedValue(undefined);

      await service.saveInspectionData(mockInspectionData);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      
      expect(writtenData).toHaveLength(testConfig.maxInspectionRecords);
    });
  });

  describe('getLatestInspectionData', () => {
    it('should return the latest inspection record', async () => {
      const mockRecords = [
        {
          id: 'latest',
          timestamp: '2025-01-15T10:30:00Z',
          data: mockInspectionData
        },
        {
          id: 'older',
          timestamp: '2025-01-14T10:30:00Z',
          data: mockInspectionData
        }
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockRecords));

      const result = await service.getLatestInspectionData();

      expect(result?.id).toBe('latest');
      expect(result?.data.url).toBe(mockInspectionData.url);
    });

    it('should return null when no records exist', async () => {
      mockFs.readFile.mockResolvedValue('[]');

      const result = await service.getLatestInspectionData();

      expect(result).toBeNull();
    });

    it('should return null when file does not exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await service.getLatestInspectionData();

      expect(result).toBeNull();
    });
  });

  describe('getInspectionDataById', () => {
    it('should return inspection record by ID', async () => {
      const mockRecords = [
        {
          id: 'target-id',
          timestamp: '2025-01-15T10:30:00Z',
          data: mockInspectionData
        },
        {
          id: 'other-id',
          timestamp: '2025-01-14T10:30:00Z',
          data: mockInspectionData
        }
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockRecords));

      const result = await service.getInspectionDataById('target-id');

      expect(result?.id).toBe('target-id');
      expect(result?.data.url).toBe(mockInspectionData.url);
    });

    it('should return null when ID not found', async () => {
      mockFs.readFile.mockResolvedValue('[]');

      const result = await service.getInspectionDataById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('formatInspectionSummary', () => {
    it('should format inspection summary correctly', () => {
      const mockRecord = {
        id: 'test-id',
        timestamp: '2025-01-15T10:30:00Z',
        data: mockInspectionData
      };

      const summary = service.formatInspectionSummary(mockRecord);

      expect(summary).toContain('=== INSPECTION SUMMARY ===');
      expect(summary).toContain('ID: test-id');
      expect(summary).toContain('URL: https://irsafam.org/ielts/timetable?city=isfahan');
      expect(summary).toContain('Check Type: AVAILABLE');
      expect(summary).toContain('Total Appointments: 2');
      expect(summary).toContain('Available Appointments: 1');
      expect(summary).toContain('Filled Appointments: 1');
      expect(summary).toContain('2025-02-15 09:00-12:00 - AVAILABLE');
      expect(summary).toContain('2025-02-16 14:00-17:00 - FILLED');
    });

    it('should handle empty appointments list', () => {
      const emptyCheckResult = {
        ...mockCheckResult,
        appointmentCount: 0,
        availableCount: 0,
        filledCount: 0,
        appointments: []
      };

      const emptyInspectionData = {
        ...mockInspectionData,
        checkResult: emptyCheckResult
      };

      const mockRecord = {
        id: 'empty-test',
        timestamp: '2025-01-15T10:30:00Z',
        data: emptyInspectionData
      };

      const summary = service.formatInspectionSummary(mockRecord);

      expect(summary).toContain('Total Appointments: 0');
      expect(summary).not.toContain('--- APPOINTMENT DETAILS ---');
    });
  });

  describe('createDetailedInspectionOutput', () => {
    it('should create detailed inspection output', async () => {
      const mockRecord = {
        id: 'detailed-test',
        timestamp: '2025-01-15T10:30:00Z',
        data: mockInspectionData
      };

      const output = await service.createDetailedInspectionOutput(mockRecord);

      expect(output).toContain('DETAILED INSPECTION REPORT');
      expect(output).toContain('Inspection ID: detailed-test');
      expect(output).toContain('CHECK RESULTS SUMMARY');
      expect(output).toContain('DETECTED PAGE ELEMENTS');
      expect(output).toContain('PARSING ANALYSIS');
      expect(output).toContain('APPOINTMENT BREAKDOWN');
      expect(output).toContain('AVAILABLE APPOINTMENTS (1):');
      expect(output).toContain('FILLED APPOINTMENTS (1):');
      expect(output).toContain('RAW HTML ANALYSIS');
    });
  });

  describe('exportInspectionData', () => {
    beforeEach(() => {
      const mockRecords = [
        {
          id: 'export-test-1',
          timestamp: '2025-01-15T10:30:00Z',
          data: mockInspectionData
        }
      ];
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockRecords));
    });

    it('should export data in JSON format', async () => {
      const result = await service.exportInspectionData('json');
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].id).toBe('export-test-1');
    });

    it('should export data in text format', async () => {
      const result = await service.exportInspectionData('text');
      
      expect(result).toContain('=== INSPECTION SUMMARY ===');
      expect(result).toContain('ID: export-test-1');
    });

    it('should export data in CSV format', async () => {
      const result = await service.exportInspectionData('csv');
      
      expect(result).toContain('ID,Timestamp,URL,PageTitle,CheckType,TotalAppointments,AvailableCount,FilledCount,ParsingNotes');
      expect(result).toContain('export-test-1');
      expect(result).toContain('available');
    });

    it('should throw error for unsupported format', async () => {
      await expect(service.exportInspectionData('xml' as any))
        .rejects.toThrow('Unsupported export format: xml');
    });

    it('should respect limit parameter', async () => {
      const mockRecords = Array.from({ length: 5 }, (_, i) => ({
        id: `record-${i}`,
        timestamp: '2025-01-15T10:30:00Z',
        data: mockInspectionData
      }));
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockRecords));

      const result = await service.exportInspectionData('json', 3);
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toHaveLength(3);
    });
  });

  describe('cleanupOldInspectionData', () => {
    it('should remove old inspection records', async () => {
      const now = new Date();
      // Create more records than the max limit to force cleanup
      const records = Array.from({ length: 12 }, (_, i) => ({
        id: `record-${i}`,
        timestamp: new Date(now.getTime() - (i + 2) * 60 * 60 * 1000).toISOString(), // All old records
        data: mockInspectionData
      }));

      mockFs.readFile.mockResolvedValue(JSON.stringify(records));
      mockFs.writeFile.mockResolvedValue(undefined);

      const removedCount = await service.cleanupOldInspectionData();

      expect(removedCount).toBe(2); // 12 - 10 (max limit)
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join('test-data', 'test-inspection.json'),
        expect.any(String),
        'utf-8'
      );
    });

    it('should return 0 when no cleanup needed', async () => {
      const recentRecord = {
        id: 'recent-record',
        timestamp: new Date().toISOString(),
        data: mockInspectionData
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify([recentRecord]));

      const removedCount = await service.cleanupOldInspectionData();

      expect(removedCount).toBe(0);
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('getInspectionStats', () => {
    it('should calculate inspection statistics correctly', async () => {
      const mockRecords = [
        {
          id: 'stats-1',
          timestamp: '2025-01-15T10:30:00.000Z',
          data: {
            ...mockInspectionData,
            checkResult: { ...mockCheckResult, appointmentCount: 3, availableCount: 2, filledCount: 1 }
          }
        },
        {
          id: 'stats-2',
          timestamp: '2025-01-14T10:30:00.000Z',
          data: {
            ...mockInspectionData,
            checkResult: { ...mockCheckResult, appointmentCount: 1, availableCount: 0, filledCount: 1 }
          }
        }
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockRecords));

      const stats = await service.getInspectionStats();

      expect(stats.totalRecords).toBe(2);
      expect(stats.latestInspection).toBe('2025-01-15T10:30:00.000Z');
      expect(stats.oldestInspection).toBe('2025-01-14T10:30:00.000Z');
      expect(stats.averageAppointmentsPerCheck).toBe(2); // (3 + 1) / 2
      expect(stats.availabilityRate).toBe(50); // (2 + 0) / (3 + 1) * 100
    });

    it('should handle empty records', async () => {
      mockFs.readFile.mockResolvedValue('[]');

      const stats = await service.getInspectionStats();

      expect(stats.totalRecords).toBe(0);
      expect(stats.latestInspection).toBeUndefined();
      expect(stats.oldestInspection).toBeUndefined();
      expect(stats.averageAppointmentsPerCheck).toBe(0);
      expect(stats.availabilityRate).toBe(0);
    });
  });

  describe('clearAllInspectionData', () => {
    it('should delete inspection file', async () => {
      mockFs.unlink.mockResolvedValue(undefined);

      await service.clearAllInspectionData();

      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.join('test-data', 'test-inspection.json')
      );
    });

    it('should handle file not existing', async () => {
      mockFs.unlink.mockRejectedValue(new Error('File not found'));

      await expect(service.clearAllInspectionData()).resolves.not.toThrow();
    });
  });
});