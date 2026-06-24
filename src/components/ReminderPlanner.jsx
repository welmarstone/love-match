import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Trash2, Plus, User } from 'lucide-react';

export default function ReminderPlanner({ reminders, userId, userName, partnerName, onAddReminder, onDeleteReminder }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [targetUserId, setTargetUserId] = useState(userId); // Default to current user
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Keep current time updated for countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAddReminder = (e) => {
    e.preventDefault();
    if (!title || !date || !time) return;

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

    onAddReminder({
      title,
      date,
      time,
      targetTimestamp,
      userId: targetUserId,
    });

    setTitle('');
    setDate('');
    setTime('');
  };

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
      <h2 className="romantic-title" style={{ fontSize: '24px', marginBottom: '4px' }}>Reminders & Alerts</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
        Schedule lock-screen alerts for yourself or your partner
      </p>

      {/* New Reminder Form */}
      <form onSubmit={handleAddReminder} className="reminder-form">
        <div className="form-group">
          <label className="form-label">Reminder Title</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Call me, Take vitamins, Hydrate..."
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

        <div className="form-group">
          <label className="form-label">Who to Notify?</label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
            <button
              type="button"
              className={`btn-secondary ${targetUserId === userId ? 'btn-primary' : ''}`}
              style={{ flex: 1, padding: '10px', fontSize: '13px' }}
              onClick={() => setTargetUserId(userId)}
            >
              Notify Me
            </button>
            <button
              type="button"
              className={`btn-secondary ${targetUserId !== userId ? 'btn-primary' : ''}`}
              style={{ flex: 1, padding: '10px', fontSize: '13px' }}
              onClick={() => setTargetUserId(userId === 'partner1' ? 'partner2' : 'partner1')}
            >
              Notify {partnerName || 'Partner'}
            </button>
          </div>
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: '5px' }}>
          <Plus size={18} /> Schedule Lock-Screen Alert
        </button>
      </form>

      {/* Active Reminders List */}
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px', marginTop: '20px' }}>Active Alarms</h3>
      {reminders.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '15px' }}>
          No scheduled alerts.
        </p>
      ) : (
        <div className="reminders-list">
          {reminders.map((reminder) => {
            const isForMe = reminder.userId === userId;
            const targetLabel = isForMe ? 'For Me' : `For ${partnerName || 'Partner'}`;
            const labelColor = isForMe ? 'var(--color-primary)' : 'var(--color-water)';

            return (
              <div key={reminder.id} className="reminder-card" style={{ opacity: reminder.triggered ? 0.6 : 1 }}>
                <div className="reminder-info">
                  <span className="reminder-title">{reminder.title}</span>
                  <span className="reminder-time">
                    <Calendar size={12} /> {reminder.date} &bull; <Clock size={12} /> {reminder.time}
                  </span>
                  <span style={{ fontSize: '10px', color: labelColor, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                    <User size={10} /> {targetLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="reminder-countdown">
                    {reminder.triggered ? '⏰ Sent' : getCountdown(reminder.targetTimestamp)}
                  </span>
                  <button className="reminder-delete-btn" onClick={() => onDeleteReminder(reminder.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
