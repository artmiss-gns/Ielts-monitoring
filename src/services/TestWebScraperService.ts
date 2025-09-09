import axios from 'axios';
import { Appointment } from '../models/types';
import { ScrapingFilters } from './WebScraperService';

/**
 * Test Web Scraper Service that works with the test simulation server API
 * Instead of scraping HTML, it uses the REST API endpoints
 */
export class TestWebScraperService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  /**
   * Initialize the service (no browser needed for API calls)
   */
  async initialize(): Promise<void> {
    // Test connectivity to the test server
    try {
      await axios.get(`${this.baseUrl}/health`);
      console.log('✅ Test server connection established');
    } catch (error) {
      throw new Error(`Failed to connect to test server at ${this.baseUrl}: ${error}`);
    }
  }

  /**
   * Close the service (no cleanup needed for API calls)
   */
  async close(): Promise<void> {
    // No cleanup needed for API-based scraping
  }

  /**
   * Fetch appointments from the test server API
   */
  async fetchAppointments(filters: ScrapingFilters): Promise<Appointment[]> {
    try {
      console.log(`🔍 Fetching appointments from test server: ${this.baseUrl}`);
      
      const response = await axios.get(`${this.baseUrl}/api/appointments`);
      const appointments = response.data;

      // Apply filters to the appointments (simulate the filtering that would happen on the real site)
      const filteredAppointments = this.applyFilters(appointments, filters);

      console.log(`📊 Found ${filteredAppointments.length} appointments matching filters`);
      
      return filteredAppointments;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch appointments from test server: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Apply filters to appointments (simulate server-side filtering)
   */
  private applyFilters(appointments: Appointment[], filters: ScrapingFilters): Appointment[] {
    return appointments.filter(appointment => {
      // Filter by city
      if (filters.city && filters.city.length > 0) {
        const cityMatch = filters.city.some(city => 
          appointment.city.toLowerCase().includes(city.toLowerCase())
        );
        if (!cityMatch) return false;
      }

      // Filter by exam model
      if (filters.examModel && filters.examModel.length > 0) {
        const examMatch = filters.examModel.some(model => 
          appointment.examType.toLowerCase().includes(model.toLowerCase())
        );
        if (!examMatch) return false;
      }

      // Filter by months (check if appointment date falls in specified months)
      if (filters.months && filters.months.length > 0) {
        const appointmentDate = new Date(appointment.date);
        const appointmentMonth = appointmentDate.getMonth() + 1; // getMonth() returns 0-11
        if (!filters.months.includes(appointmentMonth)) return false;
      }

      return true;
    });
  }

  /**
   * Build request URL (for compatibility, though not used in API mode)
   */
  buildRequestUrl(_filters: ScrapingFilters): string {
    return `${this.baseUrl}/api/appointments`;
  }
}