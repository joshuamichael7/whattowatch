import { Suspense, lazy } from "react";
import { useRoutes, Routes, Route, Navigate } from "react-router-dom";
import Home from "./components/home";
import Dashboard from "./components/Dashboard";
import MovieDetailPage from "./components/MovieDetailPage";
import routes from "tempo-routes";
import { ThemeProvider } from "./components/theme-provider";
import { ThemeToggle } from "./components/ui/theme-toggle";
import PlotSimilarityTest from "./components/PlotSimilarityTest";
import EdgeFunctionTester from "./components/EdgeFunctionTester";
import AdminDashboard from "./components/AdminDashboard";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";

// Lazy load authentication components
const Auth = lazy(() => import("./components/Auth"));
const UserProfile = lazy(() => import("./components/UserProfile"));

function App() {
  return (
    <AuthProvider>
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
            </Routes>
          </>
        </Suspense>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
