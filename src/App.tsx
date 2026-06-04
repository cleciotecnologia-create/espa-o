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
import UsersView from './components/UsersView';
import { getCurrentUser, logout } from './services/firebase';
import EditProfileModal from './components/EditProfileModal';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  
  // Navigation
  const [currentView, setCurrentView] = useState('dashboard');
  const [focusedBookingId, setFocusedBookingId] = useState<string | null>(null);

  // Theme support
  const [darkMode, setDarkMode] = useState(false);

  // Public Booking Routing Mode
  const [isPublicBooking, setIsPublicBooking] = useState(false);

  // Sidebar state for mobile/tablets
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const search = window.location.search;
      setIsPublicBooking(
        hash.startsWith('#reserva') || 
        search.includes('reserva=true') || 
        search.includes('booking=')
      );
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  // Check ongoing sessions
  useEffect(() => {
    checkSession();
    
    // Auto-seed Espaço Tropical logo and color identity if not set
    const hasSeeded = localStorage.getItem('cfg_logo_has_seeded');
    const curLogo = localStorage.getItem('cfg_brand_logo');
    const isBroken = curLogo && (curLogo.includes('PC9vPg==') || curLogo.includes('</o>'));

    if (!hasSeeded || isBroken) {
      const defaultSvgLogo = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyODAgNjQiIHdpZHRoPSIyODAiIGhlaWdodD0iNjQiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJ0cm9wR3JhZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMxMGI5ODEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzA0Nzg1NyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxnIGZpbGw9Im5vbmUiIHN0cm9rZT0ibm9uZSI+CiAgICA8Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIyOCIgZmlsbD0idXJsKCN0cm9wR3JhZCkiIG9wYWNpdHk9IjAuMTUiLz4KICAgIDxjaXJjbGUgY3g9IjMyIiBjeT0iMzIiIHI9IjIyIiBmaWxsPSJ1cmwoI3Ryb3BHcmFkKSIvPgogICAgPHBhdGggZD0iTTMyLDQ0IEwzMiwyOCBNMzIsMjkgQzI4LDIxIDE4LDI4IDE4LDI4IEMyNCwyOCAzMCwzMSAzMCwzMSBNMzIsMjkgQzM2LDIxIDQ2LDI4IDQ2LDI4IEM0MCwyOCAzNCwzMSAzNCwzMSBNMzIsMjggQzI2LDIyIDIxLDE3IDIxLDE3IEMyNiwyMCAzMCwyNiAzMCwyNiBNMzIsMjggQzM4LDIyIDQzLDE3IDQzLDE3IEMzOCwyMCAzNCwyNiAzNCwyNiBNMzIsMjYgQzMyLDE1IDMyLDE1IDMyLDE1IEMzMiwyMCAzMiwyNiAzMiwyNiIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogICAgPHRleHQgeD0iNjgiIHk9IjI5IiBmb250LWZhbWlseT0iJ0ludGVyJywgc2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9IjkwMCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzA0Nzg1NyIgbGV0dGVyLXNwYWNpbmc9Ii0wLjUiPkVTUEHDTyBUUk9QSUNBTDwvdGV4dD4KICAgIDx0ZXh0IHg9IjY5IiB5PSI0NCIgZm9udC1mYW1pbHk9IidJbnRlcicsIHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI3MDAiIGZvbnQtc2l6ZT0iOSIgZmlsbD0iIzEwYjk4MSIgbGV0dGVyLXNwYWNpbmc9IjMuMiI+TEFaRVIgJmFtcDsgRVZFTlRPUzwvdGV4dD4KICA8L2c+Cjwvc3ZnPg==';
      localStorage.setItem('cfg_brand_logo', defaultSvgLogo);
      localStorage.setItem('cfg_brand_primary', '#059669'); // emerald-600
      localStorage.setItem('cfg_brand_secondary', '#10b981'); // emerald-500
      localStorage.setItem('cfg_pix_name', 'Espaço Tropical Ltda');
      localStorage.setItem('cfg_logo_has_seeded', 'true');
      window.dispatchEvent(new Event('brand-colors-updated'));
    }
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
      checkSession();
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
        return <AgendaView onNavigateToView={handleNavigateWithContext} />;
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
      case 'users':
        if (user?.role === 'superadmin' || user?.role === 'administrador') {
          return <UsersView />;
        }
        return <DashboardView onNavigateToView={handleNavigateWithContext} />;
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
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onEditProfile={() => setIsProfileEditOpen(true)}
      />

      {isProfileEditOpen && (
        <EditProfileModal 
          currentUser={user}
          onClose={() => setIsProfileEditOpen(false)}
          onProfileUpdated={(updatedUser) => setUser(updatedUser)}
        />
      )}

      {/* Main viewport area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Dynamic global header */}
        <Header 
          onSearchSelect={(viewId, itemId) => handleQuickSearchHighlight(viewId as any, itemId)} 
          onRefreshData={() => {}} 
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Dynamic panel content */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
            {renderViewContent()}
          </div>
        </main>
      </div>

    </div>
  );
}
