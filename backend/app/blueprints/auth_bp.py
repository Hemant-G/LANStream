from flask import Blueprint, request, jsonify, redirect, url_for
from flask_login import login_user, logout_user, login_required, current_user
from app.extensions import db, bcrypt
from app.models.user import User
from datetime import datetime, timezone

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')

    if not username or not password:
        return jsonify({'message': 'Username and password are required'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'Username already exists'}), 409

    if role not in ['user', 'admin']:
        return jsonify({'message': 'Invalid role specified'}), 400

    new_user = User(username=username, role=role, created_at=datetime.now(timezone.utc))
    new_user.set_password(password)
    
    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': 'User registered successfully', 'user_id': new_user.id}), 201

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return jsonify({
            'message': 'This endpoint is for API login. Please use POST to send credentials.',
            'status': 'Awaiting POST request'
        }), 200 

    # POST login logic
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    remember_me = data.get('remember_me', False)

    if not username or not password:
        return jsonify({'message': 'Username and password are required'}), 400

    user = User.query.filter_by(username=username).first()

    if user is None or not user.check_password(password):
        return jsonify({'message': 'Invalid username or password'}), 401

    login_user(user, remember=remember_me)
    return jsonify(user.to_dict()), 200


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'}), 200

@auth_bp.route('/status', methods=['GET'])
def status():
    """Returns the current login status and user information."""
    if current_user.is_authenticated:
        return jsonify({
            'is_authenticated': True,
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'role': current_user.role
            }
        }), 200
    else:
        return jsonify({'is_authenticated': False, 'user': None}), 200