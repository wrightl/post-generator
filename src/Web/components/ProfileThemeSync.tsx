'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getProfile } from '@/lib/api';
import { useEffect, useRef } from 'react';

export function ProfileThemeSync({ children }: { children: React.ReactNode }) {
    const { idToken } = useAuth();
    const { setTheme } = useTheme();
    const synced = useRef(false);

    useEffect(() => {
        if (!idToken || synced.current) return;
        synced.current = true;
        getProfile(idToken)
            .then((p) => {
                if (
                    p.preferredTheme === 'light' ||
                    p.preferredTheme === 'dark'
                ) {
                    setTheme(p.preferredTheme);
                }
            })
            .catch(() => {
                synced.current = false;
            });
    }, [idToken, setTheme]);

    return <>{children}</>;
}
