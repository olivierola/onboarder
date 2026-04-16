"use client";

import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import { createClient }        from "@/lib/supabase";
import { Bell, HelpCircle, LogOut, ChevronDown, User } from "lucide-react";

interface HeaderProps { title: string; subtitle?: string; }

export function Header({ title, subtitle }: HeaderProps) {
  const router   = useRouter();
  const supabase = createClient();
  const [email,       setEmail]       = useState("");
  const [menuOpen,    setMenuOpen]    = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? "");
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = email ? email.slice(0, 2).toUpperCase() : "??";

  return (
    <header className="h-16 bg-white border-b border-slate-100 px-8 flex items-center gap-4 sticky top-0 z-10">
      <div className="flex-1">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 relative">
          <Bell className="w-4 h-4" />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500">
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            {email && <span className="text-xs text-slate-600 max-w-[120px] truncate hidden md:block">{email}</span>}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-20">
                {email && (
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-xs text-slate-400">Connecté en tant que</p>
                    <p className="text-sm font-medium text-slate-700 truncate">{email}</p>
                  </div>
                )}
                <button
                  onClick={async () => { setMenuOpen(false); await signOut(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Déconnexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
