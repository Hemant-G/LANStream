from app import create_app
import os

# Create the Flask app instance using our factory
app = create_app()

if __name__ == '__main__':
    # You can optionally override the media path here for testing
    # by uncommenting the line below and setting a temporary path.
    # For permanent changes, modify config.py or use an environment variable.
    # app.config['MEDIA_PATH'] = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'my_test_media')
    # if not os.path.exists(app.config['MEDIA_PATH']):
    #     os.makedirs(app.config['MEDIA_PATH'])
    #     print(f"Created test media directory: {app.config['MEDIA_PATH']}")


    app.run(debug=True, host='0.0.0.0', port=5000)