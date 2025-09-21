import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { Appointment } from '../../models/types';

/**
 * Mock IELTS server to simulate the irsafam.org website responses
 */
export class MockIELTSServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private appointments: Appointment[] = [];
  private requestCount: number = 0;
  private shouldFail: boolean = false;
  private failureType: 'network' | 'parsing' | 'timeout' = 'network';
  private responseDelay: number = 0;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    this.setupRoutes();
  }

  /**
   * Setup Express routes to simulate IELTS website
   */
  private setupRoutes(): void {
    this.app.use(express.json());

    // Main timetable endpoint
    this.app.get('/timetable', (req: Request, res: Response) => {
      this.requestCount++;

      // Simulate failures if configured
      if (this.shouldFail) {
        return this.simulateFailure(res);
      }

      // Add response delay if configured
      setTimeout(() => {
        const { city, examModel, months } = req.query;
        const filteredAppointments = this.filterAppointments(
          city as string,
          examModel as string,
          months as string
        );

        res.send(this.generateHTML(filteredAppointments));
      }, this.responseDelay);
    });

    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'OK', requestCount: this.requestCount });
    });

    // API endpoints for test integration
    this.app.get('/api/appointments', (_req: Request, res: Response) => {
      res.json(this.appointments);
    });

    this.app.post('/api/appointments', (req: Request, res: Response) => {
      const appointment = req.body;
      this.appointments.push(appointment);
      res.json({ success: true, id: appointment.id });
    });

    this.app.delete('/api/appointments', (_req: Request, res: Response) => {
      this.appointments = [];
      res.json({ success: true, cleared: true });
    });

    // Admin endpoints for test control
    this.app.post('/admin/appointments', (req: Request, res: Response) => {
      this.appointments = req.body.appointments || [];
      res.json({ success: true, count: this.appointments.length });
    });

    this.app.post('/admin/failure', (req: Request, res: Response) => {
      this.shouldFail = req.body.shouldFail || false;
      this.failureType = req.body.failureType || 'network';
      res.json({ success: true, shouldFail: this.shouldFail, failureType: this.failureType });
    });

    this.app.post('/admin/delay', (req: Request, res: Response) => {
      this.responseDelay = req.body.delay || 0;
      res.json({ success: true, delay: this.responseDelay });
    });

    this.app.get('/admin/stats', (_req: Request, res: Response) => {
      res.json({
        requestCount: this.requestCount,
        appointmentCount: this.appointments.length,
        shouldFail: this.shouldFail,
        failureType: this.failureType,
        responseDelay: this.responseDelay
      });
    });
  }

  /**
   * Filter appointments based on query parameters
   */
  private filterAppointments(city?: string, examModel?: string, months?: string): Appointment[] {
    let filtered = [...this.appointments];

    if (city) {
      const cities = city.split(',');
      filtered = filtered.filter(apt => cities.includes(apt.city.toLowerCase()));
    }

    if (examModel) {
      const models = examModel.split(',');
      filtered = filtered.filter(apt => models.includes(apt.examType.toLowerCase()));
    }

    if (months) {
      const monthNumbers = months.split(',').map(m => parseInt(m));
      filtered = filtered.filter(apt => {
        const aptMonth = new Date(apt.date).getMonth() + 1;
        return monthNumbers.includes(aptMonth);
      });
    }

    return filtered;
  }

  /**
   * Generate HTML response similar to IELTS website
   */
  private generateHTML(appointments: Appointment[]): string {
    const appointmentCards = appointments.map(apt => `
      <div class="appointment-card" data-id="${apt.id}">
        <div class="date">${apt.date}</div>
        <div class="time">${apt.time}</div>
        <div class="location">${apt.location}</div>
        <div class="exam-type">${apt.examType}</div>
        <div class="status ${apt.status}">${apt.status}</div>
        ${apt.price ? `<div class="price">${apt.price}</div>` : ''}
        ${apt.registrationUrl ? `<a href="${apt.registrationUrl}" class="register-btn">Register</a>` : ''}
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>IELTS Timetable</title>
      </head>
      <body>
        <div class="timetable-container">
          <h1>IELTS Exam Timetable</h1>
          <div class="appointments-grid">
            ${appointmentCards}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Simulate different types of failures
   */
  private simulateFailure(res: Response): void {
    switch (this.failureType) {
      case 'network':
        res.status(500).send('Internal Server Error');
        break;
      case 'parsing':
        res.send('<html><body><div>Invalid HTML structure</div></body></html>');
        break;
      case 'timeout':
        // Don't respond - simulate timeout
        break;
      default:
        res.status(500).send('Unknown error');
    }
  }

  /**
   * Start the mock server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, '127.0.0.1', (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Reset server state
   */
  reset(): void {
    this.appointments = [];
    this.requestCount = 0;
    this.shouldFail = false;
    this.failureType = 'network';
    this.responseDelay = 0;
  }

  /**
   * Set appointments for testing
   */
  setAppointments(appointments: Appointment[]): void {
    this.appointments = appointments;
  }

  /**
   * Add appointments for testing
   */
  addAppointments(appointments: Appointment[]): void {
    this.appointments.push(...appointments);
  }

  /**
   * Configure failure simulation
   */
  setFailure(shouldFail: boolean, failureType: 'network' | 'parsing' | 'timeout' = 'network'): void {
    this.shouldFail = shouldFail;
    this.failureType = failureType;
  }

  /**
   * Set response delay
   */
  setDelay(delay: number): void {
    this.responseDelay = delay;
  }

  /**
   * Get server statistics
   */
  getStats(): { requestCount: number; appointmentCount: number } {
    return {
      requestCount: this.requestCount,
      appointmentCount: this.appointments.length
    };
  }

  /**
   * Get server URL
   */
  getUrl(): string {
    return `http://localhost:${this.port}`;
  }
}