from app.extensions import db
from datetime import datetime, timezone

class UserMediaProgress(db.Model):
    __tablename__ = 'user_media_progress'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    media_item_id = db.Column(db.Integer, db.ForeignKey('media_items.id'), nullable=False, index=True)
    current_progress_seconds = db.Column(db.Integer, default=0, nullable=False)
    last_watched_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Ensure a user has only one progress entry per media item
    db.UniqueConstraint('user_id', 'media_item_id', name='uq_user_media_progress')

    # Relationships
    user = db.relationship('User', backref=db.backref('media_progress', lazy='dynamic'))
    media_item = db.relationship('MediaItem', backref=db.backref('user_progress', lazy='dynamic'))

    def __repr__(self):
        return f'<UserMediaProgress User:{self.user_id} Media:{self.media_item_id} Progress:{self.current_progress_seconds}s>'

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'media_item_id': self.media_item_id,
            'current_progress_seconds': self.current_progress_seconds,
            'last_watched_at': self.last_watched_at.isoformat() if self.last_watched_at else None
        }