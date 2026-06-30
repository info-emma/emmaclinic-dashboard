import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useAuthStore(s => s.signIn);
  const signingIn = useAuthStore(s => s.signingIn);
  const user = useAuthStore(s => s.user);

  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = await signIn(email, password);
    if (err) setError(err);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-emma-black relative overflow-hidden">
      {/* Background motifs */}
      <div className="circle-motif w-96 h-96 -top-32 -left-32" style={{ borderColor: '#C9A870', opacity: 0.15 }} />
      <div className="circle-motif w-64 h-64 -bottom-16 -right-16" style={{ borderColor: '#C9A870', opacity: 0.1 }} />

      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* Card */}
        <div className="bg-emma-black border border-emma-grey-dark rounded-2xl shadow-emma-lg overflow-hidden">
          {/* Header */}
          <div className="flex flex-col items-center pt-10 pb-6 px-8 border-b border-emma-grey-dark">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-emma-gold mb-4">
              <img src="/logo.jpg" alt="EMMA Clinic" className="w-full h-full object-cover" />
            </div>
            <h1 className="font-playfair text-xl text-emma-white tracking-wide">EMMA Clinic</h1>
            <p className="text-xs text-emma-grey tracking-widest uppercase font-inter mt-1">Executive Dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-inter font-medium text-emma-grey-light tracking-wide uppercase">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="email@emmaclinicthailand.com"
                className="w-full bg-white/5 border border-emma-grey-dark rounded-lg px-4 py-2.5
                  text-sm font-inter text-emma-white placeholder-emma-grey
                  focus:outline-none focus:border-emma-gold/60 focus:bg-white/8 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-inter font-medium text-emma-grey-light tracking-wide uppercase">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-emma-grey-dark rounded-lg px-4 py-2.5 pr-10
                    text-sm font-inter text-emma-white placeholder-emma-grey
                    focus:outline-none focus:border-emma-gold/60 focus:bg-white/8 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-emma-grey hover:text-emma-grey-light transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 font-inter text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4
                bg-emma-gold/20 hover:bg-emma-gold/30 border border-emma-gold/50
                text-emma-gold-light text-sm font-inter font-semibold rounded-lg
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signingIn
                ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-emma-gold border-t-transparent" />
                : <LogIn size={14} />
              }
              {signingIn ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </button>

            <div className="text-center">
              <Link
                to="/forgot-password"
                className="text-xs text-emma-grey hover:text-emma-grey-light font-inter transition-colors"
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
