import { Suspense, lazy } from "react";
import { useRoutes, Routes, Route, Navigate } from "react-router-dom";
import Home from "./components/home";
import Dashboard from "./components/Dashboard";
import MovieDetailPage from "./components/MovieDetailPage";
import SimilarContentSearch from "./components/SimilarContentSearch";
import routes from "tempo-routes";
import { ThemeProvider } from "./components/theme-provider";
import { ThemeToggle } from "./components/ui/theme-toggle";
import PlotSimilarityTest from "./components/PlotSimilarityTest";
import EdgeFunctionTester from "./components/EdgeFunctionTester";
import AdminDashboard from "./components/AdminDashboard";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import AdminRoleDebugger from "./components/AdminRoleDebugger";
import DebugPanel from "./components/DebugPanel";
import DebugRecommendations from "./components/DebugRecommendations";
import SupabaseConnectionTest from "./components/SupabaseConnectionTest";
import UserDashboard from "./components/UserDashboard";
import VectorDatabaseManager from "./components/VectorDatabaseManager";
import VectorDatabaseDemo from "./components/VectorDatabaseDemo";
import StaticTmdbImport from "./pages/StaticTmdbImport";
import { RecommendationProvider } from "./contexts/RecommendationContext";

// Lazy load authentication components
const Auth = lazy(() => import("./components/Auth"));
const UserProfile = lazy(() => import("./components/UserProfile"));

function App() {
  return (
    <AuthProvider>
      <RecommendationProvider>
        <ThemeProvider defaultTheme="system">
          <Suspense fallback={<p>Loading...</p>}>
            <>
              <div className="fixed top-4 right-4 z-50">
                <ThemeToggle />
              </div>
              {import.meta.env.VITE_TEMPO === "true" && useRoutes(routes)}
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/movie/:id" element={<MovieDetailPage />} />
                <Route path="/tv/:id" element={<MovieDetailPage />} />
                <Route path="/search" element={<SimilarContentSearch />} />
                <Route path="/login" element={<Auth />} />
                <Route path="/register" element={<Auth />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/profile" element={<UserProfile />} />
                <Route
                  path="/plot-similarity-test"
                  element={<PlotSimilarityTest />}
                />
                <Route
                  path="/edge-function-test"
                  element={<EdgeFunctionTester />}
                />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin-debug" element={<AdminRoleDebugger />} />
                <Route path="/debug" element={<DebugPanel />} />
                <Route
                  path="/debug-recommendations"
                  element={<DebugRecommendations />}
                />
                <Route
                  path="/supabase-test"
                  element={<SupabaseConnectionTest />}
                />
                <Route path="/user-dashboard" element={<UserDashboard />} />
                <Route
                  path="/vector-database"
                  element={<VectorDatabaseManager />}
                />
                <Route
                  path="/vector-database-demo"
                  element={<VectorDatabaseDemo />}
                />
                <Route
                  path="/static-tmdb-import"
                  element={<StaticTmdbImport />}
                />
                {import.meta.env.VITE_TEMPO === "true" && (
                  <Route path="/tempobook/*" />
                )}
              </Routes>
            </>
          </Suspense>
        </ThemeProvider>
      </RecommendationProvider>
    </AuthProvider>
  );
}

export default App;
