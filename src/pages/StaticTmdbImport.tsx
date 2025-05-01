import React from "react";
import TmdbImportMonitor from "@/components/TmdbImportMonitor";
import StaticTmdbImporter from "@/components/StaticTmdbImporter";

// This is a static page that contains TMDB IDs for server-side processing
// The actual IDs are stored in a separate data file that the server accesses

export const StaticTmdbImport: React.FC = () => {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">TMDB Data Import</h1>
      <p className="mb-4">
        Import TMDB data from the static file into the vector database.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Client-Side Import</h2>
          <p className="mb-4">
            Use this importer to process the TMDB IDs directly in your browser.
          </p>
          <StaticTmdbImporter />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Server-Side Import</h2>
          <p className="mb-4">
            Monitor the server-side import process. This process runs on the
            server and does not require the browser to be open.
          </p>
          <TmdbImportMonitor />
        </div>
      </div>

      <div className="mt-8 p-6 border rounded-md bg-muted/20">
        <h2 className="text-xl font-semibold mb-4">About the Import Process</h2>
        <p className="mb-2">
          The TMDB IDs are stored in <code>public/tmdbIds.json</code>.
        </p>
        <p className="mb-2">
          Both importers read from this file and process the IDs in batches.
        </p>
        <p>You can add more IDs to the file as needed.</p>
      </div>
    </div>
  );
};

export default StaticTmdbImport;
