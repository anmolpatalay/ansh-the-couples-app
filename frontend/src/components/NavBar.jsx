import { NavLink } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function NavBar() {
  const { logout, user } = useAuth();
  return (
    <header className="nav">
      <NavLink to="/" className="brand">
        ANSH
      </NavLink>
      <nav className="nav-links">
        <NavLink to="/" end>
          Globe
        </NavLink>
        <NavLink to="/calendar">Calendar</NavLink>
        <NavLink to="/photos">Us in photos</NavLink>
      </nav>
      <div className="nav-right">
        <span className="nav-name">{user?.name}</span>
        <button className="ghost" onClick={logout} type="button">
          Log out
        </button>
      </div>
    </header>
  );
}
