import os
from dotenv import load_dotenv

load_dotenv()


basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    # Flask configuration
    SECRET_KEY = os.environ.get('SECRET_KEY')
    DEBUG = True

    # --- NEW DATABASE CONFIGURATION FOR POSTGRESQL ---
    DATABASE_URL = os.environ.get('DATABASE_URL')
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # LANStream specific configuration
    MEDIA_PATH = os.environ.get('MEDIA_PATH')

    # Ensure the media path exists
    if not os.path.exists(MEDIA_PATH):
        os.makedirs(MEDIA_PATH)
        print(f"Created media directory: {MEDIA_PATH}")