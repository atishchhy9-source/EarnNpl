import { Home, ArrowDownCircle, ArrowUpRight, Clock, User, Shield, Rocket } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAdmin?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, onOpenAdmin }) => {
  const { isAdmin } = useAuth();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'crash', label: 'Crash 🚀', icon: Rocket },
    { id: 'deposit', label: 'Deposit', icon: ArrowDownCircle },
    { id: 'withdraw', label: 'Withdraw', icon: ArrowUpRight },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 pb-safe">
      <div className="max-w-md mx-auto px-3 h-16 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center w-14 py-1 transition-all ${
                isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive ? 'bg-emerald-500/15 text-emerald-400 scale-110' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}

        {isAdmin && (
          <button
            onClick={onOpenAdmin}
            className="flex flex-col items-center justify-center w-14 py-1 text-amber-400 hover:text-amber-300 sm:hidden"
            title="Admin Dashboard"
          >
            <div className="p-1 rounded-xl bg-amber-500/10">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold mt-0.5">Admin</span>
          </button>
        )}
      </div>
    </nav>
  );
};
