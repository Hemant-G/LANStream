from app.extensions import db, bcrypt 
from datetime import datetime, timezone
from flask_login import UserMixin

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default='user', nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<User {self.username}>'

    # Method to set (hash) the password
    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    # Method to check the password
    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

    # Helper method to check user role
    def has_role(self, role_name):
        return self.role == role_name

    # Flask-Login requires a get_id() method if your primary key isn't 'id'
    def get_id(self):
        return str(self.id)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }