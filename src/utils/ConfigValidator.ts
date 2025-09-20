import { ValidationResult } from '../models/types';

/**
 * Configuration validation utilities
 */
export class ConfigValidator {
  /**
   * Validates environment variable format
   */
  static validateEnvironmentVariable(name: string, value: string | undefined, required: boolean = false): ValidationResult {
    const errors: string[] = [];

    if (required && !value) {
      errors.push(`Environment variable ${name} is required but not set`);
    }

    if (value && value.trim().length === 0) {
      errors.push(`Environment variable ${name} cannot be empty`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates port number
   */
  static validatePort(port: number | string | undefined, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (port === undefined) {
      return { isValid: true, errors: [] };
    }

    const portNum = typeof port === 'string' ? parseInt(port) : port;

    if (isNaN(portNum) || !Number.isInteger(portNum)) {
      errors.push(`${fieldName} must be a valid integer`);
    } else if (portNum < 1 || portNum > 65535) {
      errors.push(`${fieldName} must be between 1 and 65535`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates URL format
   */
  static validateUrl(url: string | undefined, fieldName: string, required: boolean = false): ValidationResult {
    const errors: string[] = [];

    if (required && !url) {
      errors.push(`${fieldName} is required`);
      return { isValid: false, errors };
    }

    if (url) {
      try {
        new URL(url);
      } catch {
        errors.push(`${fieldName} must be a valid URL`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates array of strings
   */
  static validateStringArray(arr: any, fieldName: string, required: boolean = false): ValidationResult {
    const errors: string[] = [];

    if (required && (!arr || !Array.isArray(arr) || arr.length === 0)) {
      errors.push(`${fieldName} is required and must be a non-empty array`);
      return { isValid: false, errors };
    }

    if (arr && Array.isArray(arr)) {
      if (!arr.every(item => typeof item === 'string' && item.trim().length > 0)) {
        errors.push(`${fieldName} must contain only non-empty strings`);
      }
    } else if (arr !== undefined) {
      errors.push(`${fieldName} must be an array`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates array of numbers
   */
  static validateNumberArray(arr: any, fieldName: string, min?: number, max?: number, required: boolean = false): ValidationResult {
    const errors: string[] = [];

    if (required && (!arr || !Array.isArray(arr) || arr.length === 0)) {
      errors.push(`${fieldName} is required and must be a non-empty array`);
      return { isValid: false, errors };
    }

    if (arr && Array.isArray(arr)) {
      if (!arr.every(item => Number.isInteger(item))) {
        errors.push(`${fieldName} must contain only integers`);
      } else if (min !== undefined || max !== undefined) {
        const invalidNumbers = arr.filter(item => 
          (min !== undefined && item < min) || 
          (max !== undefined && item > max)
        );
        if (invalidNumbers.length > 0) {
          const range = min !== undefined && max !== undefined 
            ? `between ${min} and ${max}`
            : min !== undefined 
              ? `at least ${min}`
              : `at most ${max}`;
          errors.push(`${fieldName} must contain only integers ${range}`);
        }
      }
    } else if (arr !== undefined) {
      errors.push(`${fieldName} must be an array`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates boolean value
   */
  static validateBoolean(value: any, fieldName: string, required: boolean = false): ValidationResult {
    const errors: string[] = [];

    if (required && value === undefined) {
      errors.push(`${fieldName} is required`);
    } else if (value !== undefined && typeof value !== 'boolean') {
      errors.push(`${fieldName} must be a boolean`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates integer value
   */
  static validateInteger(value: any, fieldName: string, min?: number, max?: number, required: boolean = false): ValidationResult {
    const errors: string[] = [];

    if (required && value === undefined) {
      errors.push(`${fieldName} is required`);
      return { isValid: false, errors };
    }

    if (value !== undefined) {
      if (!Number.isInteger(value)) {
        errors.push(`${fieldName} must be an integer`);
      } else {
        if (min !== undefined && value < min) {
          errors.push(`${fieldName} must be at least ${min}`);
        }
        if (max !== undefined && value > max) {
          errors.push(`${fieldName} must be at most ${max}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates enum value
   */
  static validateEnum(value: any, fieldName: string, allowedValues: string[], required: boolean = false): ValidationResult {
    const errors: string[] = [];

    if (required && value === undefined) {
      errors.push(`${fieldName} is required`);
    } else if (value !== undefined && !allowedValues.includes(value)) {
      errors.push(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Combines multiple validation results
   */
  static combineValidationResults(...results: ValidationResult[]): ValidationResult {
    const allErrors = results.flatMap(result => result.errors);
    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }
}