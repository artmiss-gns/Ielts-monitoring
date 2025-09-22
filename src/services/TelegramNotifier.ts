import TelegramBot from 'node-telegram-bot-api';
import { Appointment, TelegramConfig } from '../models/types';

/**
 * Telegram notification service for sending appointment alerts
 */
export class TelegramNotifier {
  private bot: TelegramBot | null = null;
  private config: TelegramConfig;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(config: TelegramConfig) {
    this.config = config;
    this.maxRetries = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
    
    if (config.botToken && config.chatId) {
      this.initializeBot();
    }
  }

  /**
   * Initialize Telegram bot instance
   */
  private initializeBot(): void {
    try {
      this.bot = new TelegramBot(this.config.botToken, { polling: false });
    } catch (error) {
      console.error('Failed to initialize Telegram bot:', error);
      this.bot = null;
    }
  }

  /**
   * Send notification with retry mechanism
   * Enhanced filtering to prevent false positives - Requirements 3.1, 3.2, 3.5
   */
  async sendNotification(appointments: Appointment[]): Promise<boolean> {
    if (!this.bot) {
      console.error('Telegram bot not initialized. Check your bot token and chat ID.');
      return false;
    }

    // Enhanced filtering with validation - Requirements 3.1, 3.2, 3.5
    const availableAppointments = appointments.filter(apt => apt.status === 'available');
    const filteredAppointments = appointments.filter(apt => apt.status !== 'available');
    
    // Log filtering results for Telegram - Requirement 3.4
    if (filteredAppointments.length > 0) {
      console.log('🔍 Telegram notification filtering:', {
        totalAppointments: appointments.length,
        availableAppointments: availableAppointments.length,
        filteredOut: filteredAppointments.length,
        filteredStatuses: filteredAppointments.map(apt => apt.status)
      });
      
      // Log each filtered appointment - Requirement 3.4
      filteredAppointments.forEach(apt => {
        console.log(`🚫 Telegram filtered: ${apt.id} (${apt.status}) - ${this.getFilterReason(apt.status)}`);
      });
    }
    
    // Validate no filled appointments made it through - Requirement 3.5
    const filledAppointments = availableAppointments.filter(apt => 
      apt.status === 'filled' || apt.status === 'unknown'
    );
    
    if (filledAppointments.length > 0) {
      const error = `CRITICAL: Filled/unknown appointments in Telegram notification! ${filledAppointments.map(apt => `${apt.id}(${apt.status})`).join(', ')}`;
      console.error('🚨 Telegram validation failure:', error);
      return false;
    }
    
    if (availableAppointments.length === 0) {
      const statusBreakdown = appointments.reduce((counts, apt) => {
        counts[apt.status] = (counts[apt.status] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
      
      console.warn(`Telegram notification rejected: No available appointments. Status breakdown: ${JSON.stringify(statusBreakdown)}`);
      return false;
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const message = this.formatMessage(availableAppointments);
        await this.bot.sendMessage(this.config.chatId, message, {
          parse_mode: 'HTML',
          disable_web_page_preview: !this.config.enablePreview
        });
        
        console.log(`Telegram notification sent successfully (attempt ${attempt})`);
        return true;
      } catch (error) {
        console.error(`Telegram notification attempt ${attempt} failed:`, error);
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }
    
    console.error(`Failed to send Telegram notification after ${this.maxRetries} attempts`);
    return false;
  }

  /**
   * Format appointment information for Telegram message
   */
  private formatMessage(appointments: Appointment[]): string {
    const count = appointments.length;
    const title = count === 1 
      ? '🎯 <b>New IELTS Appointment Available!</b>' 
      : `🎯 <b>${count} New IELTS Appointments Available!</b>`;

    if (this.config.messageFormat === 'simple') {
      return this.formatSimpleMessage(title, appointments);
    } else {
      return this.formatDetailedMessage(title, appointments);
    }
  }

  /**
   * Format simple message with basic appointment info
   */
  private formatSimpleMessage(title: string, appointments: Appointment[]): string {
    const appointmentList = appointments
      .slice(0, 5) // Limit to first 5 appointments to avoid message length issues
      .map(apt => `📅 ${apt.date} at ${apt.time} - ${apt.location}`)
      .join('\n');

    const additionalCount = appointments.length > 5 ? `\n\n... and ${appointments.length - 5} more appointments` : '';
    const channelFooter = this.config.isChannel ? '\n\n📢 Join this channel for instant alerts!' : '';

    return `${title}\n\n${appointmentList}${additionalCount}\n\n⚡ Book now before they're filled!${channelFooter}`;
  }

  /**
   * Format detailed message with comprehensive appointment info
   */
  private formatDetailedMessage(title: string, appointments: Appointment[]): string {
    const appointmentList = appointments
      .slice(0, 3) // Limit to first 3 appointments for detailed view
      .map(apt => this.formatAppointmentDetails(apt))
      .join('\n\n');

    const additionalCount = appointments.length > 3 ? `\n\n📋 <i>... and ${appointments.length - 3} more appointments available</i>` : '';

    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const channelFooter = this.config.isChannel ? '\n\n📢 <i>Join this channel for instant IELTS appointment alerts!</i>' : '';

    return `${title}\n\n${appointmentList}${additionalCount}\n\n🕒 <i>Detected at: ${timestamp} (Tehran time)</i>\n⚡ <b>Book quickly - appointments fill fast!</b>${channelFooter}`;
  }

  /**
   * Format individual appointment details
   */
  private formatAppointmentDetails(appointment: Appointment): string {
    const details = [
      `📅 <b>Date:</b> ${appointment.date}`,
      `🕐 <b>Time:</b> ${appointment.time}`,
      `📍 <b>Location:</b> ${appointment.location}`,
      `📝 <b>Exam Type:</b> ${appointment.examType}`,
      `🏙️ <b>City:</b> ${appointment.city}`
    ];

    if (appointment.price) {
      details.push(`💰 <b>Price:</b> ${appointment.price.toLocaleString()} Toman`);
    }

    return details.join('\n');
  }

  /**
   * Test Telegram connection and configuration
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.bot) {
      return {
        success: false,
        message: 'Telegram bot not initialized. Check your bot token.'
      };
    }

    try {
      // Test by getting bot info
      const botInfo = await this.bot.getMe();
      
      // Test by sending a test message
      const testMessage = this.config.isChannel 
        ? '🤖 <b>IELTS Monitor Test</b>\n\nChannel notifications are working correctly!\n\n📢 <i>This channel will receive IELTS appointment alerts</i>'
        : '🤖 <b>IELTS Monitor Test</b>\n\nTelegram notifications are working correctly!';
        
      await this.bot.sendMessage(this.config.chatId, testMessage, {
        parse_mode: 'HTML'
      });

      const targetType = this.config.isChannel ? 'channel' : 'chat';
      return {
        success: true,
        message: `Connected successfully as @${botInfo.username} to ${targetType} ${this.config.chatId}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: TelegramConfig): void {
    this.config = config;
    if (config.botToken && config.chatId) {
      this.initializeBot();
    } else {
      this.bot = null;
    }
  }

  /**
   * Check if Telegram is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config.botToken && this.config.chatId && this.bot);
  }

  /**
   * Get human-readable reason for filtering out appointments - Requirements 3.4, 3.5
   */
  private getFilterReason(status: string): string {
    switch (status) {
      case 'filled':
        return 'Appointment is filled/unavailable for booking - prevents false positive notifications';
      case 'unknown':
        return 'Status could not be determined - conservative filtering to prevent false positives';
      case 'pending':
        return 'Appointment is in pending status - not yet available for booking';
      case 'not-registerable':
        return 'Appointment is not available for registration';
      default:
        return `Appointment has non-available status: ${status} - filtered to prevent false notifications`;
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}