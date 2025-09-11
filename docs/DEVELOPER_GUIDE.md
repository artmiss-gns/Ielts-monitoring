# Developer Guide

This guide provides comprehensive information for developers who want to understand, modify, or extend the IELTS Appointment Monitor application.

## 🏗️ Architecture Overview

The application follows a modular architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Layer     │    │  Service Layer  │    │   Data Layer    │
│                 │    │                 │    │                 │
│ • Commands      │───▶│ • Monitor       │───▶│ • Models        │
│ • User Input    │    │ • Scraper       │    │ • Storage       │
│ • Output        │    │ • Notifier      │    │ • Config        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Components

1. **CLI Layer** (`src/cli/`): Command-line interface and user interaction
2. **Service Layer** (`src/services/`): Business logic and core functionality  
3. **Data Layer** (`src/models/`): Data structures and persistence
4. **Utilities** (`src/utils/`): Shared utilities and helpers

## 📁 Project Structure

```
src/
├── cli/                    # Command-line interface
│   ├── index.ts           # Main CLI entry point
│   ├── commands/          # Individual CLI commands
│   │   ├── start.ts       # Start monitoring command
│   │   ├── stop.ts        # Stop monitoring command
│   │   ├── status.ts      # Status command
│   │   ├── configure.ts   # Configuration command
│   │   └── logs.ts        # Logs command
│   └── utils/             # CLI-specific utilities
│       ├── output.ts      # Colored output formatting
│       └── validation.ts  # Input validation
│
├── services/              # Core business logic
│   ├── MonitorService.ts  # Main monitoring orchestration
│   ├── ScraperService.ts  # Web scraping functionality
│   ├── NotificationService.ts # Notification handling
│   ├── ConfigService.ts   # Configuration management
│   └── StorageService.ts  # Data persistence
│
├── models/                # Data models and types
│   ├── Appointment.ts     # Appointment data structure
│   ├── Configuration.ts   # Configuration schema
│   ├── MonitorStatus.ts   # Monitoring status types
│   └── NotificationTypes.ts # Notification type definitions
│
├── utils/                 # Shared utilities
│   ├── logger.ts          # Logging utilities
│   ├── fileUtils.ts       # File system operations
│   ├── dateUtils.ts       # Date/time utilities
│   └── validators.ts      # Data validation functions
│
└── index.ts               # Application entry point
```

## 🔧 Core Services

### MonitorService

The central orchestrator that coordinates all monitoring activities.

**Key Responsibilities:**
- Manages monitoring lifecycle (start/stop/pause/resume)
- Coordinates scraping and notification services
- Handles error recovery and retry logic
- Maintains monitoring statistics

**Extension Points:**
```typescript
interface IMonitorService {
  start(config: Configuration): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getStatus(): MonitorStatus;
}
```

### ScraperService

Handles web scraping of the IELTS appointment website.

**Key Responsibilities:**
- Fetches appointment data from irsafam.org
- Parses HTML and extracts appointment information
- Handles rate limiting and request throttling
- Manages browser automation with Puppeteer

**Extension Points:**
```typescript
interface IScraperService {
  scrapeAppointments(criteria: SearchCriteria): Promise<Appointment[]>;
  isWebsiteAccessible(): Promise<boolean>;
  updateUserAgent(userAgent: string): void;
}
```

### NotificationService

Manages all notification channels and delivery.

**Key Responsibilities:**
- Sends desktop notifications
- Plays audio alerts
- Writes to log files
- Manages notification preferences

**Extension Points:**
```typescript
interface INotificationService {
  sendNotification(appointment: Appointment): Promise<void>;
  registerChannel(channel: INotificationChannel): void;
  testNotifications(): Promise<boolean>;
}
```

## 🔌 Extension Points

### Adding New Notification Channels

To add a new notification channel (e.g., email, SMS, Slack):

1. **Create Channel Interface Implementation:**
```typescript
// src/services/notifications/EmailNotificationChannel.ts
import { INotificationChannel } from '../interfaces/INotificationChannel';

export class EmailNotificationChannel implements INotificationChannel {
  async send(appointment: Appointment): Promise<void> {
    // Implementation for email notifications
  }
  
  async test(): Promise<boolean> {
    // Test email configuration
  }
}
```

2. **Register Channel in NotificationService:**
```typescript
// src/services/NotificationService.ts
import { EmailNotificationChannel } from './notifications/EmailNotificationChannel';

export class NotificationService {
  constructor() {
    this.registerChannel(new EmailNotificationChannel());
  }
}
```

3. **Update Configuration Schema:**
```typescript
// src/models/Configuration.ts
export interface NotificationSettings {
  desktop: boolean;
  audio: boolean;
  logFile: boolean;
  email?: EmailSettings; // Add new channel
}
```

### Adding New Scraping Targets

To support additional websites or appointment types:

1. **Create Scraper Implementation:**
```typescript
// src/services/scrapers/NewWebsiteScraper.ts
import { IAppointmentScraper } from '../interfaces/IAppointmentScraper';

export class NewWebsiteScraper implements IAppointmentScraper {
  async scrape(criteria: SearchCriteria): Promise<Appointment[]> {
    // Implementation for new website
  }
}
```

2. **Register in ScraperService:**
```typescript
// src/services/ScraperService.ts
export class ScraperService {
  private scrapers: Map<string, IAppointmentScraper> = new Map();
  
  constructor() {
    this.scrapers.set('irsafam', new IrsafamScraper());
    this.scrapers.set('newsite', new NewWebsiteScraper());
  }
}
```

### Adding New CLI Commands

To add new CLI commands:

1. **Create Command File:**
```typescript
// src/cli/commands/newCommand.ts
import { Command } from 'commander';

export function createNewCommand(): Command {
  return new Command('new-command')
    .description('Description of new command')
    .option('-o, --option <value>', 'Command option')
    .action(async (options) => {
      // Command implementation
    });
}
```

2. **Register in Main CLI:**
```typescript
// src/cli/index.ts
import { createNewCommand } from './commands/newCommand';

program.addCommand(createNewCommand());
```

## 🧪 Testing Strategy

### Test Structure

```
__tests__/
├── unit/                  # Unit tests
│   ├── services/         # Service layer tests
│   ├── models/           # Model tests
│   └── utils/            # Utility tests
├── integration/          # Integration tests
│   ├── cli/              # CLI integration tests
│   └── services/         # Service integration tests
└── fixtures/             # Test data and mocks
    ├── appointments.json # Sample appointment data
    └── configs.json      # Test configurations
```

### Writing Tests

**Unit Test Example:**
```typescript
// __tests__/unit/services/NotificationService.test.ts
import { NotificationService } from '../../../src/services/NotificationService';
import { Appointment } from '../../../src/models/Appointment';

describe('NotificationService', () => {
  let service: NotificationService;
  
  beforeEach(() => {
    service = new NotificationService();
  });
  
  it('should send desktop notification', async () => {
    const appointment = new Appointment(/* test data */);
    await expect(service.sendNotification(appointment)).resolves.not.toThrow();
  });
});
```

**Integration Test Example:**
```typescript
// __tests__/integration/cli/start.test.ts
import { execSync } from 'child_process';

describe('CLI Start Command', () => {
  it('should start monitoring with valid config', () => {
    const result = execSync('node dist/cli/index.js start --config test-config.json');
    expect(result.toString()).toContain('Monitoring started');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🔍 Debugging

### Debug Configuration

The application uses the `debug` package for structured logging:

```typescript
// Enable debug output
DEBUG=ielts:* npm start

// Specific debug categories
DEBUG=ielts:scraper npm start
DEBUG=ielts:notifications npm start
DEBUG=ielts:monitor npm start
```

### Adding Debug Logging

```typescript
import debug from 'debug';

const log = debug('ielts:service-name');

export class MyService {
  async doSomething() {
    log('Starting operation');
    // ... implementation
    log('Operation completed');
  }
}
```

### Performance Monitoring

```typescript
// Add performance timing
const start = Date.now();
await someOperation();
const duration = Date.now() - start;
log(`Operation took ${duration}ms`);
```

## 📦 Build and Deployment

### Build Process

```bash
# Development build
npm run build

# Production build (optimized)
npm run build:prod

# Clean build
npm run clean && npm run build
```

### Package Creation

```bash
# Create npm package
npm run package

# Create platform-specific executables
npm run package:linux
npm run package:macos
npm run package:windows
```

### Distribution

The application can be distributed in several ways:

1. **NPM Package**: `npm pack` creates a tarball for distribution
2. **Global Installation**: `npm link` for development, `npm install -g` for users
3. **Standalone Executables**: Platform-specific binaries with embedded Node.js
4. **Docker Container**: Containerized deployment (future enhancement)

## 🔒 Security Considerations

### Input Validation

Always validate user input:

```typescript
import { validateConfiguration } from '../utils/validators';

export class ConfigService {
  setConfiguration(config: any): void {
    const validatedConfig = validateConfiguration(config);
    if (!validatedConfig.isValid) {
      throw new Error(`Invalid configuration: ${validatedConfig.errors.join(', ')}`);
    }
    // ... save configuration
  }
}
```

### Web Scraping Ethics

- Respect robots.txt
- Implement rate limiting
- Use appropriate user agents
- Handle errors gracefully
- Don't overwhelm target servers

```typescript
// Rate limiting example
export class ScraperService {
  private lastRequest = 0;
  private minInterval = 1000; // 1 second minimum between requests
  
  async makeRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minInterval - timeSinceLastRequest)
      );
    }
    
    this.lastRequest = Date.now();
    // ... make request
  }
}
```

### Data Privacy

- Store only necessary data
- Don't log sensitive information
- Provide data cleanup options
- Follow local privacy regulations

## 🚀 Performance Optimization

### Memory Management

```typescript
// Proper cleanup in services
export class MonitorService {
  private intervals: NodeJS.Timeout[] = [];
  
  async stop(): Promise<void> {
    // Clean up intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    // Clean up other resources
    await this.scraperService.cleanup();
  }
}
```

### Efficient Data Handling

```typescript
// Stream processing for large datasets
import { Transform } from 'stream';

export class AppointmentProcessor extends Transform {
  _transform(chunk: any, encoding: string, callback: Function) {
    // Process appointments in streams to handle large datasets
    const processed = this.processAppointment(chunk);
    callback(null, processed);
  }
}
```

### Caching Strategies

```typescript
// Simple in-memory cache with TTL
export class CacheService {
  private cache = new Map<string, { data: any; expires: number }>();
  
  set(key: string, data: any, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlMs
    });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry || entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }
}
```

## 📚 API Reference

### Core Interfaces

```typescript
// Main service interfaces
export interface IMonitorService {
  start(config: Configuration): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getStatus(): MonitorStatus;
}

export interface IScraperService {
  scrapeAppointments(criteria: SearchCriteria): Promise<Appointment[]>;
  isWebsiteAccessible(): Promise<boolean>;
}

export interface INotificationService {
  sendNotification(appointment: Appointment): Promise<void>;
  testNotifications(): Promise<boolean>;
}
```

### Data Models

```typescript
// Core data structures
export interface Appointment {
  id: string;
  city: string;
  examModel: string;
  date: Date;
  timeSlot: string;
  availableSlots: number;
  registrationUrl: string;
}

export interface Configuration {
  city: string[];
  examModel: string[];
  months: number[];
  checkInterval: number;
  notificationSettings: NotificationSettings;
}

export interface MonitorStatus {
  isRunning: boolean;
  isPaused: boolean;
  startTime?: Date;
  lastCheck?: Date;
  totalChecks: number;
  appointmentsFound: number;
  errors: number;
}
```

## 🤝 Contributing Guidelines

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for code formatting
- Write comprehensive JSDoc comments

### Commit Messages

Follow conventional commit format:
```
feat: add email notification support
fix: resolve memory leak in scraper service  
docs: update API documentation
test: add integration tests for CLI commands
```

### Pull Request Process

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Write tests for new functionality
4. Ensure all tests pass: `npm test`
5. Update documentation as needed
6. Submit pull request with clear description

### Code Review Checklist

- [ ] Code follows project style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No security vulnerabilities introduced
- [ ] Performance impact considered
- [ ] Backward compatibility maintained

---

**Ready to contribute? Check out the [issues](../../issues) for good first contributions!**