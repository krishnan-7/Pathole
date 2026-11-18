/**
 * Smart Pothole Detection & Real-Time Camera Monitoring System
 * Backend Server (Node.js + Express)
 * 
 * Provides:
 * - Static file serving for Dashboard UI
 * - REST API for Pothole Event Persistence
 * - Localhost:3000 execution & Vercel serverless compatibility
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for external client access
app.use(cors());

// Support large JSON payloads for base64 captured images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Disable HTTP caching so updated frontend JS & CSS always load instantly
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Static file serving from public/ directory
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { etag: false, maxAge: 0 }));

// In-memory data store for pothole events with optional local file backup
const DATA_FILE = path.join(__dirname, 'events_db.json');
let eventsDatabase = [];

// Load existing events from disk if available
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    eventsDatabase = JSON.parse(raw);
    console.log(`[Storage] Loaded ${eventsDatabase.length} persisted events from disk.`);
  }
} catch (err) {
  console.warn('[Storage] Could not load events_db.json, starting fresh:', err.message);
}

// Helper to save to disk safely
function persistEvents() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(eventsDatabase, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Storage] Failed to save events to disk:', err.message);
  }
}

// ==================== REST API ENDPOINTS ====================

// Server Health & Status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'ESP32 Smart Pothole Detection System',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    storedEventsCount: eventsDatabase.length
  });
});

// Get all detection events
app.get('/api/events', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  // Return most recent first
  const sorted = [...eventsDatabase].reverse().slice(0, limit);
  res.json({
    success: true,
    total: eventsDatabase.length,
    events: sorted
  });
});

// Post a new pothole detection event
app.post('/api/events', (req, res) => {
  try {
    const { eventId, timestamp, distance, zone, led, buzzer, imageBase64, isTest } = req.body;

    if (!eventId || distance === undefined || !zone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required event fields: eventId, distance, and zone are required.'
      });
    }

    const newEvent = {
      id: eventId,
      timestamp: timestamp || new Date().toISOString(),
      distance: parseFloat(distance),
      zone: zone,
      led: led || 'OFF',
      buzzer: buzzer || 'OFF',
      imageBase64: imageBase64 || null,
      isTest: Boolean(isTest),
      receivedAt: new Date().toISOString()
    };

    // If it's a test image, do not save to permanent history according to requirements
    if (!isTest) {
      eventsDatabase.push(newEvent);
      persistEvents();
      console.log(`[Event Logged] Event ${newEvent.id} recorded at ${newEvent.distance} cm (${newEvent.zone})`);
    } else {
      console.log(`[Test Event] Manual test image received: ${newEvent.id}`);
    }

    res.status(201).json({
      success: true,
      message: isTest ? 'Test image verified' : 'Pothole event successfully recorded',
      event: newEvent
    });
  } catch (err) {
    console.error('[API Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a single event by ID
app.delete('/api/events/:id', (req, res) => {
  const id = req.params.id;
  const initialLength = eventsDatabase.length;
  eventsDatabase = eventsDatabase.filter(e => e.id !== id);

  if (eventsDatabase.length !== initialLength) {
    persistEvents();
    res.json({ success: true, message: `Event ${id} deleted.` });
  } else {
    res.status(404).json({ success: false, error: 'Event not found.' });
  }
});

// Clear all events
app.delete('/api/events', (req, res) => {
  eventsDatabase = [];
  persistEvents();
  res.json({ success: true, message: 'All pothole history cleared.' });
});

// Export events as downloadable JSON
app.get('/api/export', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="pothole_detection_export.json"');
  res.send(JSON.stringify(eventsDatabase, null, 2));
});

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start the server (only if run directly, compatible with Vercel serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('========================================================');
    console.log('  ESP32 Smart Pothole Detection & Real-Time Monitoring  ');
    console.log(`  Server running at: http://localhost:${PORT}          `);
    console.log('========================================================');
  });
}

module.exports = app;
