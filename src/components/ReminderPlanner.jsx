import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Trash2, Plus } from 'lucide-react';

export default function ReminderPlanner() {
  const [reminders, setReminders] = useState(() => {
    const saved = localStorage.getItem('mehin_reminders');
    return saved ? JSON.parse(saved) : [];
  });

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Save reminders
  useEffect(() => {
    localStorage.setItem('mehin_reminders', JSON.stringify(reminders));
  }, [reminders]);

  // Keep current time updated for countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);

      // Check if any reminder is due
      reminders.forEach((reminder) => {
        if (!reminder.triggered && now >= reminder.targetTimestamp) {
          triggerAlarm(reminder);
          // Mark as triggered so it doesn't fire repeatedly
          markAsTriggered(reminder.id);
        }
      });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [reminders]);

  const triggerAlarm = (reminder) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Reminder: ${reminder.title} ⏰`, {
        body: `It is now time for: ${reminder.title}!`,
        icon: '/mehin_icon.png',
        tag: reminder.id,
        requireInteraction: true
      });
    } else {
      // In-app alert fallback
      alert(`⏰ REMINDER: ${reminder.title}`);
    }
  };

  const markAsTriggered = (id) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, triggered: true } : r))
    );
  };

  const handleAddReminder = (e) => {
    e.preventDefault();
    if (!title || !date || !time) return;

    // Construct timestamp
    const targetString = `${date}T${time}`;
    const targetTimestamp = new Date(targetString).getTime();

    if (isNaN(targetTimestamp)) {
      alert('Invalid date or time');
      return;
    }

    if (targetTimestamp <= Date.now()) {
      alert('Cannot set reminders in the past!');
      return;
    }

    const newReminder = {
      id: Date.now().toString(),
      title,
      date,
      time,
      targetTimestamp,
      triggered: false,
    };

    setReminders((prev) => [...prev, newReminder].sort((a, b) => a.targetTimestamp - b.targetTimestamp));
    setTitle('');
    setDate('');
    setTime('');

    // Ask notification permission if not yet allowed
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const handleDelete = (id) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  // Helper to format countdown
  const getCountdown = (targetMs) => {
    const diff = targetMs - currentTime;
    if (diff <= 0) return 'Passed';

    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h left`;
    }
    if (hours > 0) {
      return `${hours}h ${mins}m left`;
    }
    return `${mins}m left`;
  };

  return (
    <div className="glass-card">
      <h2 className="romantic-title" style={{ fontSize: '24px', marginBottom: '4px' }}>Reminders & Plans</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
        Set personal alarms to stay on track
      </p>

      {/* New Reminder Form */}
      <form onSubmit={handleAddReminder} className="reminder-form">
        <div className="form-group">
          <label className="form-label">Reminder Name</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Drink water, Call, Pack bags..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Time</label>
            <input
              type="time"
              className="form-input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>
        </div>
        <button type="submit" className="btn-primary" style={{ marginTop: '5px' }}>
          <Plus size={18} /> Schedule Alert
        </button>
      </form>

      {/* Active Reminders List */}
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px', marginTop: '20px' }}>Active Alarms</h3>
      {reminders.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '15px' }}>
          No upcoming reminders set.
        </p>
      ) : (
        <div className="reminders-list">
          {reminders.map((reminder) => (
            <div key={reminder.id} className="reminder-card" style={{ opacity: reminder.triggered ? 0.6 : 1 }}>
              <div className="reminder-info">
                <span className="reminder-title">{reminder.title}</span>
                <span className="reminder-time">
                  <Calendar size={12} /> {reminder.date} &bull; <Clock size={12} /> {reminder.time}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="reminder-countdown">
                  {reminder.triggered ? '⏰ Due' : getCountdown(reminder.targetTimestamp)}
                </span>
                <button className="reminder-delete-btn" onClick={() => handleDelete(reminder.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
