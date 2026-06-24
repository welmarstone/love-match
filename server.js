import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'url';
import pathModule from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import cors from 'cors';
import webpush from 'web-push';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathModule.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = process.env.PORT || 5000;
const DB_FILE = pathModule.join(__dirname, 'db.json');
const UPLOADS_DIR = pathModule.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initial Database Structure
const initialDb = {
  vapidKeys: null,
  subscriptions: {}, // { partner1: sub, partner2: sub }
  reminders: [],
  hydrationSchedules: {}, // { partner1: { date, times: [], fired: [] }, ... }
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

// Setup VAPID keys for Web Push
const db = readDb();
let vapidKeys = db.vapidKeys;
if (!vapidKeys) {
  vapidKeys = webpush.generateVAPIDKeys();
  db.vapidKeys = vapidKeys;
  writeDb(db);
}
webpush.setVapidDetails(
  'mailto:mehin-app-admin@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Express Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve Static Frontend Assets (Vite build output)
app.use(express.static(pathModule.join(__dirname, 'dist')));

// Configure Multer for Photo Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = pathModule.extname(file.originalname);
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
      // Broadcast messages to other clients
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

// 1. Web Push Endpoints
app.get('/api/vapid-public-key', (req, res) => {
  const db = readDb();
  res.send(db.vapidKeys.publicKey);
});

app.post('/api/subscribe', (req, res) => {
  const { userId, subscription } = req.body;
  if (!userId || !subscription) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const db = readDb();
  if (!db.subscriptions) db.subscriptions = {};
  db.subscriptions[userId] = subscription;
  writeDb(db);

  console.log(`Saved push subscription for ${userId}`);
  res.json({ success: true });
});

// 2. Get/Set Locations
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

// 3. Photos Endpoints
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

  db.photos.unshift(photoEntry);
  writeDb(db);
  broadcast({ type: 'photo_uploaded', data: photoEntry });

  // Send Push notification to partner about new memory
  const partnerId = uploader === 'partner1' ? 'partner2' : 'partner1';
  const subscription = db.subscriptions?.[partnerId];
  if (subscription) {
    sendPushNotification(subscription, {
      title: 'New Memory Shared! 📸',
      body: `${uploader === 'partner1' ? 'Prague' : 'Cosenza'} uploaded a new photo: "${caption || 'Untitled'}"`,
      icon: '/mehin_icon.png'
    });
  }

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
  const filename = pathModule.basename(photo.url);
  const filepath = pathModule.join(UPLOADS_DIR, filename);

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

// 4. Streak & Hearts Endpoints
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
  const todayStr = new Date().toISOString().split('T')[0];
  
  const partnerKey = userId;
  const otherPartnerKey = userId === 'partner1' ? 'partner2' : 'partner1';

  db.streak.taps[partnerKey] = todayStr;

  const hasPartnerTappedToday = db.streak.taps[otherPartnerKey] === todayStr;
  let streakUpdated = false;

  if (hasPartnerTappedToday) {
    if (db.streak.lastStreakDate !== todayStr) {
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      if (db.streak.lastStreakDate === yesterdayStr) {
        db.streak.count += 1;
      } else if (db.streak.lastStreakDate === todayStr) {
        // Already logged
      } else {
        db.streak.count = 1;
      }
      db.streak.lastStreakDate = todayStr;
      streakUpdated = true;
    }
  }

  writeDb(db);

  // Send WebSocket heart beat to partner
  broadcast({ type: 'heart_pulse', senderId: userId });

  if (streakUpdated) {
    broadcast({ type: 'streak_updated', data: db.streak });
  }

  // Push notification to partner (even if app is closed!)
  const subscription = db.subscriptions?.[otherPartnerKey];
  if (subscription) {
    const pushPayload = {
      title: 'Mehin heartbeat 💓',
      body: streakUpdated 
        ? `Daily connection complete! Streak is now ${db.streak.count} days! 🔥`
        : `Your partner sent you a heartbeat! Tap to complete today's streak! ❤️`,
      icon: '/mehin_icon.png'
    };
    sendPushNotification(subscription, pushPayload);
  }

  res.json({
    success: true,
    streak: db.streak,
    streakUpdated,
  });
});

// 5. Reminders Endpoints
app.get('/api/reminders', (req, res) => {
  const db = readDb();
  res.json(db.reminders || []);
});

app.post('/api/reminders', (req, res) => {
  const { title, date, time, targetTimestamp, userId } = req.body;
  if (!title || !date || !time || !targetTimestamp || !userId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const db = readDb();
  if (!db.reminders) db.reminders = [];

  const newReminder = {
    id: Date.now().toString(),
    title,
    date,
    time,
    targetTimestamp: parseInt(targetTimestamp, 10),
    userId,
    triggered: false,
  };

  db.reminders.push(newReminder);
  db.reminders.sort((a, b) => a.targetTimestamp - b.targetTimestamp);
  writeDb(db);

  broadcast({ type: 'reminders_updated', data: db.reminders });
  res.json({ success: true, reminder: newReminder });
});

app.delete('/api/reminders/:id', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db.reminders) db.reminders = [];

  const index = db.reminders.findIndex((r) => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Reminder not found' });
  }

  db.reminders.splice(index, 1);
  writeDb(db);

  broadcast({ type: 'reminders_updated', data: db.reminders });
  res.json({ success: true });
});

// Catch-all route to serve Vite index.html
app.get('*', (req, res) => {
  res.sendFile(pathModule.join(__dirname, 'dist', 'index.html'));
});

// Web Push Sender Helper
function sendPushNotification(subscription, payload) {
  webpush.sendNotification(subscription, JSON.stringify(payload))
    .then((result) => console.log('Push notification sent, status:', result.statusCode))
    .catch((err) => {
      console.error('Error sending push notification:', err);
    });
}

// Background Scheduler (Runs every 30 seconds to check reminders and random alerts)
setInterval(() => {
  const db = readDb();
  let dbChanged = false;
  const now = Date.now();

  // 1. Check Reminders
  if (db.reminders) {
    db.reminders.forEach((reminder) => {
      if (!reminder.triggered && now >= reminder.targetTimestamp) {
        reminder.triggered = true;
        dbChanged = true;

        console.log(`Reminder due: ${reminder.title} for user ${reminder.userId}`);

        // Dispatch Push Notification
        const subscription = db.subscriptions?.[reminder.userId];
        if (subscription) {
          sendPushNotification(subscription, {
            title: `Reminder: ${reminder.title} ⏰`,
            body: `It is now time for your scheduled reminder!`,
            icon: '/mehin_icon.png'
          });
        }
      }
    });
  }

  // 2. Check Hydration Schedules (Morning, Afternoon, Evening Alerts)
  const todayStr = new Date().toISOString().split('T')[0];
  if (!db.hydrationSchedules) db.hydrationSchedules = {};

  ['partner1', 'partner2'].forEach((user) => {
    let schedule = db.hydrationSchedules[user];

    // Generate times for today if empty/different date
    if (!schedule || schedule.date !== todayStr) {
      const baseTime = new Date();
      // Morning (9:30-12:30)
      const t1 = new Date(baseTime.getFullYear(), baseTime.getMonth(), baseTime.getDate(), 9 + Math.random() * 3, Math.random() * 60).getTime();
      // Afternoon (13:30-17:30)
      const t2 = new Date(baseTime.getFullYear(), baseTime.getMonth(), baseTime.getDate(), 13 + Math.random() * 4, Math.random() * 60).getTime();
      // Evening (18:30-21:30)
      const t3 = new Date(baseTime.getFullYear(), baseTime.getMonth(), baseTime.getDate(), 18 + Math.random() * 3.5, Math.random() * 60).getTime();

      schedule = {
        date: todayStr,
        times: [t1, t2, t3],
        fired: [false, false, false]
      };
      db.hydrationSchedules[user] = schedule;
      dbChanged = true;
    }

    // Trigger due scheduled push notifications
    for (let i = 0; i < 3; i++) {
      if (!schedule.fired[i] && now >= schedule.times[i]) {
        schedule.fired[i] = true;
        dbChanged = true;

        console.log(`Scheduled push due for ${user}, index ${i}`);

        const subscription = db.subscriptions?.[user];
        if (subscription) {
          const quotes = [
            "Hey beautiful, time to drink a glass of water! 💧",
            "Remember that I love you! Hope your day is going great! ❤️",
            "Just a little reminder to take a deep breath and stay hydrated! 🌸",
            "Thinking of you from Prague... go drink some water! 🇨🇿☕",
            "Hydrated partners are the healthiest! Drink up! 👑💦",
            "Sending a huge virtual hug your way... and a glass of water! 🤗🥛",
            "A sip of water for you, a beat of my heart for you! ❤️‍🔥",
            "Distance means nothing when you stay healthy and happy. Sip some water! 🗺️",
            "You make my world spin! Keep that beautiful smile hydrated! ✨"
          ];
          const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
          sendPushNotification(subscription, {
            title: 'Mehin Love Note 💖',
            body: randomQuote,
            icon: '/mehin_icon.png'
          });
        }
      }
    }
  });

  if (dbChanged) {
    writeDb(db);
  }
}, 30000); // Check every 30 seconds

// Start Server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
