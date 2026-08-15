import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import NavBar from "./components/NavBar.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Setup from "./pages/Setup.jsx";
import Pair from "./pages/Pair.jsx";
import Home from "./pages/Home.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import Photos from "./pages/Photos.jsx";

function Gate({ children, needProfile, needPair }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen lede">Opening ANSH…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (needProfile && !user.profile_complete) return <Navigate to="/setup" replace />;
  if (needPair && !user.paired) return <Navigate to="/pair" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen lede">Opening ANSH…</div>;
  if (user?.profile_complete && user?.paired) return <Navigate to="/" replace />;
  if (user?.profile_complete) return <Navigate to="/pair" replace />;
  if (user) return <Navigate to="/setup" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  const showNav = user?.profile_complete && user?.paired;

  return (
    <div className="app-shell">
      {showNav && <NavBar />}
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnly>
              <Signup />
            </PublicOnly>
          }
        />
        <Route
          path="/setup"
          element={
            <Gate>
              <Setup />
            </Gate>
          }
        />
        <Route
          path="/pair"
          element={
            <Gate needProfile>
              <Pair />
            </Gate>
          }
        />
        <Route
          path="/"
          element={
            <Gate needProfile needPair>
              <ErrorBoundary>
                <Home />
              </ErrorBoundary>
            </Gate>
          }
        />
        <Route
          path="/calendar"
          element={
            <Gate needProfile needPair>
              <CalendarPage />
            </Gate>
          }
        />
        <Route
          path="/photos"
          element={
            <Gate needProfile needPair>
              <Photos />
            </Gate>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
