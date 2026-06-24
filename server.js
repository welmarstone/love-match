import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initial Database Structure
const initialDb = {
  locations: {
    partner1: {
      lat: 50.0755, // Prague
      lng: 14.4378,
      name: 'Prague',
      timestamp: Date.now(),
    },
    partner2: {
      lat: 39.3008, // Cosenza
      lng: 16.2521,
      name: 'Cosenza',
      timestamp: Date.now(),
    },
  },
  streak: {
    count: 0,
    lastStreakDate: null, // 'YYYY-MM-DD'
    taps: {
      partner1: null, // 'YYYY-MM-DD'
      partner2: null, // 'YYYY-MM-DD'
    },
  },
  photos: [],
};

// Database Helper Functions
function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading DB:', error);
  }
  return initialDb;
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing DB:', error);
  }
}

// Ensure DB file exists
if (!fs.existsSync(DB_FILE)) {
  writeDb(initialDb);
}

// Express Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve Static Frontend Assets (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// Configure Multer for Photo Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'photo-' + uniqueSuffix + ext);
  },
});
const upload = multer({ storage });

// WebSocket Connection Hub
const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`WebSocket client connected. Total: ${clients.size}`);

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      // We can broadcast messages (e.g. heartbeat) to all other clients
      broadcast(parsed, ws);
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`WebSocket client disconnected. Total: ${clients.size}`);
  });
});

// Broadcast helper
function broadcast(data, excludeWs = null) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client !== excludeWs && client.readyState === 1) {
      client.send(payload);
    }
  }
}

// Upgrade HTTP to WS
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// API Routes

// 1. Get/Set Locations
app.get('/api/location', (req, res) => {
  const db = readDb();
  res.json(db.locations);
});

app.post('/api/location', (req, res) => {
  const { userId, lat, lng, name } = req.body;
  if (!userId || !lat || !lng) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const db = readDb();
  const partnerKey = userId === 'partner1' ? 'partner1' : 'partner2';

  db.locations[partnerKey] = {
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    name: name || db.locations[partnerKey].name,
    timestamp: Date.now(),
  };

  writeDb(db);
  broadcast({ type: 'location_update', data: db.locations });
  res.json({ success: true, locations: db.locations });
});

// 2. Photos Endpoints
app.get('/api/photos', (req, res) => {
  const db = readDb();
  res.json(db.photos);
});

app.post('/api/photos', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo file uploaded' });
  }

  const { caption, uploader } = req.body;
  const db = readDb();

  const photoEntry = {
    id: Date.now().toString(),
    url: `/uploads/${req.file.filename}`,
    caption: caption || '',
    uploader: uploader || 'Someone',
    timestamp: Date.now(),
  };

  db.photos.unshift(photoEntry); // Add new photo to the beginning
  writeDb(db);
  broadcast({ type: 'photo_uploaded', data: photoEntry });

  res.json({ success: true, photo: photoEntry });
});

// Delete photo
app.delete('/api/photos/:id', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const photoIndex = db.photos.findIndex((p) => p.id === id);

  if (photoIndex === -1) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  const photo = db.photos[photoIndex];
  const filename = path.basename(photo.url);
  const filepath = path.join(UPLOADS_DIR, filename);

  // Delete file from disk
  if (fs.existsSync(filepath)) {
    try {
      fs.unlinkSync(filepath);
    } catch (e) {
      console.error('Error deleting photo file:', e);
    }
  }

  db.photos.splice(photoIndex, 1);
  writeDb(db);
  broadcast({ type: 'photo_deleted', data: id });

  res.json({ success: true });
});

// 3. Streak & Hearts Endpoints
app.get('/api/streak', (req, res) => {
  const db = readDb();
  res.json(db.streak);
});

app.post('/api/heart', (req, res) => {
  const { userId } = req.body;
  if (!userId || (userId !== 'partner1' && userId !== 'partner2')) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const db = readDb();
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC (close enough for Czech/Italy)
  
  const partnerKey = userId;
  const otherPartnerKey = userId === 'partner1' ? 'partner2' : 'partner1';

  // Record today's tap for this user
  db.streak.taps[partnerKey] = todayStr;

  // Check if both users tapped today
  const hasPartnerTappedToday = db.streak.taps[otherPartnerKey] === todayStr;

  let streakUpdated = false;

  if (hasPartnerTappedToday) {
    // If they haven't locked in a streak for today yet
    if (db.streak.lastStreakDate !== todayStr) {
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      if (db.streak.lastStreakDate === yesterdayStr) {
        // Streak continues
        db.streak.count += 1;
      } else if (db.streak.lastStreakDate === todayStr) {
        // Already registered today, do nothing
      } else {
        // Streak reset to 1 (first day of new streak)
        db.streak.count = 1;
      }
      db.streak.lastStreakDate = todayStr;
      streakUpdated = true;
    }
  }

  // Save changes
  writeDb(db);

  // Broadcast WebSocket messages
  // 1. Send immediate heart pulse to the other partner
  broadcast({ type: 'heart_pulse', senderId: userId });

  // 2. Broadcast streak update if it changed
  if (streakUpdated) {
    broadcast({ type: 'streak_updated', data: db.streak });
  }

  res.json({
    success: true,
    streak: db.streak,
    streakUpdated,
  });
});

// Catch-all route to serve Index.html for Single Page Application routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
