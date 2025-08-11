import os
import subprocess
import json
import logging
from app.extensions import db
from app.models.media import MediaItem

# Ensure logging is configured in your Flask app or here for standalone testing
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_video_resolution(filepath):
    """
    Uses ffprobe to get video width, height, and duration.
    """
    cmd = [
        'ffprobe', '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,display_aspect_ratio', 
        '-show_entries', 'format=duration',
        '-of', 'json', filepath
    ]
    try:
        logging.debug(f"Running ffprobe command: {' '.join(cmd)}")
        result = subprocess.run(cmd, check=True, capture_output=True, text=True, errors='ignore')
        probe_data = json.loads(result.stdout)
        
        width = probe_data['streams'][0].get('width') if 'streams' in probe_data and len(probe_data['streams']) > 0 else None
        height = probe_data['streams'][0].get('height') if 'streams' in probe_data and len(probe_data['streams']) > 0 else None
        duration = float(probe_data['format']['duration']) if 'format' in probe_data and 'duration' in probe_data['format'] else None
        dar = probe_data['streams'][0].get('display_aspect_ratio') if 'streams' in probe_data and len(probe_data['streams']) > 0 else None

        if width and height and duration is not None:
            return (width, height, duration, dar)
        else:
            logging.error("ffprobe did not return expected stream/format data (width, height, duration).")
            return None 
    except (subprocess.CalledProcessError, json.JSONDecodeError, KeyError) as e:
        logging.error(f"Error getting video resolution/duration/DAR for {filepath}: {e}")
        logging.debug(f"ffprobe stdout: {result.stdout if 'result' in locals() else 'N/A'}")
        logging.debug(f"ffprobe stderr: {result.stderr if 'result' in locals() else 'N/A'}")
        return None

# --------------------------------------------------------------------------------------
def run_ffmpeg_command(cmd, log_prefix="FFmpeg"):
    """Helper function to run FFmpeg commands and log output."""
    logging.info(f"\n{log_prefix} command being executed:")
    log_cmd = json.dumps(cmd, indent=2).replace('"', '').replace(',\n', ' \\\n  ')
    logging.info(log_cmd)
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True, errors='ignore')
        logging.info(f"\n{log_prefix} stdout:\n" + result.stdout)
        logging.info(f"\n{log_prefix} stderr:\n" + result.stderr)
        return True
    except subprocess.CalledProcessError as e:
        logging.error(f"{log_prefix} command failed with exit code {e.returncode}")
        logging.error(f"FFmpeg stdout:\n{e.stdout}") 
        logging.error(f"FFmpeg stderr:\n{e.stderr}") 
        logging.error(f"Command attempted was:\n{' '.join(e.cmd)}")
        return False
    except FileNotFoundError:
        logging.error("FFmpeg not found. Please ensure FFmpeg is installed and in your system's PATH.")
        return False
    except Exception as e:
        logging.error(f"An unexpected error occurred during {log_prefix} operation: {e}")
        return False

# --------------------------------------------------------------------------------------
def generate_video_thumbnail(input_filepath, output_thumbnail_path, time_position=3):
    """
    Generates a thumbnail image from the video using ffmpeg.
    Args:
        input_filepath (str): Path to the input video file.
        output_thumbnail_path (str): Path to save the generated thumbnail image.
        time_position (int): Time (in seconds) to capture the thumbnail frame.
    Returns:
        bool: True if thumbnail was generated successfully, False otherwise.
    """
    cmd = [
        'ffmpeg', '-y',
        '-ss', str(time_position),  # Seek to N seconds
        '-i', input_filepath,
        '-frames:v', '1',           # Capture one frame
        '-q:v', '2',                # Quality (lower is better)
        output_thumbnail_path
    ]
    try:
        logging.info(f"Generating thumbnail: {' '.join(cmd)}")
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        logging.debug(f"Thumbnail generation stdout: {result.stdout}")
        logging.debug(f"Thumbnail generation stderr: {result.stderr}")
        return True
    except Exception as e:
        logging.error(f"Failed to generate thumbnail for {input_filepath}: {e}")
        return False

def package_for_dash(app, media_id):
    """
    Packages a media item into DASH format using a multi-pass encoding strategy.
    Also generates a video thumbnail and saves its path in the database.
    
    Args:
        app: The Flask application instance, needed for app.app_context() and app.config.
        media_id (int): The ID of the MediaItem to package.
    
    Returns:
        bool: True if packaging is successful, False otherwise.
    """
    with app.app_context(): # Ensure Flask app context is active for database operations
        media_item = MediaItem.query.get(media_id)
        if not media_item:
            logging.error(f"Media item with ID {media_id} not found in database.")
            return False

        media_root = app.config['MEDIA_PATH'] 
        input_filepath = os.path.join(media_root, media_item.filepath)
        output_dir = os.path.join(media_root, f'dash/{media_item.id}')
        temp_dir = os.path.join(output_dir, 'temp_streams') 

        logging.info(f"Resolved input path: {input_filepath}")
        logging.info(f"Resolved output directory: {output_dir}")

        try:
            os.makedirs(output_dir, exist_ok=True)
            os.makedirs(temp_dir, exist_ok=True)
        except OSError as e:
            logging.error(f"Failed to create output directories: {e}")
            return False

        # --- Generate thumbnail before packaging ---
        thumbnail_dir = os.path.join(media_root, 'thumbnails')
        os.makedirs(thumbnail_dir, exist_ok=True)
        thumbnail_filename = f"{media_item.id}.jpg"
        thumbnail_path = os.path.join(thumbnail_dir, thumbnail_filename)
        thumbnail_rel_path = os.path.relpath(thumbnail_path, media_root)

        if generate_video_thumbnail(input_filepath, thumbnail_path):
            # Save thumbnail path in database if successful
            media_item.thumbnail = thumbnail_rel_path
            db.session.commit()
            logging.info(f"Thumbnail generated and saved to DB: {thumbnail_rel_path}")
        else:
            logging.warning("Thumbnail generation failed; proceeding without updating thumbnail.")

        logging.info(f"Starting DASH packaging for '{media_item.title}' using multi-pass strategy...")

        source_info = get_video_resolution(input_filepath)
        if not source_info:
            logging.error(f"Could not determine source video resolution/duration/DAR for {input_filepath}. Aborting.")
            return False
        
        source_width, source_height, source_duration, source_dar = source_info
        logging.info(f"Source video resolution: {source_width}x{source_height}, Duration: {source_duration:.2f}s, DAR: {source_dar}")

        video_renditions_config = []
        added_heights = set()

        def make_even(dim):
            """Ensures a dimension is an even number. Adds 1 if odd."""
            return dim if dim % 2 == 0 else dim + 1

        TARGET_OUTPUT_DAR_NUM = 16
        TARGET_OUTPUT_DAR_DEN = 9
        TARGET_OUTPUT_ASPECT_RATIO_FLOAT = TARGET_OUTPUT_DAR_NUM / TARGET_OUTPUT_DAR_DEN
        
        logging.info(f"Target display aspect ratio for all output renditions (frame size): {TARGET_OUTPUT_DAR_NUM}:{TARGET_OUTPUT_DAR_DEN}")
        logging.info("Source content will be fit into this frame using letterbox/pillarbox if aspect ratios differ.")

        target_resolutions = [
            {'height': 1080, 'bitrate_k': 4500, 'label': '1080p'},
            {'height': 720, 'bitrate_k': 2500, 'label': '720p'},
            {'height': 480, 'bitrate_k': 1200, 'label': '480p'},
            {'height': 360, 'bitrate_k': 800, 'label': '360p'}
        ]

        for res in target_resolutions:
            # Calculate the target width based on the desired 16:9 aspect ratio for the frame
            # Ensure the width is an even number as required by video codecs
            if source_height >= res['height'] and res['height'] not in added_heights:
                # Calculate the width to maintain 16:9 aspect ratio for the frame
                # Example: 360p -> 360 * (16/9) = 640.
                # Example: 480p -> 480 * (16/9) = 853.33 -> round(853.33) = 853 -> make_even(853) = 854
                target_width_for_frame = make_even(round(res['height'] * TARGET_OUTPUT_ASPECT_RATIO_FLOAT))
                
                video_renditions_config.append({
                    'label': res['label'],
                    'width': target_width_for_frame, # This is the *frame* width after padding
                    'height': res['height'],         # This is the *frame* height after padding
                    'bitrate_k': res['bitrate_k'],
                    'profile': 'main'
                })
                added_heights.add(res['height'])
                logging.info(f"  - Including {res['label']}: {target_width_for_frame}x{res['height']} @ {res['bitrate_k']}k.")
        
        if not video_renditions_config:
            output_height = make_even(min(source_height, 360))
            if output_height == 0: 
                output_height = 2
            
            scaled_width = make_even(round(output_height * TARGET_OUTPUT_ASPECT_RATIO_FLOAT))
            video_renditions_config.append({
                'label': f'{output_height}p',
                'width': scaled_width,
                'height': output_height,
                'bitrate_k': 800, 
                'profile': 'main'
            })
            logging.info(f"  - Source too small for standard renditions. Encoding at {scaled_width}x{output_height} @ 800k.")


        intermediate_video_files = []
        
        # --- Stage 1: Encode Each Video Rendition Separately with Correct DAR Metadata ---
        logging.info("\n--- Stage 1: Encoding Video Renditions ---")
        for rendition in video_renditions_config:
            output_video_filepath = os.path.join(temp_dir, f'video_{rendition["label"]}.mp4') 
            intermediate_video_files.append(output_video_filepath)

            # Target output frame dimensions
            target_out_width = rendition["width"]
            target_out_height = rendition["height"]

            # Construct the video filter chain
            video_filter_chain_parts = [
                # Scale the content to fit within the target frame, maintaining original aspect ratio
                f'scale=w={target_out_width}:h={target_out_height}:force_original_aspect_ratio=decrease',
                # Pad the scaled content to the final target frame dimensions (e.g., 640x360 for 360p 16:9)
                f'pad={target_out_width}:{target_out_height}:(ow-iw)/2:(oh-ih)/2',
                f'setsar=1',  # Set Sample Aspect Ratio to 1:1 (square pixels)
                f'format=yuv420p', # Ensure pixel format is yuv420p, commonly required for H.264
                f'fps=30' # Ensure consistent frame rate
            ]
            
            video_filter_chain = ",".join(video_filter_chain_parts)

            video_encode_cmd = [
                'ffmpeg', '-y', '-i', input_filepath,
                '-vf', video_filter_chain,
                '-c:v', 'libx264',
                '-b:v', f"{rendition['bitrate_k']}k",
                '-profile:v', rendition['profile'],
                '-preset', 'fast', 
                '-movflags', 'faststart', 
                '-an', 
                # --- ADDED: Explicitly set display aspect ratio for the output file ---
                '-aspect', f'{TARGET_OUTPUT_DAR_NUM}:{TARGET_OUTPUT_DAR_DEN}', 
                # --- END ADDITION ---
                output_video_filepath
            ]
            if not run_ffmpeg_command(video_encode_cmd, f"FFmpeg (Video Encode {rendition['label']})"):
                logging.error(f"Failed to encode video rendition {rendition['label']}.")
                return False
            logging.info(f"Successfully encoded video rendition: {rendition['label']}")
            
        # --- Stage 2: Extract Audio Stream Separately ---
        logging.info("\n--- Stage 2: Extracting Audio Stream ---")
        audio_output_filepath = os.path.join(temp_dir, 'audio.mp4')
        audio_extract_cmd = [
            'ffmpeg', '-y', '-i', input_filepath,
            '-map', '0:a:0', 
            '-c:a', 'aac',
            '-b:a', '128k', 
            '-ac', '2', 
            '-ar', '48000', 
            '-vn', 
            '-movflags', 'faststart',
            audio_output_filepath
        ]
        if not run_ffmpeg_command(audio_extract_cmd, "FFmpeg (Audio Extract)"):
            logging.error("Failed to extract audio stream.")
            return False
        logging.info("Successfully extracted audio stream.")

        # --- Stage 3: Mux all encoded files into DASH ---
        logging.info("\n--- Stage 3: Muxing into DASH Format ---")
        dash_mux_cmd = [
            'ffmpeg', '-y'
        ]

        for f in intermediate_video_files:
            dash_mux_cmd.extend(['-i', f])
        
        audio_input_index = len(intermediate_video_files) 
        dash_mux_cmd.extend(['-i', audio_output_filepath])

        video_output_stream_indices_for_adaptation_sets = []
        for i in range(len(intermediate_video_files)):
            dash_mux_cmd.extend(['-map', f'{i}:v:0']) 
            video_output_stream_indices_for_adaptation_sets.append(str(i)) 
        
        # Explicitly map the audio stream from its input file
        dash_mux_cmd.extend(['-map', f'{audio_input_index}:a:0']) 

        audio_output_stream_index_for_adaptation_sets = str(len(intermediate_video_files)) 

        dash_mux_cmd.extend(['-c', 'copy']) 
        
        dash_mux_cmd.extend([
            '-f', 'dash', 
            '-use_timeline', '1', 
            '-use_template', '1', 
            '-adaptation_sets', 
            f'id=0,streams={",".join(video_output_stream_indices_for_adaptation_sets)} id=1,streams={audio_output_stream_index_for_adaptation_sets}',
            os.path.join(output_dir, 'manifest.mpd')
        ])

        if not run_ffmpeg_command(dash_mux_cmd, "FFmpeg (DASH Muxer)"):
            logging.error(f"Failed to package into DASH for '{media_item.title}'.")
            return False
        
        logging.info(f"DASH packaging complete for '{media_item.title}'. Output in: {output_dir}")
        
        logging.info("Cleaning up temporary files...")
        for f in intermediate_video_files + [audio_output_filepath]:
            try:
                os.remove(f)
                logging.debug(f"Cleaned up temporary file: {f}")
            except OSError as e:
                logging.warning(f"Could not remove temporary file {f}: {e}")

        try:
            if not os.listdir(temp_dir):
                os.rmdir(temp_dir)
                logging.debug(f"Cleaned up temporary directory: {temp_dir}")
            else:
                logging.warning(f"Temporary directory {temp_dir} is not empty, skipping removal.")
        except OSError as e:
            logging.warning(f"Could not remove temporary directory {temp_dir}: {e}")

        return True
