'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ProfileThemeSync } from '@/components/ProfileThemeSync';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <AuthProvider>
                <ProfileThemeSync>{children}</ProfileThemeSync>
            </AuthProvider>
        </ThemeProvider>
    );
}
