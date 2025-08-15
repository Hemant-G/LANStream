from dotenv import load_dotenv
load_dotenv()
from flask import Flask, current_app
from config import Config
from sqlalchemy import text
from flask_cors import CORS
from app.extensions import db, migrate, login_manager, bcrypt # NEW: import login_manager, bcrypt
import click
from app.transcoding import package_for_dash
import os

# Import models so Flask-Migrate can discover them
from app.models import user, media # Ensure user is imported
from app.models.user_media_progress import UserMediaProgress # NEW: Import UserMediaProgress

# --- Scan media (no change to this function for now) ---
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
    from app.blueprints.media_bp import media_bp # Already there
    from app.blueprints.auth_bp import auth_bp # NEW: Import auth blueprint

    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app) # NEW: Initialize bcrypt
    
    login_manager.init_app(app) # NEW: Initialize login manager
    login_manager.login_view = 'auth.login' # NEW: Specify login view (blueprint_name.route_name)
    login_manager.session_protection = "strong" # Recommended for security

    CORS(app, supports_credentials=True, origins='*') 

    app.register_blueprint(media_bp, url_prefix='/api/media')
    app.register_blueprint(auth_bp, url_prefix='/api/auth') # NEW: Register auth blueprint

    # --- Flask-Login user loader callback ---
    @login_manager.user_loader
    def load_user(user_id):
        from app.models.user import User # Import here to avoid circular dependency
        return User.query.get(int(user_id))

    # --- CLI for scan media ---
    @app.cli.command("scan-media")
    def scan_media_command():
        run_scan(app)

    # --- CLI for list media ---
    @app.cli.command("list-media")
    def list_media_command():
        """Lists all media items currently in the database."""
        from app.models.media import MediaItem
        from app.extensions import db

        with current_app.app_context():
            media_items = MediaItem.query.order_by(MediaItem.id).all()
            
            if not media_items:
                print("No media files found in the database.")
                return

            print("\n--- Media Files in Database ---")
            for item in media_items:
                print(f"ID: {item.id}, Title: '{item.title}', Path: '{item.filepath}'")
            print("---------------------------------")
            print(f"Total files: {len(media_items)}")

    # --- CLI for package dash ---
    @app.cli.command('package-dash')
    @click.argument('media_ids', nargs=-1, type=int, required=False)
    @click.option('--all', 'all_videos', is_flag=True, help='Packages all videos in the database.')
    def package_dash_command(media_ids, all_videos):
        """
        Generates a DASH package for one or more media items.
        
        To package specific videos:
        flask package-dash 1 2 3
        
        To package all videos:
        flask package-dash --all
        """
        from app.models.media import MediaItem
        
        if not media_ids and not all_videos:
            print("Error: You must provide at least one MEDIA_ID or use the --all flag.")
            return

        with current_app.app_context():
            videos_to_package = []
            
            if all_videos:
                print("Packaging all videos in the database...")
                videos_to_package = MediaItem.query.all()
            else:
                print(f"Packaging specific videos with IDs: {media_ids}")
                for media_id in media_ids:
                    media_item = MediaItem.query.get(media_id)
                    if media_item:
                        videos_to_package.append(media_item)
                    else:
                        print(f"Warning: Media item with ID {media_id} not found in the database. Skipping.")

            if not videos_to_package:
                print("No videos found to package.")
                return

            total_videos = len(videos_to_package)
            for i, media_item in enumerate(videos_to_package, 1):
                print(f"\n--- Packaging video {i}/{total_videos}: '{media_item.title}' (ID: {media_item.id}) ---")
                try:
                    package_for_dash(current_app, media_item.id)
                    print(f"--- Successfully packaged '{media_item.title}' ---")
                except Exception as e:
                    print(f"--- Error packaging '{media_item.title}': {e} ---")

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

# The import models from here at the bottom helps with Flask-Migrate discovery
# and avoids circular imports in some cases.
from app.models import user, media
from app.models.user_media_progress import UserMediaProgress # This might be redundant if imported above