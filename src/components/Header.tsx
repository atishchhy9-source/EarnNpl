import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Bell,
  Shield,
  User,
  LogOut,
  Sparkles,
  ChevronRight,
  X,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchUserNotifications, markNotificationAsRead } from '../services/notificationService';
import { NotificationItem } from '../types';

interface HeaderProps {
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
  onNavigateTab: (tab: string) => void;
  currentTab: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAuth,
  onOpenAdmin,
  onNavigateTab,
  currentTab,
}) => {
  const { currentUser, userProfile, isAdmin, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (currentUser?.uid) {
      fetchUserNotifications(currentUser.uid).then(setNotifications).catch(() => {});
    }
  }, [currentUser?.uid, showNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleRead = async (notif: NotificationItem) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
      setNotifications(prev =>
        prev.map(n => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => onNavigateTab('home')}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <span className="font-extrabold text-emerald-400 text-lg tracking-tighter">NPL</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-100 text-lg tracking-tight">Earn Npl</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span>🇳🇵</span> NPR
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Verified Earning & Deposits</p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Crash Game Shortcut */}
          <button
            onClick={() => onNavigateTab('crash')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
              currentTab === 'crash'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <span>🚀 Crash</span>
          </button>

          {currentUser ? (
            <>
              {/* Admin Portal Button */}
              {isAdmin && (
                <button
                  onClick={onOpenAdmin}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold transition-colors"
                >
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin Panel</span>
                </button>
              )}

              {/* Balance Chip */}
              <div
                onClick={() => onNavigateTab('deposit')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 cursor-pointer transition-colors"
              >
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span className="text-xs sm:text-sm font-bold font-mono">
                  Rs. {(userProfile?.balance ?? 0).toFixed(2)}
                </span>
              </div>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/60 p-4 z-50">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-sm font-bold text-white">Notifications</h4>
                      </div>
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60 mt-2 pr-1">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleRead(n)}
                            className={`py-2.5 px-2 rounded-lg transition-colors cursor-pointer ${
                              n.read ? 'opacity-70 hover:bg-slate-800/40' : 'bg-slate-800/60 hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="text-xs font-semibold text-slate-200">{n.title}</h5>
                              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Avatar Trigger */}
              <button
                onClick={() => onNavigateTab('profile')}
                className={`p-1.5 rounded-lg border transition-colors ${
                  currentTab === 'profile'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-700/80 bg-slate-800/60 text-slate-300 hover:text-white'
                }`}
                title={userProfile?.name || 'Profile'}
              >
                <User className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition-all"
            >
              Log In / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
