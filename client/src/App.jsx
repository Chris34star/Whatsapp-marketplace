import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import Header from './components/Header.jsx';
import Browse from './pages/Browse.jsx';
import ListingDetail from './pages/ListingDetail.jsx';
import Login from './pages/Login.jsx';
import SellerDashboard from './pages/SellerDashboard.jsx';
import SellerOnboarding from './pages/SellerOnboarding.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import MyOrders from './pages/MyOrders.jsx';

export default function App() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(() => localStorage.getItem('sokohub_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sokohub_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  if (loading) {
    return <div className="loading">Loading SokoHub...</div>;
  }

  return (
    <>
      <Header theme={theme} toggleTheme={toggleTheme} navigate={navigate} location={location} user={user} profile={profile} />
      <Routes>
        <Route path="/" element={<Browse />} />
        <Route path="/listing/:id" element={<ListingDetail />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/seller/dashboard" />} />
        <Route path="/seller/onboarding" element={user ? <SellerOnboarding /> : <Navigate to="/login" />} />
        <Route path="/seller/dashboard" element={user ? <SellerDashboard /> : <Navigate to="/login" />} />
        <Route path="/orders" element={user ? <MyOrders /> : <Navigate to="/login" />} />
        <Route path="/admin" element={profile?.role === 'super_admin' ? <AdminPanel /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}
