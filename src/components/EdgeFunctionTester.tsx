import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const EdgeFunctionTester: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [functionUrl, setFunctionUrl] = useState("/api/test-edge");

  const testEdgeFunction = async () => {
    setIsLoading(true);
    setError(null);
    setTestResult(null);

    try {
      console.log(`Testing edge function at: ${functionUrl}`);
      const response = await fetch(functionUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Edge function response:", data);
      setTestResult(data);
    } catch (err) {
      console.error("Error testing edge function:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-4">
        <Link to="/" className="text-blue-500 hover:underline">
          ← Back to Home
        </Link>
      </div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            Edge Function Tester
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-4">
              This tool tests if edge functions are working properly on your
              Netlify deployment.
            </p>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={functionUrl}
                onChange={(e) => setFunctionUrl(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Edge function URL"
              />
              <Button onClick={testEdgeFunction} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Edge Function"
                )}
              </Button>
            </div>

            <div className="text-sm mb-2">
              Try these URLs:
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>
                  <code>/api/test-edge</code> - Test edge function
                </li>
                <li>
                  <code>/api/omdb-edge</code> - OMDB edge function
                </li>
                <li>
                  <code>/.netlify/edge-functions/test-edge</code> - Direct edge
                  function path
                </li>
                <li>
                  <code>/.netlify/functions/check-edge</code> - Regular function
                  to check edge status
                </li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="p-4 mb-4 bg-destructive/10 text-destructive rounded-md flex items-center">
              <XCircle className="h-5 w-5 mr-2" />
              <div>
                <p className="font-medium">Error testing edge function</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {testResult && (
            <div className="mt-4">
              <div className="p-4 mb-4 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-md flex items-center">
                <CheckCircle className="h-5 w-5 mr-2" />
                <p className="font-medium">Edge function is working!</p>
              </div>

              <div className="bg-muted p-4 rounded-md overflow-auto max-h-80">
                <pre className="text-xs">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EdgeFunctionTester;
