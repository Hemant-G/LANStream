from flask import Blueprint, request, jsonify, current_app, send_from_directory
from app.extensions import db
from app.models.media import MediaItem
from app import run_scan
import os


media_bp = Blueprint('media', __name__)

# Add a new media item.
@media_bp.route('/', methods=['POST'])
def add_media():
    data = request.get_json()
    title = data.get('title')
    filepath = data.get('filepath')
    media_type = data.get('media_type')
    duration_seconds = data.get('duration_seconds')

    if not all([title, filepath, media_type]):
        return jsonify({'error': 'Title, filepath, and media_type are required'}), 400

    new_media = MediaItem(
        title=title,
        filepath=filepath,
        media_type=media_type,
        duration_seconds=duration_seconds
    )

    db.session.add(new_media)
    db.session.commit()

    return jsonify(new_media.to_dict()), 201

# Retrieve a list of all media items.
@media_bp.route('/', methods=['GET'])
def get_all_media():
    media_items = MediaItem.query.all()
    return jsonify([item.to_dict() for item in media_items]), 200

# Retrieve a single media item by ID.
@media_bp.route('/<int:media_id>', methods=['GET'])
def get_media(media_id):
    media_item = MediaItem.query.get_or_404(media_id)
    return jsonify(media_item.to_dict()), 200

# Update a media item by ID.
@media_bp.route('/<int:media_id>', methods=['PUT'])
def update_media(media_id):
    media_item = MediaItem.query.get_or_404(media_id)
    data = request.get_json()

    media_item.title = data.get('title', media_item.title)
    media_item.filepath = data.get('filepath', media_item.filepath)
    media_item.media_type = data.get('media_type', media_item.media_type)
    media_item.duration_seconds = data.get('duration_seconds', media_item.duration_seconds)

    db.session.commit()

    return jsonify(media_item.to_dict()), 200

# Delete a media item by ID.
@media_bp.route('/<int:media_id>', methods=['DELETE'])
def delete_media(media_id):
    media_item = MediaItem.query.get_or_404(media_id)
    db.session.delete(media_item)
    db.session.commit()
    
    return jsonify({'message': f'Media item with ID {media_id} deleted'}), 200

# Scan media
@media_bp.route('/scan', methods=['POST'])
def scan_media_endpoint():
    run_scan(current_app)
    return jsonify({'message': 'Media scan started. Check server logs for progress.'}), 200

# Stream a media file by ID.
@media_bp.route('/stream/<int:media_id>', methods=['GET'])
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

# Serve DASH manifest and segments
@media_bp.route('/dash/<int:media_id>/<path:filename>')
def serve_dash_content(media_id, filename):
    media_root = current_app.config['MEDIA_PATH']
    dash_dir = os.path.join(media_root, f'dash/{media_id}')
    
    return send_from_directory(dash_dir, filename)