# lanstream/backend/app/models/media.py
from app.extensions import db
from datetime import datetime, timezone

class MediaItem(db.Model):
    __tablename__ = 'media_items'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), index=True, nullable=False)
    filepath = db.Column(db.String(512), unique=True, nullable=False)
    media_type = db.Column(db.String(50), nullable=False) # <--- ADD THIS COLUMN BACK
    last_scanned = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    duration_seconds = db.Column(db.Integer)

    def __repr__(self):
        return f'<MediaItem {self.title}>'

    def to_dict(self):
        """Converts the MediaItem object to a dictionary."""
        return {
            'id': self.id,
            'title': self.title,
            'filepath': self.filepath,
            'media_type': self.media_type,
            'last_scanned': self.last_scanned.isoformat() if self.last_scanned else None,
            'duration_seconds': self.duration_seconds
        }