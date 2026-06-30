import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) { setError('ไม่สามารถเชื่อมต่อ Supabase ได้'); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
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
            <h1 className="font-playfair text-xl text-emma-white tracking-wide">ลืมรหัสผ่าน</h1>
            <p className="text-xs text-emma-grey font-inter mt-1 text-center">
              ระบบจะส่ง link สำหรับ reset password ไปที่ email ของคุณ
            </p>
          </div>

          <div className="px-8 py-8">
            {sent ? (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emma-gold/20 border border-emma-gold/40 mx-auto">
                  <Mail size={20} className="text-emma-gold" />
                </div>
                <p className="text-sm font-inter text-emma-white">ส่ง email แล้ว</p>
                <p className="text-xs text-emma-grey font-inter">
                  ตรวจสอบ inbox ของคุณ และคลิก link เพื่อ reset รหัสผ่าน
                </p>
                <Link to="/login" className="block text-xs text-emma-grey hover:text-emma-grey-light font-inter transition-colors mt-2">
                  กลับหน้า Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-inter font-medium text-emma-grey-light tracking-wide uppercase">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="email@emmaclinicthailand.com"
                    className="w-full bg-white/5 border border-emma-grey-dark rounded-lg px-4 py-2.5
                      text-sm font-inter text-emma-white placeholder-emma-grey
                      focus:outline-none focus:border-emma-gold/60 transition-colors"
                  />
                </div>

                {error && <p className="text-xs text-red-400 font-inter text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4
                    bg-emma-gold/20 hover:bg-emma-gold/30 border border-emma-gold/50
                    text-emma-gold-light text-sm font-inter font-semibold rounded-lg
                    transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <span className="animate-spin rounded-full h-4 w-4 border-2 border-emma-gold border-t-transparent" />}
                  {loading ? 'กำลังส่ง…' : 'ส่ง Reset Link'}
                </button>

                <div className="text-center">
                  <Link to="/login" className="inline-flex items-center gap-1 text-xs text-emma-grey hover:text-emma-grey-light font-inter transition-colors">
                    <ArrowLeft size={12} /> กลับหน้า Login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
