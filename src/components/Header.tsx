/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, Activity, FileSpreadsheet, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { getLogs, getClientes, getEspacos, getReservas } from '../services/db';
import { ActivityLog, Cliente, Espaco, Reserva } from '../types';

interface HeaderProps {
  onSearchSelect: (viewId: string, itemId: string) => void;
  onRefreshData: () => void;
}

export default function Header({ onSearchSelect, onRefreshData }: HeaderProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [showLogsDrawer, setShowLogsDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ type: string; id: string; title: string; subtitle: string }[]>([]);
  const [brandLogo, setBrandLogo] = useState(() => localStorage.getItem('cfg_brand_logo') || '');

  // Clients, spaces & bookings for fast search
  const [clients, setClients] = useState<Cliente[]>([]);
  const [spaces, setSpaces] = useState<Espaco[]>([]);
  const [bookings, setBookings] = useState<Reserva[]>([]);

  useEffect(() => {
    loadSearchData();
    loadLogs();

    const handleUpdate = () => {
      setBrandLogo(localStorage.getItem('cfg_brand_logo') || '');
    };
    window.addEventListener('brand-colors-updated', handleUpdate);
    return () => {
      window.removeEventListener('brand-colors-updated', handleUpdate);
    };
  }, []);

  const loadSearchData = async () => {
    try {
      const cli = await getClientes();
      const sp = await getEspacos();
      const bk = await getReservas();
      setClients(cli);
      setSpaces(sp);
      setBookings(bk);
    } catch (e) {
      console.warn("Failed to gather index resources:", e);
    }
  };

  const loadLogs = async () => {
    try {
      const dbLogs = await getLogs();
      setLogs(dbLogs);
    } catch (e) {
      console.warn("Failed loading activity logs:", e);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }

    const lower = val.toLowerCase();
    const matches: { type: string; id: string; title: string; subtitle: string }[] = [];

    // Filter spaces
    spaces.forEach(sp => {
      if (sp.nome.toLowerCase().includes(lower) || sp.descricao.toLowerCase().includes(lower)) {
        matches.push({ type: 'spaces', id: sp.id, title: sp.nome, subtitle: `Espaço • Capacidade: ${sp.capacidade} pessoas` });
      }
    });

    // Filter clients
    clients.forEach(cli => {
      if (cli.nome.toLowerCase().includes(lower) || cli.cpf.includes(lower) || cli.email.toLowerCase().includes(lower)) {
        matches.push({ type: 'clients', id: cli.id, title: cli.nome, subtitle: `Cliente • CPF: ${cli.cpf} • ${cli.email}` });
      }
    });

    // Filter bookings
    bookings.forEach(bk => {
      const cliName = clients.find(c => c.id === bk.clienteId)?.nome || "Cliente";
      const spName = spaces.find(s => s.id === bk.espacoId)?.nome || "Espaço";
      if (bk.tipoEvento.toLowerCase().includes(lower) || cliName.toLowerCase().includes(lower) || spName.toLowerCase().includes(lower)) {
        matches.push({ type: 'bookings', id: bk.id, title: `${bk.tipoEvento} - ${cliName}`, subtitle: `Reserva • ${bk.dataEvento} em ${spName} (${bk.status})` });
      }
    });

    setSearchResults(matches.slice(0, 8)); // Max 8 results
  };

  const handleResultClick = (item: { type: string; id: string }) => {
    onSearchSelect(item.type, item.id);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <header className="h-16 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between relative z-30">
      
      {/* Quick Search */}
      <div className="relative w-96">
        <label htmlFor="quick-search-input" className="sr-only">Pesquisa rápida</label>
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          id="quick-search-input"
          type="text"
          placeholder="Pesquisa rápida (espaços, clientes, reservas...)"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-gray-400 dark:placeholder-zinc-500"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={loadSearchData}
        />

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute left-0 mt-2 w-full max-h-80 overflow-y-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-750 rounded-xl shadow-xl z-50 p-2 divide-y divide-gray-100 dark:divide-slate-800">
            {searchResults.map((item) => (
              <button
                key={item.id}
                onClick={() => handleResultClick(item)}
                className="w-full text-left p-2.5 rounded-lg hover:bg-indigo-500 hover:text-white dark:hover:bg-slate-800 text-gray-800 dark:text-zinc-200 transition-all flex flex-col cursor-pointer mt-1"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 hover:text-inherit select-none mb-0.5">
                  {item.type === 'spaces' ? 'Espaço' : item.type === 'clients' ? 'Cliente' : 'Reserva'}
                </div>
                <div className="text-sm font-semibold leading-snug truncate">{item.title}</div>
                <div className="text-[11px] opacity-75 truncate">{item.subtitle}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Tools: Logs, Backups, Cloud Mode Indicator */}
      <div className="flex items-center gap-4">
        {brandLogo && (
          <img 
            src={brandLogo} 
            alt="Logo do Espaço" 
            className="h-8 max-w-[120px] object-contain rounded-lg border border-slate-100 dark:border-slate-800 p-0.5 bg-white dark:bg-slate-900 shadow-sm"
            referrerPolicy="no-referrer"
          />
        )}

        {/* Link to Public Booking Calendar Portal */}
        <button
          onClick={() => {
            window.location.hash = '#reserva';
          }}
          className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs flex items-center gap-1.5 transition-all border border-indigo-200/40 dark:border-indigo-900/20 cursor-pointer shadow-sm"
          title="Abrir o Canal de Reservas de Autoatendimento do Cliente"
        >
          <ExternalLink className="w-3.5 h-3.5 text-indigo-505" />
          <span>Canal de Clientes</span>
        </button>
        {/* Trace Activity Logs Drawer Toggle */}
        <button
          id="btn-toggle-logs-drawer"
          onClick={() => {
            loadLogs();
            setShowLogsDrawer(!showLogsDrawer);
          }}
          className={`p-2.5 rounded-xl border transition-all relative cursor-pointer ${
            showLogsDrawer 
              ? 'bg-indigo-600 border-indigo-650 text-white shadow-md' 
              : 'bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-750 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-zinc-300'
          }`}
          title="Trilha de Auditoria (Logs)"
        >
          <Activity className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
        </button>
      </div>

      {/* Logs Sliding Drawer Panel Overlay */}
      {showLogsDrawer && (
        <>
          <div className="fixed inset-0 bg-black/40 z-45" onClick={() => setShowLogsDrawer(false)}></div>
          <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-slate-900 border-l border-gray-100 dark:border-slate-800 shadow-2xl z-50 flex flex-col animate-slide-in p-6">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
                <Activity className="w-5 h-5 animate-pulse" />
                <h3 className="text-md font-bold text-gray-900 dark:text-white leading-none">Logs de Atividades</h3>
              </div>
              <button 
                onClick={() => setShowLogsDrawer(false)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-bold p-1 hover:bg-gray-100 dark:hover:bg-slate-800 roundedLg"
              >
                Ø Fechar
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4 leading-relaxed font-sans">
              Trilha de Auditoria Geral das ações de segurança e gerenciais do sistema ERP de Clécio Santos.
            </p>

            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Nenhum evento registrado ainda.
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={`${log.id || 'log'}_${idx}`} className="p-3 bg-gray-50 dark:bg-slate-850 rounded-lg border border-gray-100 dark:border-slate-800 scrollbar-thin">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 truncate">{log.acao}</span>
                      <span className="text-[9px] text-gray-400 font-mono flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 dark:text-zinc-400 mt-1 leading-snug">{log.detalhes}</p>
                    <div className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1.5 font-mono flex items-center gap-1 select-none">
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>{log.usuario}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
