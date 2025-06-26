from flask import Flask
from config import Config
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from flask_cors import CORS

db = SQLAlchemy()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    CORS(app)


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