import { TelegramNotifier } from '../TelegramNotifier';
import { Appointment, TelegramConfig } from '../../models/types';

// Mock node-telegram-bot-api
jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue({ message_id: 123 }),
    getMe: jest.fn().mockResolvedValue({ username: 'test_bot' })
  }));
});

describe('TelegramNotifier - Enhanced Filtering', () => {
  let telegramNotifier: TelegramNotifier;
  let mockBot: any;

  const mockTelegramConfig: TelegramConfig = {
    botToken: 'test-token',
    chatId: '@test_channel',
    messageFormat: 'detailed',
    enablePreview: false,
    isChannel: true
  };

  const mockAvailableAppointments: Appointment[] = [
    {
      id: 'apt-available-1',
      date: '2025-02-15',
      time: '09:00-12:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'isfahan',
      status: 'available'
    },
    {
      id: 'apt-available-2',
      date: '2025-02-16',
      time: '14:00-17:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'isfahan',
      status: 'available'
    }
  ];

  const mockFilledAppointments: Appointment[] = [
    {
      id: 'apt-filled-1',
      date: '2025-02-17',
      time: '09:00-12:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'isfahan',
      status: 'filled'
    },
    {
      id: 'apt-unknown-1',
      date: '2025-02-18',
      time: '14:00-17:00',
      location: 'Isfahan Center',
      examType: 'CDIELTS',
      city: 'isfahan',
      status: 'unknown'
    }
  ];

  const mockMixedAppointments: Appointment[] = [
    ...mockAvailableAppointments,
    ...mockFilledAppointments
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup TelegramBot mock
    const TelegramBot = require('node-telegram-bot-api');
    mockBot = {
      sendMessage: jest.fn().mockResolvedValue({ message_id: 123 }),
      getMe: jest.fn().mockResolvedValue({ username: 'test_bot' })
    };
    TelegramBot.mockImplementation(() => mockBot);

    telegramNotifier = new TelegramNotifier(mockTelegramConfig);
  });

  describe('Enhanced Filtering - Requirements 3.1, 3.2, 3.5', () => {
    test('should send notifications for available appointments only - Requirement 3.1', async () => {
      const result = await telegramNotifier.sendNotification(mockAvailableAppointments);

      expect(result).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '@test_channel',
        expect.stringContaining('New IELTS Appointment'),
        expect.any(Object)
      );
    });

    test('should reject notifications when no available appointments - Requirement 3.1', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await telegramNotifier.sendNotification(mockFilledAppointments);

      expect(result).toBe(false);
      expect(mockBot.sendMessage).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Telegram notification rejected: No available appointments')
      );
      
      consoleSpy.mockRestore();
    });

    test('should filter mixed appointments to only available ones - Requirement 3.2', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await telegramNotifier.sendNotification(mockMixedAppointments);

      expect(result).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalled();
      
      // Should log filtering results
      expect(consoleSpy).toHaveBeenCalledWith(
        '🔍 Telegram notification filtering:',
        expect.objectContaining({
          totalAppointments: 4,
          availableAppointments: 2,
          filteredOut: 2
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚫 Telegram filtered:')
      );
      
      consoleSpy.mockRestore();
    });

    test('should validate no filled appointments trigger notifications - Requirement 3.5', async () => {
      // Mock the filtering to accidentally let filled appointments through
      const originalFilter = Array.prototype.filter;
      jest.spyOn(Array.prototype, 'filter').mockImplementationOnce(function(this: any[], callback: any) {
        // First call should return all appointments (simulating a bug)
        if (this.some && this.some((apt: any) => apt.status === 'available')) {
          return this; // Return all appointments including filled ones
        }
        return originalFilter.call(this, callback);
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        const result = await telegramNotifier.sendNotification(mockMixedAppointments);
        
        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          '🚨 Telegram validation failure:',
          expect.stringContaining('CRITICAL: Filled/unknown appointments in Telegram notification!')
        );
        expect(mockBot.sendMessage).not.toHaveBeenCalled();
      } finally {
        (Array.prototype.filter as any).mockRestore();
        consoleSpy.mockRestore();
      }
    });

    test('should log detailed filtering reasons - Requirement 3.4', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await telegramNotifier.sendNotification(mockMixedAppointments);

      // Check that filtering reasons are logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚫 Telegram filtered: apt-filled-1 (filled)')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚫 Telegram filtered: apt-unknown-1 (unknown)')
      );
      
      consoleSpy.mockRestore();
    });

    test('should include status breakdown in rejection messages - Requirement 3.4', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await telegramNotifier.sendNotification(mockFilledAppointments);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Status breakdown:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('filled')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown')
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle empty appointment list gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await telegramNotifier.sendNotification([]);

      expect(result).toBe(false);
      expect(mockBot.sendMessage).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No available appointments')
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle appointments with undefined status', async () => {
      const appointmentsWithUndefinedStatus = [
        {
          ...mockAvailableAppointments[0],
          status: undefined as any
        }
      ];

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await telegramNotifier.sendNotification(appointmentsWithUndefinedStatus);

      expect(result).toBe(false);
      expect(mockBot.sendMessage).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Filter Reason Messages - Requirements 3.4, 3.5', () => {
    test('should provide appropriate filter reasons for different statuses', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const diverseAppointments: Appointment[] = [
        { ...mockAvailableAppointments[0], id: 'apt-1', status: 'available' },
        { ...mockAvailableAppointments[0], id: 'apt-2', status: 'filled' },
        { ...mockAvailableAppointments[0], id: 'apt-3', status: 'unknown' },
        { ...mockAvailableAppointments[0], id: 'apt-4', status: 'pending' },
        { ...mockAvailableAppointments[0], id: 'apt-5', status: 'not-registerable' }
      ];
      
      await telegramNotifier.sendNotification(diverseAppointments);

      // Check that appropriate reasons are logged for each status
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('filled/unavailable for booking')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Status could not be determined')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('pending status')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('not available for registration')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling with Filtering', () => {
    test('should handle bot initialization failure gracefully', async () => {
      const notifierWithoutBot = new TelegramNotifier({
        ...mockTelegramConfig,
        botToken: '' // Invalid token
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await notifierWithoutBot.sendNotification(mockAvailableAppointments);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Telegram bot not initialized')
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle message sending failure with filtered appointments', async () => {
      mockBot.sendMessage.mockRejectedValue(new Error('Network error'));
      
      const result = await telegramNotifier.sendNotification(mockAvailableAppointments);

      expect(result).toBe(false);
      // Should still attempt to send after filtering
      expect(mockBot.sendMessage).toHaveBeenCalled();
    });
  });
});