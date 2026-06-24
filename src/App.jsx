import React, { useState, useEffect, useRef } from 'react';
import { Heart, Map, Droplet, Calendar, Image as ImageIcon, Settings } from 'lucide-react';
import HeartPulse from './components/HeartPulse';
import MapTracker from './components/MapTracker';
import WaterTracker from './components/WaterTracker';
import ReminderPlanner from './components/ReminderPlanner';
import Gallery from './components/Gallery';

// Helper for converting base64 VAPID public key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  // User Configurations
  const [userId, setUserId] = useState(() => localStorage.getItem('mehin_user_id') || 'partner1');
  const [userName, setUserName] = useState(() => localStorage.getItem('mehin_user_name') || '');
  const [partnerName, setPartnerName] = useState(() => localStorage.getItem('mehin_partner_name') || '');

  // Synchronized States
  const [locations, setLocations] = useState({
    partner1: { lat: 50.0755, lng: 14.4378, name: 'Prague', timestamp: Date.now() },
    partner2: { lat: 39.3008, lng: 16.2521, name: 'Cosenza', timestamp: Date.now() },
  });

  const [streak, setStreak] = useState({
    count: 0,
    lastStreakDate: null,
    taps: { partner1: null, partner2: null },
  });

  const [photos, setPhotos] = useState([]);
  const [reminders, setReminders] = useState([]);
  
  // Real-time states
  const [wsConnected, setWsConnected] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState([]);

  const wsRef = useRef(null);

  // Sync settings updates to localStorage
  useEffect(() => {
    localStorage.setItem('mehin_user_id', userId);
    // Refresh push subscription if roles change
    checkPushSubscription();
  }, [userId]);

  useEffect(() => {
    localStorage.setItem('mehin_user_name', userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem('mehin_partner_name', partnerName);
  }, [partnerName]);

  // Load initial configurations from REST API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const locRes = await fetch('/api/location');
        if (locRes.ok) setLocations(await locRes.json());

        const streakRes = await fetch('/api/streak');
        if (streakRes.ok) setStreak(await streakRes.json());

        const photosRes = await fetch('/api/photos');
        if (photosRes.ok) setPhotos(await photosRes.json());

        const remindersRes = await fetch('/api/reminders');
        if (remindersRes.ok) setReminders(await remindersRes.json());
      } catch (error) {
        console.error('Error fetching initial REST states:', error);
      }
    };
    fetchData();
    checkPushSubscription();
  }, []);

  // Check if browser is subscribed to push
  const checkPushSubscription = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushSubscribed(!!sub);
    }
  };

  // Subscribe to Web Push Notifications
  const handleSubscribePush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Push notifications are not supported in this browser.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const existingSub = await reg.pushManager.getSubscription();

      if (existingSub) {
        await sendSubscriptionToBackend(existingSub);
        setPushSubscribed(true);
        alert('Lock-Screen Alerts are active!');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Permission for notifications denied.');
        return;
      }

      const keyRes = await fetch('/api/vapid-public-key');
      if (!keyRes.ok) throw new Error('Could not fetch public VAPID key');
      const publicKeyBase64 = await keyRes.text();
      const convertedKey = urlBase64ToUint8Array(publicKeyBase64);

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      await sendSubscriptionToBackend(sub);
      setPushSubscribed(true);
      alert('Success! Lock-Screen Alerts enabled successfully.');
    } catch (err) {
      console.error('Failed to subscribe to Web Push:', err);
      alert('Push registration failed. Make sure you run over localhost or HTTPS.');
    }
  };

  const sendSubscriptionToBackend = async (subscription) => {
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription }),
    });
  };

  // WebSockets synchronization listener
  useEffect(() => {
    const connectWs = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.port === '5173' ? 'localhost:5000' : window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}/ws`;

      console.log('Connecting to WS:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
        console.log('WS Connection active.');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WS Message:', message);

          switch (message.type) {
            case 'heart_pulse':
              spawnHearts();
              fetchStreak();
              break;
            case 'streak_updated':
              setStreak(message.data);
              break;
            case 'location_update':
              setLocations(message.data);
              break;
            case 'photo_uploaded':
              setPhotos((prev) => [message.data, ...prev]);
              break;
            case 'photo_deleted':
              setPhotos((prev) => prev.filter((p) => p.id !== message.data));
              break;
            case 'reminders_updated':
              setReminders(message.data);
              break;
            default:
              break;
          }
        } catch (err) {
          console.error(err);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        console.log('WS Disconnected. Retry in 5s...');
        setTimeout(connectWs, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    };

    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const fetchStreak = async () => {
    const res = await fetch('/api/streak');
    if (res.ok) setStreak(await res.json());
  };

  const spawnHearts = () => {
    const fresh = Array.from({ length: 18 }).map(() => ({
      id: Date.now() + Math.random(),
      left: Math.random() * 90 + 5,
      size: Math.random() * 25 + 15,
      delay: Math.random() * 1.2,
      duration: Math.random() * 2.5 + 1.5,
    }));
    setFloatingHearts((prev) => [...prev, ...fresh]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => !fresh.find((fh) => fh.id === h.id)));
    }, 4500);
  };

  // API Callback Handlers
  const handleHeartTap = async () => {
    const res = await fetch('/api/heart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      const data = await res.json();
      setStreak(data.streak);
    }
  };

  const handleLocationUpdate = async (lat, lng) => {
    const res = await fetch('/api/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        lat,
        lng,
        name: userId === 'partner1' ? 'Prague' : 'Cosenza',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setLocations(data.locations);
    }
  };

  const handlePhotoUpload = async (formData) => {
    const res = await fetch('/api/photos', {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      setPhotos((prev) => [data.photo, ...prev]);
    }
  };

  const handlePhotoDelete = async (id) => {
    const res = await fetch(`/api/photos/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleAddReminder = async (reminderData) => {
    const res = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reminderData),
    });
    if (res.ok) {
      const data = await res.json();
      setReminders((prev) => [...prev, data.reminder].sort((a, b) => a.targetTimestamp - b.targetTimestamp));
    }
  };

  const handleDeleteReminder = async (id) => {
    const res = await fetch(`/api/reminders/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setReminders((prev) => prev.filter((r) => r.id !== id));
    }
  };

  return (
    <div className="app-container">
      {/* Floating Hearts Overlay */}
      <div className="floating-hearts-container">
        {floatingHearts.map((heart) => (
          <div
            key={heart.id}
            className="floating-heart"
            style={{
              left: `${heart.left}%`,
              fontSize: `${heart.size}px`,
              animationDelay: `${heart.delay}s`,
              animationDuration: `${heart.duration}s`,
            }}
          >
            ❤️
          </div>
        ))}
      </div>

      {/* App Header */}
      <header className="header">
        <div className="logo-container">
          <span style={{ fontSize: '20px' }}>💖</span>
          <span className="logo-text">Mehin and Elmar</span>
        </div>
        <div className="header-actions">
          <div
            style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '12px',
              background: wsConnected ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: wsConnected ? '#4ade80' : '#ef4444',
              border: `1px solid ${wsConnected ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: wsConnected ? '#4ade80' : '#ef4444',
                display: 'inline-block',
              }}
            ></span>
            {wsConnected ? 'Connected' : 'Offline'}
          </div>
        </div>
      </header>

      {/* Main Content Pane */}
      <main className="main-content">
        {activeTab === 'home' && (
          <HeartPulse
            streak={streak}
            userId={userId}
            partnerName={partnerName}
            onHeartTap={handleHeartTap}
            triggerPulse={spawnHearts}
          />
        )}

        {activeTab === 'map' && (
          <MapTracker
            locations={locations}
            userId={userId}
            userName={userName}
            partnerName={partnerName}
            onLocationUpdate={handleLocationUpdate}
          />
        )}

        {activeTab === 'water' && (
          <WaterTracker 
            partnerName={partnerName} 
            pushSubscribed={pushSubscribed}
            onSubscribePush={handleSubscribePush}
          />
        )}

        {activeTab === 'planner' && (
          <ReminderPlanner 
            reminders={reminders}
            userId={userId}
            userName={userName}
            partnerName={partnerName}
            onAddReminder={handleAddReminder}
            onDeleteReminder={handleDeleteReminder}
          />
        )}

        {activeTab === 'gallery' && (
          <Gallery
            photos={photos}
            userName={userName}
            onPhotoUpload={handlePhotoUpload}
            onPhotoDelete={handlePhotoDelete}
          />
        )}

        {activeTab === 'settings' && (
          <div className="glass-card">
            <h2 className="romantic-title" style={{ fontSize: '24px', marginBottom: '8px' }}>Settings</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Personalize your connection preferences
            </p>

            <div className="settings-form">
              <div className="form-group">
                <label className="form-label">My Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Tomas"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Partner's Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="e.g. Giulia"
                />
              </div>

              <div className="form-group">
                <label className="form-label">My Current Role / Station</label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  <button
                    className={`btn-secondary ${userId === 'partner1' ? 'btn-primary' : ''}`}
                    style={{ flex: 1, padding: '12px 10px', fontSize: '13px' }}
                    onClick={() => setUserId('partner1')}
                  >
                    Partner Prague 🇨🇿
                  </button>
                  <button
                    className={`btn-secondary ${userId === 'partner2' ? 'btn-primary' : ''}`}
                    style={{ flex: 1, padding: '12px 10px', fontSize: '13px' }}
                    onClick={() => setUserId('partner2')}
                  >
                    Partner Cosenza 🇮🇹
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.4' }}>
                  Select "Partner Prague" if you are located in the north/sending station. Select "Partner Cosenza" to assume the southern station. This aligns map pins correctly.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Navigation tabs */}
      <nav className="nav-bar">
        <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
          <Heart size={22} />
          <span>Home</span>
        </button>

        <button className={`nav-item ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
          <Map size={22} />
          <span>Map</span>
        </button>

        <button className={`nav-item ${activeTab === 'water' ? 'active' : ''}`} onClick={() => setActiveTab('water')}>
          <Droplet size={22} />
          <span>Water</span>
        </button>

        <button className={`nav-item ${activeTab === 'planner' ? 'active' : ''}`} onClick={() => setActiveTab('planner')}>
          <Calendar size={22} />
          <span>Alerts</span>
        </button>

        <button className={`nav-item ${activeTab === 'gallery' ? 'active' : ''}`} onClick={() => setActiveTab('gallery')}>
          <ImageIcon size={22} />
          <span>Gallery</span>
        </button>

        <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings size={22} />
          <span>Setup</span>
        </button>
      </nav>
    </div>
  );
}
