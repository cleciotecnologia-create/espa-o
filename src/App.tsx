/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import SpacesView from './components/SpacesView';
import AgendaView from './components/AgendaView';
import ClientsView from './components/ClientsView';
import BookingsView from './components/BookingsView';
import FinancialView from './components/FinancialView';
import PixView from './components/PixView';
import ContractsView from './components/ContractsView';
import ReportsView from './components/ReportsView';
import LoginView from './components/LoginView';
import NotificationsView from './components/NotificationsView';
import FunnelView from './components/FunnelView';
import SettingsView from './components/SettingsView';
import PublicBookingView from './components/PublicBookingView';
import { getCurrentUser, logout } from './services/firebase';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Navigation
  const [currentView, setCurrentView] = useState('dashboard');
  const [focusedBookingId, setFocusedBookingId] = useState<string | null>(null);

  // Theme support
  const [darkMode, setDarkMode] = useState(false);

  // Public Booking Routing Mode
  const [isPublicBooking, setIsPublicBooking] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      setIsPublicBooking(window.location.hash === '#reserva' || window.location.search.includes('reserva=true'));
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Check ongoing sessions
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const u = await getCurrentUser();
      if (u) {
        setUser(u);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingAuth(false);
    }
  };

  // Sync theme mode with DOM tailwind selector
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Sync theme colors with localStorage
  useEffect(() => {
    const applyBrandColors = () => {
      const primary = localStorage.getItem('cfg_brand_primary') || '#4f46e5';
      const secondary = localStorage.getItem('cfg_brand_secondary') || '#f59e0b';
      document.documentElement.style.setProperty('--brand-primary', primary);
      document.documentElement.style.setProperty('--brand-secondary', secondary);
    };

    applyBrandColors();

    const handleStyleUpdate = () => {
      applyBrandColors();
    };

    window.addEventListener('brand-colors-updated', handleStyleUpdate);
    window.addEventListener('storage', handleStyleUpdate);

    return () => {
      window.removeEventListener('brand-colors-updated', handleStyleUpdate);
      window.removeEventListener('storage', handleStyleUpdate);
    };
  }, []);

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setCurrentView('dashboard');
    } catch (e) {
      console.error(e);
    }
  };

  const handleNavigateWithContext = (view: string, itemId?: string) => {
    if (itemId) {
      setFocusedBookingId(itemId);
    } else {
      setFocusedBookingId(null);
    }
    setCurrentView(view);
  };

  // Safe wrapper for searching and highlighting across entities
  const handleQuickSearchHighlight = (entityType: 'spaces' | 'bookings' | 'clients', id: string) => {
    handleNavigateWithContext(entityType, id);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Verificando autenticação no ERP...</p>
        </div>
      </div>
    );
  }

  // Enforce credentials checks
  if (isPublicBooking) {
    return <PublicBookingView />;
  }

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // View dispatcher
  const renderViewContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigateToView={handleNavigateWithContext} />;
      case 'spaces':
        return <SpacesView />;
      case 'agenda':
        return <AgendaView />;
      case 'clients':
        return <ClientsView />;
      case 'bookings':
        return (
          <BookingsView 
            onNavigateToView={handleNavigateWithContext} 
            focusedBookingId={focusedBookingId} 
          />
        );
      case 'financials':
        return <FinancialView />;
      case 'pix':
        return <PixView preselectedBookingId={focusedBookingId} />;
      case 'contracts':
        return <ContractsView preselectedBookingId={focusedBookingId} />;
      case 'reports':
        return <ReportsView />;
      case 'notifications':
        return <NotificationsView />;
      case 'funnel':
        return <FunnelView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onNavigateToView={handleNavigateWithContext} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans text-gray-900 transition-colors duration-200">
      
      {/* Sidebar navigation */}
      <Sidebar 
        activeView={currentView} 
        setActiveView={(view) => handleNavigateWithContext(view)} 
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        currentUser={user}
        onLogout={handleLogout}
      />

      {/* Main viewport area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Dynamic global header */}
        <Header 
          onSearchSelect={(viewId, itemId) => handleQuickSearchHighlight(viewId as any, itemId)} 
          onRefreshData={() => {}} 
        />

        {/* Dynamic panel content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {renderViewContent()}
          </div>
        </main>
      </div>

    </div>
  );
}
