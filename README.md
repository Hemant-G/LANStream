# LANstream

A full-stack video streaming solution designed for seamless, high-quality media playback within a local area network (LAN).

![Preview of LANstream](/media_player/public/lanstream_thumbnail.png)

## Project Overview

LANstream is a self-contained media streaming application that uses **DASH (Dynamic Adaptive Streaming over HTTP)** to deliver video content from a local server to any device on the same network. This approach ensures low latency and high-speed playbook without relying on external internet connections or cloud services.

### Key Features

- **Adaptive bitrate streaming** - Automatically adjusts video quality based on network conditions
- **Responsive UI** - Works seamlessly across desktop and mobile devices
- **User progress tracking** - Remember where users left off watching
- **Robust playback controls** - Full-featured video player with custom controls
- **Local network optimization** - Designed specifically for LAN environments
- **HTTPS security** - Secure communication between server and clients

## Tech Stack

### Frontend (React)
- **React** - UI development with Vite
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first styling
- **Axios** - Promise-based HTTP client for API requests
- **Dash.js** - DASH video playback library

### Backend (Python)
- **Flask** - Web framework for the backend API
- **PostgreSQL** - Relational database for data storage
- **Flask-SQLAlchemy** & **Flask-Migrate** - ORM and database migrations

### Video Processing
- **FFmpeg** - Open-source tool for video processing and conversion
- **ffprobe** - Companion tool for analyzing media file properties and streams

## Demo Videos

- [Local Setup and Running the Project](https://www.youtube.com/watch?v=k2tijbZ_J64)
- [Desktop (PC) Walkthrough](https://www.youtube.com/watch?v=BTK19KNDHQI)
- [Mobile Device Walkthrough](https://www.youtube.com/shorts/9eEaTk2OQ0U)

## 🔧 How It Works

### Streaming Architecture

The system's core is the DASH (Dynamic Adaptive Streaming over HTTP) protocol. The backend doesn't stream a single video file; instead, it provides:

- **Manifest (.mpd file)**: XML file describing the video, available qualities, fragment locations, and synchronization information
- **Video Fragments (.m4s files)**: Small, separate video chunks served on-demand

### Adaptive Bitrate Algorithms

The Dash.js player intelligently switches between video qualities using:

- **Throughput-based algorithms**: Monitor download speed to predict network capacity
- **Buffer-based algorithms**: Prioritize buffer health (e.g., BOLA - Buffer Occupancy-based Lyapunov Algorithm)
- **Hybrid approach**: Dash.js's default 'abrDynamic' strategy balances quality and stability

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 16+
- PostgreSQL
- FFmpeg and ffprobe
- OpenSSL (for HTTPS certificates)

### Backend Setup

1. **Navigate to backend directory and create virtual environment:**
   ```bash
   python -m venv venv
   ```

2. **Activate virtual environment:**
   ```bash
   # macOS/Linux
   source venv/bin/activate
   
   # Windows
   .\venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Generate SSL certificates:**
   ```bash
   openssl req -x509 -newkey rsa:4096 -nodes -keyout key.pem -out cert.pem -days 365
   ```
   > **Important**: When prompted for "Common Name", enter your computer's local IP address (e.g., `192.168.1.10`).

5. **Create `.env` file in backend directory:**
   ```env
   FLASK_ENV=development
   SECRET_KEY=your_super_secret_key_here
   DATABASE_URL=postgresql://username:password@localhost:5432/dbname
   BACKEND_URL=https://YOUR_LOCAL_IP:5000/api
   MEDIA_PATH=/path/to/your/video/files
   ```

6. **Run the server:**
   ```bash
   python run.py
   ```

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env` file in frontend directory:**
   ```env
   VITE_BACKEND_BASE_URL=https://YOUR_LOCAL_IP:5000
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## Media Management

LANstream includes built-in CLI tools for managing your media library:

### Scan Media Directory
```bash
flask scan-media
```
Scans your media directory, adds new files to the database, and removes deleted files.

### List All Media
```bash
flask list-media
```
Displays all media files in the database with their IDs and paths.

### Package Videos for DASH
```bash
# Package specific videos by ID
flask package-dash 1 2 3

# Package all videos
flask package-dash --all
```
Converts videos to DASH format with multiple quality levels.

## Security Notes

- The application uses self-signed SSL certificates for HTTPS
- First-time access will show browser security warnings - these can be safely bypassed for local network use
- Never use the example secret keys in production

## Acknowledgments

- [Dash.js](https://dashjs.org) for the excellent DASH video player
- [FFmpeg](https://ffmpeg.org/) for powerful video processing capabilities
- The open-source community for the amazing tools and libraries that made this project possible

---

**Note**: This project is designed for local network use. For internet-wide streaming, additional security measures and scalability considerations would be necessary.