import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, UserRound } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || !isSupabaseConfigured) return;
    setError(null); setLoading(true);
    try {
      const email = username.includes('@') ? username.trim() : `${username.trim()}@ireserve.local`;
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError('Unable to sign in. Check your username and password, then try again.');
    } catch { setError('We couldn’t connect. Check your internet connection and try again.'); }
    finally { setLoading(false); }
  };
  return <main className="login-page">
    <div className="login-card">
      <section className="login-hero" aria-label="PJP Hardware">
        <div className="login-brand"><img src="/logo2.png" alt="PJP Hardware logo" width="64" height="64" /><div><strong>PJP HARDWARE</strong><span>Inventory Management System</span></div></div>
        <div className="login-hero-copy"><h1>Smarter inventory.<br />Stronger business.</h1><p>Track. Manage. Grow.</p></div>
        <img className="login-illustration" src="/hardware-workspace.png" alt="" fetchPriority="high" />
        <p className="login-hero-footer">Everything your store needs. All in one place.</p>
      </section>
      <section className="login-form-container" aria-labelledby="login-title">
        <div className="login-form-heading"><span className="welcome-badge">Welcome back</span><h2 id="login-title">Log in to your workspace</h2><p>Access your account to manage inventory,<br className="desktop-break" /> sales, and more.</p></div>
        {!isSupabaseConfigured && <div role="status" className="ui-alert ui-alert-error">Workspace connection is not configured. Contact your store administrator.</div>}
        {error && <div id="login-error" role="alert" className="ui-alert ui-alert-error">{error}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group"><label className="form-label" htmlFor="staffId">Staff username or email</label><div className="input-with-icon"><UserRound size={18} /><input id="staffId" type="text" className="form-input" placeholder="Enter your username or email" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" autoCapitalize="none" spellCheck={false} aria-describedby={error ? 'login-error' : undefined} /></div></div>
          <div className="form-group"><label className="form-label" htmlFor="passcode">Password</label><div className="input-with-icon"><KeyRound size={18} /><input id="passcode" type={showPassword ? 'text' : 'password'} className="form-input password-input" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" aria-describedby={error ? 'login-error' : undefined} /><button className="password-toggle icon-button" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          <button type="submit" className="btn btn-primary login-submit" disabled={loading || !isSupabaseConfigured}>{loading ? <><Loader2 className="animate-spin" size={18} /> Signing in…</> : <>Log in <ArrowRight size={18} /></>}</button>
        </form>
        <div className="login-security"><LockKeyhole size={13} /> Authorized staff access only</div>
        <p className="login-help">Need access? Contact your store administrator.</p>
      </section>
    </div>
    <p className="login-footer">PJP Hardware <span>·</span> Inventory Management System</p>
  </main>;
}
