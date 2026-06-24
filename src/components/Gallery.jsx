import React, { useState, useRef } from 'react';
import { Camera, X, Trash2, Plus } from 'lucide-react';

export default function Gallery({ photos, userName, onPhotoUpload, onPhotoDelete }) {
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('caption', caption);
    formData.append('uploader', userName || 'Someone');

    try {
      await onPhotoUpload(formData);
      setCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Photo upload failed. Check server connection.');
    } finally {
      setUploading(false);
    }
  };

  const handleCardClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatDate = (timestamp) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this memory?')) return;
    
    try {
      await onPhotoDelete(id);
      setLightboxPhoto(null);
    } catch (err) {
      console.error(err);
      alert('Could not delete photo');
    }
  };

  return (
    <div className="glass-card">
      <h2 className="romantic-title" style={{ fontSize: '24px', marginBottom: '4px' }}>Shared Memories</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
        A private photostream of Czech and Italy moments
      </p>

      {/* Image Uploader widget */}
      <div className="gallery-uploader-card" onClick={handleCardClick}>
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={uploading}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Camera size={28} color="var(--color-primary)" />
          <span style={{ fontSize: '14px', fontWeight: '600' }}>
            {uploading ? 'Uploading memory...' : 'Add a New Photo'}
          </span>
          <input
            type="text"
            placeholder="Add a sweet caption first..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onClick={(e) => e.stopPropagation()} // Don't trigger file dialog when clicking input
            className="form-input"
            style={{ width: '80%', padding: '8px 12px', fontSize: '12px', textAlign: 'center', marginTop: '5px' }}
          />
        </div>
      </div>

      {/* Photo Stream Grid */}
      {photos.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '30px' }}>
          No memories captured yet. Upload your first picture together!
        </p>
      ) : (
        <div className="gallery-grid">
          {photos.map((photo) => (
            <div key={photo.id} className="gallery-item" onClick={() => setLightboxPhoto(photo)}>
              <img src={photo.url} alt={photo.caption} className="gallery-img" loading="lazy" />
              <div className="gallery-overlay">
                <p style={{ fontWeight: '600', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {photo.caption || 'Memory'}
                </p>
                <span style={{ fontSize: '10px' }}>{formatDate(photo.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Overlay */}
      {lightboxPhoto && (
        <div className="lightbox" onClick={() => setLightboxPhoto(null)}>
          <button className="lightbox-close" onClick={() => setLightboxPhoto(null)}>
            <X size={24} />
          </button>
          
          <button className="lightbox-delete" onClick={(e) => handleDelete(lightboxPhoto.id, e)}>
            <Trash2 size={20} />
          </button>

          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxPhoto.url} alt={lightboxPhoto.caption} className="lightbox-img" />
          </div>

          <p className="lightbox-caption">{lightboxPhoto.caption || 'Untold memory'}</p>
          <div className="lightbox-meta">
            <span>By {lightboxPhoto.uploader} &bull; {formatDate(lightboxPhoto.timestamp)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
