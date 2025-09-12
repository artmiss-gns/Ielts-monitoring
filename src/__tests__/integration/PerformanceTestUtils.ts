/**
 * Memory usage snapshot
 */
interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

/**
 * Performance metrics
 */
interface PerformanceMetrics {
  duration: number;
  memoryGrowth: number;
  peakMemory: number;
  averageMemory: number;
  checksPerSecond: number;
  memoryEfficiency: number;
}

/**
 * Performance testing utilities for monitoring memory usage and efficiency
 */
export class PerformanceTestUtils {
  private static readonly MB = 1024 * 1024;



  /**
   * Take a memory snapshot
   */
  static takeMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    return {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    };
  }

  /**
   * Format memory size in MB
   */
  static formatMemory(bytes: number): string {
    return `${(bytes / this.MB).toFixed(2)} MB`;
  }

  /**
   * Monitor memory usage during a test function
   */
  static async monitorMemoryUsage<T>(
    testFunction: () => Promise<T>,
    options?: {
      sampleInterval?: number;
      maxSamples?: number;
    }
  ): Promise<{
    result: T;
    metrics: PerformanceMetrics;
    snapshots: MemorySnapshot[];
  }> {
    const sampleInterval = options?.sampleInterval || 100; // 100ms
    const maxSamples = options?.maxSamples || 1000;
    
    const snapshots: MemorySnapshot[] = [];
    const startTime = Date.now();
    let sampleCount = 0;
    
    // Take initial snapshot
    snapshots.push(this.takeMemorySnapshot());
    
    // Start memory monitoring
    const monitoringInterval = setInterval(() => {
      if (sampleCount < maxSamples) {
        snapshots.push(this.takeMemorySnapshot());
        sampleCount++;
      }
    }, sampleInterval);

    try {
      // Execute test function
      const result = await testFunction();
      
      // Stop monitoring
      clearInterval(monitoringInterval);
      
      // Take final snapshot
      snapshots.push(this.takeMemorySnapshot());
      
      // Calculate metrics
      const endTime = Date.now();
      const metrics = this.calculateMetrics(snapshots, startTime, endTime);
      
      return { result, metrics, snapshots };
    } catch (error) {
      clearInterval(monitoringInterval);
      throw error;
    }
  }

  /**
   * Calculate performance metrics from snapshots
   */
  private static calculateMetrics(
    snapshots: MemorySnapshot[],
    startTime: number,
    endTime: number
  ): PerformanceMetrics {
    if (snapshots.length < 2) {
      throw new Error('Need at least 2 snapshots to calculate metrics');
    }

    const duration = endTime - startTime;
    const initialMemory = snapshots[0].heapUsed;
    const finalMemory = snapshots[snapshots.length - 1].heapUsed;
    const memoryGrowth = finalMemory - initialMemory;
    
    const peakMemory = Math.max(...snapshots.map(s => s.heapUsed));
    const averageMemory = snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / snapshots.length;
    
    // Estimate checks per second (this would need to be provided by the test)
    const checksPerSecond = 0; // Placeholder - would be calculated based on actual checks
    
    // Memory efficiency: lower is better (memory growth per second)
    const memoryEfficiency = memoryGrowth / (duration / 1000);

    return {
      duration,
      memoryGrowth,
      peakMemory,
      averageMemory,
      checksPerSecond,
      memoryEfficiency
    };
  }

  /**
   * Assert memory usage is within acceptable limits
   */
  static assertMemoryLimits(
    metrics: PerformanceMetrics,
    limits: {
      maxMemoryGrowthMB?: number;
      maxPeakMemoryMB?: number;
      maxMemoryEfficiencyMBPerSecond?: number;
    }
  ): void {
    if (limits.maxMemoryGrowthMB !== undefined) {
      const growthMB = metrics.memoryGrowth / this.MB;
      if (growthMB > limits.maxMemoryGrowthMB) {
        throw new Error(
          `Memory growth ${this.formatMemory(metrics.memoryGrowth)} exceeds limit of ${limits.maxMemoryGrowthMB} MB`
        );
      }
    }

    if (limits.maxPeakMemoryMB !== undefined) {
      const peakMB = metrics.peakMemory / this.MB;
      if (peakMB > limits.maxPeakMemoryMB) {
        throw new Error(
          `Peak memory ${this.formatMemory(metrics.peakMemory)} exceeds limit of ${limits.maxPeakMemoryMB} MB`
        );
      }
    }

    if (limits.maxMemoryEfficiencyMBPerSecond !== undefined) {
      const efficiencyMB = metrics.memoryEfficiency / this.MB;
      if (efficiencyMB > limits.maxMemoryEfficiencyMBPerSecond) {
        throw new Error(
          `Memory efficiency ${efficiencyMB.toFixed(2)} MB/s exceeds limit of ${limits.maxMemoryEfficiencyMBPerSecond} MB/s`
        );
      }
    }
  }

  /**
   * Create a performance report
   */
  static createPerformanceReport(
    testName: string,
    metrics: PerformanceMetrics,
    snapshots: MemorySnapshot[]
  ): string {
    const report = [
      `Performance Report: ${testName}`,
      `Duration: ${metrics.duration}ms`,
      `Memory Growth: ${this.formatMemory(metrics.memoryGrowth)}`,
      `Peak Memory: ${this.formatMemory(metrics.peakMemory)}`,
      `Average Memory: ${this.formatMemory(metrics.averageMemory)}`,
      `Memory Efficiency: ${(metrics.memoryEfficiency / this.MB).toFixed(2)} MB/s`,
      `Snapshots Taken: ${snapshots.length}`,
      ''
    ];

    // Add memory timeline (first, middle, last snapshots)
    if (snapshots.length >= 3) {
      const first = snapshots[0];
      const middle = snapshots[Math.floor(snapshots.length / 2)];
      const last = snapshots[snapshots.length - 1];

      report.push('Memory Timeline:');
      report.push(`Start:  ${this.formatMemory(first.heapUsed)}`);
      report.push(`Middle: ${this.formatMemory(middle.heapUsed)}`);
      report.push(`End:    ${this.formatMemory(last.heapUsed)}`);
    }

    return report.join('\n');
  }

  /**
   * Wait for a specified duration
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Force garbage collection if available
   */
  static forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Measure execution time of a function
   */
  static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{
    result: T;
    executionTime: number;
  }> {
    const startTime = process.hrtime.bigint();
    const result = await fn();
    const endTime = process.hrtime.bigint();
    
    const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    return { result, executionTime };
  }
}