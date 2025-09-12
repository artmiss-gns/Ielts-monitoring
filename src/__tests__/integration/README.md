# End-to-End Integration Tests

This directory contains comprehensive integration tests for the IELTS Appointment Monitor application. These tests validate the complete monitoring workflows, error recovery mechanisms, and system performance under various conditions.

## Test Structure

### Core Test Files

1. **EndToEnd.integration.test.ts** - Complete monitoring session workflows
2. **MonitoringWorkflows.integration.test.ts** - Specific monitoring scenarios
3. **ErrorRecovery.integration.test.ts** - Error handling and recovery testing
4. **BasicIntegration.test.ts** - Basic functionality validation

### Supporting Files

1. **MockIELTSServer.ts** - Mock server simulating the IELTS website
2. **TestDataFactory.ts** - Factory for creating test data and configurations
3. **PerformanceTestUtils.ts** - Utilities for performance and memory testing
4. **setup.ts** - Test environment setup and configuration

## Test Categories

### 1. Complete Monitoring Sessions
- Full monitoring lifecycle (start → monitor → detect → notify → stop)
- Pause and resume functionality
- Configuration persistence and state management
- Session statistics tracking

### 2. Appointment Detection Workflows
- New appointment detection and notification
- Filter-based appointment filtering (city, exam type, month)
- Appointment change detection algorithms
- Multi-channel notification delivery

### 3. Error Recovery Scenarios
- Network failure recovery (timeouts, connection errors)
- HTML parsing error handling
- File system error recovery
- Service failure recovery
- Cascading error scenarios

### 4. Performance Testing
- Memory usage monitoring during extended sessions
- High-frequency check efficiency
- Concurrent operation handling
- Memory leak detection

## Mock Server Features

The `MockIELTSServer` provides:
- Configurable appointment data
- Failure simulation (network, parsing, timeout)
- Response delay simulation
- Request tracking and statistics
- Admin endpoints for test control

## Running Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npx jest src/__tests__/integration/EndToEnd.integration.test.ts

# Run with verbose output
VERBOSE_TESTS=1 npm run test:integration

# Run with coverage
npm run test:coverage
```

## Test Configuration

- **Timeout**: 60 seconds for integration tests
- **Execution**: Sequential (`--runInBand`) to avoid port conflicts
- **Mocking**: External dependencies (puppeteer, node-notifier) are mocked
- **Cleanup**: Automatic cleanup of test data and mock servers

## Performance Assertions

Tests include performance assertions for:
- Maximum memory growth (50MB during extended monitoring)
- Peak memory usage (200MB limit)
- Memory efficiency (10MB/s growth rate limit)
- Check frequency (minimum 5 checks per second)

## Error Scenarios Tested

1. **Network Errors**
   - Connection timeouts
   - DNS resolution failures
   - HTTP 500 errors
   - Intermittent connectivity issues

2. **Parsing Errors**
   - Invalid HTML structure
   - Missing appointment data
   - Malformed response content

3. **File System Errors**
   - Permission denied (EACCES)
   - Disk space full (ENOSPC)
   - File locking issues

4. **Service Errors**
   - Notification service failures
   - Configuration validation errors
   - Multiple simultaneous failures

## Test Data Management

- Temporary test directories are created and cleaned up automatically
- Mock server state is reset between tests
- Configuration files are isolated per test
- No persistent data is left after test completion

## Validation Coverage

These integration tests validate all requirements from the specification:

- **Requirement 1**: Automated monitoring and immediate notifications
- **Requirement 2**: Configurable search criteria and filtering
- **Requirement 3**: Multi-channel notification delivery
- **Requirement 4**: Status monitoring and history tracking
- **Requirement 5**: Monitoring process control (start/pause/stop)

## Extending Tests

To add new integration tests:

1. Create test file in this directory with `.integration.test.ts` suffix
2. Use `MockIELTSServer` for simulating website responses
3. Use `TestDataFactory` for creating test data
4. Use `PerformanceTestUtils` for performance validation
5. Follow existing patterns for setup/teardown and error handling

## Troubleshooting

Common issues and solutions:

- **Port conflicts**: Tests use different ports (3001-3004) to avoid conflicts
- **Timeout errors**: Increase test timeout if needed for slower systems
- **Memory issues**: Run tests with `--runInBand` to prevent parallel execution
- **Mock issues**: Ensure all external dependencies are properly mocked