from app.extensions import db
from datetime import datetime, timezone

class MediaItem(db.Model):
    __tablename__ = 'media_items'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), index=True, nullable=False)
    filepath = db.Column(db.String(512), unique=True, nullable=False)
    media_type = db.Column(db.String(50), nullable=False)
    thumbnail = db.Column(db.String(512), nullable=True)
    last_scanned = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    duration_seconds = db.Column(db.Integer)
    user_progress = db.relationship(
        "UserMediaProgress",
        backref="media_item",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f'<MediaItem {self.title}>'

    def to_dict(self):
        """Converts the MediaItem object to a dictionary."""
        return {
            'id': self.id,
            'title': self.title,
            'filepath': self.filepath,
            'media_type': self.media_type,
            'thumbnail': self.thumbnail,
            'last_scanned': self.last_scanned.isoformat() if hasattr(self, 'last_scanned') and self.last_scanned else None,
            'duration_seconds': self.duration_seconds if hasattr(self, 'duration_seconds') else None
        }