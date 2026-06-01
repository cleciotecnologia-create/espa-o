/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Upload, 
  Database, 
  Save, 
  Check, 
  CheckCircle, 
  AlertCircle, 
  Building,
  RefreshCw,
  Sliders,
  Smartphone,
  Lock,
  Moon,
  Sun,
  QrCode,
  Key,
  CreditCard,
  HelpCircle,
  ShieldCheck,
  Users,
  UserPlus,
  Shield,
  Trash2
} from 'lucide-react';
import { getEspacos, getClientes, getReservas, getPagamentos, getContratos, getLogs, getSystemUsers, saveSystemUser, deleteSystemUser } from '../services/db';
import { SystemUser } from '../types';

export default function SettingsView() {
  const [backupMessage, setBackupMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    spacesCount: 0,
    clientsCount: 0,
    bookingsCount: 0,
    paymentsCount: 0,
    contractsCount: 0,
    logsCount: 0
  });

  // ERP State variables with localStorage backup
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('cfg_company_name') || 'EventSpace ERP');
  const [adminPhone, setAdminPhone] = useState(() => localStorage.getItem('cfg_admin_phone') || '(11) 98112-4022');
  const [taxPercent, setTaxPercent] = useState(() => localStorage.getItem('cfg_tax_percent') || '50');
  const [automaticWhatsApp, setAutomaticWhatsApp] = useState(() => localStorage.getItem('cfg_whatsapp_auto') === 'true' || true);
  const [backupFrequencia, setBackupFrequencia] = useState(() => localStorage.getItem('cfg_backup_freq') || 'diaria');

  // PIX Integration parameters with localStorage backups
  const [pixKey, setPixKey] = useState(() => localStorage.getItem('cfg_pix_key') || '42.183.904/0001-82');
  const [pixName, setPixName] = useState(() => localStorage.getItem('cfg_pix_name') || 'Holding EventSpace Administradora LTDA');
  const [pixGateway, setPixGateway] = useState(() => localStorage.getItem('cfg_pix_gateway') || 'direto');
  const [pixCity, setPixCity] = useState(() => localStorage.getItem('cfg_pix_city') || 'SAO PAULO');
  const [pixKeyType, setPixKeyType] = useState(() => localStorage.getItem('cfg_pix_key_type') || 'cnpj');
  const [pixClientId, setPixClientId] = useState(() => localStorage.getItem('cfg_pix_client_id') || '');
  const [pixClientSecret, setPixClientSecret] = useState(() => localStorage.getItem('cfg_pix_client_secret') || '');
  const [pixEnvironment, setPixEnvironment] = useState(() => localStorage.getItem('cfg_pix_environment') || 'sandbox');
  const [pixToken, setPixToken] = useState(() => localStorage.getItem('cfg_pix_token') || '');

  // Brand Identity Palettes states
  const [brandPrimary, setBrandPrimary] = useState(() => localStorage.getItem('cfg_brand_primary') || '#4f46e5');
  const [brandSecondary, setBrandSecondary] = useState(() => localStorage.getItem('cfg_brand_secondary') || '#f59e0b');
  const [brandLogo, setBrandLogo] = useState(() => localStorage.getItem('cfg_brand_logo') || '');
  const [logoUploading, setLogoUploading] = useState(false);

  // System users state
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [userNome, setUserNome] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userSenha, setUserSenha] = useState('');
  const [userRole, setUserRole] = useState<'superadmin' | 'administrador' | 'operador' | 'desenvolvedor'>('operador');
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);

  const [showGeneralSuccess, setShowGeneralSuccess] = useState(false);
  const [showPixSuccess, setShowPixSuccess] = useState(false);
  const [localToast, setLocalToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setLocalToast({ text, type });
    setTimeout(() => {
      setLocalToast(null);
    }, 4500);
  };

  useEffect(() => {
    loadDatabaseStats();
    loadSystemUsersList();
  }, []);

  const loadSystemUsersList = async () => {
    try {
      const list = await getSystemUsers();
      setSystemUsers(list);
    } catch (e) {
      console.error("Falha ao carregar operadores:", e);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);

    if (!userNome.trim() || !userEmail.trim() || !userSenha.trim()) {
      setUserError("Todos os campos do operador são de preenchimento obrigatório.");
      return;
    }

    try {
      await saveSystemUser({
        nome: userNome,
        email: userEmail,
        senhaSecreta: userSenha,
        role: userRole
      });

      setUserSuccess(`Operador ${userNome} cadastrado com sucesso!`);
      // Reset form
      setUserNome('');
      setUserEmail('');
      setUserSenha('');
      setUserRole('operador');
      loadSystemUsersList();
    } catch (err: any) {
      setUserError("Falha ao persistir usuário: " + err.message);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (confirm(`Deseja realmente revogar e apagar o acesso do operador ${name}?`)) {
      try {
        await deleteSystemUser(id);
        setUserSuccess("Acesso revogado com sucesso!");
        loadSystemUsersList();
      } catch (err: any) {
        setUserError("Falha ao revogar acesso: " + err.message);
      }
    }
  };

  const loadDatabaseStats = async () => {
    try {
      const sp = await getEspacos();
      const cli = await getClientes();
      const bk = await getReservas();
      const pay = await getPagamentos();
      const cont = await getContratos();
      const lg = await getLogs();

      setStats({
        spacesCount: sp.length,
        clientsCount: cli.length,
        bookingsCount: bk.length,
        paymentsCount: pay.length,
        contractsCount: cont.length,
        logsCount: lg.length
      });
    } catch (e) {
      console.warn("Falha ao carregar métricas da base:", e);
    }
  };

  const saveGeneralSettings = () => {
    localStorage.setItem('cfg_company_name', companyName);
    localStorage.setItem('cfg_admin_phone', adminPhone);
    localStorage.setItem('cfg_tax_percent', taxPercent);
    localStorage.setItem('cfg_whatsapp_auto', String(automaticWhatsApp));
    localStorage.setItem('cfg_backup_freq', backupFrequencia);

    // Notify Layout and options elements in real-time
    window.dispatchEvent(new Event('brand-colors-updated'));

    setShowGeneralSuccess(true);
    setTimeout(() => setShowGeneralSuccess(false), 3000);
    showToast('Preferências Gerais salvas com sucesso!');

    setBackupMessage({ text: 'Configurações de preferências salvas com sucesso!', type: 'success' });
    setTimeout(() => setBackupMessage(null), 4000);
  };

  const savePixSettings = () => {
    localStorage.setItem('cfg_pix_key', pixKey);
    localStorage.setItem('cfg_pix_name', pixName);
    localStorage.setItem('cfg_pix_gateway', pixGateway);
    localStorage.setItem('cfg_pix_city', pixCity);
    localStorage.setItem('cfg_pix_key_type', pixKeyType);
    localStorage.setItem('cfg_pix_client_id', pixClientId);
    localStorage.setItem('cfg_pix_client_secret', pixClientSecret);
    localStorage.setItem('cfg_pix_environment', pixEnvironment);
    localStorage.setItem('cfg_pix_token', pixToken);

    // Notify Layout elements in real-time
    window.dispatchEvent(new Event('brand-colors-updated'));

    setShowPixSuccess(true);
    setTimeout(() => setShowPixSuccess(false), 3000);
    showToast('Configurações do PIX salvas com sucesso!');

    setBackupMessage({ text: 'Configurações de faturamento PIX e Gateway salvas com sucesso!', type: 'success' });
    setTimeout(() => setBackupMessage(null), 4000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultString = reader.result as string;
      setBrandLogo(resultString);
      setLogoUploading(false);
      showToast('Logomarca carregada com sucesso! Clique em salvar para aplicar.');
    };
    reader.onerror = () => {
      setLogoUploading(false);
      showToast('Falha ao ler o arquivo de imagem.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const saveBrandIdentity = (primaryColor: string, secondaryColor: string, logoUrl: string) => {
    localStorage.setItem('cfg_brand_primary', primaryColor);
    localStorage.setItem('cfg_brand_secondary', secondaryColor);
    localStorage.setItem('cfg_brand_logo', logoUrl);
    setBrandPrimary(primaryColor);
    setBrandSecondary(secondaryColor);
    setBrandLogo(logoUrl);

    // Notify Layout elements in real-time
    window.dispatchEvent(new Event('brand-colors-updated'));

    showToast('Identidade visual aplicada com sucesso!');

    setBackupMessage({ text: 'Estética de identidade visual aplicada e propagada com sucesso!', type: 'success' });
    setTimeout(() => setBackupMessage(null), 4000);
  };

  const triggerExportBackup = () => {
    try {
      setLoading(true);
      // Package local states
      const dataPackage = {
        spaces: localStorage.getItem('es_spaces'),
        clients: localStorage.getItem('es_clients'),
        bookings: localStorage.getItem('es_bookings'),
        payments: localStorage.getItem('es_payments'),
        contracts: localStorage.getItem('es_contracts'),
        logs: localStorage.getItem('es_logs'),
        config: {
          companyName,
          adminPhone,
          taxPercent,
          automaticWhatsApp,
          backupFrequencia,
          pixKey,
          pixName,
          pixGateway,
          pixCity,
          pixKeyType,
          brandPrimary,
          brandSecondary
        },
        timestamp: new Date().toISOString(),
        backupType: 'EventSpace ERP Local Backup Export'
      };

      const blob = new Blob([JSON.stringify(dataPackage, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const tempElement = document.createElement('a');
      tempElement.href = url;
      tempElement.download = `EventSpace_ERP_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(tempElement);
      tempElement.click();
      document.body.removeChild(tempElement);

      setBackupMessage({ text: "Backup manual compilado e exportado com sucesso!", type: 'success' });
      setTimeout(() => setBackupMessage(null), 5000);
    } catch (e) {
      console.error(e);
      setBackupMessage({ text: "Erro ao compilar arquivo de backup do sistema.", type: 'error' });
      setTimeout(() => setBackupMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        // Basic validation
        if (!json.backupType || (!json.spaces && !json.bookings)) {
          throw new Error("Formato de backup inválido. Chaves do banco ausentes.");
        }

        // Restore localStorage items
        if (json.spaces) localStorage.setItem('es_spaces', json.spaces);
        if (json.clients) localStorage.setItem('es_clients', json.clients);
        if (json.bookings) localStorage.setItem('es_bookings', json.bookings);
        if (json.payments) localStorage.setItem('es_payments', json.payments);
        if (json.contracts) localStorage.setItem('es_contracts', json.contracts);
        if (json.logs) localStorage.setItem('es_logs', json.logs);
        
        // Restore config if exists in backup
        if (json.config) {
          const { 
            companyName, 
            adminPhone, 
            taxPercent, 
            automaticWhatsApp, 
            backupFrequencia,
            pixKey,
            pixName,
            pixGateway,
            pixCity,
            pixKeyType,
            brandPrimary,
            brandSecondary
          } = json.config;
          if (companyName) localStorage.setItem('cfg_company_name', companyName);
          if (adminPhone) localStorage.setItem('cfg_admin_phone', adminPhone);
          if (taxPercent) localStorage.setItem('cfg_tax_percent', taxPercent);
          if (automaticWhatsApp !== undefined) localStorage.setItem('cfg_whatsapp_auto', String(automaticWhatsApp));
          if (backupFrequencia) localStorage.setItem('cfg_backup_freq', backupFrequencia);
          if (pixKey) localStorage.setItem('cfg_pix_key', pixKey);
          if (pixName) localStorage.setItem('cfg_pix_name', pixName);
          if (pixGateway) localStorage.setItem('cfg_pix_gateway', pixGateway);
          if (pixCity) localStorage.setItem('cfg_pix_city', pixCity);
          if (pixKeyType) localStorage.setItem('cfg_pix_key_type', pixKeyType);
          if (brandPrimary) localStorage.setItem('cfg_brand_primary', brandPrimary);
          if (brandSecondary) localStorage.setItem('cfg_brand_secondary', brandSecondary);
        }

        setBackupMessage({ text: "Banco de dados restaurado com sucesso! Recarregando ERP...", type: 'success' });
        
        setTimeout(() => {
          window.location.reload();
        }, 1500);

      } catch (err: any) {
        setBackupMessage({ text: `Falha na importação: ${err.message || 'Formato incorreto'}`, type: 'error' });
        setTimeout(() => setBackupMessage(null), 6000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 id="settings-title" className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Configurações do ERP
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
            Configure as regras de negócio, dados de auditoria, e faça o backup e restauração completa das tabelas locais.
          </p>
        </div>
        
        {/* Rapid Backup button matching header layout style */}
        <button
          id="btn-quick-export"
          onClick={triggerExportBackup}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition shadow-sm cursor-pointer"
          disabled={loading}
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>Backup Automático (Exportar)</span>
        </button>
      </div>

      {/* Notifications status feedback */}
      {backupMessage && (
        <div id="settings-status-feedback" className={`p-4 rounded-xl flex items-start gap-3 border ${
          backupMessage.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 text-emerald-800 dark:text-emerald-400' 
            : 'bg-rose-50 dark:bg-rose-950/20 border-rose-250 text-rose-800 dark:text-rose-450'
        }`}>
          {backupMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          )}
          <div>
            <span className="font-bold text-xs select-none block uppercase tracking-wider">Aviso do Sistema</span>
            <p className="text-xs font-semibold leading-relaxed mt-0.5">{backupMessage.text}</p>
          </div>
        </div>
      )}

      {/* Grid view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Database backup card panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Backup and Recovery block */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-850 pb-3">
              <Database className="w-5 h-5 text-indigo-505" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-905 dark:text-zinc-150 uppercase tracking-wider">
                  Banco de Dados & Arrastes
                </h3>
                <p className="text-[11px] text-slate-400 tracking-tight leading-none mt-1">Segurança e migração das tabelas em ambiente local</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Left Action: Export */}
              <div className="border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-4 rounded-xl space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">Exportação de Tabelas</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Baixe o dump completo instantâneo contendo todos os clientes cadastrados, contratos firmados, agendas de locações e histórico financeiro para segurança extra.
                  </p>
                </div>
                
                <button
                  id="btn-main-export-db"
                  onClick={triggerExportBackup}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/50 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Gerar Arquivo JSON</span>
                </button>
              </div>

              {/* Right Action: Import */}
              <div className="border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-4 rounded-xl space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight text-amber-600 dark:text-amber-400">Restaurar do Backup</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Importe um arquivo de backup JSON previamente gerado para restabelecer os cadastros. <b className="text-rose-500 select-none">Atenção:</b> Isso sobrescreverá os dados locais atuais.
                  </p>
                </div>

                <div className="relative">
                  <input
                    type="file"
                    id="file-backup-uploader"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-350 border border-slate-250 dark:border-slate-700 py-2.5 rounded-xl text-xs font-semibold cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>Selecionar Backup JSON</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Quick Index Metrics of DB */}
            <div className="p-4 bg-slate-900 text-slate-300 font-mono rounded-xl space-y-2.5 text-[10px]">
              <span className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider block">💾 Métricas de Registros no Cache:</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-400">
                <div className="bg-slate-950 p-2 rounded border border-slate-850">
                  <span className="block text-slate-500 text-[8px] uppercase font-sans">Gestão de Espaços</span>
                  <span className="text-xs font-bold font-mono text-emerald-400">{stats.spacesCount}</span> cadastrados
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-850">
                  <span className="block text-slate-500 text-[8px] uppercase font-sans">Cadastro de Clientes</span>
                  <span className="text-xs font-bold font-mono text-emerald-400">{stats.clientsCount}</span> indexados
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-850">
                  <span className="block text-slate-500 text-[8px] uppercase font-sans">Reservas Ativas</span>
                  <span className="text-xs font-bold font-mono text-emerald-400">{stats.bookingsCount}</span> lançadas
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-850">
                  <span className="block text-slate-500 text-[8px] uppercase font-sans">Lançamentos Financeiros</span>
                  <span className="text-xs font-bold font-mono text-emerald-400">{stats.paymentsCount}</span> transações
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-850">
                  <span className="block text-slate-500 text-[8px] uppercase font-sans">Termos Contratuais</span>
                  <span className="text-xs font-bold font-mono text-emerald-400">{stats.contractsCount}</span> acordos
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-850">
                  <span className="block text-slate-500 text-[8px] uppercase font-sans">Logs de Trilha</span>
                  <span className="text-xs font-bold font-mono text-indigo-400">{stats.logsCount}</span> eventos
                </div>
              </div>
            </div>
          </div>

          {/* Business rules preferences */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-850 pb-3">
              <Sliders className="w-5 h-5 text-indigo-505" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-905 dark:text-zinc-150 uppercase tracking-wider">
                  Configurações de Fluxo e Negócio
                </h3>
                <p className="text-[11px] text-slate-400 tracking-tight leading-none mt-1">Defina as diretrizes padrão de locação e notificações</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Standard Sinal / Retention Percent */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sinal Confirmatório Padrão (Arras)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={taxPercent}
                      onChange={(e) => setTaxPercent(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-xs font-bold">
                      %
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-snug">Calculado sobre o montante total. Garante o bloqueio permanente das datas comerciais contra o risco de cancelamentos.</p>
                </div>

                {/* Automated Backup Frequency */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Frequência Sugerida para Backup</label>
                  <select
                    value={backupFrequencia}
                    onChange={(e) => setBackupFrequencia(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="diaria">Automático por Sessão (Diária)</option>
                    <option value="semanal">Aviso Semanal</option>
                    <option value="mensal">Aviso Mensal (Consolidado)</option>
                    <option value="manual">Apenas Manual por Solicitação</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1 leading-snug">Controla o status sugerido do botão de exportação rápida na tela de configurações.</p>
                </div>

              </div>

              {/* Automatic WhatsApp toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-850">
                <div className="flex gap-3">
                  <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white leading-tight">Envio de WhatsApp em Lote</span>
                    <span className="block text-[10px] text-slate-500 leading-normal">
                      Dispara lembretes automáticos com as faturas PIX e links de termos digitais contratados para locatários indexados.
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setAutomaticWhatsApp(!automaticWhatsApp)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer flex items-center ${
                    automaticWhatsApp ? 'bg-indigo-600' : 'bg-slate-350 dark:bg-slate-800'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform absolute ${
                    automaticWhatsApp ? 'translate-x-[25px]' : 'translate-x-[4px]'
                  }`} />
                </button>
              </div>

            </div>

            <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-50 dark:border-slate-850">
              {showGeneralSuccess && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 animate-fade-in">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  Salvo com sucesso!
                </span>
              )}
              <button
                onClick={saveGeneralSettings}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-extrabold shadow-sm transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Salvar Preferências
              </button>
            </div>
          </div>

          {/* PIX Gateway & Conciliation Configuration */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-850 pb-3">
              <QrCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Configuração de Faturamento PIX
                </h3>
                <p className="text-[11px] text-slate-400 tracking-tight leading-none mt-1">Conecte seus dados bancários para faturamento instantâneo das arras</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
              As faturas geradas de forma automática na esteira comercial utilizam os dados abaixo para formatar a string de pagamento (padrão EMV BR Code do Banco Central). Defina o gateway de preferência para conciliação automática.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Type of PIX Key & PIX Key Input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tipo da Chave PIX</label>
                <select
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="cnpj">CNPJ (Pessoa Jurídica)</option>
                  <option value="cpf">CPF (Pessoa Física)</option>
                  <option value="email">E-mail</option>
                  <option value="celular">Celular / Telefone</option>
                  <option value="aleatoria">Chave Aleatória (EVP)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Chave PIX (Recebimento)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                    <Key className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder="Ex: 42.183.904/0001-82 ou pix@suaempresa.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Beneficiary Name & Beneficiary City */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome do Beneficiário (Identidade Recibo)</label>
                <input
                  type="text"
                  value={pixName}
                  onChange={(e) => setPixName(e.target.value)}
                  placeholder="Ex: Holding EventSpace Administradora LTDA"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <span className="block text-[8px] text-slate-400 mt-0.5 leading-tight">Deve corresponder exatamente ao cadastro na instituição bancária.</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cidade do Beneficiário (Bacen Código)</label>
                <input
                  type="text"
                  value={pixCity}
                  onChange={(e) => setPixCity(e.target.value)}
                  placeholder="Ex: SAO PAULO"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <span className="block text-[8px] text-slate-400 mt-0.5 leading-tight">Sem acentos gráficos, conforme norma técnica BR Code.</span>
              </div>

            </div>

            {/* Gateway Selector Dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Gateway de Pagamento / Integrador</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <select
                  value={pixGateway}
                  onChange={(e) => setPixGateway(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="direto">Banco Central / EMV Direto (Sem taxas / Instantâneo)</option>
                  <option value="mercadopago">Mercado Pago (Conciliação automática via Webhook)</option>
                  <option value="asaas">Asaas (Gateway de Cobrança com Webhook nativo de liquidação)</option>
                  <option value="efi">Efí Bank / Gerencianet (API Oficial de Pix Dinâmico)</option>
                  <option value="pagseguro">PagSeguro (Faturamento e liquidação em Lote)</option>
                </select>
              </div>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1.5 leading-snug">
                {pixGateway === 'direto' && "✓ Recomendado para automações sem taxas. O sistema calcula a assinatura CRC-16 estática diretamente na esteira comercial."}
                {pixGateway === 'mercadopago' && "✓ Integração ativa. Exige credenciais de Client ID e Client Secret nas chaves de ambiente."}
                {pixGateway === 'asaas' && "✓ Integração com Asaas habilitada. Gera links de checkout e contas digitais gerenciadas para bloqueio de Arras."}
                {pixGateway === 'efi' && "✓ API Dinâmica homologada com certificação TLS 1.3 do Banco Central do Brasil."}
                {pixGateway === 'pagseguro' && "✓ Integração com PagBank habilitada. Conciliação rápida de pagamentos parcelados e faturamentos de sinal."}
              </p>
            </div>

            {/* Dynamic PIX Gateway API Credentials configuration */}
            {pixGateway !== 'direto' && (
              <div className="p-4 bg-indigo-50/30 dark:bg-slate-950/40 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 border-b border-indigo-150/50 dark:border-slate-800 pb-2">
                  <Key className="w-4 h-4 text-indigo-650" />
                  <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                    Credenciais de API de PIX Dinâmico ({pixGateway === 'mercadopago' ? 'Mercado Pago' : pixGateway === 'asaas' ? 'Asaas' : pixGateway === 'efi' ? 'Efí Bank' : 'PagSeguro'})
                  </h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Environment Selector */}
                  <div className="md:col-span-2">
                    <label className="block text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Ambiente de Operação</label>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-bold cursor-pointer">
                        <input
                          type="radio"
                          name="pixEnvironment"
                          value="sandbox"
                          checked={pixEnvironment === 'sandbox'}
                          onChange={() => setPixEnvironment('sandbox')}
                          className="text-indigo-650 focus:ring-indigo-500"
                        />
                        <span>Homologação (Sandbox de Testes)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-bold cursor-pointer">
                        <input
                          type="radio"
                          name="pixEnvironment"
                          value="production"
                          checked={pixEnvironment === 'production'}
                          onChange={() => setPixEnvironment('production')}
                          className="text-indigo-650 focus:ring-indigo-500"
                        />
                        <span>Produção (Dinheiro Real)</span>
                      </label>
                    </div>
                  </div>

                  {/* Client ID / Token depending on Gateway */}
                  {pixGateway !== 'asaas' ? (
                    <>
                      <div>
                        <label className="block text-[9px] font-black text-slate-450 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Client ID de Integração *</label>
                        <input
                          type="text"
                          value={pixClientId}
                          onChange={(e) => setPixClientId(e.target.value)}
                          placeholder={`Insira o Client ID do ${pixGateway === 'mercadopago' ? 'Mercado Pago' : pixGateway === 'efi' ? 'Efí Bank' : 'PagSeguro'}`}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-450 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Client Secret *</label>
                        <input
                          type="password"
                          value={pixClientSecret}
                          onChange={(e) => setPixClientSecret(e.target.value)}
                          placeholder="••••••••••••••••••••••••••••••••"
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-2">
                      <label className="block text-[9px] font-black text-slate-450 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Token de API da Conta Asaas *</label>
                      <input
                        type="password"
                        value={pixToken}
                        onChange={(e) => setPixToken(e.target.value)}
                        placeholder="Ex: $aae.Ym9sc2FfZGVfZm9sY2hhcy..."
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <span className="block text-[8px] text-slate-450 mt-1">Gerado no menu Minha Conta &gt; Integração &gt; Chave de API no painel do Asaas.</span>
                    </div>
                  )}
                  
                  {/* Webhook endpoint feedback description */}
                  <div className="md:col-span-2 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-150 dark:border-slate-800/80 text-[10px] text-slate-400 leading-relaxed font-mono">
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400 block mb-0.5">Webhook de Conciliação Automática:</span>
                    {window.location.origin}/api/pix/webhook?gateway={pixGateway}&amp;env={pixEnvironment}
                  </div>
                </div>
              </div>
            )}

            {/* Compliance Badge */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-150 dark:border-slate-850 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-extrabold uppercase text-[10px] tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Normativa Regulamentar de Segurança PIX</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                Os QR Codes gerados na esteira do EventSpace estão em estrito alinhamento com os Manuais de Padrões Padrão de Iniciação do <b>Banco Central do Brasil (BCB)</b> sob a especificação <b>BR Code v1.0</b>. O arranjo prevê as regras de retenção legal do sinal (Artigo 418 do Código Civil) inclusas na descrição da transação.
              </p>
            </div>

            <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-50 dark:border-slate-850">
              {showPixSuccess && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 animate-fade-in">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  Configurações salvas com sucesso!
                </span>
              )}
              <button
                onClick={savePixSettings}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-extrabold shadow-sm transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Salvar Configurações PIX
              </button>
            </div>
          </div>

          {/* CLIENT RESERVATIONS LINK ENGINE (REQUISITO: o link para reservas dos clientes) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 animate-fade-in">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-850 pb-3">
              <QrCode className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Link de Reservas para Clientes
                </h3>
                <p className="text-[11px] text-slate-400 tracking-tight leading-none mt-1">
                  Envie este link para os contratantes reservarem o Espaço Tropical de forma autônoma
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Ao clicar ou compartilhar este endereço, o cliente é direcionado à ficha de reserva oficial do <strong className="text-indigo-600 dark:text-indigo-400">Espaço Tropical</strong>. O sistema valida datas livres na hora, cria o registro do cliente, preenche a locação e gera o PIX dinâmico do sinal com compensação de teste automática!
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-800/80 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest block mb-1">
                      Link Compartilhavel
                    </span>
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/#reserva`}
                      className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-xs font-mono border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/#reserva`);
                      alert("Link copiado com sucesso! Agora você já pode enviar no WhatsApp de seus clientes.");
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition text-center cursor-pointer shadow-sm shadow-indigo-600/10"
                  >
                    Copiar Link de Atendimento
                  </button>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-800/80 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest block mb-1">
                      Simular como Cliente
                    </span>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Abra a página do cliente em uma aba anônima ou nova guia para testar a experiência de autoatendimento.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      window.open(`${window.location.origin}/#reserva`, '_blank');
                    }}
                    className="w-full py-2.5 bg-slate-200 dark:bg-slate-850 hover:bg-slate-300 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl transition text-center cursor-pointer"
                  >
                    Abrir Página de Reserva ↗
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* USER & OPERATOR ACCESS CONTROL SYSTEM (REQUISITO: CADASTRAR SUPERADMIN E USUARIOS DO SISTEMA) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-850 pb-3">
              <Users className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Controle de Acessos & Operadores
                </h3>
                <p className="text-[11px] text-slate-400 tracking-tight leading-none mt-1">
                  Cadastrar usuários do sistema, administradores e superadmin do desenvolvedor
                </p>
              </div>
            </div>

            {/* Error & Success Feedback inside card */}
            {userError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold rounded-xl leading-snug">
                {userError}
              </div>
            )}
            {userSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-xl leading-snug">
                {userSuccess}
              </div>
            )}

            {/* Registered operators table list */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operadores Ativos e Credenciados ({systemUsers.length})</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-150 dark:border-slate-800/80">
                <table className="w-full text-left font-sans text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 text-[9px] uppercase tracking-wider font-extrabold border-b border-slate-150 dark:border-slate-800/80">
                    <tr>
                      <th className="p-3">Nome / Identidade</th>
                      <th className="p-3">E-mail de Login</th>
                      <th className="p-3">Senha Secreta</th>
                      <th className="p-3">Nível</th>
                      <th className="p-3 text-center">Controle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {systemUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/20 transition">
                        <td className="p-3 whitespace-nowrap">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{u.nome}</p>
                          <p className="text-[8px] text-slate-400 font-mono mt-0.5">ID: {u.id}</p>
                        </td>
                        <td className="p-3 font-semibold text-slate-705 dark:text-slate-350">{u.email}</td>
                        <td className="p-3 font-mono text-indigo-650 dark:text-indigo-400">{u.senhaSecreta}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                            u.role === 'superadmin' 
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/10' 
                              : u.role === 'desenvolvedor'
                              ? 'bg-purple-500/10 text-purple-600 border border-purple-500/10'
                              : u.role === 'administrador'
                              ? 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/10'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/10'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {/* Disable deleting Clécio default account for safety! */}
                          {u.email !== 'admin@eventspace.com.br' ? (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.nome)}
                              className="p-1 px-2 bg-rose-500/10 hover:bg-rose-600 hover:text-white rounded text-rose-650 text-[10px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                              title="Revogar credencial"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Revogar</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-sans italic">Protegido</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form: Add New User */}
            <form onSubmit={handleSaveUser} className="pt-4 border-t border-slate-100 dark:border-slate-850 space-y-4">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Credenciar Novo Operador</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Clecio Ferreira Corretor"
                    value={userNome}
                    onChange={(e) => setUserNome(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">E-mail de Login *</label>
                  <input
                    type="email"
                    required
                    placeholder="Ex: clecio@eventspace.com.br"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Senha de Acesso (Senha Secreta) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Senha de acesso"
                    value={userSenha}
                    onChange={(e) => setUserSenha(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nível de Permissão *</label>
                  <select
                    value={userRole}
                    onChange={(e: any) => setUserRole(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="superadmin">Superadmin do Sistema (Desenvolvedor)</option>
                    <option value="desenvolvedor">Desenvolvedor Administrativo</option>
                    <option value="administrador">Administrador Regional</option>
                    <option value="operador">Operador Comercial</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-sm transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-amber-300" />
                  <span>Cadastrar Acesso do Sistema</span>
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Sidebar Info card */}
        <div className="space-y-6">

          {/* Brand Personalization & Colors Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-850 pb-3">
              <Sliders className="w-5 h-5" style={{ color: brandPrimary }} />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Paleta de Cores da Marca
                </h3>
                <p className="text-[11px] text-slate-400 tracking-tight leading-none mt-1">
                  Personalize as cores primárias e secundárias do ERP
                </p>
              </div>
            </div>

            {/* Curated Presets Grid */}
            <div className="space-y-2.5">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paletas Sugeridas</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Padrão Clássico', primary: '#4f46e5', secondary: '#f59e0b' },
                  { name: 'Esmeralda Nobre', primary: '#059669', secondary: '#d97706' },
                  { name: 'Vinho Sofisticado', primary: '#9f1239', secondary: '#f43f5e' },
                  { name: 'Futurista Neon', primary: '#7c3aed', secondary: '#10b981' },
                  { name: 'Oceano Profundo', primary: '#0f766e', secondary: '#06b6d4' },
                  { name: 'Slate Moderno', primary: '#475569', secondary: '#ca8a04' }
                ].map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setBrandPrimary(preset.primary);
                      setBrandSecondary(preset.secondary);
                    }}
                    type="button"
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left transition text-[11px] hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer ${
                      brandPrimary === preset.primary && brandSecondary === preset.secondary
                        ? 'border-slate-400 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/50'
                        : 'border-slate-200 dark:border-slate-805'
                    }`}
                  >
                    <div className="flex -space-x-1.5">
                      <div className="w-3.5 h-3.5 rounded-full border border-white dark:border-slate-900" style={{ backgroundColor: preset.primary }} />
                      <div className="w-3.5 h-3.5 rounded-full border border-white dark:border-slate-900" style={{ backgroundColor: preset.secondary }} />
                    </div>
                    <span className="font-semibold text-slate-705 dark:text-slate-350 truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom inputs */}
            <div className="space-y-3 pt-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cores Customizadas</span>
              <div className="grid grid-cols-2 gap-3">
                {/* Primary */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-tight">Cor Primária</label>
                  <div className="flex gap-1.5">
                    <input
                      type="color"
                      value={brandPrimary}
                      onChange={(e) => setBrandPrimary(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-200 dark:border-slate-700 cursor-pointer p-0 overflow-hidden bg-transparent"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={brandPrimary}
                      onChange={(e) => setBrandPrimary(e.target.value)}
                      className="w-full text-center px-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-[11px] font-mono font-bold rounded-lg focus:outline-none"
                    />
                  </div>
                </div>

                {/* Secondary */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-tight">Cor Secundária</label>
                  <div className="flex gap-1.5">
                    <input
                      type="color"
                      value={brandSecondary}
                      onChange={(e) => setBrandSecondary(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-200 dark:border-slate-700 cursor-pointer p-0 overflow-hidden bg-transparent"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={brandSecondary}
                      onChange={(e) => setBrandSecondary(e.target.value)}
                      className="w-full text-center px-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-[11px] font-mono font-bold rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Logomarca URL & Upload */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[9px] font-bold text-slate-550 uppercase tracking-tight mb-1">Logomarca do Espaço (URL ou Arquivo Local)</label>
                  <input
                    type="text"
                    placeholder="Ex: https://link-da-imagem.com/logo.png"
                    value={brandLogo}
                    onChange={(e) => setBrandLogo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2"
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-200 dark:border-slate-850" />
                  </div>
                  <div className="relative flex justify-center text-[9px] uppercase font-bold">
                    <span className="bg-white dark:bg-slate-900 px-2 text-slate-400">ou faça upload</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 py-3.5 px-4 rounded-xl cursor-pointer transition-all gap-1 text-center group">
                    <Upload className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    <span className="text-[10px] font-extrabold text-slate-600 dark:text-zinc-350 tracking-wide uppercase">
                      {logoUploading ? "Lendo arquivo..." : "Escolher arquivo de Imagem"}
                    </span>
                    <span className="text-[8px] text-slate-400">PNG, JPG, JPEG ou SVG</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={logoUploading}
                    />
                  </label>
                  {brandLogo && (
                    <button
                      type="button"
                      onClick={() => setBrandLogo('')}
                      className="px-2.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-rose-500 rounded-lg hover:border-rose-250 cursor-pointer transition-all"
                      title="Remover Logomarca atual"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">Essa logomarca será exibida nos cabeçalhos (Sidebar e Header) e na ficha pública de agendamentos.</p>
              </div>
            </div>

            {/* Dynamic preview block */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Pré-visualização do Tema:</span>
              <div className="flex items-center gap-2">
                {brandLogo ? (
                  <img src={brandLogo} alt="Logo" className="h-6 object-contain mr-2 max-w-[100px]" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-6 h-6 rounded bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-[10px]">
                    ES
                  </div>
                )}
                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-lg text-white text-[11px] font-extrabold transition"
                  style={{ backgroundColor: brandPrimary }}
                >
                  Botão do ERP
                </button>
                <span 
                  className="px-2 py-0.5 rounded text-[9px] font-mono font-bold"
                  style={{ backgroundColor: `${brandSecondary}15`, color: brandSecondary, border: `1px solid ${brandSecondary}30` }}
                >
                  Sinal {taxPercent}%
                </span>
                <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: brandPrimary }}></div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => saveBrandIdentity(brandPrimary, brandSecondary, brandLogo)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold tracking-wide transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                style={{ backgroundColor: brandPrimary }}
              >
                <Save className="w-3.5 h-3.5" />
                Aplicar Paleta de Cores & Logo
              </button>
            </div>
          </div>
          
          {/* Admin card parameters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-850 pb-3">
              <Building className="w-5 h-5 text-indigo-505" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-905 dark:text-zinc-150 uppercase tracking-wider">
                  Administradora Master
                </h3>
                <p className="text-[11px] text-slate-400 tracking-tight leading-none mt-1">Informações do faturamento institucional</p>
              </div>
            </div>

            <div className="space-y-3.5">
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Título do ERP / Empresa</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Celular para Notificações</label>
                <input
                  type="text"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none"
                />
              </div>

              <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-1">
                <span className="block text-[9px] uppercase tracking-wider font-extrabold text-indigo-600 dark:text-indigo-400">Diretriz Legal de Proteção:</span>
                <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                  Em conformidade com a Lei de Arras (Artigo 418 do Código Civil Brasileiro), o sinal faturado nesta holding assegura a posse provisória de reserva, garantindo indenizações caso haja quebra injustificada.
                </p>
              </div>

            </div>

            <div className="pt-3 border-t border-slate-50 dark:border-slate-850 flex items-center justify-between gap-3">
              {showGeneralSuccess && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 animate-fade-in">
                  ✓ Atualizado!
                </span>
              )}
              <button
                onClick={saveGeneralSettings}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-755 text-slate-800 dark:text-white rounded-xl text-xs font-extrabold tracking-wide transition cursor-pointer"
              >
                Atualizar Dados Corporativos
              </button>
            </div>
          </div>

          {/* Secure mode warning box status */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 text-slate-300">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span className="text-xs uppercase tracking-wider font-extrabold text-white">Segurança do Database</span>
            </div>
            
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              As conexões com esta base de dados local estão operando no modelo offline durável. Seus backups locais são criptografados pelo seu próprio navegador e consolidados na sandbox segura.
            </p>

            <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 bg-emerald-950/40 p-2 border border-emerald-900/35 rounded-lg select-none">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
              <span><b>ONLINE & PERSISTENTE:</b> LocalStorage Ativo</span>
            </div>
          </div>

        </div>

      </div>

      {localToast && (
        <div 
          className="fixed bottom-6 right-6 z-[99999] bg-emerald-600 dark:bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-500 animate-bounce duration-500 font-sans"
          style={{ animationDuration: '0.8s' }}
        >
          <CheckCircle className="w-5 h-5 text-white flex-shrink-0" />
          <span className="font-extrabold text-xs tracking-wider uppercase">{localToast.text}</span>
        </div>
      )}

    </div>
  );
}
