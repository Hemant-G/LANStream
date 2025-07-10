import { useState } from 'react';
import DashPlayer from './components/DashPlayer';

function App() {
  // --- IMPORTANT: Change this URL to your Flask server's address ---
  const [mediaId, setMediaId] = useState(27); // Set a default media ID to test
  const manifestUrl = `http://192.168.18.6:5000/api/media/dash/${mediaId}/manifest.mpd`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-900 text-gray-100">
      <header className="text-center mb-10">
        <h1 className="text-5xl font-extrabold text-teal-400 drop-shadow-lg">
          LanStream
        </h1>
        <p className="mt-4 text-gray-400 max-w-2xl text-lg">
          A professional frontend for adaptive bitrate streaming with React and Tailwind CSS.
        </p>
      </header>
      
      <main className="w-full flex flex-col items-center space-y-8">
        <div className="w-full max-w-md flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-4">
          <label htmlFor="media-id" className="text-lg font-medium">
            Enter Media ID:
          </label>
          <input
            id="media-id"
            type="number"
            value={mediaId}
            onChange={(e) => setMediaId(e.target.value)}
            className="w-24 px-4 py-2 text-gray-900 bg-gray-200 rounded-md shadow-inner focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
          />
        </div>
        
        {/* The DashPlayer component will initialize the stream */}
        <DashPlayer manifestUrl={manifestUrl} />
      </main>

      <footer className="mt-20 text-center text-gray-500 text-sm">
        <p>
          <a href="https://dash.js.org/" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">Powered by dash.js</a>
        </p>
      </footer>
    </div>
  );
}

export default App;