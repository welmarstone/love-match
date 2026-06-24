import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';

export default function HeartPulse({ streak, userId, partnerName, onHeartTap, triggerPulse }) {
  const [clicked, setClicked] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const userTappedToday = streak.taps?.[userId] === todayStr;
  const partnerId = userId === 'partner1' ? 'partner2' : 'partner1';
  const partnerTappedToday = streak.taps?.[partnerId] === todayStr;
  const streakCompletedToday = streak.lastStreakDate === todayStr;

  const handleTap = async () => {
    if (clicked) return;
    setClicked(true);
    
    // Trigger floating hearts locally
    triggerPulse();

    try {
      await onHeartTap();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setClicked(false), 1000);
    }
  };

  // Get status text
  let statusText = '';
  if (streakCompletedToday) {
    statusText = 'You both tapped today! Your streak is locked in. 🔥❤️';
  } else if (userTappedToday && !partnerTappedToday) {
    statusText = `You tapped today! Waiting for ${partnerName || 'your partner'} to tap...`;
  } else if (!userTappedToday && partnerTappedToday) {
    statusText = `${partnerName || 'Your partner'} already tapped today! Tap to complete today's streak!`;
  } else {
    statusText = "Tap the heart to check-in today and keep your connection alive!";
  }

  return (
    <div className="glass-card heart-panel" style={{ minHeight: '340px' }}>
      <h2 className="romantic-title" style={{ fontSize: '24px', marginBottom: '8px' }}>Daily Connection</h2>
      
      {/* Streak Badge */}
      <div className="streak-badge">
        <span>🔥</span>
        <span>{streak.count || 0} Days Streak</span>
      </div>

      {/* Pulsing Heart Button */}
      <div className="heart-button-outer" onClick={handleTap}>
        <div className="heart-button-glow"></div>
        <div className={`heart-button ${userTappedToday || clicked ? 'active' : ''}`}>
          <Heart 
            fill={userTappedToday || clicked ? '#fff' : 'none'} 
            stroke={userTappedToday || clicked ? '#fff' : 'var(--color-primary)'} 
            size={40} 
            style={{ animation: userTappedToday ? 'heartbeatFast 1.5s infinite' : 'none' }}
          />
        </div>
      </div>

      {/* Status Indicators */}
      <p className="streak-status-text">{statusText}</p>

      {/* Visual Indicator Dots */}
      <div className="tap-indicator">
        <div className={`tap-dot ${userTappedToday ? 'active' : ''}`}>
          <span>Me:</span>
          <span>{userTappedToday ? '❤️ Done' : '⚪ Waiting'}</span>
        </div>
        <div className={`tap-dot ${partnerTappedToday ? 'active' : ''}`}>
          <span>{partnerName || 'Partner'}:</span>
          <span>{partnerTappedToday ? '❤️ Done' : '⚪ Waiting'}</span>
        </div>
      </div>
    </div>
  );
}
