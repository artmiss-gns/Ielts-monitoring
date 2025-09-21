module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  projects: [
    {
      displayName: 'unit',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.test.ts',
        '<rootDir>/src/**/?(*.)(spec|test).ts'
      ],
      testPathIgnorePatterns: [
        '/src/__tests__/integration/',
        '.*\\.integration\\.test\\.ts'
      ],
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      moduleNameMapper: {
        '^chalk$': '<rootDir>/src/__tests__/__mocks__/chalk.js'
      },
      transformIgnorePatterns: [
        'node_modules/(?!(chalk)/)'
      ],
      // Optimize test execution
      maxWorkers: '50%',
      testTimeout: 10000,
      // Improve error handling
      errorOnDeprecated: true,
      // Better test isolation
      clearMocks: true,
      restoreMocks: true
    },
    {
      displayName: 'integration',
      testMatch: [
        '<rootDir>/src/__tests__/integration/**/*.test.ts',
        '<rootDir>/src/**/*.integration.test.ts'
      ],
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      moduleNameMapper: {
        '^chalk$': '<rootDir>/src/__tests__/__mocks__/chalk.js'
      },
      transformIgnorePatterns: [
        'node_modules/(?!(chalk)/)'
      ],
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/integration/setup.ts'],
      testTimeout: 60000,
      // Optimize integration test execution
      maxWorkers: 1, // Run integration tests sequentially to avoid conflicts
      // Better cleanup
      clearMocks: true,
      restoreMocks: true
    }
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/__tests__/**',
    '!src/**/types.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  // Enhanced coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  // Improve test performance
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  // Better error reporting
  verbose: false,
  silent: false,
  // Detect open handles to prevent hanging tests
  detectOpenHandles: true,
  forceExit: true
};