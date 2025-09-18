import { TelegramNotifier } from '../TelegramNotifier';
import { TelegramConfig, Appointment } from '../../models/types';

// Mock node-telegram-bot-api
jest.mock('node-telegram-bot-api');

describe('TelegramNotifier', () => {
  const mockConfig: TelegramConfig = {
    botToken: 'test-bot-token',
    chatId: '@test_channel',
    messageFormat: 'detailed',
    enablePreview: false,
    retryAttempts: 2,
    retryDelay: 100,
    isChannel: true
  };

  const mockAppointments: Appointment[] = [
    {
      id: '1',
      date: '2024-01-15',
      time: '09:00-12:00',
      location: 'Test Center',
      examType: 'Academic',
      city: 'Tehran',
      status: 'available'
    },
    {
      id: '2',
      date: '2024-01-16',
      time: '14:00-17:00',
      location: 'Another Center',
      examType: 'General',
      city: 'Isfahan',
      status: 'available',
      price: 5500000
    }
  ];

  let telegramNotifier: TelegramNotifier;
  let mockBot: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock TelegramBot
    const TelegramBot = require('node-telegram-bot-api');
    mockBot = {
      sendMessage: jest.fn().mockResolvedValue({}),
      getMe: jest.fn().mockResolvedValue({ username: 'test_bot' })
    };
    TelegramBot.mockImplementation(() => mockBot);

    telegramNotifier = new TelegramNotifier(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(telegramNotifier.isConfigured()).toBe(true);
    });

    it('should not initialize bot with invalid config', () => {
      const invalidConfig = { ...mockConfig, botToken: '' };
      const notifier = new TelegramNotifier(invalidConfig);
      expect(notifier.isConfigured()).toBe(false);
    });
  });

  describe('sendNotification', () => {
    it('should send notification for available appointments', async () => {
      const result = await telegramNotifier.sendNotification(mockAppointments);
      
      expect(result).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '@test_channel',
        expect.stringContaining('2 New IELTS Appointments Available!'),
        {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }
      );
    });

    it('should filter out non-available appointments', async () => {
      const mixedAppointments = [
        ...mockAppointments,
        {
          id: '3',
          date: '2024-01-17',
          time: '10:00-13:00',
          location: 'Filled Center',
          examType: 'Academic',
          city: 'Tehran',
          status: 'filled' as const
        }
      ];

      const result = await telegramNotifier.sendNotification(mixedAppointments);
      
      expect(result).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '@test_channel',
        expect.stringContaining('2 New IELTS Appointments Available!'),
        expect.any(Object)
      );
    });

    it('should return false when no available appointments', async () => {
      const filledAppointments = mockAppointments.map(apt => ({
        ...apt,
        status: 'filled' as const
      }));

      const result = await telegramNotifier.sendNotification(filledAppointments);
      expect(result).toBe(false);
      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('should retry on failure', async () => {
      mockBot.sendMessage
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({});

      const result = await telegramNotifier.sendNotification(mockAppointments);
      
      expect(result).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      mockBot.sendMessage.mockRejectedValue(new Error('Persistent error'));

      const result = await telegramNotifier.sendNotification(mockAppointments);
      
      expect(result).toBe(false);
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(2); // retryAttempts = 2
    });
  });

  describe('message formatting', () => {
    it('should format detailed message correctly', async () => {
      await telegramNotifier.sendNotification([mockAppointments[0]]);
      
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      expect(sentMessage).toContain('📅 <b>Date:</b> 2024-01-15');
      expect(sentMessage).toContain('🕐 <b>Time:</b> 09:00-12:00');
      expect(sentMessage).toContain('📍 <b>Location:</b> Test Center');
      expect(sentMessage).toContain('📝 <b>Exam Type:</b> Academic');
      expect(sentMessage).toContain('🏙️ <b>City:</b> Tehran');
    });

    it('should format simple message when configured', async () => {
      const simpleConfig = { ...mockConfig, messageFormat: 'simple' as const };
      const simpleNotifier = new TelegramNotifier(simpleConfig);
      
      await simpleNotifier.sendNotification([mockAppointments[0]]);
      
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      expect(sentMessage).toContain('📅 2024-01-15 at 09:00-12:00 - Test Center');
      expect(sentMessage).not.toContain('<b>Date:</b>');
    });

    it('should include price when available', async () => {
      await telegramNotifier.sendNotification([mockAppointments[1]]);
      
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      expect(sentMessage).toContain('💰 <b>Price:</b> 5,500,000 Toman');
    });

    it('should limit appointments in detailed view', async () => {
      const manyAppointments = Array(5).fill(null).map((_, i) => ({
        ...mockAppointments[0],
        id: `${i + 1}`,
        date: `2024-01-${15 + i}`
      }));

      await telegramNotifier.sendNotification(manyAppointments);
      
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      expect(sentMessage).toContain('... and 2 more appointments available');
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const result = await telegramNotifier.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected successfully as @test_bot');
      expect(mockBot.getMe).toHaveBeenCalled();
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '@test_channel',
        expect.stringContaining('IELTS Monitor Test'),
        { parse_mode: 'HTML' }
      );
    });

    it('should handle connection failure', async () => {
      mockBot.getMe.mockRejectedValue(new Error('Invalid token'));
      
      const result = await telegramNotifier.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection failed: Invalid token');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig = { ...mockConfig, messageFormat: 'simple' as const };
      telegramNotifier.updateConfig(newConfig);
      
      // Test that new config is applied by checking message format
      expect(telegramNotifier.isConfigured()).toBe(true);
    });

    it('should disable bot with invalid config', () => {
      const invalidConfig = { ...mockConfig, botToken: '' };
      telegramNotifier.updateConfig(invalidConfig);
      
      expect(telegramNotifier.isConfigured()).toBe(false);
    });
  });

  describe('channel support', () => {
    it('should include channel footer in detailed messages', async () => {
      await telegramNotifier.sendNotification([mockAppointments[0]]);
      
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      expect(sentMessage).toContain('Join this channel for instant IELTS appointment alerts!');
    });

    it('should include channel footer in simple messages', async () => {
      const simpleConfig = { ...mockConfig, messageFormat: 'simple' as const };
      const simpleNotifier = new TelegramNotifier(simpleConfig);
      
      await simpleNotifier.sendNotification([mockAppointments[0]]);
      
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      expect(sentMessage).toContain('Join this channel for instant alerts!');
    });

    it('should send channel-specific test message', async () => {
      const result = await telegramNotifier.testConnection();
      
      expect(result.success).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '@test_channel',
        expect.stringContaining('Channel notifications are working correctly!'),
        { parse_mode: 'HTML' }
      );
    });

    it('should work with private chat config', async () => {
      const privateChatConfig = { 
        ...mockConfig, 
        chatId: '123456789',
        isChannel: false 
      };
      const privateChatNotifier = new TelegramNotifier(privateChatConfig);
      
      await privateChatNotifier.sendNotification([mockAppointments[0]]);
      
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      expect(sentMessage).not.toContain('Join this channel');
    });
  });
});