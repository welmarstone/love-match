import React, { useState, useEffect } from 'react';
import { Droplet, Bell, BellOff, Compass } from 'lucide-react';

const SWEET_QUOTES = [
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

export default function WaterTracker({ partnerName }) {
  const [waterAmount, setWaterAmount] = useState(() => {
    const saved = localStorage.getItem('mehin_water_log');
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem('mehin_water_date');
    if (savedDate === today && saved) {
      return parseInt(saved, 10);
    }
    return 0;
  });

  const [notifsEnabled, setNotifsEnabled] = useState(() => {
    return localStorage.getItem('mehin_notifs_enabled') === 'true';
  });

  const [nextNotifTime, setNextNotifTime] = useState('');
  const dailyGoal = 2000; // 2L standard goal
  const percentFilled = Math.min((waterAmount / dailyGoal) * 100, 100);

  // Save water log
  useEffect(() => {
    localStorage.setItem('mehin_water_log', waterAmount.toString());
    localStorage.setItem('mehin_water_date', new Date().toDateString());
  }, [waterAmount]);

  // Request notifications permission & scheduler
  useEffect(() => {
    if (notifsEnabled) {
      requestNotifPermission();
      setupNotificationSchedule();
      const interval = setInterval(setupNotificationSchedule, 60000); // refresh every minute
      return () => clearInterval(interval);
    }
  }, [notifsEnabled]);

  const requestNotifPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNotifsEnabled(false);
        localStorage.setItem('mehin_notifs_enabled', 'false');
      }
    } else {
      alert('This browser does not support desktop notifications');
      setNotifsEnabled(false);
    }
  };

  const toggleNotifications = () => {
    const nextVal = !notifsEnabled;
    setNotifsEnabled(nextVal);
    localStorage.setItem('mehin_notifs_enabled', nextVal.toString());
  };

  // Schedules 3 random notifications throughout the day (Morning, Afternoon, Evening)
  const setupNotificationSchedule = () => {
    const now = new Date();
    const todayStr = now.toDateString();
    
    // Check if we already computed times for today in localStorage
    let schedule = JSON.parse(localStorage.getItem('mehin_notif_schedule') || '{}');
    
    if (schedule.date !== todayStr) {
      // Generate 3 random target times today (in hours)
      // Morning: 9:00 - 12:00
      // Afternoon: 13:00 - 17:00
      // Evening: 18:00 - 21:30
      const morningTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9 + Math.random() * 3, Math.random() * 60);
      const afternoonTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13 + Math.random() * 4, Math.random() * 60);
      const eveningTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18 + Math.random() * 3.5, Math.random() * 60);
      
      schedule = {
        date: todayStr,
        times: [morningTime.getTime(), afternoonTime.getTime(), eveningTime.getTime()],
        fired: [false, false, false]
      };
      localStorage.setItem('mehin_notif_schedule', JSON.stringify(schedule));
    }

    // Find next upcoming notification
    let nextTime = null;
    let foundNext = false;
    
    for (let i = 0; i < 3; i++) {
      const targetTime = schedule.times[i];
      const hasFired = schedule.fired[i];
      
      if (!hasFired) {
        if (now.getTime() >= targetTime) {
          // Trigger notification now!
          triggerRandomNotification();
          schedule.fired[i] = true;
          localStorage.setItem('mehin_notif_schedule', JSON.stringify(schedule));
        } else {
          if (!foundNext) {
            nextTime = targetTime;
            foundNext = true;
          }
        }
      }
    }

    if (nextTime) {
      const diffMs = nextTime - now.getTime();
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      setNextNotifTime(`${diffHrs}h ${diffMins}m`);
    } else {
      setNextNotifTime('Tomorrow morning');
    }
  };

  const triggerRandomNotification = () => {
    if (Notification.permission === 'granted') {
      const randomQuote = SWEET_QUOTES[Math.floor(Math.random() * SWEET_QUOTES.length)];
      new Notification('Mehin Love Note 💖', {
        body: randomQuote,
        icon: '/mehin_icon.png',
        tag: 'mehin-motivation',
        vibrate: [200, 100, 200]
      });
    }
  };

  const sendTestNotification = () => {
    if (!notifsEnabled) {
      alert("Please enable notification alerts toggle first!");
      return;
    }
    triggerRandomNotification();
  };

  const addWater = (amount) => {
    setWaterAmount((prev) => Math.max(prev + amount, 0));
  };

  return (
    <div className="glass-card water-panel">
      <h2 className="romantic-title" style={{ fontSize: '24px', marginBottom: '4px' }}>Stay Hydrated</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
        Daily target: {dailyGoal}ml (8 glasses)
      </p>

      {/* SVG Water Glass filled dynamically */}
      <div className="glass-svg-wrapper" onClick={() => addWater(250)}>
        <div className="water-text-overlay">
          <span className="water-amount">{waterAmount}</span>
          <span className="water-label">ml</span>
        </div>
        
        <svg className="glass-svg" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
          {/* Glass Rim Top */}
          <ellipse cx="50" cy="15" rx="30" ry="8" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
          
          {/* Water Fill Area (Uses clipPath to fill from bottom) */}
          <g clipPath="url(#glass-clip)">
            {/* Background of the water */}
            <path d="M 15 15 L 85 15 L 75 110 L 25 110 Z" fill="rgba(255,255,255,0.03)" />
            {/* Water content filled up by percentage */}
            <rect 
              x="0" 
              y={120 - (percentFilled / 100) * 95} 
              width="100" 
              height="120" 
              fill="url(#water-gradient)" 
              style={{ transition: 'y 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          </g>

          {/* Glass Outer Outlines */}
          <path d="M 20 15 L 25 110 L 75 110 L 80 15" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="50" cy="110" rx="25" ry="6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />

          {/* Clip path defining glass shape */}
          <defs>
            <clipPath id="glass-clip">
              <path d="M 20.5 16 L 80 16 L 74.5 109 L 25.5 109 Z" />
            </clipPath>
            <linearGradient id="water-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8ed0f8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#2c7fae" stopOpacity="0.9" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Control Buttons */}
      <div className="water-controls">
        <button className="water-btn-circle" onClick={() => addWater(-250)}>-</button>
        <button className="btn-primary" style={{ padding: '10px 20px', borderRadius: '25px', fontSize: '14px' }} onClick={() => addWater(250)}>
          + Glass (250ml)
        </button>
        <button className="water-btn-circle" onClick={() => setWaterAmount(0)}>🔄</button>
      </div>

      {/* Notifications Panel */}
      <div style={{
        marginTop: '25px',
        paddingTop: '20px',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {notifsEnabled ? <Bell size={18} color="var(--color-primary)" /> : <BellOff size={18} color="var(--text-muted)" />}
            <span style={{ fontSize: '14px', fontWeight: '500' }}>Random Love Alerts</span>
          </div>
          <button 
            className={`btn-secondary`} 
            style={{ 
              padding: '6px 14px', 
              fontSize: '12px',
              borderRadius: '20px', 
              backgroundColor: notifsEnabled ? 'rgba(229,179,166,0.1)' : '' 
            }} 
            onClick={toggleNotifications}
          >
            {notifsEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {notifsEnabled && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            background: 'rgba(255,255,255,0.02)',
            padding: '10px 12px',
            borderRadius: '12px',
            fontSize: '12px'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Next random check-in: <strong style={{ color: 'var(--color-primary)' }}>{nextNotifTime}</strong>
            </span>
            <button 
              onClick={sendTestNotification} 
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-water)',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Test Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
