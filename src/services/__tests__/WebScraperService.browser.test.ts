import { WebScraperService } from '../WebScraperService';

describe('WebScraperService Browser Availability', () => {
  it('should check browser availability', async () => {
    const result = await WebScraperService.checkBrowserAvailability();
    
    expect(result).toHaveProperty('available');
    expect(typeof result.available).toBe('boolean');
    expect(result).toHaveProperty('suggestions');
    expect(Array.isArray(result.suggestions)).toBe(true);
    
    if (!result.available) {
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
      expect(result.suggestions.length).toBeGreaterThan(0);
    }
  });

  it('should provide helpful suggestions when browser is not available', async () => {
    const result = await WebScraperService.checkBrowserAvailability();
    
    if (!result.available) {
      expect(result.suggestions).toContain(
        expect.stringContaining('Install Chromium')
      );
      expect(result.suggestions).toContain(
        expect.stringContaining('Install Chrome')
      );
      expect(result.suggestions).toContain(
        expect.stringContaining('PUPPETEER_EXECUTABLE_PATH')
      );
      expect(result.suggestions).toContain(
        expect.stringContaining('test-server')
      );
    }
  });
});