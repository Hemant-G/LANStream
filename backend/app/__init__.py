from dotenv import load_dotenv
load_dotenv()
from flask import Flask, current_app
from config import Config
from sqlalchemy import text
from flask_cors import CORS
from app.extensions import db, migrate
import click
from app.transcoding import package_for_dash


# --- Scan media ---
def run_scan(app):
    import os
    import subprocess
    from app.models.media import MediaItem
    from app.extensions import db

    media_root = app.config['MEDIA_PATH']
    supported_extensions = ['.mp4', '.mkv', '.avi', '.mov', '.mp3', '.flac', '.webm']
    
    if not os.path.isdir(media_root):
        print(f"Error: Media root directory not found at '{media_root}'. Check your .env file.")
        return

    print(f"Starting scan of '{media_root}'...")
    
    with app.app_context():
        # Collect all existing file paths from the database
        db_paths = {item.filepath for item in MediaItem.query.all()}

        disk_paths = set()
        
        # Scan for new and existing files on the disk
        for root, dirs, files in os.walk(media_root):
            for filename in files:
                if any(filename.lower().endswith(ext) for ext in supported_extensions):
                    full_filepath = os.path.join(root, filename)
                    relative_filepath = os.path.relpath(full_filepath, media_root)
                    
                    disk_paths.add(relative_filepath)
                    
                    # Check if the file is already in the database
                    if relative_filepath not in db_paths:
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
        
        # Find and remove deleted files from the database
        deleted_paths = db_paths.difference(disk_paths)
        
        if deleted_paths:
            print("\nFound deleted files. Removing from database...")
            for filepath_to_delete in deleted_paths:
                media_to_delete = MediaItem.query.filter_by(filepath=filepath_to_delete).first()
                if media_to_delete:
                    print(f"Removing '{media_to_delete.title}' from the database.")
                    db.session.delete(media_to_delete)
        else:
            print("\nNo files found to be deleted from the database.")

        # Commit all changes at once
        db.session.commit()
        
    print("\nScan complete.")


def create_app(config_class=Config):
    from app.blueprints.media import media_bp

    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)
    app.register_blueprint(media_bp, url_prefix='/api/media')

    # --- CLI for scan media ---
    @app.cli.command("scan-media")
    def scan_media_command():
        run_scan(app)

    # --- CLI for package dash ---
    @app.cli.command('package-dash')
    @click.argument('media_id', type=int)
    def package_dash_command(media_id):
        print(f"Attempting to package media item with ID: {media_id}")
        package_for_dash(app, media_id)
        print("Packaging command finished. Please check the terminal output for details.")
        print(f"Expected output directory: {app.config['MEDIA_PATH']}/dash/{media_id}/")

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