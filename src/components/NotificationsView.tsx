/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Send, 
  Settings, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Smartphone, 
  Mail, 
  RefreshCw, 
  Search, 
  User, 
  Sparkles, 
  FileText,
  Clock,
  ExternalLink,
  Sliders,
  Play
} from 'lucide-react';
import { 
  getNotifConfigs, 
  saveNotifConfigs, 
  getNotificacoes, 
  dispatchNotification,
  getLessorConfigs,
  saveLessorConfigs
} from '../services/notifications';
import { getClientes, getReservas, getEspacos } from '../services/db';
import { Notificacao, NotifConfigs, Cliente, Reserva, Espaco, LessorConfigs } from '../types';

export default function NotificationsView() {
  const [activeTab, setActiveTab] = useState<'audit' | 'settings' | 'lessor' | 'dispatch'>('audit');
  
  // Lessor state
  const [lessorConfigs, setLessorConfigs] = useState<LessorConfigs>(getLessorConfigs());
  const [saveLessorSuccess, setSaveLessorSuccess] = useState(false);
  
  // Data lists
  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [bookings, setBookings] = useState<Reserva[]>([]);
  const [spaces, setSpaces] = useState<Espaco[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Email' | 'SMS'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Enviado' | 'Simulado' | 'Falha'>('All');

  // Modal / Detail drawer
  const [selectedNotif, setSelectedNotif] = useState<Notificacao | null>(null);

  // Settings state
  const [configs, setConfigs] = useState<NotifConfigs>(getNotifConfigs());
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Manual trigger state
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedBooking, setSelectedBooking] = useState<string>('');
  const [manualType, setManualType] = useState<'Email' | 'SMS'>('Email');
  const [manualTrigger, setManualTrigger] = useState<Notificacao['gatilho']>('Confirmação');
  const [manualSubject, setManualSubject] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [customRecipient, setCustomRecipient] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{ success: boolean; msg: string } | null>(null);

  useEffect(() => {
    loadData();
    window.addEventListener('es-database-updated', loadData);
    return () => {
      window.removeEventListener('es-database-updated', loadData);
    };
  }, []);

  // Update templates when manual targets change
  useEffect(() => {
    if (selectedClient) {
      const cli = clients.find(c => c.id === selectedClient);
      const res = bookings.find(b => b.id === selectedBooking);
      const esp = res ? spaces.find(s => s.id === res.espacoId) : null;
      
      if (cli) {
        setCustomRecipient(manualType === 'Email' ? cli.email : (cli.whatsapp || cli.telefone || ''));
        generateTemplatePreview(cli, res, esp);
      }
    }
  }, [selectedClient, selectedBooking, manualType, manualTrigger, clients, bookings, spaces]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [nList, cList, bList, sList] = await Promise.all([
        getNotificacoes(),
        getClientes(),
        getReservas(),
        getEspacos()
      ]);
      setNotifs(nList);
      setClients(cList);
      setBookings(bList);
      setSpaces(sList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfigs = (e: React.FormEvent) => {
    e.preventDefault();
    saveNotifConfigs(configs);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSaveLessor = (e: React.FormEvent) => {
    e.preventDefault();
    saveLessorConfigs(lessorConfigs);
    setSaveLessorSuccess(true);
    setTimeout(() => setSaveLessorSuccess(false), 3000);
  };

  const generateTemplatePreview = (cli: Cliente, res?: Reserva, esp?: Espaco | null) => {
    const defaultDate = res ? new Date(res.dataEvento).toLocaleDateString('pt-BR') : '';
    const formattedTotal = res ? res.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
    
    if (manualTrigger === 'Confirmação') {
      if (manualType === 'Email') {
        setManualSubject(`✨ EventSpace: Confirmação de Reserva para ${cli.nome}`);
        setManualMessage(
          `Olá, ${cli.nome}!\n\nSua reserva de espaço na EventSpace ERP está confirmada com absoluto sucesso.\n\n` +
          `• Evento: ${res?.tipoEvento || 'Locação Especial'}\n` +
          `• Data: ${defaultDate || 'A definir'}\n` +
          `• Espaço: ${esp?.nome || 'Salão Especial'}\n` +
          `• Horário: ${res?.horario || '14:00 - 22:00'}\n\n` +
          `O contrato de prestação de serviços já foi confeccionado pelos nossos gestores de pauta. Agradecemos pelo sinal!\n\n` +
          `Atenciosamente,\nEventSpace ERP Management`
        );
      } else {
        setManualSubject('');
        setManualMessage(`Ola ${cli.nome}, seu evento dia ${defaultDate || 'A definir'} no ${esp?.nome || 'EventSpace'} esta CONFIRMADO. Equipe operacional acionada!`);
      }
    } else if (manualTrigger === 'Lembrete') {
      if (manualType === 'Email') {
        setManualSubject(`⏰ Lembrete de Evento: Sua data está próxima! - ${cli.nome}`);
        setManualMessage(
          `Olá, ${cli.nome}!\n\nEstamos passando para lembrar que o seu grande evento está chegando na EventSpace ERP!\n\n` +
          `• Espaço: ${esp?.nome || 'Nossos Jardins'}\n` +
          `• Data: ${defaultDate || 'Esta semana'}\n\n` +
          `Por favor, lembre-se de conferir se todos os seus fornecedores (buffet, decoração e banda) enviaram a documentação RG e CPF na portaria central.\n\n` +
          `Qualquer dúvida de infraestrutura, fale diretamente comigo por este canal.\n\n` +
          `Abraços,\nClécio Santos — Gestor ERP`
        );
      } else {
        setManualSubject('');
        setManualMessage(`Lembrete EventSpace: Ola ${cli.nome}! Seu grande evento no ${esp?.nome || 'nosso espaco'} esta proximo (${defaultDate || 'em breve'}). Nos vemos la!`);
      }
    } else if (manualTrigger === 'Pagamento') {
      if (manualType === 'Email') {
        setManualSubject(`💳 EventSpace ERP: Recebemos seu Pagamento`);
        setManualMessage(
          `Olá, ${cli.nome}!\n\nConfirmamos com sucesso a liquidação e o faturamento do seu lançamento financeiro de locação.\n\n` +
          `• Valor Quitado: ${formattedTotal || 'R$ --'}\n` +
          `• Destino de Pauta: Evento em ${defaultDate || 'data agendada'}\n` +
          `• Status: Compensado / Arquivado no Caixa Geral\n\n` +
          `O comprovante oficial já está indexado e associado à sua reserva no nosso banco digital.\n\n` +
          `Obrigado,\nFinanceiro EventSpace`
        );
      } else {
        setManualSubject('');
        setManualMessage(`Financeiro EventSpace: Confirmamos o recebimento de pagamento para o dia ${defaultDate || 'agendado'}. Seu saldo atualizado esta disponível no ERP.`);
      }
    } else if (manualTrigger === 'Contrato') {
      if (manualType === 'Email') {
        setManualSubject(`📝 Contrato de Locação Compilado - EventSpace ERP`);
        setManualMessage(
          `Olá, ${cli.nome}!\n\nSeu Contrato de Locação Digital Inteligente foi gerado com sucesso pelo EventSpace ERP.\n\n` +
          `Por favor, revise atentamente a minuta do documento e os termos de cancelamento, regras para decibéis de som e multas.\n\n` +
          `O seu link seguro para assinatura eletrônica integrada Gov.br está ativo e aguarda processamento preliminar.\n\n` +
          `Atenciosamente,\nDepto Jurídico EventSpace ERP`
        );
      } else {
        setManualSubject('');
        setManualMessage(`EventSpace Contrato: Ola ${cli.nome}! O termo juridico digital do seu evento dia ${defaultDate} foi gerado e enviado ao seu e-mail.`);
      }
    } else { // Admin_Alerta
      setManualSubject(`⚠️ [ALERTA] Notificação Manual EventSpace ERP`);
      setManualMessage(`Aviso aos Administradores:\n\nUm teste manual de notificação foi acionado para o cliente ${cli.nome} referente à locação do espaço ${esp?.nome || 'Geral'}.`);
    }
  };

  const handleManualDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRecipient) {
      setDispatchResult({ success: false, msg: 'Informe o e-mail ou telefone do destinatário.' });
      return;
    }
    
    setDispatching(true);
    setDispatchResult(null);

    try {
      const res = await dispatchNotification(
        manualType,
        customRecipient,
        manualTrigger,
        manualType === 'Email' ? manualSubject : undefined,
        manualMessage,
        selectedBooking || undefined,
        selectedClient || undefined
      );

      setDispatchResult({ 
        success: res.status !== 'Falha', 
        msg: res.status === 'Falha' 
          ? `Falha no envio da mensagem. Verifique suas credenciais de API` 
          : `Mensagem enviada com sucesso! (${res.status === 'Simulado' ? 'Simulação Sandbox Ativa' : 'Disparo em Produção Real!'})`
      });
      
      // Refresh list
      loadData();
    } catch (err: any) {
      setDispatchResult({ success: false, msg: err.message || 'Erro inesperado no despacho.' });
    } finally {
      setDispatching(false);
    }
  };

  const filteredNotifs = notifs.filter(n => {
    const matchesSearch = 
      n.destinatario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.mensagem.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.assunto && n.assunto.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = typeFilter === 'All' || n.tipo === typeFilter;
    const matchesStatus = statusFilter === 'All' || n.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div id="notifications-view-container" className="space-y-6">
      
      {/* Top Banner and Brand Profile Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight flex items-center gap-2">
            <Bell className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            Central de Notificações
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Gestão integrada de comunicações em massa e automáticas (E-mail SendGrid e SMS / WhatsApp Twilio)
          </p>
        </div>
        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button 
            onClick={loadData}
            title="Sincronizar dados"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              id="tab-audit"
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                activeTab === 'audit' 
                  ? 'bg-amber-500 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Log de Disparos
            </button>
            <button
              id="tab-dispatch"
              onClick={() => setActiveTab('dispatch')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                activeTab === 'dispatch' 
                  ? 'bg-amber-500 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Envio Manual
            </button>
            <button
              id="tab-settings"
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                activeTab === 'settings' 
                  ? 'bg-amber-500 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Configurar APIs
            </button>
            <button
              id="tab-lessor"
              onClick={() => setActiveTab('lessor')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                activeTab === 'lessor' 
                  ? 'bg-amber-500 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Dados do Locador
            </button>
          </div>
        </div>
      </div>

      {/* Global Mode Alert Box */}
      {configs.simulationMode && (
        <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-4 rounded-xl text-amber-850 dark:text-amber-300">
          <Info className="w-5 h-5 flex-shrink-0 text-amber-600" />
          <div className="text-xs">
            <p className="font-bold uppercase tracking-wider mb-0.5">Mock Sandbox Ativo (Modo de Simulação)</p>
            <p className="opacity-90">
              O sistema está simulando o disparo de mensagens para evitar custos. Todas as notificações disparadas por ações do EventSpace ERP (confirmar reservas, cobranças Pix, gerar contratos e avisar admins) serão registradas instantaneamente no log abaixo para fins de auditoria impecável.
            </p>
          </div>
        </div>
      )}

      {/* TAB 1: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Filtrar por destinatário, mensagem ou assunto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold cursor-pointer outline-none"
              >
                <option value="All">Todos os Canais</option>
                <option value="Email">📧 E-mails</option>
                <option value="SMS">📱 SMS / Zap</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold cursor-pointer outline-none"
              >
                <option value="All">Todos os Status</option>
                <option value="Enviado">Enviados (Real)</option>
                <option value="Simulado">Simulados</option>
                <option value="Falha">Falhas de Envio</option>
              </select>
            </div>
          </div>

          {/* Audit Master Logs Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-905 dark:text-white text-md">Registro Geral de Comunicações</h3>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono px-2 py-0.5 rounded-md font-bold">
                {filteredNotifs.length} registros
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs text-slate-500">Buscando histórico na nuvem...</p>
              </div>
            ) : filteredNotifs.length === 0 ? (
              <div className="p-16 text-center text-slate-400 space-y-2">
                <Bell className="w-10 h-10 mx-auto opacity-30 text-slate-500" />
                <p className="text-sm font-bold">Nenhuma notificação catalogada</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">Tente alterar os filtros acima ou dispare um lembrete do cliente pelas telas de reservas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-550 dark:text-slate-400">
                      <th className="px-5 py-3">Canal</th>
                      <th className="px-5 py-3">Destinatário</th>
                      <th className="px-5 py-3">Gatilho</th>
                      <th className="px-5 py-3">Assunto / Mensagem</th>
                      <th className="px-5 py-3">Enviado em</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-center">Visualizar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {filteredNotifs.map((notif) => {
                      const dateStr = new Date(notif.dataEnvio).toLocaleString('pt-BR');
                      return (
                        <tr 
                          key={notif.id} 
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <span className="flex items-center gap-1.5 font-bold">
                              {notif.tipo === 'Email' ? (
                                <>
                                  <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  <span className="text-xs text-emerald-700 dark:text-emerald-400">E-mail</span>
                                </>
                              ) : (
                                <>
                                  <Smartphone className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                                  <span className="text-xs text-sky-700 dark:text-sky-400">SMS</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-900 dark:text-slate-300 font-bold">
                            {notif.destinatario}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                              {notif.gatilho}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 max-w-xs md:max-w-md">
                            <div className="truncate font-sans font-semibold text-xs text-slate-900 dark:text-slate-200">
                              {notif.assunto || notif.mensagem}
                            </div>
                            <div className="truncate text-[10px] text-slate-400 mt-0.5">
                              {notif.mensagem}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                            {dateStr}
                          </td>
                          <td className="px-5 py-3.5">
                            {notif.status === 'Enviado' && (
                              <span className="px-2 py-1 text-[9px] font-extrabold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 uppercase tracking-widest">
                                REAL DISPATCH
                              </span>
                            )}
                            {notif.status === 'Simulado' && (
                              <span className="px-2 py-1 text-[9px] font-extrabold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 uppercase tracking-widest">
                                SANDBOX MOCK
                              </span>
                            )}
                            {notif.status === 'Falha' && (
                              <span className="px-2 py-1 text-[9px] font-extrabold rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 uppercase tracking-widest">
                                FAILED
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <button
                              id={`btn-view-notif-${notif.id}`}
                              onClick={() => setSelectedNotif(notif)}
                              className="p-1 px-3 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-650 rounded-lg dark:bg-slate-800 dark:text-slate-300 font-bold cursor-pointer"
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MANUAL DISPATCH SANDBOX */}
      {activeTab === 'dispatch' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Dispatch Setup Column */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-md flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Preparar Mensagem
            </h3>

            <form onSubmit={handleManualDispatch} className="space-y-4">
              {/* Type toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Canal do Disparo</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setManualType('Email');
                      if (selectedClient) {
                        const cli = clients.find(c => c.id === selectedClient);
                        if (cli) setCustomRecipient(cli.email);
                      }
                    }}
                    className={`py-2 text-xs font-bold rounded-md transition-all ${
                      manualType === 'Email' 
                        ? 'bg-indigo-650 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-905 dark:hover:text-white'
                    }`}
                  >
                    E-mail
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualType('SMS');
                      if (selectedClient) {
                        const cli = clients.find(c => c.id === selectedClient);
                        if (cli) setCustomRecipient(cli.whatsapp || cli.telefone || '');
                      }
                    }}
                    className={`py-2 text-xs font-bold rounded-md transition-all ${
                      manualType === 'SMS' 
                        ? 'bg-indigo-650 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-905 dark:hover:text-white'
                    }`}
                  >
                    SMS / Whatsapp WhatsApp
                  </button>
                </div>
              </div>

              {/* Client Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Destinatário Cliente</label>
                <select
                  required
                  value={selectedClient}
                  onChange={(e) => {
                    setSelectedClient(e.target.value);
                    // Match a booking automatically if possible
                    const hasB = bookings.find(b => b.clienteId === e.target.value);
                    if (hasB) {
                      setSelectedBooking(hasB.id);
                    } else {
                      setSelectedBooking('');
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white outline-none"
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} ({c.email})</option>
                  ))}
                </select>
              </div>

              {/* Booking Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Associar à Reserva (Opcional)</label>
                <select
                  value={selectedBooking}
                  onChange={(e) => setSelectedBooking(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white outline-none"
                >
                  <option value="">Nenhuma reserva associada</option>
                  {bookings.filter(b => !selectedClient || b.clienteId === selectedClient).map(b => (
                    <option key={b.id} value={b.id}>
                      Reserva #{b.id} — Detalhado {new Date(b.dataEvento).toLocaleDateString('pt-BR')} ({b.tipoEvento})
                    </option>
                  ))}
                </select>
              </div>

              {/* Template / Trigger Type selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Modelo Base (Template)</label>
                <select
                  value={manualTrigger}
                  onChange={(e) => setManualTrigger(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white outline-none"
                >
                  <option value="Confirmação">Modelo 1: Confirmação de Reserva</option>
                  <option value="Lembrete">Modelo 2: Lembretes de Evento</option>
                  <option value="Pagamento">Modelo 3: Recibo de Pagamento</option>
                  <option value="Contrato">Modelo 4: Notificação Jurídica de Contrato</option>
                  <option value="Admin_Alerta">Modelo 5: Alerta Administrativo Interno</option>
                </select>
              </div>

              {/* Dynamic Recipient Phone/Mail Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Endereço / Tel de Disparo
                </label>
                <input
                  type="text"
                  required
                  placeholder={manualType === 'Email' ? 'exemplo@mail.com' : '+5511999999999'}
                  value={customRecipient}
                  onChange={(e) => setCustomRecipient(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white font-mono outline-none"
                />
              </div>

              {/* Action dispatch */}
              <button
                type="submit"
                disabled={dispatching || !selectedClient}
                className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition-all shadow-sm shadow-indigo-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {dispatching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Disparando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar Notificação Agora</span>
                  </>
                )}
              </button>

              {/* Alert Feedback block */}
              {dispatchResult && (
                <div className={`p-3.5 rounded-xl border text-xs leading-5 flex gap-2 ${
                  dispatchResult.success 
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-850 dark:text-emerald-400' 
                    : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-850 dark:text-rose-400'
                }`}>
                  {dispatchResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                  <div>{dispatchResult.msg}</div>
                </div>
              )}
            </form>
          </div>

          {/* Quick Realtime Preview Column */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-md flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Visualização Cênica do Template (Auto-Composto)
              </h3>
              <p className="text-xs text-slate-500 mt-2">Veja os campos que serão incorporados à mensagem de pauta final.</p>

              <div className="mt-4 space-y-4">
                {manualType === 'Email' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Linha de Assunto (Subject)</label>
                    <input
                      type="text"
                      value={manualSubject}
                      onChange={(e) => setManualSubject(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-white font-semibold outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Corpo Truncado (Message Body)</label>
                  <textarea
                    rows={12}
                    value={manualMessage}
                    onChange={(e) => setManualMessage(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-white font-mono leading-relaxed outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3 text-xs bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-slate-800 p-4 rounded-xl text-indigo-850 dark:text-zinc-400 font-sans leading-relaxed">
              <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0" />
              <div>
                O EventSpace ERP suporta tags dinâmicas baseadas no motor de processamento client-side e sincronizadas no Firestore. Sinta-se à vontade para editar o texto acima livremente antes do envio imediato.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CREDENTIAL SETTINGS FORM */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveConfigs} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Email integration column */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-md flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Gestão de Canais de E-mail
            </h3>

            <div className="space-y-4 text-xs font-medium">
              {/* Enable toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-xs">Habilitar Notificações via Email</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Toggle de envio para e-mails institucionais automáticos.</p>
                </div>
                <input
                  type="checkbox"
                  checked={configs.enableEmail}
                  onChange={(e) => setConfigs({ ...configs, enableEmail: e.target.checked })}
                  className="w-5 h-5 border-slate-300 rounded text-indigo-650 accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Provider Selection Tab Button */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Servidor de Disparo (Provedor de E-mail)</label>
                <div className="grid grid-cols-2 p-1 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-850">
                  <button
                    type="button"
                    onClick={() => setConfigs({ ...configs, useCustomSmtp: false })}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      !configs.useCustomSmtp
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    SendGrid Cloud API
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfigs({ ...configs, useCustomSmtp: true })}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      configs.useCustomSmtp
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    SMTP Customizado
                  </button>
                </div>
              </div>

              {/* Conditional providers */}
              {!configs.useCustomSmtp ? (
                /* SENDGRID */
                <div className="space-y-4 animate-fade-in">
                  <div className="p-3.5 bg-indigo-50/20 dark:bg-slate-950/20 border border-indigo-100/50 dark:border-indigo-950/30 rounded-xl">
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold leading-relaxed">
                      Utilizando o gateway corporativo do SendGrid. Garanta que a chave de API possua a permissão "Mail Send" e que seu remetente esteja validado no painel da SendGrid.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">SendGrid API Key</label>
                    <input
                      type="password"
                      placeholder="SG._xxxxxxxx_xxxxxxxxx"
                      value={configs.sendgridApiKey || ''}
                      onChange={(e) => setConfigs({ ...configs, sendgridApiKey: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white font-mono text-xs outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Remetente Verificado (Sender Email)</label>
                    <input
                      type="email"
                      placeholder="contato@eventspace.com.br"
                      value={configs.sendgridVerifiedSender || ''}
                      onChange={(e) => setConfigs({ ...configs, sendgridVerifiedSender: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white font-mono text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              ) : (
                /* CUSTOM SMTP PANEL */
                <div className="space-y-4 animate-fade-in">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-800">
                    <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                      Configure os parâmetros de conexão do seu próprio servidor de correio de saída (SMTP) para disparos diretos sem dependência de terceiros.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Host do SMTP *</label>
                      <input
                        type="text"
                        required
                        placeholder="smtp.zoho.com ou smtp.gmail.com"
                        value={configs.smtpHost || ''}
                        onChange={(e) => setConfigs({ ...configs, smtpHost: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white text-xs outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Porta SMTP *</label>
                      <input
                        type="text"
                        required
                        placeholder="587"
                        value={configs.smtpPort || ''}
                        onChange={(e) => setConfigs({ ...configs, smtpPort: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white text-xs outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Usuário SMTP *</label>
                      <input
                        type="text"
                        required
                        placeholder="contato@eventspace.com.br"
                        value={configs.smtpUser || ''}
                        onChange={(e) => setConfigs({ ...configs, smtpUser: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white font-mono text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Senha SMTP *</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••••••••••••••••••"
                        value={configs.smtpPass || ''}
                        onChange={(e) => setConfigs({ ...configs, smtpPass: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white font-mono text-xs outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome do Remetente *</label>
                      <input
                        type="text"
                        required
                        placeholder="EventSpace Geral"
                        value={configs.smtpSenderName || ''}
                        onChange={(e) => setConfigs({ ...configs, smtpSenderName: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">E-mail do Remetente *</label>
                      <input
                        type="email"
                        required
                        placeholder="noreply@eventspace.com.br"
                        value={configs.smtpSenderEmail || ''}
                        onChange={(e) => setConfigs({ ...configs, smtpSenderEmail: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white text-xs outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl text-slate-700 dark:text-zinc-300">
                    <div>
                      <p className="font-bold text-xs">Conexão Segura (SSL/TLS)</p>
                      <p className="text-slate-450 text-[10px] mt-0.5 font-sans">Ativa criptografia de canal TLS sobre as portas 465/587.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!configs.smtpSecure}
                      onChange={(e) => setConfigs({ ...configs, smtpSecure: e.target.checked })}
                      className="w-5 h-5 rounded text-indigo-650 accent-indigo-600 focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* ALWAYS SHOW ADMIN EMAIL FOR ALERTS IN BOTH CASES */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-850">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">E-mail Administrativo para Alertas</label>
                <input
                  type="email"
                  placeholder="admin@eventspace.com.br"
                  value={configs.adminEmail || ''}
                  onChange={(e) => setConfigs({ ...configs, adminEmail: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white font-mono text-xs outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* SMS twilio validation column */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-md flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Integração SMS (Twilio Services)
              </h3>

              <div className="space-y-4 text-xs font-medium">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-xs">Habilitar SMS / Whatsapp</p>
                    <p className="text-slate-500 text-[11px] mt-0.5 font-sans">Toggle de envio para SMS móveis institucionais.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={configs.enableSms}
                    onChange={(e) => setConfigs({ ...configs, enableSms: e.target.checked })}
                    className="w-5 h-5 border-slate-300 rounded text-indigo-650 accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Twilio Account SID</label>
                    <input
                      type="text"
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={configs.twilioAccountSid}
                      onChange={(e) => setConfigs({ ...configs, twioSmsSid: e.target.value, twilioAccountSid: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white font-mono text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Twilio Auth Token</label>
                    <input
                      type="password"
                      placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={configs.twilioAuthToken}
                      onChange={(e) => setConfigs({ ...configs, twilioAuthToken: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white font-mono text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Twilio Número (Phone)</label>
                    <input
                      type="text"
                      placeholder="+1415xxxxxxx"
                      value={configs.twilioPhoneNumber}
                      onChange={(e) => setConfigs({ ...configs, twilioPhoneNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white font-mono text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">WhatsApp / SMS Admins Telefone</label>
                    <input
                      type="text"
                      placeholder="+5511999999999"
                      value={configs.adminPhone}
                      onChange={(e) => setConfigs({ ...configs, adminPhone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-white font-mono text-xs outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-850 space-y-4">
              {/* Simulation Sandbox mode active toggle */}
              <div className="flex items-center justify-between p-3.5 bg-indigo-50/40 dark:bg-slate-950 rounded-xl border border-indigo-100 dark:border-indigo-950/60 text-indigo-950 dark:text-zinc-300">
                <div>
                  <p className="font-bold text-xs uppercase tracking-wider mb-0.5">Ativar Sandbox Sandbox Simulado</p>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-4">Impede cobranças reais e desvia mensagens para a auditoria de logs no ERP.</p>
                </div>
                <input
                  type="checkbox"
                  checked={configs.simulationMode}
                  onChange={(e) => setConfigs({ ...configs, simulationMode: e.target.checked })}
                  className="w-5 h-5 rounded text-indigo-650 accent-indigo-600 focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm"
                >
                  Confirmar e Salvar Credenciais
                </button>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 rounded-xl text-emerald-800 text-xs text-center font-bold">
                  Configurações salvas e aplicadas na nuvem do ERP!
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: LESSOR CONFIGS */}
      {activeTab === 'lessor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6">
          
          {/* Lessor Form setup column */}
          <form onSubmit={handleSaveLessor} className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center bg-white dark:bg-slate-900">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-md flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Dados Cadastrais do Locador (Proprietário / Administradora)
              </h3>
              <span className="text-[10px] text-indigo-650 bg-indigo-50 dark:bg-slate-800 dark:text-indigo-305 font-mono font-bold px-2 py-0.5 rounded-md">
                Preenchimento Obrigatório para Contratos Automatizados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Razão Social (PJ)</label>
                <input
                  type="text"
                  required
                  placeholder="EX: EVENTSPACE ERP GESTÃO DE ESPAÇOS LTDA"
                  value={lessorConfigs.razaoSocial}
                  onChange={(e) => setLessorConfigs({ ...lessorConfigs, razaoSocial: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-955 dark:text-white outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Nome Fantasia / Marca</label>
                <input
                  type="text"
                  required
                  placeholder="EX: EventSpace Locações"
                  value={lessorConfigs.nomeFantasia}
                  onChange={(e) => setLessorConfigs({ ...lessorConfigs, nomeFantasia: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-955 text-slate-955 dark:text-white outline-none focus:border-indigo-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 uppercase tracking-wider mb-1.5 font-sans">CNPJ ou CPF do Locador</label>
                <input
                  type="text"
                  required
                  placeholder="00.000.000/0001-00"
                  value={lessorConfigs.cnpjCpf}
                  onChange={(e) => setLessorConfigs({ ...lessorConfigs, cnpjCpf: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-955 dark:text-white font-mono outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Inscrição Estadual (Opcional)</label>
                <input
                  type="text"
                  placeholder="Isento ou nº estadual"
                  value={lessorConfigs.inscricaoEstadual || ''}
                  onChange={(e) => setLessorConfigs({ ...lessorConfigs, inscricaoEstadual: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-955 dark:text-white font-mono outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Telefone Comercial / WhatsApp</label>
                <input
                  type="text"
                  required
                  placeholder="(11) 99999-9999"
                  value={lessorConfigs.telefone}
                  onChange={(e) => setLessorConfigs({ ...lessorConfigs, telefone: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-955 dark:text-white font-mono outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 uppercase tracking-wider mb-1.5 font-sans">E-mail Comercial de Pauta</label>
                <input
                  type="email"
                  required
                  placeholder="comercial@suapraca.com.br"
                  value={lessorConfigs.email}
                  onChange={(e) => setLessorConfigs({ ...lessorConfigs, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-955 dark:text-white font-mono outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="text-xs font-semibold">
              <label className="block text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Endereço Sede (Será impresso no preâmbulo contratual)</label>
              <input
                type="text"
                required
                placeholder="Av. das Nações Unidas, 12551 - Pinheiros, São Paulo - SP"
                value={lessorConfigs.endereco}
                onChange={(e) => setLessorConfigs({ ...lessorConfigs, endereco: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-955 dark:text-white outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            {/* Representante Legal Area */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-850 space-y-4">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 block border-b border-slate-200/50 dark:border-slate-800/80 pb-1.5 uppercase tracking-wider">
                Representante Legal Assinante
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                <div>
                  <label className="block text-slate-500 mb-1 font-sans">Nome do Representante</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome completo do assinante legal"
                    value={lessorConfigs.representanteNome}
                    onChange={(e) => setLessorConfigs({ ...lessorConfigs, representanteNome: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-955 dark:text-white outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-sans">CPF do Representante</label>
                  <input
                    type="text"
                    required
                    placeholder="000.000.000-00"
                    value={lessorConfigs.representanteCpf}
                    onChange={(e) => setLessorConfigs({ ...lessorConfigs, representanteCpf: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-955 dark:text-white font-mono outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-850">
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Salvar Dados do Locador
              </button>
            </div>

            {saveLessorSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 rounded-xl text-emerald-800 dark:text-emerald-400 text-xs text-center font-bold">
                Dados do Locador atualizados com sucesso e integrados à pauta de Contratos!
              </div>
            )}
          </form>

          {/* Business card card preview Column */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Business Card layout */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl relative overflow-hidden select-none">
              {/* Decorative light ring elements */}
              <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-600/20 rounded-full blur-2xl"></div>
              <div className="absolute left-0 bottom-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl"></div>

              <div className="relative space-y-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Ficha Cadastral Locador</p>
                    <h4 className="text-lg font-bold text-indigo-400 mt-1 leading-tight">{lessorConfigs.nomeFantasia || "Nome Fantasia"}</h4>
                  </div>
                  <span className="text-[9px] bg-slate-800 text-indigo-300 font-extrabold px-2 py-0.5 rounded-md self-center">
                    ERP ATIVO
                  </span>
                </div>

                <div className="space-y-3 font-sans text-[11px] leading-relaxed">
                  <div>
                    <span className="text-slate-400 text-[9px] uppercase font-bold block">Razão Social</span>
                    <span className="font-semibold text-slate-200">{lessorConfigs.razaoSocial || " EVENTSPACE ERP LTDA"}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 text-[9px] uppercase font-bold block">CNPJ / CPF</span>
                      <span className="font-mono text-xs text-slate-200 font-semibold">{lessorConfigs.cnpjCpf || "12.345.678/0001-99"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[9px] uppercase font-bold block">Insc. Estadual</span>
                      <span className="font-mono text-xs text-slate-200 font-semibold">{lessorConfigs.inscricaoEstadual || "Isento"}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[9px] uppercase font-bold block">Endereço Sede Administrativa</span>
                    <span className="text-slate-200 text-[10px] leading-relaxed block">{lessorConfigs.endereco || "Av. Paulista, 1000 - Bela Vista"}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/85 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 text-[9px] uppercase font-bold block">Contato</span>
                      <span className="font-semibold text-slate-200">{lessorConfigs.telefone || "(11) 99999-9999"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[9px] uppercase font-bold block">E-mail</span>
                      <span className="font-mono text-[10px] text-zinc-350 truncate block">{lessorConfigs.email || "contato@eventspace.com.br"}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-slate-400 text-[9px] uppercase font-bold block">Assinatura Digital</span>
                    <span className="font-semibold text-slate-100 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      {lessorConfigs.representanteNome || "Representante Autorizado"}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">CPF: {lessorConfigs.representanteCpf}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Smart info terms */}
            <div className="bg-amber-50/50 dark:bg-slate-900 border border-amber-200/50 dark:border-slate-850 p-4 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Como funciona a automação contratual?
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                Ao alterar os dados acima e salvá-los, o módulo de <strong>Contratos Inteligentes</strong> passará a emitir em tempo real todas as novas minutas pré-compiladas em nome da sua empresa locadora.
              </p>
              <div className="p-2 border-l-2 border-slate-300 dark:border-slate-750 bg-slate-100/50 dark:bg-slate-950 text-[10px] text-slate-400 font-semibold rounded-r-lg font-mono leading-none flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Atualização instantânea sem necessidade de reiniciar.</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* DRAWER / DETAILED NOTIFICATION SHEET MODAL */}
      {selectedNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between max-h-[85vh]">
            
            {/* Modal header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Auditoria da Notificação</h3>
              </div>
              <button
                id="btn-close-notif-modal"
                onClick={() => setSelectedNotif(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer font-bold text-xs"
              >
                ✕ Fechar
              </button>
            </div>

            {/* Modal content viewport */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-700 dark:text-slate-350">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-slate-850">
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Identificação ID</p>
                  <p className="font-mono mt-0.5 text-slate-950 dark:text-white font-bold">{selectedNotif.id}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Data do Disparo</p>
                  <p className="font-mono mt-0.5 text-slate-950 dark:text-white font-bold">{new Date(selectedNotif.dataEnvio).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-slate-850">
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Destinatário Alvo</p>
                  <p className="font-mono mt-0.5 text-slate-950 dark:text-white font-bold">{selectedNotif.destinatario}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Meio & Canal</p>
                  <p className="mt-0.5 text-slate-950 dark:text-white font-bold">{selectedNotif.tipo === 'Email' ? '📧 Correio Eletrônico' : '📱 SMS Móvel'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-slate-850">
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Gatilho Gerador de Pauta</p>
                  <p className="mt-0.5 font-bold text-slate-900 dark:text-zinc-200">{selectedNotif.gatilho}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Compensação de Entrega</p>
                  <p className="mt-0.5">
                    {selectedNotif.status === 'Enviado' && <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ Entregue (Produção Real)</span>}
                    {selectedNotif.status === 'Simulado' && <span className="text-indigo-600 dark:text-indigo-400 font-bold">● Simulação Sandbox Sucedida</span>}
                    {selectedNotif.status === 'Falha' && <span className="text-rose-600 dark:text-rose-400 font-bold">✕ Erro de Protocolo</span>}
                  </p>
                </div>
              </div>

              {selectedNotif.assunto && (
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mb-1">Linha do Assunto (Subject Email)</p>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 text-slate-955 dark:text-white rounded-lg border border-slate-150 font-semibold">{selectedNotif.assunto}</div>
                </div>
              )}

              <div>
                <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mb-1">Corpo da Mensagem Transmitido (Raw Text)</p>
                <div 
                  className="p-4 bg-slate-900 text-green-400 font-mono text-xs rounded-xl overflow-x-auto border border-slate-850 max-h-56 select-all whitespace-pre-wrap"
                  style={{ direction: 'ltr' }}
                >
                  {selectedNotif.mensagem}
                </div>
              </div>
            </div>

            {/* Modal footer action */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-950 gap-2">
              <button
                id="btn-close-notif-modal-footer"
                onClick={() => setSelectedNotif(null)}
                className="px-5 py-2 hover:bg-slate-105 rounded-xl text-slate-600 dark:hover:bg-slate-800 dark:text-slate-350 cursor-pointer text-xs font-bold"
              >
                Retornar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
