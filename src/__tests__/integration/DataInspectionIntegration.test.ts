import { DataInspectionService } from '../../services/DataInspectionService';
import { InspectionData, Appointment } from '../../models/types';
import { promises as fs } from 'fs';
import path from 'path';

describe('Data Inspection Integration Tests', () => {
    let dataInspectionService: DataInspectionService;
    let testDataDir: string;

    beforeAll(async () => {
        // Setup test data directory
        testDataDir = path.join(__dirname, '../../..', 'test-data-inspection');

        try {
            await fs.access(testDataDir);
        } catch {
            await fs.mkdir(testDataDir, { recursive: true });
        }
    });

    beforeEach(() => {
        dataInspectionService = new DataInspectionService({
            dataDirectory: testDataDir,
            inspectionFile: 'test-inspection.json',
            maxInspectionRecords: 10,
            cleanupIntervalHours: 1
        });
    });

    afterEach(async () => {
        // Clean up test files
        try {
            const files = await fs.readdir(testDataDir);
            for (const file of files) {
                await fs.unlink(path.join(testDataDir, file));
            }
        } catch {
            // Directory might not exist
        }
    });

    afterAll(async () => {
        // Remove test directory
        try {
            await fs.rmdir(testDataDir);
        } catch {
            // Directory might not be empty or not exist
        }
    });

    describe('WebScraper Integration with Inspection Service', () => {
        it('should save inspection data when scraping appointments', async () => {
            // Create mock inspection data
            const mockAppointments: Appointment[] = [
                {
                    id: 'integration-apt-1',
                    date: '2025-02-15',
                    time: '09:00-12:00',
                    location: 'Isfahan Center',
                    examType: 'CDIELTS',
                    city: 'Isfahan',
                    status: 'available',
                    rawHtml: '<div class="appointment-card">Available slot</div>'
                }
            ];

            const mockInspectionData: InspectionData = {
                url: 'http://localhost:3001/appointments',
                pageTitle: 'Test IELTS Appointments',
                detectedElements: ['Found elements with selector: .appointment-card'],
                parsingNotes: 'Integration test parsing',
                rawAppointmentHtml: ['<div class="appointment-card">Available slot</div>'],
                checkResult: {
                    type: 'available',
                    appointmentCount: 1,
                    availableCount: 1,
                    filledCount: 0,
                    timestamp: new Date(),
                    url: 'http://localhost:3001/appointments',
                    appointments: mockAppointments
                }
            };

            // Save inspection data
            const inspectionId = await dataInspectionService.saveInspectionData(mockInspectionData);

            // Verify data was saved
            expect(inspectionId).toMatch(/^inspection_\d+_[a-z0-9]+$/);

            // Retrieve and verify the saved data
            const savedData = await dataInspectionService.getLatestInspectionData();
            expect(savedData).not.toBeNull();
            expect(savedData!.data.url).toBe('http://localhost:3001/appointments');
            expect(savedData!.data.checkResult.appointmentCount).toBe(1);
            expect(savedData!.data.checkResult.availableCount).toBe(1);
        });

        it('should handle multiple inspection records correctly', async () => {
            const inspectionData1: InspectionData = {
                url: 'http://localhost:3001/appointments?month=1',
                pageTitle: 'January Appointments',
                detectedElements: ['No elements found'],
                parsingNotes: 'No appointments available',
                rawAppointmentHtml: [],
                checkResult: {
                    type: 'no-slots',
                    appointmentCount: 0,
                    availableCount: 0,
                    filledCount: 0,
                    timestamp: new Date(Date.now() - 1000),
                    url: 'http://localhost:3001/appointments?month=1',
                    appointments: []
                }
            };

            const inspectionData2: InspectionData = {
                url: 'http://localhost:3001/appointments?month=2',
                pageTitle: 'February Appointments',
                detectedElements: ['Found 2 filled appointments'],
                parsingNotes: 'All appointments filled',
                rawAppointmentHtml: ['<div>تکمیل ظرفیت</div>', '<div>تکمیل ظرفیت</div>'],
                checkResult: {
                    type: 'filled',
                    appointmentCount: 2,
                    availableCount: 0,
                    filledCount: 2,
                    timestamp: new Date(),
                    url: 'http://localhost:3001/appointments?month=2',
                    appointments: [
                        {
                            id: 'filled-1',
                            date: '2025-02-15',
                            time: '09:00-12:00',
                            location: 'Isfahan Center',
                            examType: 'CDIELTS',
                            city: 'Isfahan',
                            status: 'filled',
                            rawHtml: '<div>تکمیل ظرفیت</div>'
                        },
                        {
                            id: 'filled-2',
                            date: '2025-02-16',
                            time: '14:00-17:00',
                            location: 'Isfahan Center',
                            examType: 'CDIELTS',
                            city: 'Isfahan',
                            status: 'filled',
                            rawHtml: '<div>تکمیل ظرفیت</div>'
                        }
                    ]
                }
            };

            // Save both inspection records
            await dataInspectionService.saveInspectionData(inspectionData1);
            await dataInspectionService.saveInspectionData(inspectionData2);

            // Verify latest record is the second one
            const latestData = await dataInspectionService.getLatestInspectionData();
            expect(latestData!.data.checkResult.type).toBe('filled');
            expect(latestData!.data.checkResult.appointmentCount).toBe(2);

            // Verify we have both records
            const allRecords = await dataInspectionService.getAllInspectionRecords();
            expect(allRecords).toHaveLength(2);
        });
    });

    describe('Service Integration Tests', () => {
        it('should integrate inspection data saving and retrieval', async () => {
            const mockInspectionData: InspectionData = {
                url: 'http://localhost:3001/test',
                pageTitle: 'Service Integration Test',
                detectedElements: ['Service test elements'],
                parsingNotes: 'Service integration test',
                rawAppointmentHtml: ['<div>Service test HTML</div>'],
                checkResult: {
                    type: 'available',
                    appointmentCount: 1,
                    availableCount: 1,
                    filledCount: 0,
                    timestamp: new Date(),
                    url: 'http://localhost:3001/test',
                    appointments: [
                        {
                            id: 'service-test-apt',
                            date: '2025-02-15',
                            time: '09:00-12:00',
                            location: 'Test Center',
                            examType: 'CDIELTS',
                            city: 'Isfahan',
                            status: 'available',
                            rawHtml: '<div>Service test HTML</div>'
                        }
                    ]
                }
            };

            // Save and retrieve data
            const inspectionId = await dataInspectionService.saveInspectionData(mockInspectionData);
            const retrievedData = await dataInspectionService.getInspectionDataById(inspectionId);

            expect(retrievedData).not.toBeNull();
            expect(retrievedData!.data.pageTitle).toBe('Service Integration Test');
            expect(retrievedData!.data.checkResult.appointmentCount).toBe(1);
        });
    });

    describe('Data Export Integration', () => {
        beforeEach(async () => {
            // Setup multiple inspection records for export testing
            const inspectionRecords = [
                {
                    url: 'http://localhost:3001/export-test-1',
                    pageTitle: 'Export Test 1',
                    detectedElements: ['Export test elements 1'],
                    parsingNotes: 'Export test 1 notes',
                    rawAppointmentHtml: ['<div>Export test 1</div>'],
                    checkResult: {
                        type: 'available' as const,
                        appointmentCount: 1,
                        availableCount: 1,
                        filledCount: 0,
                        timestamp: new Date(Date.now() - 2000),
                        url: 'http://localhost:3001/export-test-1',
                        appointments: []
                    }
                },
                {
                    url: 'http://localhost:3001/export-test-2',
                    pageTitle: 'Export Test 2',
                    detectedElements: ['Export test elements 2'],
                    parsingNotes: 'Export test 2 notes',
                    rawAppointmentHtml: ['<div>Export test 2</div>'],
                    checkResult: {
                        type: 'filled' as const,
                        appointmentCount: 2,
                        availableCount: 0,
                        filledCount: 2,
                        timestamp: new Date(Date.now() - 1000),
                        url: 'http://localhost:3001/export-test-2',
                        appointments: []
                    }
                }
            ];

            for (const record of inspectionRecords) {
                await dataInspectionService.saveInspectionData(record);
            }
        });

        it('should export inspection data in JSON format', async () => {
            const exportData = await dataInspectionService.exportInspectionData('json');
            const parsedData = JSON.parse(exportData);

            expect(parsedData).toHaveLength(2);
            expect(parsedData[0].data.pageTitle).toBe('Export Test 2'); // Latest first
            expect(parsedData[1].data.pageTitle).toBe('Export Test 1');
        });

        it('should export inspection data in text format', async () => {
            const exportData = await dataInspectionService.exportInspectionData('text');

            expect(exportData).toContain('=== INSPECTION SUMMARY ===');
            expect(exportData).toContain('Export Test 1');
            expect(exportData).toContain('Export Test 2');
            expect(exportData).toContain('Check Type: AVAILABLE');
            expect(exportData).toContain('Check Type: FILLED');
        });

        it('should export inspection data in CSV format', async () => {
            const exportData = await dataInspectionService.exportInspectionData('csv');

            expect(exportData).toContain('ID,Timestamp,URL,PageTitle,CheckType,TotalAppointments,AvailableCount,FilledCount,ParsingNotes');
            expect(exportData).toContain('Export Test 1');
            expect(exportData).toContain('Export Test 2');
            expect(exportData).toContain('available');
            expect(exportData).toContain('filled');
        });

        it('should respect limit parameter in export', async () => {
            const exportData = await dataInspectionService.exportInspectionData('json', 1);
            const parsedData = JSON.parse(exportData);

            expect(parsedData).toHaveLength(1);
            expect(parsedData[0].data.pageTitle).toBe('Export Test 2'); // Latest record
        });
    });

    describe('Cleanup Integration', () => {
        it('should clean up old inspection records automatically', async () => {
            // Create more records than the max limit to force cleanup
            const inspectionRecords = Array.from({ length: 12 }, (_, i) => ({
                url: `http://localhost:3001/cleanup-test-${i}`,
                pageTitle: `Cleanup Test ${i}`,
                detectedElements: [`Cleanup elements ${i}`],
                parsingNotes: `Cleanup notes ${i}`,
                rawAppointmentHtml: [`<div>Cleanup test ${i}</div>`],
                checkResult: {
                    type: 'no-slots' as const,
                    appointmentCount: 0,
                    availableCount: 0,
                    filledCount: 0,
                    timestamp: new Date(Date.now() - (i + 2) * 60 * 60 * 1000), // All old records
                    url: `http://localhost:3001/cleanup-test-${i}`,
                    appointments: []
                }
            }));

            // Save all records
            for (const record of inspectionRecords) {
                await dataInspectionService.saveInspectionData(record);
            }

            // Verify records exist (limited to max count during save)
            let allRecords = await dataInspectionService.getAllInspectionRecords();
            expect(allRecords).toHaveLength(10); // Already limited during save

            // Run cleanup (should not remove any since they're within max count)
            const removedCount = await dataInspectionService.cleanupOldInspectionData();

            // No records should be removed since they're within the max count limit
            expect(removedCount).toBe(0);
            allRecords = await dataInspectionService.getAllInspectionRecords();
            expect(allRecords).toHaveLength(10);
        });
    });

    describe('Statistics Integration', () => {
        it('should calculate accurate statistics across multiple records', async () => {
            const inspectionRecords = [
                {
                    checkResult: { appointmentCount: 3, availableCount: 2, filledCount: 1 }
                },
                {
                    checkResult: { appointmentCount: 1, availableCount: 0, filledCount: 1 }
                },
                {
                    checkResult: { appointmentCount: 0, availableCount: 0, filledCount: 0 }
                }
            ];

            for (let i = 0; i < inspectionRecords.length; i++) {
                const record = inspectionRecords[i];
                const inspectionData: InspectionData = {
                    url: `http://localhost:3001/stats-test-${i}`,
                    pageTitle: `Stats Test ${i}`,
                    detectedElements: [`Stats elements ${i}`],
                    parsingNotes: `Stats notes ${i}`,
                    rawAppointmentHtml: [`<div>Stats test ${i}</div>`],
                    checkResult: {
                        type: record.checkResult.availableCount > 0 ? 'available' :
                            record.checkResult.filledCount > 0 ? 'filled' : 'no-slots',
                        appointmentCount: record.checkResult.appointmentCount,
                        availableCount: record.checkResult.availableCount,
                        filledCount: record.checkResult.filledCount,
                        timestamp: new Date(Date.now() - (inspectionRecords.length - i) * 1000),
                        url: `http://localhost:3001/stats-test-${i}`,
                        appointments: []
                    }
                };

                await dataInspectionService.saveInspectionData(inspectionData);
            }

            const stats = await dataInspectionService.getInspectionStats();

            expect(stats.totalRecords).toBe(3);
            expect(stats.averageAppointmentsPerCheck).toBe(1.33); // (3 + 1 + 0) / 3 = 1.33
            expect(stats.availabilityRate).toBe(50); // (2 + 0 + 0) / (3 + 1 + 0) * 100 = 50%
            expect(stats.latestInspection).toBeDefined();
            expect(stats.oldestInspection).toBeDefined();
        });
    });
});