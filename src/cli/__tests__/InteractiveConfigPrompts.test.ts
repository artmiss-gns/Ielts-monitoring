import { InteractiveConfigPrompts } from '../InteractiveConfigPrompts';

// Mock readline
jest.mock('readline');

describe('InteractiveConfigPrompts', () => {
  let interactivePrompts: InteractiveConfigPrompts;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock readline interface
    const mockRl = {
      question: jest.fn(),
      close: jest.fn()
    };

    const readline = require('readline');
    readline.createInterface = jest.fn().mockReturnValue(mockRl);
    
    interactivePrompts = new InteractiveConfigPrompts();
  });

  describe('InteractiveConfigPrompts', () => {
    it('should create InteractiveConfigPrompts instance', () => {
      // Basic test to ensure class can be instantiated
      expect(interactivePrompts).toBeInstanceOf(InteractiveConfigPrompts);
    });

    it('should have promptForConfiguration method', () => {
      expect(typeof interactivePrompts.promptForConfiguration).toBe('function');
    });

    it('should have confirmRestart method', () => {
      expect(typeof interactivePrompts.confirmRestart).toBe('function');
    });
  });
});