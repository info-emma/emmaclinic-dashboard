import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (!supabase) { setError('ไม่สามารถเชื่อมต่อ Supabase ได้'); return; }

    // Implicit flow: hash contains type=recovery or type=invite
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get('type') === 'recovery' || hash.get('type') === 'invite') {
      setReady(true);
    }

    // PKCE flow: code in query params (Supabase exchanges it for a session automatically)
    if (new URLSearchParams(window.location.search).has('code')) {
      setReady(true);
    }

    // Listen for auth events — covers both flows and delayed processing
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === 'PASSWORD_RECOVERY' ||
        event === 'SIGNED_IN' ||
        (event === 'INITIAL_SESSION' && session)
      ) {
        setReady(true);
      }
    });

    // Fallback: session already exists (e.g. arrived after token was already processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    if (password !== confirm) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    if (!supabase) { setError('ไม่สามารถเชื่อมต่อ Supabase ได้'); return; }

    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) { setError(err.message); return; }

    setDone(true);
    await supabase.auth.signOut();
    setTimeout(() => navigate('/login', { replace: true }), 2500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-emma-black relative overflow-hidden">
      <div className="circle-motif w-96 h-96 -top-32 -left-32" style={{ borderColor: '#C9A870', opacity: 0.15 }} />

      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-emma-black border border-emma-grey-dark rounded-2xl shadow-emma-lg overflow-hidden">
          <div className="flex flex-col items-center pt-10 pb-6 px-8 border-b border-emma-grey-dark">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-emma-gold mb-4">
              <img src="/logo.jpg" alt="EMMA Clinic" className="w-full h-full object-cover" />
            </div>
            <h1 className="font-playfair text-xl text-emma-white tracking-wide">ตั้งรหัสผ่านใหม่</h1>
          </div>

          <div className="px-8 py-8">
            {done ? (
              <div className="text-center space-y-4">
                <CheckCircle size={40} className="mx-auto text-emerald-400" />
                <p className="text-sm font-inter text-emma-white">เปลี่ยนรหัสผ่านเรียบร้อยแล้ว</p>
                <p className="text-xs text-emma-grey font-inter">กำลังนำคุณไปหน้า Login…</p>
              </div>
            ) : !ready ? (
              <div className="text-center space-y-3">
                <p className="text-sm font-inter text-emma-grey">
                  กรุณาคลิก link จาก email เพื่อเข้าสู่หน้านี้
                </p>
                <Link to="/login" className="text-xs text-emma-grey hover:text-emma-grey-light font-inter transition-colors">
                  กลับหน้า Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-inter font-medium text-emma-grey-light tracking-wide uppercase">
                    รหัสผ่านใหม่
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="อย่างน้อย 8 ตัวอักษร"
                      className="w-full bg-white/5 border border-emma-grey-dark rounded-lg px-4 py-2.5 pr-10
                        text-sm font-inter text-emma-white placeholder-emma-grey
                        focus:outline-none focus:border-emma-gold/60 transition-colors"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-emma-grey hover:text-emma-grey-light transition-colors">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-inter font-medium text-emma-grey-light tracking-wide uppercase">
                    ยืนยันรหัสผ่าน
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-emma-grey-dark rounded-lg px-4 py-2.5
                      text-sm font-inter text-emma-white placeholder-emma-grey
                      focus:outline-none focus:border-emma-gold/60 transition-colors"
                  />
                </div>

                {error && <p className="text-xs text-red-400 font-inter text-center">{error}</p>}

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4
                    bg-emma-gold/20 hover:bg-emma-gold/30 border border-emma-gold/50
                    text-emma-gold-light text-sm font-inter font-semibold rounded-lg
                    transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading && <span className="animate-spin rounded-full h-4 w-4 border-2 border-emma-gold border-t-transparent" />}
                  {loading ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
