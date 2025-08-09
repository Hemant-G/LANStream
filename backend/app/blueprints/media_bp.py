from flask import Blueprint, request, jsonify, current_app, send_from_directory, abort
from flask_login import login_required, current_user
from app.extensions import db
from app.models.media import MediaItem
from app.models.user_media_progress import UserMediaProgress
from app import run_scan
import os
from datetime import datetime, timezone
from sqlalchemy import func, case
from functools import wraps # <--- NEW IMPORT

media_bp = Blueprint('media', __name__)

# --- Helper decorator for admin access ---
def admin_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if not current_user.has_role('admin'):
            abort(403) 
        return f(*args, **kwargs)
    return decorated_function

# --- Media Listing (Personalized) ---
@media_bp.route('/list', methods=['GET'])
@login_required
def list_media():
    """
    Returns a list of available media for the current user,
    sorted by their last watched time, with unwatched media coming after.
    """
    user_id = current_user.id

    media_data = db.session.query(
        MediaItem,
        UserMediaProgress.current_progress_seconds,
        UserMediaProgress.last_watched_at
    ).outerjoin(
        UserMediaProgress,
        (UserMediaProgress.media_item_id == MediaItem.id) & (UserMediaProgress.user_id == user_id)
    ).order_by(
        UserMediaProgress.last_watched_at.desc().nullslast(),
        MediaItem.title.asc() 
    ).all()

    response_list = []
    for media_item, progress_seconds, last_watched_at in media_data:
        thumbnail_url = media_item.thumbnail if media_item.thumbnail else \
                        f"https://upload.wikimedia.org/wikipedia/commons/b/b6/Image_created_with_a_mobile_phone.png"
        
        response_list.append({
            "id": media_item.id,
            "title": media_item.title,
            "filepath": media_item.filepath,
            "media_type": media_item.media_type,
            "duration_seconds": media_item.duration_seconds,
            "thumbnail": thumbnail_url,
            "last_scanned": media_item.last_scanned.isoformat() if media_item.last_scanned else None,
            "user_progress_seconds": progress_seconds if progress_seconds is not None else 0,
            "user_last_watched_at": last_watched_at.isoformat() if last_watched_at else None
        })
    
    return jsonify(response_list), 200

# --- User Media Progress Endpoints ---
@media_bp.route('/<int:media_id>/progress', methods=['GET'])
@login_required
def get_user_progress(media_id):
    """
    Retrieves the current user's progress for a specific media item.
    """
    user_id = current_user.id
    progress = UserMediaProgress.query.filter_by(
        user_id=user_id,
        media_item_id=media_id
    ).first()

    if progress:
        return jsonify(progress.to_dict()), 200
    else:
        return jsonify({
            'user_id': user_id,
            'media_item_id': media_id,
            'current_progress_seconds': 0,
            'last_watched_at': None
        }), 200


@media_bp.route('/<int:media_id>/progress', methods=['POST'])
@login_required
def record_user_progress(media_id):
    """
    Updates the current user's progress for a specific media item.
    Expects JSON: {"progress_seconds": int}
    """
    data = request.get_json()
    progress_seconds = data.get('progress_seconds')

    if progress_seconds is None or not isinstance(progress_seconds, (int, float)):
        return jsonify({'error': 'progress_seconds (integer or float) is required'}), 400
    
    progress_seconds = int(progress_seconds)

    user_id = current_user.id
    media_item = MediaItem.query.get(media_id)

    if not media_item:
        return jsonify({'error': 'Media item not found'}), 404

    progress_entry = UserMediaProgress.query.filter_by(
        user_id=user_id,
        media_item_id=media_id
    ).first()

    if progress_entry:
        progress_entry.current_progress_seconds = progress_seconds
        progress_entry.last_watched_at = datetime.now(timezone.utc)
    else:
        new_progress = UserMediaProgress(
            user_id=user_id,
            media_item_id=media_id,
            current_progress_seconds=progress_seconds,
            last_watched_at=datetime.now(timezone.utc)
        )
        db.session.add(new_progress)
    
    db.session.commit()

    return jsonify({'message': 'Progress updated successfully'}), 200

# --- Admin-only endpoint for changing thumbnail ---
@media_bp.route('/<int:media_id>/thumbnail', methods=['PUT'])
@admin_required # Only admin can change thumbnails
def update_media_thumbnail(media_id):
    """
    Updates the thumbnail URL/path for a specific media item.
    Requires admin role.
    """
    media_item = MediaItem.query.get_or_404(media_id)
    data = request.get_json()
    new_thumbnail = data.get('thumbnail')

    if not new_thumbnail:
        return jsonify({'error': 'New thumbnail URL/path is required'}), 400
    
    media_item.thumbnail = new_thumbnail
    db.session.commit()
    
    return jsonify(media_item.to_dict()), 200

# --- Media Management Endpoints ---

@media_bp.route('/', methods=['POST'])
@admin_required # Only admin can add new media
def add_media():
    data = request.get_json()
    title = data.get('title')
    filepath = data.get('filepath') 
    media_type = data.get('media_type')
    duration_seconds = data.get('duration_seconds')
    thumbnail = data.get('thumbnail') 

    if not all([title, filepath, media_type]):
        return jsonify({'error': 'Title, filepath, and media_type are required'}), 400

    new_media = MediaItem(
        title=title,
        filepath=filepath,
        media_type=media_type,
        duration_seconds=duration_seconds,
        thumbnail=thumbnail 
    )

    db.session.add(new_media)
    db.session.commit()

    return jsonify(new_media.to_dict()), 201

@media_bp.route('/', methods=['GET'])
@login_required # All media list might also require login
def get_all_media():
    media_items = MediaItem.query.all()
    return jsonify([item.to_dict() for item in media_items]), 200

@media_bp.route('/<int:media_id>', methods=['GET'])
@login_required # Access to single media detail requires login
def get_media(media_id):
    media_item = MediaItem.query.get_or_404(media_id)
    return jsonify(media_item.to_dict()), 200

@media_bp.route('/<int:media_id>', methods=['PUT'])
@admin_required # Only admin can update media details
def update_media(media_id):
    media_item = MediaItem.query.get_or_404(media_id)
    data = request.get_json()

    media_item.title = data.get('title', media_item.title)
    media_item.filepath = data.get('filepath', media_item.filepath)
    media_item.media_type = data.get('media_type', media_item.media_type)
    media_item.duration_seconds = data.get('duration_seconds', media_item.duration_seconds)
    media_item.thumbnail = data.get('thumbnail', media_item.thumbnail) 

    db.session.commit()

    return jsonify(media_item.to_dict()), 200

@media_bp.route('/<int:media_id>', methods=['DELETE'])
@admin_required # Only admin can delete media
def delete_media(media_id):
    media_item = MediaItem.query.get_or_404(media_id)
    db.session.delete(media_item)
    db.session.commit()
    
    return jsonify({'message': f'Media item with ID {media_id} deleted'}), 200

@media_bp.route('/scan', methods=['POST'])
@admin_required # Only admin can trigger a scan
def scan_media_endpoint():
    run_scan(current_app) 
    return jsonify({'message': 'Media scan started. Check server logs for progress.'}), 200

@media_bp.route('/stream/<int:media_id>', methods=['GET'])
@login_required # Streaming requires login
def stream_media(media_id):
    media_item = MediaItem.query.get_or_404(media_id)
    
    media_root = current_app.config['MEDIA_PATH']
    full_filepath = os.path.join(media_root, media_item.filepath) 
    
    if not os.path.exists(full_filepath):
        return jsonify({'error': 'File not found on server'}), 404

    directory = os.path.dirname(full_filepath)
    filename = os.path.basename(full_filepath)
    
    return send_from_directory(
        directory, 
        filename, 
        as_attachment=False,
        mimetype='video/mp4' 
    )

@media_bp.route('/dash/<int:media_id>/<path:filename>')
def serve_dash_content(media_id, filename):
    media_root = current_app.config['MEDIA_PATH']
    dash_dir = os.path.join(media_root, f'dash/{media_id}') 
    
    if not os.path.exists(dash_dir):
        return jsonify({"error": f"DASH content for media ID {media_id} not found"}), 404
        
    if ".." in filename or filename.startswith('/'):
        return jsonify({"error": "Invalid filename"}), 400

    return send_from_directory(dash_dir, filename)