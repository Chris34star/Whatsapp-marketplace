import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

export default function Login() {
  const navigate = useNavigate();

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/seller/dashboard',
        },
      });
      if (error) throw error;
    } catch (err) {
      toast(err.message || 'Google sign-in failed');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Soko<span>Hub</span></div>
        <div className="auth-subtitle">Kenya's local marketplace</div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p className="subtle" style={{ marginBottom: 20 }}>
            Sign in with Google to start selling, place orders, and manage your business.
          </p>
          <button className="btn btn-google" onClick={signInWithGoogle} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 16px', fontSize: 15, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--card)', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </div>

        <button className="btn" onClick={() => navigate('/')} style={{ width: '100%' }}>Back to browse</button>
      </div>
    </div>
  );
}
