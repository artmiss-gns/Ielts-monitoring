import { spawn } from 'child_process';
import { MockHelpers } from './MockHelpers';

/**
 * Framework for testing CLI commands with standardized patterns
 */
export class CLITestFramework {
  private mockSetup: ReturnType<typeof MockHelpers.setupIntegrationTestMocks> | null = null;

  /**
   * Setup CLI test environment
   */
  setup() {
    this.mockSetup = MockHelpers.setupIntegrationTestMocks();
    return this.mockSetup;
  }

  /**
   * Cleanup CLI test environment
   */
  cleanup() {
    if (this.mockSetup) {
      this.mockSetup.restoreAll();
      this.mockSetup = null;
    }
  }

  /**
   * Execute a CLI command and capture output
   */
  async executeCommand(
    command: string,
    args: string[] = [],
    options: {
      timeout?: number;
      input?: string;
      env?: Record<string, string>;
      cwd?: string;
    } = {}
  ): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
  }> {
    const startTime = Date.now();
    const timeout = options.timeout || 5000;

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        env: { ...process.env, ...options.env },
        cwd: options.cwd || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle input if provided
      if (options.input) {
        child.stdin?.write(options.input);
        child.stdin?.end();
      }

      // Setup timeout
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        
        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
          duration
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Execute CLI command with mocked dependencies
   */
  async executeMockedCommand(
    commandModule: string,
    args: string[] = [],
    options: {
      mockScenario?: 'success' | 'error' | 'timeout' | 'partial-failure';
      expectedExitCode?: number;
      expectedOutput?: string | RegExp;
      expectedError?: string | RegExp;
    } = {}
  ) {
    // Setup mocks based on scenario
    const mocks = options.mockScenario 
      ? MockHelpers.createScenarioMocks(options.mockScenario)
      : this.mockSetup || MockHelpers.setupIntegrationTestMocks();

    try {
      // Mock process.argv to simulate CLI arguments
      const originalArgv = process.argv;
      process.argv = ['node', commandModule, ...args];

      // Capture console output
      const consoleMocks = MockHelpers.setupConsoleMocks();

      // Import and execute the command module
      await import(commandModule);
      
      // Restore process.argv
      process.argv = originalArgv;

      const result = {
        exitCode: mocks.process.mockProcess.exit.mock.calls.length > 0 
          ? mocks.process.mockProcess.exit.mock.calls[0][0] 
          : 0,
        stdout: consoleMocks.mockConsole.log.mock.calls.map(call => call.join(' ')).join('\n'),
        stderr: consoleMocks.mockConsole.error.mock.calls.map(call => call.join(' ')).join('\n'),
        duration: 100
      };

      // Validate expectations
      if (options.expectedExitCode !== undefined) {
        expect(result.exitCode).toBe(options.expectedExitCode);
      }

      if (options.expectedOutput) {
        if (typeof options.expectedOutput === 'string') {
          expect(result.stdout).toContain(options.expectedOutput);
        } else {
          expect(result.stdout).toMatch(options.expectedOutput);
        }
      }

      if (options.expectedError) {
        if (typeof options.expectedError === 'string') {
          expect(result.stderr).toContain(options.expectedError);
        } else {
          expect(result.stderr).toMatch(options.expectedError);
        }
      }

      consoleMocks.restore();
      return result;

    } finally {
      if (options.mockScenario) {
        mocks.restoreAll();
      }
    }
  }

  /**
   * Test interactive CLI prompts
   */
  async testInteractiveCommand(
    commandModule: string,
    interactions: Array<{
      prompt: string | RegExp;
      response: string;
      delay?: number;
    }>,
    options: {
      timeout?: number;
      expectedExitCode?: number;
    } = {}
  ) {
    MockHelpers.setupIntegrationTestMocks();
    
    // Mock readline for interactive prompts
    const mockReadline = {
      createInterface: jest.fn().mockReturnValue({
        question: jest.fn().mockImplementation((prompt, callback) => {
          const interaction = interactions.find(i => 
            typeof i.prompt === 'string' 
              ? prompt.includes(i.prompt)
              : i.prompt.test(prompt)
          );
          
          if (interaction) {
            setTimeout(() => callback(interaction.response), interaction.delay || 0);
          } else {
            callback('');
          }
        }),
        close: jest.fn()
      })
    };

    jest.doMock('readline', () => mockReadline);

    try {
      const result = await this.executeMockedCommand(commandModule, [], 
        options.expectedExitCode !== undefined ? { expectedExitCode: options.expectedExitCode } : {}
      );

      return result;
    } finally {
      jest.dontMock('readline');
    }
  }

  /**
   * Test CLI command with file system operations
   */
  async testCommandWithFiles(
    commandModule: string,
    args: string[] = [],
    fileOperations: {
      createFiles?: Record<string, string>;
      expectFiles?: string[];
      expectFileContents?: Record<string, string | RegExp>;
      expectFilesDeleted?: string[];
    } = {}
  ) {
    const mocks = this.mockSetup || MockHelpers.setupIntegrationTestMocks();

    // Setup initial files
    if (fileOperations.createFiles) {
      Object.entries(fileOperations.createFiles).forEach(([path, content]) => {
        mocks.fs.readFile = jest.fn().mockImplementation((filePath: string) => {
          return filePath === path ? Promise.resolve(content) : Promise.reject(new Error('File not found'));
        });
      });
    }

    const result = await this.executeMockedCommand(commandModule, args);

    // Verify file operations
    if (fileOperations.expectFiles) {
      fileOperations.expectFiles.forEach(filePath => {
        expect(mocks.fs.writeFile).toHaveBeenCalledWith(
          filePath,
          expect.any(String)
        );
      });
    }

    if (fileOperations.expectFileContents) {
      Object.entries(fileOperations.expectFileContents).forEach(([filePath, expectedContent]) => {
        const writeCall = mocks.fs.writeFile.mock.calls.find(call => call[0] === filePath);
        expect(writeCall).toBeDefined();
        
        if (typeof expectedContent === 'string') {
          expect(writeCall[1]).toContain(expectedContent);
        } else {
          expect(writeCall[1]).toMatch(expectedContent);
        }
      });
    }

    if (fileOperations.expectFilesDeleted) {
      fileOperations.expectFilesDeleted.forEach(filePath => {
        expect(mocks.fs.remove).toHaveBeenCalledWith(filePath);
      });
    }

    return result;
  }

  /**
   * Test CLI command error handling
   */
  async testCommandErrorHandling(
    commandModule: string,
    args: string[] = [],
    errorScenarios: Array<{
      mockError: () => void;
      expectedExitCode: number;
      expectedErrorMessage: string | RegExp;
    }>
  ) {
    const results = [];

    for (const scenario of errorScenarios) {
      const mocks = MockHelpers.setupIntegrationTestMocks();
      
      // Apply the error mock
      scenario.mockError();

      try {
        const result = await this.executeMockedCommand(commandModule, args, {
          expectedExitCode: scenario.expectedExitCode,
          expectedError: scenario.expectedErrorMessage
        });
        
        results.push(result);
      } finally {
        mocks.restoreAll();
      }
    }

    return results;
  }

  /**
   * Create a test suite for a CLI command
   */
  createCommandTestSuite(
    commandName: string,
    commandModule: string,
    testCases: Array<{
      name: string;
      args?: string[];
      setup?: () => void;
      expectations: {
        exitCode?: number;
        stdout?: string | RegExp;
        stderr?: string | RegExp;
        fileOperations?: {
          created?: string[];
          modified?: string[];
          deleted?: string[];
        };
      };
    }>
  ) {
    return describe(`CLI Command: ${commandName}`, () => {
      let framework: CLITestFramework;

      beforeEach(() => {
        framework = new CLITestFramework();
        framework.setup();
      });

      afterEach(() => {
        framework.cleanup();
      });

      testCases.forEach(testCase => {
        it(testCase.name, async () => {
          if (testCase.setup) {
            testCase.setup();
          }

          const executionOptions: any = {};
          if (testCase.expectations.exitCode !== undefined) {
            executionOptions.expectedExitCode = testCase.expectations.exitCode;
          }
          if (testCase.expectations.stdout !== undefined) {
            executionOptions.expectedOutput = testCase.expectations.stdout;
          }
          if (testCase.expectations.stderr !== undefined) {
            executionOptions.expectedError = testCase.expectations.stderr;
          }

          await framework.executeMockedCommand(
            commandModule,
            testCase.args || [],
            executionOptions
          );

          // Additional file operation checks
          if (testCase.expectations.fileOperations) {
            const mocks = framework.mockSetup!;
            
            if (testCase.expectations.fileOperations.created) {
              testCase.expectations.fileOperations.created.forEach(file => {
                expect(mocks.fs.writeFile).toHaveBeenCalledWith(file, expect.any(String));
              });
            }

            if (testCase.expectations.fileOperations.modified) {
              testCase.expectations.fileOperations.modified.forEach(file => {
                expect(mocks.fs.writeFile).toHaveBeenCalledWith(file, expect.any(String));
              });
            }

            if (testCase.expectations.fileOperations.deleted) {
              testCase.expectations.fileOperations.deleted.forEach(file => {
                expect(mocks.fs.remove).toHaveBeenCalledWith(file);
              });
            }
          }
        });
      });
    });
  }
}

/**
 * Utility functions for CLI testing
 */
export class CLITestUtils {
  /**
   * Parse CLI output into structured data
   */
  static parseOutput(output: string): {
    lines: string[];
    tables: string[][];
    json?: any;
  } {
    const lines = output.split('\n').filter(line => line.trim());
    
    // Try to parse as JSON
    let json;
    try {
      json = JSON.parse(output);
    } catch {
      // Not JSON, ignore
    }

    // Extract table-like structures (simple heuristic)
    const tables: string[][] = [];
    let currentTable: string[] = [];
    
    lines.forEach(line => {
      if (line.includes('|') || line.includes('\t')) {
        currentTable.push(line);
      } else if (currentTable.length > 0) {
        tables.push([...currentTable]);
        currentTable = [];
      }
    });
    
    if (currentTable.length > 0) {
      tables.push(currentTable);
    }

    return { lines, tables, json };
  }

  /**
   * Create mock CLI arguments
   */
  static createMockArgs(command: string, options: Record<string, any> = {}): string[] {
    const args = [command];
    
    Object.entries(options).forEach(([key, value]) => {
      if (typeof value === 'boolean' && value) {
        args.push(`--${key}`);
      } else if (value !== undefined && value !== false) {
        args.push(`--${key}`, String(value));
      }
    });

    return args;
  }

  /**
   * Validate CLI output format
   */
  static validateOutputFormat(
    output: string,
    format: 'json' | 'table' | 'text'
  ): boolean {
    switch (format) {
      case 'json':
        try {
          JSON.parse(output);
          return true;
        } catch {
          return false;
        }
      
      case 'table':
        return output.includes('|') || output.includes('\t');
      
      case 'text':
        return output.trim().length > 0;
      
      default:
        return false;
    }
  }
}