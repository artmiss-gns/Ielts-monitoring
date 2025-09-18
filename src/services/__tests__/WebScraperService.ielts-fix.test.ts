import { WebScraperService } from '../WebScraperService';

describe('WebScraperService - IELTS Appointment Fix', () => {
  let webScraperService: WebScraperService;

  beforeEach(() => {
    webScraperService = new WebScraperService();
  });

  afterEach(async () => {
    await webScraperService.close();
  });

  describe('IELTS-specific HTML parsing', () => {
    it('should correctly parse appointment with disabled status', async () => {
      // Mock HTML structure based on the user's example
      const mockHtml = `
        <html>
          <body>
            <a class="exam__item ielts disabled">
              <time><date><span>27 Oct</span><span>2025</span></date></time>
              <div both="" style="display: flex;flex-direction: column;justify-content: center;align-items: center;">
                <span class="exam_type">cdielts&nbsp;-&nbsp;(Ac/Gt)</span>
                <em> ظهر (۱۳:۳۰ - ۱۶:۳۰)</em>
              </div>
              <span class="farsi_date">۱۴۰۴/۰۸/۰۵</span>
              <h5>اصفهان (ایده نواندیش)</h5>
              <h6>۲۷۳,۰۰۶,۲۵۰ ریال</h6>
              <span class="btn disable">تکمیل ظرفیت</span>
            </a>
          </body>
        </html>
      `;

      // Mock the scrapeAppointmentsWithStatusFromUrl method
      (webScraperService as any).scrapeAppointmentsWithStatusFromUrl = jest.fn().mockResolvedValue({
        type: 'filled',
        appointmentCount: 1,
        availableCount: 0,
        filledCount: 1,
        timestamp: new Date(),
        url: 'https://irsafam.org/ielts/timetable?city%5B%5D=isfahan&model%5B%5D=cdielts&month%5B%5D=10',
        appointments: [{
          id: 'appointment-test-1',
          date: '2025-10-27',
          time: 'ظهر (13:30 - 16:30)',
          location: 'اصفهان (ایده نواندیش)',
          examType: 'CDIELTS',
          city: 'Isfahan',
          status: 'filled',
          price: 273006250,
          registrationUrl: undefined,
          rawHtml: mockHtml
        }]
      });

      const filters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [10]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('filled');
      expect(result.appointmentCount).toBe(1);
      expect(result.availableCount).toBe(0);
      expect(result.filledCount).toBe(1);
      expect(result.appointments).toHaveLength(1);

      const appointment = result.appointments[0];
      expect(appointment.date).toBe('2025-10-27');
      expect(appointment.time).toBe('ظهر (13:30 - 16:30)');
      expect(appointment.location).toBe('اصفهان (ایده نواندیش)');
      expect(appointment.status).toBe('filled');
      expect(appointment.price).toBe(273006250);
    });

    it('should correctly parse multiple appointments with mixed statuses', async () => {
      // Mock the method to return multiple appointments
      (webScraperService as any).scrapeAppointmentsWithStatusFromUrl = jest.fn().mockResolvedValue({
        type: 'available',
        appointmentCount: 2,
        availableCount: 1,
        filledCount: 1,
        timestamp: new Date(),
        url: 'https://irsafam.org/ielts/timetable?city%5B%5D=isfahan&model%5B%5D=cdielts&month%5B%5D=10',
        appointments: [
          {
            id: 'appointment-test-1',
            date: '2025-10-27',
            time: 'ظهر (13:30 - 16:30)',
            location: 'اصفهان (مرکز اول)',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'filled',
            price: 273006250
          },
          {
            id: 'appointment-test-2',
            date: '2025-10-28',
            time: 'صبح (09:00 - 12:00)',
            location: 'اصفهان (مرکز دوم)',
            examType: 'CDIELTS',
            city: 'Isfahan',
            status: 'available',
            price: 273006250
          }
        ]
      });

      const filters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [10]
      };

      const result = await webScraperService.fetchAppointmentsWithStatus(filters);

      expect(result.type).toBe('available');
      expect(result.appointmentCount).toBe(2);
      expect(result.availableCount).toBe(1);
      expect(result.filledCount).toBe(1);
      expect(result.appointments).toHaveLength(2);

      // Check that we have both filled and available appointments
      const filledAppointments = result.appointments.filter(apt => apt.status === 'filled');
      const availableAppointments = result.appointments.filter(apt => apt.status === 'available');
      
      expect(filledAppointments).toHaveLength(1);
      expect(availableAppointments).toHaveLength(1);
    });
  });

  describe('URL building', () => {
    it('should build correct URL for IELTS filters', () => {
      const filters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [10]
      };

      const url = webScraperService.buildRequestUrl(filters, 10);
      expect(url).toBe('https://irsafam.org/ielts/timetable?city%5B%5D=isfahan&model%5B%5D=cdielts&month%5B%5D=10');
    });

    it('should build multiple URLs for multiple months', () => {
      const filters = {
        city: ['isfahan'],
        examModel: ['cdielts'],
        months: [10, 11, 12]
      };

      const urls = webScraperService.buildRequestUrls(filters);
      expect(urls).toHaveLength(3);
      expect(urls[0]).toContain('month%5B%5D=10');
      expect(urls[1]).toContain('month%5B%5D=11');
      expect(urls[2]).toContain('month%5B%5D=12');
    });
  });
});