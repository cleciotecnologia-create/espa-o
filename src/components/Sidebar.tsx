/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Home, 
  Calendar, 
  Users, 
  FileSpreadsheet, 
  Coins, 
  QrCode, 
  FileText, 
  BarChart3,
  Moon,
  Sun,
  LogOut,
  Activity,
  Bell,
  Workflow,
  Settings,
  Shield,
  X
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  darkMode: boolean;
  setDarkMode: (mode: boolean) => void;
  onLogout: () => void;
  currentUser: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ 
  activeView, 
  setActiveView, 
  darkMode, 
  setDarkMode, 
  onLogout,
  currentUser,
  isOpen,
  onClose
}: SidebarProps) {
  const [brandLogo, setBrandLogo] = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('cfg_brand_logo') || '') : '');

  useEffect(() => {
    const handleUpdate = () => {
      setBrandLogo(localStorage.getItem('cfg_brand_logo') || '');
    };
    window.addEventListener('brand-colors-updated', handleUpdate);
    return () => {
      window.removeEventListener('brand-colors-updated', handleUpdate);
    };
  }, []);
  
  const menuItems = [
    { id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard },
    { id: 'spaces', label: 'Gestão de Espaços', icon: Home },
    { id: 'agenda', label: 'Agenda de Eventos', icon: Calendar },
    { id: 'clients', label: 'Cadastro de Clientes', icon: Users },
    { id: 'bookings', label: 'Gestão de Reservas', icon: FileSpreadsheet },
    { id: 'financials', label: 'Financeiro', icon: Coins },
    { id: 'pix', label: 'Cobrança PIX', icon: QrCode },
    { id: 'contracts', label: 'Contratos Inteligentes', icon: FileText },
    { id: 'reports', label: 'Relatórios & Business', icon: BarChart3 },
    { id: 'notifications', label: 'Notificações & APIs', icon: Bell },
    { id: 'funnel', label: 'Esteira Automatizada', icon: Workflow },
    ...(currentUser?.role === 'superadmin' || currentUser?.role === 'administrador'
      ? [{ id: 'users', label: 'Gestão de Usuários', icon: Shield }]
      : []),
    { id: 'settings', label: 'Configurações', icon: Settings }
  ];

  return (
    <>
      {/* Background Overlay for mobile */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-[55] bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
        />
      )}
      
      <aside 
        id="sidebar-container" 
        className={`fixed inset-y-0 left-0 z-[60] w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-900 flex flex-col justify-between text-slate-900 dark:text-slate-105 flex-shrink-0 transition-transform duration-300 lg:translate-x-0 lg:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Profile Header */}
        <div>
          <div className="p-6 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between font-sans">
            <div className="flex items-center gap-3">
              {brandLogo ? (
                <img src={brandLogo} alt="Logo" className="h-8 object-contain rounded-lg flex-shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-extrabold text-white text-md shadow-sm select-none flex-shrink-0">
                  T
                </div>
              )}
              <div>
                <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">Espaço Tropical</h1>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold tracking-widest uppercase">SISTEMA ERP</span>
              </div>
            </div>

            {/* Mobile/Tablet Close Button */}
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-pointer"
              title="Fechar Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Menu Items */}
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  id={`sidebar-link-${item.id}`}
                  onClick={() => {
                    setActiveView(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 border-l-2 ${
                    isActive 
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-bold border-indigo-600' 
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-white font-semibold border-transparent'
                  }`}
                >
                  <IconComponent className={`w-4 h-4 transition-transform ${isActive ? 'scale-110' : ''}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Session & System Controls */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-900 space-y-3 bg-slate-50/50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-extrabold text-sm text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-800">
              {currentUser?.email ? currentUser.email[0].toUpperCase() : 'C'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">{currentUser?.displayName || 'Clécio Santos'}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{currentUser?.email || 'admin@eventspace.com'}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-1 pt-1">
            <button
              id="toggle-dark-mode"
              onClick={() => setDarkMode(!darkMode)}
              className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-all text-xs font-bold border border-slate-200 dark:border-slate-800 cursor-pointer"
              title="Alterar tema visual"
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Refletir Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-650" />
                  <span>Refletir Escuro</span>
                </>
              )}
            </button>

            <button
              id="btn-logout"
              onClick={onLogout}
              className="px-3 py-1.5 rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-red-950/20 dark:hover:bg-red-950/50 text-rose-700 dark:text-red-400 hover:text-rose-800 transition-all text-xs font-bold border border-rose-200 dark:border-red-900/35 flex items-center justify-center cursor-pointer"
              title="Sair do ERP"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
