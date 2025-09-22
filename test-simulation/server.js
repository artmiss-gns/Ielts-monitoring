const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data file path
const DATA_FILE = path.join(__dirname, 'data', 'appointments.json');

// Utility function to read appointments data
async function readAppointments() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Return empty array if file doesn't exist or is corrupted
    console.log('No appointments file found or corrupted, starting with empty array');
    return [];
  }
}

// Utility function to write appointments data
async function writeAppointments(appointments) {
  try {
    // Ensure data directory exists
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(appointments, null, 2));
  } catch (error) {
    console.error('Error writing appointments data:', error);
    throw error;
  }
}

// API Routes
app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await readAppointments();
    res.json(appointments);
  } catch (error) {
    console.error('Error reading appointments:', error);
    res.status(500).json({ error: 'Failed to read appointments' });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const appointments = await readAppointments();
    const newAppointment = req.body;

    // Basic validation
    if (!newAppointment.id || !newAppointment.date || !newAppointment.time) {
      return res.status(400).json({ error: 'Missing required fields: id, date, time' });
    }

    appointments.push(newAppointment);
    await writeAppointments(appointments);

    res.status(201).json(newAppointment);
  } catch (error) {
    console.error('Error adding appointment:', error);
    res.status(500).json({ error: 'Failed to add appointment' });
  }
});

app.delete('/api/appointments', async (req, res) => {
  try {
    await writeAppointments([]);
    res.json({ message: 'All appointments cleared' });
  } catch (error) {
    console.error('Error clearing appointments:', error);
    res.status(500).json({ error: 'Failed to clear appointments' });
  }
});

app.put('/api/appointments/:id', async (req, res) => {
  try {
    const appointments = await readAppointments();
    const appointmentId = req.params.id;
    const updatedData = req.body;

    const index = appointments.findIndex(apt => apt.id === appointmentId);
    if (index === -1) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    appointments[index] = { ...appointments[index], ...updatedData };
    await writeAppointments(appointments);

    res.json(appointments[index]);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// IELTS timetable route (matches real website path)
app.get('/ielts/timetable', (req, res) => {
  const timetablePath = path.join(__dirname, 'public', 'ielts-timetable.html');
  res.sendFile(timetablePath, (err) => {
    if (err) {
      console.error('Error serving IELTS timetable:', err);
      res.status(500).json({ error: 'Failed to load IELTS timetable' });
    }
  });
});

// Route to reset appointments to default test data
app.post('/api/reset-test-data', async (req, res) => {
  try {
    const defaultAppointments = [
      {
        "id": "filled-1",
        "date": "2025-10-27",
        "time": "ظهر (۱۳:۳۰ - ۱۶:۳۰)",
        "location": "اصفهان (ایده نواندیش)",
        "city": "Isfahan",
        "examType": "cdielts - (Ac/Gt)",
        "price": "۲۹۱,۱۱۵,۰۰۰ ریال",
        "persianDate": "۱۴۰۴/۰۸/۰۵",
        "status": "filled",
        "filledIndicators": ["disabled", "تکمیل ظرفیت"],
        "registrationUrl": null
      },
      {
        "id": "filled-2", 
        "date": "2025-11-03",
        "time": "صبح (۰۹:۰۰ - ۱۲:۰۰)",
        "location": "اصفهان (ایده نواندیش)",
        "city": "Isfahan",
        "examType": "cdielts - (Ac/Gt)",
        "price": "۲۹۱,۱۱۵,۰۰۰ ریال",
        "persianDate": "۱۴۰۴/۰۸/۱۲",
        "status": "filled",
        "filledIndicators": ["disabled", "تکمیل ظرفیت"],
        "registrationUrl": null
      },
      {
        "id": "available-1",
        "date": "2025-11-10",
        "time": "ظهر (۱۳:۳۰ - ۱۶:۳۰)",
        "location": "اصفهان (ایده نواندیش)",
        "city": "Isfahan", 
        "examType": "cdielts - (Ac/Gt)",
        "price": "۲۹۱,۱۱۵,۰۰۰ ریال",
        "persianDate": "۱۴۰۴/۰۸/۱۹",
        "status": "available",
        "filledIndicators": [],
        "availableIndicators": ["قابل ثبت نام", "active-button"],
        "registrationUrl": "https://irsafam.org/ielts/register/available-1"
      },
      {
        "id": "available-2",
        "date": "2025-11-17",
        "time": "صبح (۰۹:۰۰ - ۱۲:۰۰)",
        "location": "تهران (مرکز آزمون)",
        "city": "Tehran",
        "examType": "cdielts - (Ac/Gt)",
        "price": "۲۹۱,۱۱۵,۰۰۰ ریال",
        "persianDate": "۱۴۰۴/۰۸/۲۶",
        "status": "available",
        "filledIndicators": [],
        "availableIndicators": ["قابل ثبت نام", "active-button"],
        "registrationUrl": "https://irsafam.org/ielts/register/available-2"
      }
    ];
    
    await writeAppointments(defaultAppointments);
    res.json({ message: 'Test data reset successfully', count: defaultAppointments.length });
  } catch (error) {
    console.error('Error resetting test data:', error);
    res.status(500).json({ error: 'Failed to reset test data' });
  }
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // If index.html doesn't exist, send a simple response
      res.status(404).json({
        error: 'Page not found',
        message: 'This is the IELTS Test Simulation Server. Use /api endpoints for data access.',
        endpoints: [
          'GET /api/appointments',
          'POST /api/appointments',
          'PUT /api/appointments/:id',
          'DELETE /api/appointments',
          'GET /health',
          'GET /ielts/timetable',
          'POST /api/reset-test-data'
        ]
      });
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`IELTS Test Simulation Server running on http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop the server');
});

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      console.error('Error during server shutdown:', err);
      process.exit(1);
    }

    console.log('Server closed successfully');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

module.exports = app;