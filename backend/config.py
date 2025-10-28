# LANStream/backend/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    # Flask configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'a-very-secret-key-that-you-should-change-in-production' # NEW: Added SECRET_KEY
    DEBUG = os.environ.get('FLASK_DEBUG') == '1' # Use env var for DEBUG
    # Session cookie settings (recommended for production)
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'None' # Or 'None' with SECURE for cross-site requests

    # --- DATABASE CONFIGURATION ---
    DATABASE_URL = os.environ.get('DATABASE_URL')
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # LANStream specific configuration
    MEDIA_PATH = os.environ.get('MEDIA_PATH')

    # Ensure the media path exists
    if MEDIA_PATH and not os.path.exists(MEDIA_PATH): # Check if MEDIA_PATH is set before trying to create
        os.makedirs(MEDIA_PATH)
        print(f"Created media directory: {MEDIA_PATH}")
    elif not MEDIA_PATH:
        print("Warning: MEDIA_PATH environment variable is not set. Media features might not work.")