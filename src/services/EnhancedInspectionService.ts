import { promises as fs } from 'fs';
import path from 'path';
import { 
  EnhancedInspectionData, 
  StatusDetectionResult, 
  StatusIndicator, 
  DetectionStrategy,
  EnhancedAppointment,
  Appointment
} from '../models/types';

/**
 * Enhanced inspection service with detailed status detection reasoning
 * Implements Requirements 2.1, 2.2, 2.3, 2.4, 6.1, 6.2, 6.4
 */
export class EnhancedInspectionService {
  private config: {
    dataDirectory: string;
    inspectionFile: string;
    maxInspectionRecords: number;
    enableRawHtmlCapture: boolean;
    enablePerformanceMetrics: boolean;
  };

  constructor(config?: Partial<typeof EnhancedInspectionService.prototype.config>) {
    this.config = {
      dataDirectory: 'data',
      inspectionFile: 'enhanced-inspection-data.json',
      maxInspectionRecords: 100,
      enableRawHtmlCapture: true,
      enablePerformanceMetrics: true,
      ...config
    };
  }

  /**
   * Creates detailed status detection result with reasoning
   * Requirement 2.2: Record specific indicators that led to decisions
   */
  createStatusDetectionResult(
    finalStatus: string,
    indicators: StatusIndicator[],
    reasoning: string,
    confidence: number,
    fallbackUsed: boolean = false
  ): StatusDetectionResult {
    return {
      status: finalStatus as any,
      confidence,
      indicators,
      reasoning,
      fallbackUsed
    };
  }

  /**
   * Creates status indicator with detailed metadata
   */
  createStatusIndicator(
    type: 'css-class' | 'text-content' | 'interactive-element' | 'contextual',
    value: string,
    weight: number,
    source: 'element' | 'sibling' | 'parent'
  ): StatusIndicator {
    return { type, value, weight, source };
  }

  /**
   * Logs detailed parsing decision for each element
   * Requirement 2.1: Log detailed parsing decisions for each element
   */
  logParsingDecision(
    elementIndex: number,
    elementHtml: string,
    statusResult: StatusDetectionResult,
    parsingNotes: string[]
  ): {
    elementIndex: number;
    finalStatus: string;
    indicators: StatusIndicator[];
    reasoning: string;
    confidenceScore: number;
    rawHtml: string;
    parsingNotes: string[];
  } {
    return {
      elementIndex,
      finalStatus: statusResult.status,
      indicators: statusResult.indicators,
      reasoning: statusResult.reasoning,
      confidenceScore: statusResult.confidence,
      rawHtml: this.config.enableRawHtmlCapture ? elementHtml : '',
      parsingNotes
    };
  }

  /**
   * Captures raw HTML of problematic elements for debugging
   * Requirement 2.3: Capture raw HTML and context for debugging
   */
  captureProblematicElement(
    elementHtml: string,
    error: string,
    context: string,
    elementIndex?: number
  ): {
    timestamp: Date;
    error: string;
    context: string;
    elementIndex?: number;
    rawHtml?: string;
  } {
    const result: {
      timestamp: Date;
      error: string;
      context: string;
      elementIndex?: number;
      rawHtml?: string;
    } = {
      timestamp: new Date(),
      error,
      context
    };
    
    if (elementIndex !== undefined) {
      result.elementIndex = elementIndex;
    }
    
    if (this.config.enableRawHtmlCapture) {
      result.rawHtml = elementHtml;
    }
    
    return result;
  }

  /**
   * Creates detection strategy result with performance metrics
   */
  createDetectionStrategy(
    name: string,
    priority: number,
    selectors: string[],
    elementsFound: number,
    processingTime: number
  ): DetectionStrategy {
    return {
      name,
      priority,
      selectors,
      elementsFound,
      successRate: elementsFound > 0 ? 1.0 : 0.0,
      processingTime
    };
  }

  /**
   * Validates detection accuracy and creates validation checks
   * Requirement 6.4: Document decision-making process and fallback logic
   */
  validateDetectionAccuracy(
    appointments: EnhancedAppointment[],
    detectionStrategies: DetectionStrategy[]
  ): {
    check: string;
    passed: boolean;
    details: string;
  }[] {
    const validationChecks = [];

    // Check 1: Verify appointments have valid status
    const validStatuses = ['available', 'filled', 'pending', 'not-registerable', 'unknown'];
    const invalidStatusCount = appointments.filter(apt => !validStatuses.includes(apt.status)).length;
    validationChecks.push({
      check: 'Valid Status Assignment',
      passed: invalidStatusCount === 0,
      details: invalidStatusCount === 0 
        ? 'All appointments have valid status values'
        : `${invalidStatusCount} appointments have invalid status values`
    });

    // Check 2: Verify confidence scores are reasonable
    const lowConfidenceCount = appointments.filter(apt => apt.confidenceScore < 0.3).length;
    validationChecks.push({
      check: 'Confidence Score Validation',
      passed: lowConfidenceCount === 0,
      details: lowConfidenceCount === 0
        ? 'All appointments have reasonable confidence scores'
        : `${lowConfidenceCount} appointments have low confidence scores (<0.3)`
    });

    // Check 3: Verify detection strategies were successful
    const successfulStrategies = detectionStrategies.filter(strategy => strategy.elementsFound > 0);
    validationChecks.push({
      check: 'Detection Strategy Success',
      passed: successfulStrategies.length > 0,
      details: successfulStrategies.length > 0
        ? `${successfulStrategies.length} detection strategies found elements`
        : 'No detection strategies found any elements'
    });

    // Check 4: Verify appointments have required data
    const incompleteAppointments = appointments.filter(apt => 
      !apt.date || !apt.time || !apt.location || !apt.examType
    ).length;
    validationChecks.push({
      check: 'Complete Appointment Data',
      passed: incompleteAppointments === 0,
      details: incompleteAppointments === 0
        ? 'All appointments have complete data'
        : `${incompleteAppointments} appointments are missing required data`
    });

    // Check 5: Verify status indicators are present
    const appointmentsWithoutIndicators = appointments.filter(apt => 
      !apt.statusIndicators || apt.statusIndicators.length === 0
    ).length;
    validationChecks.push({
      check: 'Status Indicators Present',
      passed: appointmentsWithoutIndicators === 0,
      details: appointmentsWithoutIndicators === 0
        ? 'All appointments have status indicators'
        : `${appointmentsWithoutIndicators} appointments lack status indicators`
    });

    return validationChecks;
  }

  /**
   * Creates comprehensive inspection report with detailed reasoning
   * Requirement 2.4: Provide summary of detection patterns and results
   */
  createInspectionReport(
    url: string,
    pageTitle: string,
    appointments: EnhancedAppointment[],
    detectionStrategies: DetectionStrategy[],
    statusDecisions: any[],
    selectorResults: any[],
    errorLog: any[],
    performanceMetrics: any
  ): EnhancedInspectionData {
    const validationChecks = this.validateDetectionAccuracy(appointments, detectionStrategies);

    // Create basic inspection data
    const basicInspectionData = {
      url,
      pageTitle,
      detectedElements: selectorResults.map(result => 
        `${result.selector} (${result.elementCount} elements, strategy: ${result.strategy})`
      ),
      parsingNotes: this.generateParsingNotesSummary(statusDecisions, errorLog),
      rawAppointmentHtml: appointments.map(apt => apt.rawHtml || ''),
      checkResult: {
        type: this.determineCheckResultType(appointments),
        appointmentCount: appointments.length,
        availableCount: appointments.filter(apt => apt.status === 'available').length,
        filledCount: appointments.filter(apt => apt.status === 'filled').length,
        timestamp: new Date(),
        url,
        appointments: appointments.map(apt => ({
          id: apt.id,
          date: apt.date,
          time: apt.time,
          location: apt.location,
          examType: apt.examType,
          city: apt.city,
          status: apt.status,
          ...(apt.price !== undefined && { price: apt.price }),
          ...(apt.registrationUrl !== undefined && { registrationUrl: apt.registrationUrl }),
          ...(apt.rawHtml !== undefined && { rawHtml: apt.rawHtml })
        } as Appointment))
      }
    };

    // Enhanced inspection data
    return {
      ...basicInspectionData,
      detectionStrategies,
      statusDecisions,
      selectorResults,
      validationChecks,
      errorLog,
      performanceMetrics
    };
  }

  /**
   * Generates parsing notes summary from status decisions and errors
   */
  private generateParsingNotesSummary(statusDecisions: any[], errorLog: any[]): string {
    const notes = [];
    
    // Summary of status decisions
    const statusCounts = statusDecisions.reduce((counts, decision) => {
      counts[decision.finalStatus] = (counts[decision.finalStatus] || 0) + 1;
      return counts;
    }, {});
    
    notes.push(`Status Detection Summary: ${Object.entries(statusCounts)
      .map(([status, count]) => `${status}=${count}`)
      .join(', ')}`);

    // High confidence decisions
    const highConfidenceDecisions = statusDecisions.filter(d => d.confidenceScore >= 0.8);
    notes.push(`High Confidence Decisions: ${highConfidenceDecisions.length}/${statusDecisions.length}`);

    // Fallback usage
    const fallbackDecisions = statusDecisions.filter(d => 
      d.reasoning.includes('defaulting') || d.reasoning.includes('fallback')
    );
    if (fallbackDecisions.length > 0) {
      notes.push(`Fallback Logic Used: ${fallbackDecisions.length} decisions`);
    }

    // Error summary
    if (errorLog.length > 0) {
      notes.push(`Errors Encountered: ${errorLog.length} parsing errors`);
    }

    return notes.join('; ');
  }

  /**
   * Determines check result type based on appointments
   */
  private determineCheckResultType(appointments: EnhancedAppointment[]): 'available' | 'filled' | 'no-slots' {
    if (appointments.length === 0) {
      return 'no-slots';
    }
    
    const availableCount = appointments.filter(apt => apt.status === 'available').length;
    return availableCount > 0 ? 'available' : 'filled';
  }

  /**
   * Saves enhanced inspection data with detailed reasoning
   */
  async saveEnhancedInspectionData(inspectionData: EnhancedInspectionData): Promise<string> {
    await this.ensureDataDirectory();
    
    const record = {
      id: this.generateInspectionId(),
      timestamp: new Date().toISOString(),
      data: inspectionData
    };

    const filePath = this.getInspectionFilePath();
    let records = [];

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
   * Formats detailed inspection report for display
   * Requirement 6.1: Provide decision details for each appointment including reasoning
   */
  formatDetailedInspectionReport(inspectionData: EnhancedInspectionData): string {
    let report = '';
    
    report += `\n=== ENHANCED INSPECTION REPORT ===\n`;
    report += `URL: ${inspectionData.url}\n`;
    report += `Page Title: ${inspectionData.pageTitle}\n`;
    report += `Timestamp: ${new Date().toLocaleString()}\n`;
    
    // Detection Strategies Summary
    report += `\n--- DETECTION STRATEGIES ---\n`;
    inspectionData.detectionStrategies.forEach((strategy, index) => {
      report += `${index + 1}. ${strategy.name} (Priority: ${strategy.priority})\n`;
      report += `   Selectors: ${strategy.selectors.join(', ')}\n`;
      report += `   Elements Found: ${strategy.elementsFound}\n`;
      report += `   Success Rate: ${(strategy.successRate * 100).toFixed(1)}%\n`;
      report += `   Processing Time: ${strategy.processingTime}ms\n`;
    });

    // Status Decisions Detail
    report += `\n--- STATUS DETECTION DECISIONS ---\n`;
    inspectionData.statusDecisions.forEach((decision, index) => {
      report += `${index + 1}. Element ${decision.elementIndex}\n`;
      report += `   Final Status: ${decision.finalStatus.toUpperCase()}\n`;
      report += `   Confidence: ${(decision.confidenceScore * 100).toFixed(1)}%\n`;
      report += `   Reasoning: ${decision.reasoning}\n`;
      report += `   Indicators Found:\n`;
      decision.indicators.forEach((indicator: StatusIndicator) => {
        report += `     - ${indicator.type}: "${indicator.value}" (weight: ${indicator.weight}, source: ${indicator.source})\n`;
      });
      if (decision.rawHtml && decision.rawHtml.length > 0) {
        const truncatedHtml = decision.rawHtml.length > 150 
          ? decision.rawHtml.substring(0, 150) + '...'
          : decision.rawHtml;
        report += `   Raw HTML: ${truncatedHtml}\n`;
      }
      report += `\n`;
    });

    // Validation Results
    report += `--- VALIDATION CHECKS ---\n`;
    inspectionData.validationChecks.forEach((check, index) => {
      const status = check.passed ? '✅ PASS' : '❌ FAIL';
      report += `${index + 1}. ${check.check}: ${status}\n`;
      report += `   Details: ${check.details}\n`;
    });

    // Error Log
    if (inspectionData.errorLog.length > 0) {
      report += `\n--- ERROR LOG ---\n`;
      inspectionData.errorLog.forEach((error, index) => {
        report += `${index + 1}. ${new Date(error.timestamp).toLocaleString()}\n`;
        report += `   Error: ${error.error}\n`;
        report += `   Context: ${error.context}\n`;
        if (error.elementIndex !== undefined) {
          report += `   Element Index: ${error.elementIndex}\n`;
        }
      });
    }

    // Performance Metrics
    if (inspectionData.performanceMetrics) {
      report += `\n--- PERFORMANCE METRICS ---\n`;
      const metrics = inspectionData.performanceMetrics;
      report += `Total Processing Time: ${metrics.totalProcessingTime}ms\n`;
      report += `Element Detection Time: ${metrics.elementDetectionTime}ms\n`;
      report += `Status Detection Time: ${metrics.statusDetectionTime}ms\n`;
      report += `Parsing Time: ${metrics.parsingTime}ms\n`;
    }

    report += `\n=== END ENHANCED INSPECTION ===\n`;
    return report;
  }

  /**
   * Creates error report when appointments are missed
   * Requirement 2.4: Create better error reporting when appointments are missed
   */
  createMissedAppointmentReport(
    expectedAppointments: number,
    foundAppointments: number,
    detectionStrategies: DetectionStrategy[],
    errorLog: any[]
  ): string {
    let report = '';
    
    report += `\n=== MISSED APPOINTMENT ANALYSIS ===\n`;
    report += `Expected Appointments: ${expectedAppointments}\n`;
    report += `Found Appointments: ${foundAppointments}\n`;
    report += `Missed Appointments: ${expectedAppointments - foundAppointments}\n`;
    
    report += `\n--- DETECTION STRATEGY ANALYSIS ---\n`;
    detectionStrategies.forEach((strategy, index) => {
      report += `${index + 1}. ${strategy.name}\n`;
      report += `   Success Rate: ${(strategy.successRate * 100).toFixed(1)}%\n`;
      report += `   Elements Found: ${strategy.elementsFound}\n`;
      if (strategy.elementsFound === 0) {
        report += `   ⚠️  This strategy found no elements - potential issue\n`;
      }
    });

    if (errorLog.length > 0) {
      report += `\n--- PARSING ERRORS ---\n`;
      errorLog.forEach((error, index) => {
        report += `${index + 1}. ${error.error}\n`;
        report += `   Context: ${error.context}\n`;
      });
    }

    report += `\n--- RECOMMENDATIONS ---\n`;
    if (detectionStrategies.every(s => s.elementsFound === 0)) {
      report += `- No elements found by any strategy - website structure may have changed\n`;
      report += `- Consider updating selectors or adding new detection strategies\n`;
    }
    
    if (errorLog.length > 0) {
      report += `- ${errorLog.length} parsing errors occurred - review element structure\n`;
    }

    const lowSuccessStrategies = detectionStrategies.filter(s => s.successRate < 0.5);
    if (lowSuccessStrategies.length > 0) {
      report += `- ${lowSuccessStrategies.length} strategies have low success rates - consider optimization\n`;
    }

    report += `\n=== END MISSED APPOINTMENT ANALYSIS ===\n`;
    return report;
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
    return `enhanced_inspection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}