'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Profile = {
  id: string;
  full_name: string | null;
  role: 'user' | 'roaster' | 'supplier' | 'cafe' | 'admin';
  country: string | null;
};

// يعيد المحاولة عند فشل عابر (شبكة/JWT مؤقت) بدل ما يترك profile عالقة null
// للأبد -- بدونها، أي فشل مؤقت واحد بجلب البروفايل كان يخلي صفحة الأدمن
// تعرض "هذا الحساب ما عنده صلاحية وصول" حتى لحساب أدمن حقيقي وصحيح.
async function loadProfile(userId: string, attempt = 1): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    return loadProfile(userId, attempt + 1);
  }
  return data ?? null;
}

export function useAdminAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        setProfile(await loadProfile(data.session.user.id));
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setProfile(await loadProfile(newSession.user.id));
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = () => supabase.auth.signOut();

  return {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    signIn,
    signOut,
  };
}
