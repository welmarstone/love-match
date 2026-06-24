import React, { useState, useEffect } from 'react';
import { Droplet, Bell, BellOff } from 'lucide-react';

export default function WaterTracker({ partnerName, pushSubscribed, onSubscribePush }) {
  const [waterAmount, setWaterAmount] = useState(() => {
    const saved = localStorage.getItem('mehin_water_log');
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem('mehin_water_date');
    if (savedDate === today && saved) {
      return parseInt(saved, 10);
    }
    return 0;
  });

  const dailyGoal = 2000;
  const percentFilled = Math.min((waterAmount / dailyGoal) * 100, 100);

  useEffect(() => {
    localStorage.setItem('mehin_water_log', waterAmount.toString());
    localStorage.setItem('mehin_water_date', new Date().toDateString());
  }, [waterAmount]);

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
          <ellipse cx="50" cy="15" rx="30" ry="8" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
          <g clipPath="url(#glass-clip-2)">
            <path d="M 15 15 L 85 15 L 75 110 L 25 110 Z" fill="rgba(255,255,255,0.03)" />
            <rect 
              x="0" 
              y={120 - (percentFilled / 100) * 95} 
              width="100" 
              height="120" 
              fill="url(#water-gradient-2)" 
              style={{ transition: 'y 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          </g>
          <path d="M 20 15 L 25 110 L 75 110 L 80 15" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="50" cy="110" rx="25" ry="6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <defs>
            <clipPath id="glass-clip-2">
              <path d="M 20.5 16 L 80 16 L 74.5 109 L 25.5 109 Z" />
            </clipPath>
            <linearGradient id="water-gradient-2" x1="0%" y1="0%" x2="0%" y2="100%">
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

      {/* Web Push Panel */}
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
            {pushSubscribed ? <Bell size={18} color="var(--color-primary)" /> : <BellOff size={18} color="var(--text-muted)" />}
            <span style={{ fontSize: '14px', fontWeight: '500' }}>Lock-Screen Love Alerts</span>
          </div>
          <button 
            className={`btn-secondary`} 
            style={{ 
              padding: '6px 14px', 
              fontSize: '12px',
              borderRadius: '20px', 
              backgroundColor: pushSubscribed ? 'rgba(229,179,166,0.1)' : '' 
            }} 
            onClick={onSubscribePush}
          >
            {pushSubscribed ? 'Active' : 'Enable'}
          </button>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Enabling Lock-Screen Alerts allows the server to send you **3 random checks-in and motivational notes daily**, even when the app is completely closed.
        </p>
      </div>
    </div>
  );
}
