import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeDashboard } from './components/HomeDashboard';
import { DepositScreen } from './components/DepositScreen';
import { WithdrawalScreen } from './components/WithdrawalScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { AuthModal } from './components/AuthModal';
import { AdminPanel } from './components/AdminPanel';
import { CrashMultiplierGame } from './components/CrashGame/CrashMultiplierGame';

function MainApp() {
  const { currentUser, isAdmin } = useAuth();

  const [currentTab, setCurrentTab] = useState<'home' | 'crash' | 'deposit' | 'withdraw' | 'history' | 'profile'>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthInitialMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Header */}
      <Header
        onOpenAuth={() => handleOpenAuth('login')}
        onOpenAdmin={() => setAdminPanelOpen(true)}
        onNavigateTab={(tab) => setCurrentTab(tab as any)}
        currentTab={currentTab}
      />

      {/* Main Content */}
      <main className="flex-1">
        {currentTab === 'home' && (
          <HomeDashboard
            onNavigateTab={(tab) => setCurrentTab(tab as any)}
            onOpenAuth={() => handleOpenAuth('login')}
            onOpenAdmin={() => setAdminPanelOpen(true)}
          />
        )}

        {currentTab === 'crash' && (
          <CrashMultiplierGame
            onNavigateDeposit={() => setCurrentTab('deposit')}
            onOpenAuth={() => handleOpenAuth('login')}
          />
        )}

        {currentTab === 'deposit' && (
          <DepositScreen
            onSuccessNavigateHistory={() => setCurrentTab('history')}
            onOpenAuth={() => handleOpenAuth('login')}
          />
        )}

        {currentTab === 'withdraw' && (
          <WithdrawalScreen
            onSuccessNavigateHistory={() => setCurrentTab('history')}
            onOpenAuth={() => handleOpenAuth('login')}
          />
        )}

        {currentTab === 'history' && (
          <HistoryScreen
            onNavigateDeposit={() => setCurrentTab('deposit')}
            onNavigateWithdraw={() => setCurrentTab('withdraw')}
            onOpenAuth={() => handleOpenAuth('login')}
          />
        )}

        {currentTab === 'profile' && (
          <ProfileScreen
            onOpenAuth={() => handleOpenAuth('login')}
            onOpenAdmin={() => setAdminPanelOpen(true)}
            onNavigateTab={(tab) => setCurrentTab(tab as any)}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab as any)}
        onOpenAdmin={() => setAdminPanelOpen(true)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authInitialMode}
      />

      {/* Admin Panel */}
      {adminPanelOpen && (
        <AdminPanel onClose={() => setAdminPanelOpen(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
