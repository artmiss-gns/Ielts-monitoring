import { promises as fs } from 'fs';
import path from 'path';
import { InspectionData } from '../models/types';

/**
 * Configuration for data inspection service
 */
export interface DataInspectionConfig {
  dataDirectory: string;
  inspectionFile: string;
  maxInspectionRecords: number;
  cleanupIntervalHours: number;
}

/**
 * Inspection record with metadata
 */
export interface InspectionRecord {
  id: string;
  timestamp: string;
  data: InspectionData;
}

/**
 * Service for managing inspection data and raw HTML examination
 */
export class DataInspectionService {
  private config: DataInspectionConfig;

  constructor(config?: Partial<DataInspectionConfig>) {
    this.config = {
      dataDirectory: 'data',
      inspectionFile: 'inspection-data.json',
      maxInspectionRecords: 50,
      cleanupIntervalHours: 24,
      ...config
    };
  }

  /**
   * Ensures the data directory exists
   */
  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(this.config.dataDirectory);
    } catch {
      await fs.mkdir(this.config.dataDirectory, { recursive: true });
    }
  }

  /**
   * Gets the full path for the inspection data file
   */
  private getInspectionFilePath(): string {
    return path.join(this.config.dataDirectory, this.config.inspectionFile);
  }

  /**
   * Generates a unique ID for inspection records
   */
  private generateInspectionId(): string {
    return `inspection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Saves inspection data with raw HTML snippets and parsing results
   */
  async saveInspectionData(inspectionData: InspectionData): Promise<string> {
    await this.ensureDataDirectory();
    
    const record: InspectionRecord = {
      id: this.generateInspectionId(),
      timestamp: new Date().toISOString(),
      data: inspectionData
    };

    const filePath = this.getInspectionFilePath();
    let records: InspectionRecord[] = [];

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      records = JSON.parse(data);
    } catch {
      // File doesn't exist or is invalid, start with empty array
    }

    // Add new record at the beginning
    records.unshift(record);

    // Keep only the most recent records
    if (records.length > this.config.maxInspectionRecords) {
      records = records.slice(0, this.config.maxInspectionRecords);
    }

    await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
    return record.id;
  }

  /**
   * Retrieves the latest inspection data
   */
  async getLatestInspectionData(): Promise<InspectionRecord | null> {
    try {
      const filePath = this.getInspectionFilePath();
      const data = await fs.readFile(filePath, 'utf-8');
      const records: InspectionRecord[] = JSON.parse(data);
      
      return records.length > 0 ? records[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves inspection data by ID
   */
  async getInspectionDataById(id: string): Promise<InspectionRecord | null> {
    try {
      const filePath = this.getInspectionFilePath();
      const data = await fs.readFile(filePath, 'utf-8');
      const records: InspectionRecord[] = JSON.parse(data);
      
      return records.find(record => record.id === id) || null;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves all inspection records with optional limit
   */
  async getAllInspectionRecords(limit?: number): Promise<InspectionRecord[]> {
    try {
      const filePath = this.getInspectionFilePath();
      const data = await fs.readFile(filePath, 'utf-8');
      const records: InspectionRecord[] = JSON.parse(data);
      
      return limit ? records.slice(0, limit) : records;
    } catch {
      return [];
    }
  }

  /**
   * Formats inspection data for display with clear status categorization
   */
  formatInspectionSummary(record: InspectionRecord): string {
    const { data } = record;
    const { checkResult } = data;
    
    let summary = '';
    summary += `\n=== INSPECTION SUMMARY ===\n`;
    summary += `ID: ${record.id}\n`;
    summary += `Timestamp: ${new Date(record.timestamp).toLocaleString()}\n`;
    summary += `URL: ${data.url}\n`;
    summary += `Page Title: ${data.pageTitle}\n`;
    summary += `\n--- PARSING RESULTS ---\n`;
    summary += `Check Type: ${checkResult.type.toUpperCase()}\n`;
    summary += `Total Appointments: ${checkResult.appointmentCount}\n`;
    summary += `Available Appointments: ${checkResult.availableCount}\n`;
    summary += `Filled Appointments: ${checkResult.filledCount}\n`;
    summary += `\n--- DETECTED ELEMENTS ---\n`;
    data.detectedElements.forEach((element, index) => {
      summary += `${index + 1}. ${element}\n`;
    });
    summary += `\n--- PARSING NOTES ---\n`;
    summary += `${data.parsingNotes}\n`;
    
    if (checkResult.appointments.length > 0) {
      summary += `\n--- APPOINTMENT DETAILS ---\n`;
      checkResult.appointments.forEach((appointment, index) => {
        summary += `${index + 1}. ${appointment.date} ${appointment.time} - ${appointment.status.toUpperCase()}\n`;
        summary += `   Location: ${appointment.location}\n`;
        summary += `   Exam Type: ${appointment.examType}\n`;
        if (appointment.rawHtml) {
          const truncatedHtml = appointment.rawHtml.length > 100 
            ? appointment.rawHtml.substring(0, 100) + '...'
            : appointment.rawHtml;
          summary += `   Raw HTML: ${truncatedHtml}\n`;
        }
        summary += `\n`;
      });
    }

    if (data.rawAppointmentHtml.length > 0) {
      summary += `--- RAW HTML SNIPPETS ---\n`;
      data.rawAppointmentHtml.forEach((html, index) => {
        const truncatedHtml = html.length > 200 ? html.substring(0, 200) + '...' : html;
        summary += `Snippet ${index + 1}:\n${truncatedHtml}\n\n`;
      });
    }

    summary += `=== END INSPECTION ===\n`;
    return summary;
  }

  /**
   * Creates a detailed inspection output showing parsing results and raw elements
   */
  async createDetailedInspectionOutput(record: InspectionRecord): Promise<string> {
    const { data } = record;
    
    let output = '';
    output += `DETAILED INSPECTION REPORT\n`;
    output += `${'='.repeat(50)}\n\n`;
    
    // Basic Information
    output += `Inspection ID: ${record.id}\n`;
    output += `Timestamp: ${new Date(record.timestamp).toLocaleString()}\n`;
    output += `URL: ${data.url}\n`;
    output += `Page Title: ${data.pageTitle}\n\n`;
    
    // Check Results Summary
    output += `CHECK RESULTS SUMMARY\n`;
    output += `${'-'.repeat(25)}\n`;
    output += `Result Type: ${data.checkResult.type}\n`;
    output += `Total Appointments Found: ${data.checkResult.appointmentCount}\n`;
    output += `Available for Booking: ${data.checkResult.availableCount}\n`;
    output += `Filled/Unavailable: ${data.checkResult.filledCount}\n`;
    output += `Check Timestamp: ${new Date(data.checkResult.timestamp).toLocaleString()}\n\n`;
    
    // Detected Elements
    output += `DETECTED PAGE ELEMENTS\n`;
    output += `${'-'.repeat(25)}\n`;
    if (data.detectedElements.length > 0) {
      data.detectedElements.forEach((element, index) => {
        output += `${index + 1}. ${element}\n`;
      });
    } else {
      output += `No specific elements detected\n`;
    }
    output += `\n`;
    
    // Parsing Notes
    output += `PARSING ANALYSIS\n`;
    output += `${'-'.repeat(25)}\n`;
    output += `${data.parsingNotes}\n\n`;
    
    // Appointment Details
    if (data.checkResult.appointments.length > 0) {
      output += `APPOINTMENT BREAKDOWN\n`;
      output += `${'-'.repeat(25)}\n`;
      
      const availableAppointments = data.checkResult.appointments.filter(apt => apt.status === 'available');
      const filledAppointments = data.checkResult.appointments.filter(apt => apt.status === 'filled');
      
      if (availableAppointments.length > 0) {
        output += `\nAVAILABLE APPOINTMENTS (${availableAppointments.length}):\n`;
        availableAppointments.forEach((appointment, index) => {
          output += `  ${index + 1}. ${appointment.date} at ${appointment.time}\n`;
          output += `     Location: ${appointment.location}\n`;
          output += `     Exam Type: ${appointment.examType}\n`;
          output += `     City: ${appointment.city}\n`;
          if (appointment.registrationUrl) {
            output += `     Registration URL: ${appointment.registrationUrl}\n`;
          }
          output += `\n`;
        });
      }
      
      if (filledAppointments.length > 0) {
        output += `\nFILLED APPOINTMENTS (${filledAppointments.length}):\n`;
        filledAppointments.forEach((appointment, index) => {
          output += `  ${index + 1}. ${appointment.date} at ${appointment.time}\n`;
          output += `     Location: ${appointment.location}\n`;
          output += `     Status: FILLED/UNAVAILABLE\n`;
          output += `\n`;
        });
      }
    } else {
      output += `APPOINTMENT BREAKDOWN\n`;
      output += `${'-'.repeat(25)}\n`;
      output += `No appointments found for the specified criteria\n\n`;
    }
    
    // Raw HTML Analysis
    if (data.rawAppointmentHtml.length > 0) {
      output += `RAW HTML ANALYSIS\n`;
      output += `${'-'.repeat(25)}\n`;
      output += `Found ${data.rawAppointmentHtml.length} HTML snippet(s) for analysis:\n\n`;
      
      data.rawAppointmentHtml.forEach((html, index) => {
        output += `HTML Snippet ${index + 1}:\n`;
        output += `${'-'.repeat(15)}\n`;
        
        // Show first 300 characters of HTML
        const displayHtml = html.length > 300 ? html.substring(0, 300) + '\n... [truncated]' : html;
        output += `${displayHtml}\n\n`;
        
        // Basic HTML analysis
        const hasAvailableIndicators = html.includes('register') || html.includes('ثبت نام');
        const hasFilledIndicators = html.includes('تکمیل ظرفیت') || html.includes('filled');
        
        output += `Analysis:\n`;
        output += `  - Contains availability indicators: ${hasAvailableIndicators ? 'YES' : 'NO'}\n`;
        output += `  - Contains filled indicators: ${hasFilledIndicators ? 'YES' : 'NO'}\n`;
        output += `  - HTML length: ${html.length} characters\n\n`;
      });
    }
    
    output += `${'='.repeat(50)}\n`;
    output += `End of Detailed Inspection Report\n`;
    
    return output;
  }

  /**
   * Exports inspection data in various formats
   */
  async exportInspectionData(format: 'json' | 'text' | 'csv', limit?: number): Promise<string> {
    const records = await this.getAllInspectionRecords(limit);
    
    switch (format) {
      case 'json':
        return JSON.stringify(records, null, 2);
        
      case 'text':
        let textOutput = '';
        for (const record of records) {
          textOutput += this.formatInspectionSummary(record);
          textOutput += '\n' + '='.repeat(80) + '\n\n';
        }
        return textOutput;
        
      case 'csv':
        let csvOutput = 'ID,Timestamp,URL,PageTitle,CheckType,TotalAppointments,AvailableCount,FilledCount,ParsingNotes\n';
        for (const record of records) {
          const { data } = record;
          const csvRow = [
            record.id,
            record.timestamp,
            `"${data.url}"`,
            `"${data.pageTitle}"`,
            data.checkResult.type,
            data.checkResult.appointmentCount,
            data.checkResult.availableCount,
            data.checkResult.filledCount,
            `"${data.parsingNotes.replace(/"/g, '""')}"`
          ].join(',');
          csvOutput += csvRow + '\n';
        }
        return csvOutput;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Cleans up old inspection records based on age and count limits
   */
  async cleanupOldInspectionData(): Promise<number> {
    const filePath = this.getInspectionFilePath();
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const records: InspectionRecord[] = JSON.parse(data);
      
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - this.config.cleanupIntervalHours);
      
      // Keep records that are either recent or within the max count limit
      const recentRecords = records.filter((record, index) => {
        const recordTime = new Date(record.timestamp);
        return recordTime >= cutoffTime || index < this.config.maxInspectionRecords;
      });
      
      const removedCount = records.length - recentRecords.length;
      
      if (removedCount > 0) {
        await fs.writeFile(filePath, JSON.stringify(recentRecords, null, 2), 'utf-8');
      }
      
      return removedCount;
    } catch {
      return 0;
    }
  }

  /**
   * Gets inspection statistics
   */
  async getInspectionStats(): Promise<{
    totalRecords: number;
    latestInspection?: string;
    oldestInspection?: string;
    averageAppointmentsPerCheck: number;
    availabilityRate: number;
  }> {
    const records = await this.getAllInspectionRecords();
    
    if (records.length === 0) {
      return {
        totalRecords: 0,
        averageAppointmentsPerCheck: 0,
        availabilityRate: 0
      };
    }
    
    const timestamps = records.map(r => new Date(r.timestamp));
    const latestInspection = new Date(Math.max(...timestamps.map(t => t.getTime()))).toISOString();
    const oldestInspection = new Date(Math.min(...timestamps.map(t => t.getTime()))).toISOString();
    
    const totalAppointments = records.reduce((sum, record) => sum + record.data.checkResult.appointmentCount, 0);
    const totalAvailable = records.reduce((sum, record) => sum + record.data.checkResult.availableCount, 0);
    
    const averageAppointmentsPerCheck = totalAppointments / records.length;
    const availabilityRate = totalAppointments > 0 ? (totalAvailable / totalAppointments) * 100 : 0;
    
    return {
      totalRecords: records.length,
      latestInspection,
      oldestInspection,
      averageAppointmentsPerCheck: Math.round(averageAppointmentsPerCheck * 100) / 100,
      availabilityRate: Math.round(availabilityRate * 100) / 100
    };
  }

  /**
   * Clears all inspection data
   */
  async clearAllInspectionData(): Promise<void> {
    try {
      const filePath = this.getInspectionFilePath();
      await fs.unlink(filePath);
    } catch {
      // File doesn't exist
    }
  }
}