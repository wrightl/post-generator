"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getProfile } from "@/lib/api";
import { useEffect, useRef } from "react";

export function ProfileThemeSync({ children }: { children: React.ReactNode }) {
  const { appUser } = useAuth();
  const { setTheme } = useTheme();
  const synced = useRef(false);

  useEffect(() => {
    if (!appUser || synced.current) return;
    synced.current = true;
    getProfile()
      .then((p) => {
        if (p.preferredTheme === "light" || p.preferredTheme === "dark") {
          setTheme(p.preferredTheme);
        }
      })
      .catch(() => {
        synced.current = false;
      });
  }, [appUser?.id, setTheme]);

  return <>{children}</>;
}
