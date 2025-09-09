import * as path from 'path';
import { ConfigurationManager } from '../ConfigurationManager';
import { MonitorConfig } from '../../models/types';

// Mock fs-extra module
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn(),
  pathExists: jest.fn(),
  readJson: jest.fn(),
  writeJson: jest.fn()
}));

const mockFs = require('fs-extra');

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  const testConfigPath = 'test-config/monitor-config.json';

  beforeEach(() => {
    jest.clearAllMocks();
    configManager = new ConfigurationManager(testConfigPath);
  });

  describe('constructor', () => {
    it('should use default config path when none provided', () => {
      const defaultManager = new ConfigurationManager();
      expect(defaultManager.getConfigPath()).toBe('config/monitor-config.json');
    });

    it('should use provided config path', () => {
      expect(configManager.getConfigPath()).toBe(testConfigPath);
    });
  });

  describe('loadConfig', () => {
    it('should load valid configuration from existing file', async () => {
      const validConfig: MonitorConfig = {
        city: ['tehran'],
        examModel: ['ielts'],
        months: [3, 4, 5],
        checkInterval: 60000,
        notificationSettings: {
          desktop: true,
          audio: false,
          logFile: true
        }
      };

      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(validConfig);

      const result = await configManager.loadConfig();
      expect(result).toEqual(validConfig);
      expect(mockFs.ensureDir).toHaveBeenCalledWith(path.dirname(testConfigPath));
      expect(mockFs.readJson).toHaveBeenCalledWith(testConfigPath);
    });

    it('should create and return default config when file does not exist', async () => {
      const defaultConfig = configManager.getDefaultConfig();

      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeJson.mockResolvedValue(undefined);

      const result = await configManager.loadConfig();
      expect(result).toEqual(defaultConfig);
      expect(mockFs.writeJson).toHaveBeenCalledWith(testConfigPath, defaultConfig, { spaces: 2 });
    });

    it('should throw error when loading invalid configuration', async () => {
      const invalidConfig = {
        city: 'not-an-array', // Should be array
        examModel: ['ielts'],
        months: [1, 2],
        checkInterval: 30000,
        notificationSettings: {
          desktop: true,
          audio: true,
          logFile: true
        }
      };

      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(invalidConfig);

      await expect(configManager.loadConfig()).rejects.toThrow('Invalid configuration');
    });

    it('should throw error when file system operation fails', async () => {
      mockFs.ensureDir.mockRejectedValue(new Error('Permission denied'));

      await expect(configManager.loadConfig()).rejects.toThrow('Failed to load configuration');
    });
  });

  describe('saveConfig', () => {
    it('should save valid configuration', async () => {
      const validConfig: MonitorConfig = {
        city: ['shiraz'],
        examModel: ['cdielts'],
        months: [6, 7, 8],
        checkInterval: 45000,
        notificationSettings: {
          desktop: false,
          audio: true,
          logFile: true
        }
      };

      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.writeJson.mockResolvedValue(undefined);

      await configManager.saveConfig(validConfig);
      expect(mockFs.ensureDir).toHaveBeenCalledWith(path.dirname(testConfigPath));
      expect(mockFs.writeJson).toHaveBeenCalledWith(testConfigPath, validConfig, { spaces: 2 });
    });

    it('should throw error when trying to save invalid configuration', async () => {
      const invalidConfig = {
        city: [],
        examModel: ['ielts'],
        months: [1],
        checkInterval: 30000,
        notificationSettings: {
          desktop: true,
          audio: true,
          logFile: true
        }
      } as MonitorConfig;

      await expect(configManager.saveConfig(invalidConfig)).rejects.toThrow('Cannot save invalid configuration');
      expect(mockFs.writeJson).not.toHaveBeenCalled();
    });

    it('should throw error when file system operation fails', async () => {
      const validConfig = configManager.getDefaultConfig();
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.writeJson.mockRejectedValue(new Error('Disk full'));

      await expect(configManager.saveConfig(validConfig)).rejects.toThrow('Failed to save configuration');
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const validConfig: MonitorConfig = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [1, 2, 3],
        checkInterval: 30000,
        notificationSettings: {
          desktop: true,
          audio: true,
          logFile: true
        }
      };

      const result = configManager.validateConfig(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null or undefined config', () => {
      const result1 = configManager.validateConfig(null);
      const result2 = configManager.validateConfig(undefined);

      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Configuration must be a valid object');
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Configuration must be a valid object');
    });

    it('should reject invalid city field', () => {
      const configs = [
        { city: 'not-array' },
        { city: [] },
        { city: ['', 'valid'] },
        { city: [123, 'valid'] }
      ];

      configs.forEach(config => {
        const fullConfig = { ...configManager.getDefaultConfig(), ...config };
        const result = configManager.validateConfig(fullConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('city'))).toBe(true);
      });
    });

    it('should reject invalid examModel field', () => {
      const configs = [
        { examModel: 'not-array' },
        { examModel: [] },
        { examModel: ['', 'valid'] },
        { examModel: [null, 'valid'] }
      ];

      configs.forEach(config => {
        const fullConfig = { ...configManager.getDefaultConfig(), ...config };
        const result = configManager.validateConfig(fullConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('examModel'))).toBe(true);
      });
    });

    it('should reject invalid months field', () => {
      const configs = [
        { months: 'not-array' },
        { months: [] },
        { months: [0, 1, 2] }, // 0 is invalid
        { months: [1, 13, 2] }, // 13 is invalid
        { months: [1.5, 2, 3] }, // 1.5 is not integer
        { months: ['1', 2, 3] } // '1' is string
      ];

      configs.forEach(config => {
        const fullConfig = { ...configManager.getDefaultConfig(), ...config };
        const result = configManager.validateConfig(fullConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('months'))).toBe(true);
      });
    });

    it('should reject invalid checkInterval field', () => {
      const configs = [
        { checkInterval: 'not-number' },
        { checkInterval: 1000 }, // Too small
        { checkInterval: 4000000 }, // Too large
        { checkInterval: 30000.5 } // Not integer
      ];

      configs.forEach(config => {
        const fullConfig = { ...configManager.getDefaultConfig(), ...config };
        const result = configManager.validateConfig(fullConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('checkInterval'))).toBe(true);
      });
    });

    it('should reject invalid notificationSettings', () => {
      const configs = [
        { notificationSettings: null },
        { notificationSettings: 'not-object' },
        { notificationSettings: { desktop: 'not-boolean', audio: true, logFile: true } },
        { notificationSettings: { desktop: true, audio: 'not-boolean', logFile: true } },
        { notificationSettings: { desktop: true, audio: true, logFile: 'not-boolean' } },
        { notificationSettings: { desktop: false, audio: false, logFile: false } } // All disabled
      ];

      configs.forEach(config => {
        const fullConfig = { ...configManager.getDefaultConfig(), ...config };
        const result = configManager.validateConfig(fullConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('notification'))).toBe(true);
      });
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const defaultConfig = configManager.getDefaultConfig();
      expect(defaultConfig).toEqual({
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [12, 1, 2],
        checkInterval: 30000,
        notificationSettings: {
          desktop: true,
          audio: true,
          logFile: true
        }
      });
    });

    it('should return a deep copy (not reference)', () => {
      const config1 = configManager.getDefaultConfig();
      const config2 = configManager.getDefaultConfig();
      
      config1.city.push('tehran');
      expect(config2.city).not.toContain('tehran');
    });
  });

  describe('configExists', () => {
    it('should return true when config file exists', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      
      const exists = await configManager.configExists();
      expect(exists).toBe(true);
      expect(mockFs.pathExists).toHaveBeenCalledWith(testConfigPath);
    });

    it('should return false when config file does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      const exists = await configManager.configExists();
      expect(exists).toBe(false);
    });
  });

  describe('resetToDefault', () => {
    it('should save default configuration', async () => {
      const defaultConfig = configManager.getDefaultConfig();
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.writeJson.mockResolvedValue(undefined);

      await configManager.resetToDefault();
      expect(mockFs.writeJson).toHaveBeenCalledWith(testConfigPath, defaultConfig, { spaces: 2 });
    });
  });
});