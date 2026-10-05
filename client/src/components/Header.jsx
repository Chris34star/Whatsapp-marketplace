import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Header({ theme, toggleTheme, navigate, location, user, profile }) {
  const { logout } = useAuth();

  const go = (path) => (e) => {
    e.preventDefault();
    navigate(path);
  };

  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo" onClick={go('/')}>Soko<span>Hub</span></div>
        <div className="header-actions" style={{ flex: 1, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={go('/')}>Browse</button>
          {user && <button className="btn" onClick={go('/orders')}>My Orders</button>}
          {user && <button className="btn btn-accent" onClick={go('/seller/dashboard')}>Seller Dashboard</button>}
          {profile?.role === 'super_admin' && <button className="btn tab-admin" onClick={go('/admin')}>Admin Panel</button>}
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {user ? (
            <button className="btn btn-danger btn-sm" onClick={() => { logout(); navigate('/'); }}>
              Log out
            </button>
          ) : (
            <button className="btn btn-accent" onClick={go('/login')}>Sign in with Google</button>
          )}
        </div>
      </div>
    </header>
  );
}
