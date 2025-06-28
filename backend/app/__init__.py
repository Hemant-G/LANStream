from dotenv import load_dotenv
load_dotenv()
from flask import Flask, current_app
from config import Config
from sqlalchemy import text
from flask_cors import CORS
from app.extensions import db, migrate

# --- Scan media ---
def run_scan(app):
    import os
    import subprocess
    from app.models.media import MediaItem
    
    # Access config using the 'app' argument
    media_root = app.config['MEDIA_PATH']
    supported_extensions = ['.mp4', '.mkv', '.avi', '.mov', '.mp3', '.flac', '.webm']
    
    if not os.path.isdir(media_root):
        print(f"Error: Media root directory not found at '{media_root}'. Check your .env file.")
        return

    print(f"Starting scan of '{media_root}'...")
    
    # Use a context for database operations
    with app.app_context():
        for root, dirs, files in os.walk(media_root):
            for filename in files:
                if any(filename.lower().endswith(ext) for ext in supported_extensions):
                    full_filepath = os.path.join(root, filename)
                    
                    relative_filepath = os.path.relpath(full_filepath, media_root)
                    
                    if MediaItem.query.filter_by(filepath=relative_filepath).first():
                        print(f"Skipping: '{relative_filepath}' (already in DB)")
                        continue
                        
                    print(f"Found new file: '{relative_filepath}'")
                    
                    duration = None
                    try:
                        cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
                                '-of', 'default=noprint_wrappers=1:nokey=1', full_filepath]
                        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
                        duration = int(float(result.stdout.strip()))
                    except Exception as e:
                        print(f"Could not get duration for '{filename}': {e}")
                    
                    new_media = MediaItem(
                        title=os.path.splitext(filename)[0],
                        filepath=relative_filepath,
                        media_type='video' if filename.lower().endswith(('.mp4', '.mkv', '.avi', '.mov')) else 'audio',
                        duration_seconds=duration
                    )
                    
                    db.session.add(new_media)
                    db.session.commit()
                    print(f"Added '{new_media.title}' to the database.")
        
        print("Scan complete.")


def create_app(config_class=Config):
    from app.blueprints.media import media_bp

    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)
    app.register_blueprint(media_bp, url_prefix='/api/media')

    
    @app.cli.command("scan-media")
    def scan_media_command():
        run_scan(app)

    # --- Simple routes for testing purposes ---
    @app.route('/')
    def index():
        return '<h1>Welcome to the LANStream Backend!</h1>'

    @app.route('/db_test')
    def db_test_page():
        try:
            with db.engine.connect() as connection:
                connection.execute(text('SELECT 1'))
            return '<h1>PostgreSQL database connection successful!</h1>'
        except Exception as e:
            return f'<h1>Database connection failed:</h1><p>{e}</p><p>Check your config.py credentials and ensure the PostgreSQL server is running.</p>'

    return app


from app.models import user
from app.models import media