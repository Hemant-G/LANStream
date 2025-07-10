import os
import subprocess
import json
from app.extensions import db
from app.models.media import MediaItem

def get_video_resolution(filepath):
    cmd = [
        'ffprobe',
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height',
        '-show_entries', 'format=duration',
        '-of', 'json',
        filepath
    ]
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        probe_data = json.loads(result.stdout)
        
        width, height = None, None
        if 'streams' in probe_data and len(probe_data['streams']) > 0:
            width = probe_data['streams'][0].get('width')
            height = probe_data['streams'][0].get('height')
        
        duration = None
        if 'format' in probe_data and 'duration' in probe_data['format']:
            duration = float(probe_data['format']['duration'])

        if width and height:
            return (width, height, duration)
    except (subprocess.CalledProcessError, json.JSONDecodeError, KeyError) as e:
        print(f"Error getting video resolution/duration for {filepath}: {e}")
    return None


def package_for_dash(app, media_id):
    with app.app_context():
        media_item = MediaItem.query.get(media_id)
        if not media_item:
            print(f"Error: Media item with ID {media_id} not found.")
            return False

        media_root = app.config['MEDIA_PATH']
        input_filepath = os.path.join(media_root, media_item.filepath)

        output_dir = os.path.join(media_root, f'dash/{media_item.id}')
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        print(f"Starting DASH packaging for '{media_item.title}'...")

        # 1. Get source video resolution and duration
        source_info = get_video_resolution(input_filepath)
        if not source_info:
            print(f"Could not determine source video resolution/duration for {input_filepath}. Aborting.")
            return False
        
        source_width, source_height, source_duration = source_info
        print(f"Source video resolution: {source_width}x{source_height}, Duration: {source_duration}s")

        # 2. Dynamically build FFmpeg video output arguments
        video_output_args = []
        added_heights = set() # To keep track of heights already added
        stream_index = 0

        # --- ALWAYS Add Original Quality First ---
        # A rough estimate for original bitrate based on resolution, or set a high cap
        original_bitrate_k = min(
            int((source_width * source_height) / (1920 * 1080) * 4500), # Scale from 1080p bitrate
            15000 # Cap it at a reasonable max (e.g., for 4K source)
        )
        if source_height >= 1080: # If source is high-res, give it a higher cap
             original_bitrate_k = min(original_bitrate_k, 15000)
        elif source_height >= 720: # If 720p original
             original_bitrate_k = min(original_bitrate_k, 5000)
        else: # For lower originals
             original_bitrate_k = min(original_bitrate_k, 2000)

        video_output_args.extend([
            '-map', '0:v:0', f'-c:v:{stream_index}', 'libx264', f'-b:v:{stream_index}', f'{original_bitrate_k}k',
            f'-s:v:{stream_index}', f'{source_width}x{source_height}', f'-profile:v:{stream_index}', 'main', '-strict', '2'
        ])
        added_heights.add(source_height) # Mark original height as added
        print(f"  - Including ORIGINAL quality: {source_width}x{source_height} @ {original_bitrate_k}k.")
        stream_index += 1

        # --- Conditionally Add 1080p ---
        TARGET_1080P_HEIGHT = 1080
        TARGET_1080P_WIDTH = 1920
        TARGET_1080P_BITRATE_K = 4500

        # Add 1080p if source is higher than 1080p (needs downscaling)
        # AND 1080p hasn't already been added as the 'original'
        if source_height > TARGET_1080P_HEIGHT and TARGET_1080P_HEIGHT not in added_heights:
            video_output_args.extend([
                '-map', '0:v:0', f'-c:v:{stream_index}', 'libx264', f'-b:v:{stream_index}', f'{TARGET_1080P_BITRATE_K}k',
                f'-s:v:{stream_index}', f'{TARGET_1080P_WIDTH}x{TARGET_1080P_HEIGHT}', f'-profile:v:{stream_index}', 'main', '-strict', '2'
            ])
            added_heights.add(TARGET_1080P_HEIGHT)
            print(f"  - Including 1080p (downscaled from higher original): {TARGET_1080P_WIDTH}x{TARGET_1080P_HEIGHT} @ {TARGET_1080P_BITRATE_K}k.")
            stream_index += 1
        elif source_height < TARGET_1080P_HEIGHT:
            print(f"  - Skipping 1080p (source is lower resolution than 1080p).")
        # else: It means source_height == 1080 and it was added as original, so implicitly skipped here.


        # --- Conditionally Add 480p ---
        TARGET_480P_HEIGHT = 480
        TARGET_480P_WIDTH = 854
        TARGET_480P_BITRATE_K = 1200

        # Add 480p if source is higher than 480p (needs downscaling)
        # AND 480p hasn't already been added as the 'original'
        if source_height > TARGET_480P_HEIGHT and TARGET_480P_HEIGHT not in added_heights:
            video_output_args.extend([
                '-map', '0:v:0', f'-c:v:{stream_index}', 'libx264', f'-b:v:{stream_index}', f'{TARGET_480P_BITRATE_K}k',
                f'-s:v:{stream_index}', f'{TARGET_480P_WIDTH}x{TARGET_480P_HEIGHT}', f'-profile:v:{stream_index}', 'main', '-strict', '2'
            ])
            added_heights.add(TARGET_480P_HEIGHT)
            print(f"  - Including 480p (downscaled from higher original): {TARGET_480P_WIDTH}x{TARGET_480P_HEIGHT} @ {TARGET_480P_BITRATE_K}k.")
            stream_index += 1
        elif source_height < TARGET_480P_HEIGHT:
            print(f"  - Skipping 480p (source is lower resolution than 480p).")
        # else: It means source_height == 480 and it was added as original, so implicitly skipped here.


        # Ensure at least one video stream exists (the original should always cover this)
        if not video_output_args:
            print("Error: No video renditions could be generated. This should not happen if a source video exists. Aborting.")
            return False

        # FFmpeg command base
        cmd = [
            'ffmpeg', '-y', '-i', input_filepath
        ]
        
        # Add dynamically built video arguments
        cmd.extend(video_output_args)

        # Add audio stream (assuming '0:a:0' always exists and is desired)
        cmd.extend([
            '-map', '0:a:0', '-c:a:0', 'aac', '-b:a:0', '128k',
        ])
        
        # DASH packaging options
        # Ensure adaptation_sets correctly lists all video streams (v0, v1, v2 if all 3 are present)
        cmd.extend([
            '-f', 'dash', '-use_timeline', '1', '-use_template', '1',
            '-adaptation_sets', f'id=0,streams=v{",".join([str(i) for i in range(stream_index)])} id=1,streams=a0',
            os.path.join(output_dir, 'manifest.mpd')
        ])

        print("\nFFmpeg command being executed:")
        print(" \\\n  ".join(cmd))


        try:
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            print("\nFFmpeg stdout:\n", result.stdout)
            print("\nFFmpeg stderr:\n", result.stderr)
            print(f"DASH packaging complete for '{media_item.title}'.")

        except subprocess.CalledProcessError as e:
            print(f"\nERROR: FFmpeg command failed with exit code {e.returncode}")
            print(f"FFmpeg stdout:\n{e.stdout}")
            print(f"FFmpeg stderr:\n{e.stderr}")
            print(f"Command attempted was:\n{' '.join(e.cmd)}")
            return False
        except Exception as e:
            print(f"\nAn unexpected error occurred during packaging: {e}")
            return False
        
    return True