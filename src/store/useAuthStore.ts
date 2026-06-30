import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthStore {
  user: User | null;
  initialized: boolean;
  signingIn: boolean;
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  initialized: false,
  signingIn: false,

  initialize: () => {
    if (!supabase) {
      set({ initialized: true });
      return () => {};
    }

    supabase.auth.getSession().then(({ data }) => {
      set({ user: data.session?.user ?? null, initialized: true });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, initialized: true });
    });

    return () => subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    if (!supabase) return 'ไม่สามารถเชื่อมต่อ Supabase ได้';
    set({ signingIn: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ signingIn: false });
    if (!error) return null;
    if (error.message === 'Invalid login credentials') return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    return error.message;
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  },
}));
