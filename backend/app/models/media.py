from app.__init__ import db
from datetime import datetime, timezone

class MediaItem(db.Model):
    __tablename__ = 'media_items'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), index=True, nullable=False)
    filepath = db.Column(db.String(512), unique=True, nullable=False)
    last_scanned = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    duration_seconds = db.Column(db.Integer)

    def __repr__(self):
        return f'<MediaItem {self.title}>'