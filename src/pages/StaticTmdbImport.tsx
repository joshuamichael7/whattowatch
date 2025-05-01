import React from "react";
import TmdbImportMonitor from "@/components/TmdbImportMonitor";

// This is a static page that contains TMDB IDs for server-side processing
// The actual IDs are stored in a separate data file that the server accesses

const StaticTmdbImportPage: React.FC = () => {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">TMDB Data Import</h1>
      <p className="mb-4">
        This page contains static TMDB IDs for server-side processing.
      </p>
      <p className="mb-4">
        The import process runs on the server and does not require the browser
        to be open.
      </p>

      <div className="mt-8">
        <TmdbImportMonitor />
      </div>

      <div className="mt-8 p-6 border rounded-md bg-muted/20">
        <h2 className="text-xl font-semibold mb-4">About the Import Process</h2>
        <p className="mb-2">
          The TMDB IDs are stored in <code>src/data/tmdbIds.json</code>.
        </p>
        <p className="mb-2">
          The server reads this file and processes the IDs in batches.
        </p>
        <p>You can add more IDs to the file as needed.</p>
      </div>
    </div>
  );
};

export default StaticTmdbImportPage;
