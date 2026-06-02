/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  getSystemUsers, 
  saveSystemUser, 
  deleteSystemUser,
  getLogs
} from '../services/db';
import { SystemUser, ActivityLog } from '../types';
import { 
  UserPlus, 
  Search, 
  Filter, 
  Shield, 
  Lock, 
  Mail, 
  Trash2, 
  Edit, 
  Calendar, 
  Key, 
  AlertTriangle, 
  Check, 
  X, 
  Eye, 
  EyeOff, 
  Activity, 
  UserCheck,
  RefreshCw
} from 'lucide-react';
import { getCurrentUser } from '../services/firebase';

export default function UsersView() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<ActivityLog[]>([]);
  const [currentUserSession, setCurrentUserSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  // Form Fields
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSenhaSecreta, setFormSenhaSecreta] = useState('');
  const [formRole, setFormRole] = useState<'superadmin' | 'administrador' | 'operador' | 'desenvolvedor'>('operador');
  const [formError, setFormError] = useState('');

  // Password visibility state map by user ID
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const allUsers = await getSystemUsers();
      setUsers(allUsers);

      const session = await getCurrentUser();
      setCurrentUserSession(session);

      const allLogs = await getLogs();
      // Filter for logs pertaining to "Controle de Operadores" or similar user actions
      const filteredLogs = allLogs
        .filter(log => log.acao.includes('Operador') || log.acao.includes('operador') || log.acao.includes('Sessão') || log.acao.includes('Login'))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 15);
      setAuditLogs(filteredLogs);
    } catch (e) {
      console.error("Erro ao carregar dados de usuários:", e);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormNome('');
    setFormEmail('');
    setFormSenhaSecreta('');
    setFormRole('operador');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (user: SystemUser) => {
    setEditingUser(user);
    setFormNome(user.nome);
    setFormEmail(user.email);
    setFormSenhaSecreta(user.senhaSecreta);
    setFormRole(user.role);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formNome.trim()) {
      setFormError('O nome do usuário é obrigatório.');
      return;
    }
    if (!formEmail.trim() || !formEmail.includes('@')) {
      setFormError('Por favor, informe um e-mail válido.');
      return;
    }
    if (!formSenhaSecreta.trim() || formSenhaSecreta.length < 4) {
      setFormError('A senha secreta deve ter no mínimo 4 caracteres.');
      return;
    }

    // Check if email already exists by another user
    const emailDup = users.find(u => u.email.toLowerCase() === formEmail.trim().toLowerCase() && u.id !== editingUser?.id);
    if (emailDup) {
      setFormError('Já existe um usuário cadastrado com este endereço de e-mail.');
      return;
    }

    try {
      const payload: Omit<SystemUser, 'id' | 'createdAt'> & { id?: string; createdAt?: string } = {
        nome: formNome.trim(),
        email: formEmail.trim().toLowerCase(),
        senhaSecreta: formSenhaSecreta,
        role: formRole,
      };

      if (editingUser) {
        payload.id = editingUser.id;
        payload.createdAt = editingUser.createdAt;
      }

      await saveSystemUser(payload);
      setIsModalOpen(false);
      loadAllData();

      // Trigger custom branding event in case user self-updated or to refresh App state
      window.dispatchEvent(new Event('brand-colors-updated'));
    } catch (error: any) {
      setFormError('Erro ao gravar operador: ' + error.message);
    }
  };

  const handleDeleteUser = async (user: SystemUser) => {
    if (currentUserSession && (currentUserSession.uid === user.id || currentUserSession.email === user.email)) {
      alert('Ação bloqueada! Você não pode excluir a si mesmo enquanto estiver conectado em sua sessão.');
      return;
    }

    if (confirm(`Tem certeza absoluta de que deseja revogar o acesso e excluir definitivamente o perfil do operador "${user.nome}"?\nEsta ação é irreversível e impedirá o login imediatamente.`)) {
      try {
        await deleteSystemUser(user.id);
        loadAllData();
      } catch (e: any) {
        alert('Erro ao excluir usuário: ' + e.message);
      }
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Filter logic
  const filteredUsers = users.filter(usr => {
    const matchesSearch = 
      usr.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
      usr.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || usr.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Role style attributes map
  const getRoleBadgeStyle = (role: SystemUser['role']) => {
    switch(role) {
      case 'superadmin':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400 border border-violet-200 dark:border-violet-800';
      case 'administrador':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800';
      case 'operador':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
      case 'desenvolvedor':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200';
    }
  };

  const getRoleLabel = (role: SystemUser['role']) => {
    switch(role) {
      case 'superadmin': return 'Super Admin';
      case 'administrador': return 'Administrador';
      case 'operador': return 'Operador padrão';
      case 'desenvolvedor': return 'Desenvolvedor';
      default: return role;
    }
  };

  // Quick stats computed
  const totalCount = users.length;
  const superadminCount = users.filter(u => u.role === 'superadmin').length;
  const adminCount = users.filter(u => u.role === 'administrador').length;
  const operatorCount = users.filter(u => u.role === 'operador').length;
  const devCount = users.filter(u => u.role === 'desenvolvedor').length;

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs uppercase tracking-widest font-black text-indigo-600 dark:text-indigo-400">Controle Operacional</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Gestão de Usuários e Permissões</h2>
          <p className="text-xs text-gray-500 mt-0.5">Defina e monitore quem possui credenciais para gerenciar agendamentos, financeiros e contratos no ERP.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            id="btn-refresh-users"
            onClick={loadAllData}
            className="p-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-slate-100 hover:dark:bg-slate-755 text-gray-700 dark:text-zinc-200 rounded-xl transition border border-gray-200 dark:border-slate-700 cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            id="btn-create-user"
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/15 transition hover:scale-[1.02] cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Operador</span>
          </button>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-150 dark:border-slate-800/80 flex flex-col justify-between">
          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Total de Contas</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold text-slate-850 dark:text-white">{totalCount}</span>
            <span className="text-[10px] text-zinc-440 font-medium">ativos</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-150 dark:border-slate-800/80 flex flex-col justify-between">
          <span className="text-[10px] text-violet-500 font-bold uppercase tracking-wider">Superadmins</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">{superadminCount}</span>
            <span className="text-[10px] text-zinc-440 font-medium">contas</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-150 dark:border-slate-800/80 flex flex-col justify-between">
          <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Admins Comuns</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{adminCount}</span>
            <span className="text-[10px] text-zinc-440 font-medium">contas</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-150 dark:border-slate-800/80 flex flex-col justify-between">
          <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Operadores</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{operatorCount}</span>
            <span className="text-[10px] text-zinc-440 font-medium font-sans">padrão</span>
          </div>
        </div>
        <div className="grid grid-cols-1 bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-150 dark:border-slate-800/80 col-span-2 lg:col-span-1 justify-between">
          <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Desenvolvedor</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{devCount}</span>
            <span className="text-[10px] text-zinc-440 font-medium font-mono">dev</span>
          </div>
        </div>
      </div>

      {/* Main filter & layout segment */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Core user grid list */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-150 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-sm">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por nome ou email..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Role Filter tabs */}
            <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto self-stretch sm:self-auto py-1">
              <button
                onClick={() => setRoleFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  roleFilter === 'all' 
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' 
                    : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 hover:dark:bg-slate-755 text-slate-600 dark:text-slate-300'
                }`}
              >
                Todos ({totalCount})
              </button>
              <button
                onClick={() => setRoleFilter('superadmin')}
                className={`px-2 py-1.2 rounded-lg text-xs font-bold transition-all ${
                  roleFilter === 'superadmin' 
                    ? 'bg-violet-600 text-white' 
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-100'
                }`}
              >
                Superadmins
              </button>
              <button
                onClick={() => setRoleFilter('administrador')}
                className={`px-2 py-1.2 rounded-lg text-xs font-bold transition-all ${
                  roleFilter === 'administrador' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-100'
                }`}
              >
                Admins
              </button>
              <button
                onClick={() => setRoleFilter('operador')}
                className={`px-2 py-1.2 rounded-lg text-xs font-bold transition-all ${
                  roleFilter === 'operador' 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-100'
                }`}
              >
                Operadores
              </button>
            </div>
          </div>

          {/* User Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredUsers.length === 0 ? (
              <div className="col-span-1 md:col-span-2 bg-white dark:bg-slate-900 p-12 text-center rounded-xl border border-gray-150 dark:border-slate-800/80">
                <Shield className="w-10 h-10 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-800 dark:text-zinc-250">Nenhum operador localizado</p>
                <p className="text-xs text-gray-400 mt-1">Experimente limpar os filtros ou realizar um novo cadastro.</p>
              </div>
            ) : (
              filteredUsers.map((usr) => {
                const initials = usr.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                const isMyAccount = currentUserSession?.uid === usr.id || currentUserSession?.email === usr.email;
                const showPassword = !!visiblePasswords[usr.id];

                return (
                  <div 
                    key={usr.id} 
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-150 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-slate-700 transition duration-150 flex flex-col justify-between shadow-sm relative group"
                  >
                    {isMyAccount && (
                      <span className="absolute top-4 right-4 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-extrabold text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1">
                        <UserCheck className="w-2.5 h-2.5" />
                        Minha Conta
                      </span>
                    )}

                    {/* Profile & Identity block */}
                    <div className="flex gap-4.5 items-start">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center font-extrabold text-sm text-indigo-650 dark:text-indigo-350 shadow-inner border border-white/50 dark:border-slate-800">
                        {initials}
                      </div>
                      <div className="space-y-1 overflow-hidden flex-1">
                        <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider font-sans inline-block ${getRoleBadgeStyle(usr.role)}`}>
                          {getRoleLabel(usr.role)}
                        </span>
                        <h4 className="text-sm font-bold text-slate-850 dark:text-white truncate" title={usr.nome}>
                          {usr.nome}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                          <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate" title={usr.email}>{usr.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Detail properties */}
                    <div className="border-t border-gray-100 dark:border-slate-800 mt-4.5 pt-4 space-y-2.5 text-[11px]">
                      {/* Password line (extremely relevant for operations diagnostics) */}
                      <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-gray-100 dark:border-slate-850">
                        <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
                          <Key className="w-3.5 h-3.5 text-gray-400" />
                          <span>Senha Secreta:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-800 dark:text-zinc-200">
                            {showPassword ? usr.senhaSecreta : '••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(usr.id)}
                            className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5 cursor-pointer"
                            title={showPassword ? "Ocultar senha" : "Exibir senha"}
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Date details */}
                      <div className="flex items-center justify-between text-gray-400 font-sans px-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Cadastrado em:</span>
                        </div>
                        <span className="font-medium">
                          {usr.createdAt ? new Date(usr.createdAt).toLocaleDateString('pt-BR') : 'Sem data'}
                        </span>
                      </div>
                    </div>

                    {/* Action footer */}
                    <div className="flex items-center gap-2 mt-4.5 pt-3.5 border-t border-gray-100 dark:border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => openEditModal(usr)}
                        className="flex-1 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white hover:bg-gray-50 hover:border-gray-300 dark:bg-slate-900 hover:dark:bg-slate-850 transition text-[11px] font-bold text-gray-700 dark:text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(usr)}
                        disabled={isMyAccount}
                        className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                          isMyAccount 
                            ? 'bg-gray-100 dark:bg-slate-850 text-gray-400 dark:text-slate-600 border border-transparent cursor-not-allowed opacity-50' 
                            : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 hover:dark:bg-rose-950/40 border border-rose-200/40'
                        }`}
                        title={isMyAccount ? "Não é possível excluir você mesmo" : "Revogar acesso"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Audit / Logs side visual tab */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-150 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Log de Auditoria de Acessos</h3>
              </div>
              <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-gray-500 rounded px-1.5 py-0.5 font-bold font-mono">
                SEGURANÇA
              </span>
            </div>

            <div className="mt-4 space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
              {auditLogs.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-8 font-sans">Nenhuma atividade de segurança registrada recentemente.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="text-xs space-y-1 pb-3 border-b border-gray-50 dark:border-slate-850 last:border-b-0">
                    <div className="flex justify-between items-start">
                      <span className="font-extrabold text-slate-800 dark:text-zinc-250 truncate block max-w-[130px]">{log.usuario}</span>
                      <span className="text-[9px] text-gray-400" title={log.timestamp}>
                        {new Date(log.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                      </span>
                    </div>
                    <p className="text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase leading-tight">{log.acao}</p>
                    <p className="text-gray-500 dark:text-slate-400 leading-normal text-[10px] font-sans">{log.detalhes}</p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 p-3 bg-indigo-50/50 dark:bg-slate-950/40 rounded-xl border border-indigo-100/50 dark:border-slate-850/60">
              <p className="text-[10px] text-indigo-800 dark:text-indigo-400 leading-relaxed font-sans font-medium">
                💡 <b>Dica de Segurança:</b> As concessões do nível <b>Super Admin</b> herdam poder total para alterar faturamento e dados de SMTP comercial. Use papéis de <b>Operador</b> para recepcionistas ou secretários.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive Overlay Modal Form */}
      {isModalOpen && (
        <div id="modal-user-form" className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{editingUser ? 'Editar Perfil Operador' : 'Adicionar Novo Operador'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-bold font-sans flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="mt-4 space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Endereço de E-mail *</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="exemplo@eventspace.com.br"
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Secret Password for login */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Senha Secreta de Acesso *</label>
                <input
                  type="text"
                  required
                  value={formSenhaSecreta}
                  onChange={(e) => setFormSenhaSecreta(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full px-3.5 py-2.5 text-xs font-mono rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  title="Será utilizada para o painel de login"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Nível de Permissão *</label>
                <select
                  value={formRole}
                  onChange={(e: any) => setFormRole(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="operador">Operador padrão (Apenas controle e reservas)</option>
                  <option value="administrador">Administrador comum (Acessa geral, exceto SMTP empresarial)</option>
                  <option value="superadmin">Super Admin (Poder total no sistema, faturamento e usuários)</option>
                  <option value="desenvolvedor">Desenvolvedor (Acesso irrestrito e APIs de integração)</option>
                </select>
                <div className="mt-1.5 p-2 bg-slate-50 dark:bg-slate-950/55 rounded-lg text-[10px] text-gray-400 dark:text-zinc-400 leading-normal">
                  {formRole === 'superadmin' && '⭐ Permissão máxima. Acesso a relatórios, remoções completas e auditoria.'}
                  {formRole === 'administrador' && '💼 Gerencia reservas, clientes, espaços e visualiza financeiros.'}
                  {formRole === 'operador' && '📝 Cadastro básico de propostas na agenda e visualização de clientes.'}
                  {formRole === 'desenvolvedor' && '⚙️ Operação focada em webhooks, monitoramento e integrações de API.'}
                </div>
              </div>

              {/* Save or Cancel buttons */}
              <div className="flex gap-2 pt-4 border-t border-gray-150 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 text-xs font-bold hover:bg-gray-50 transition cursor-pointer"
                >
                  Voltar / Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingUser ? 'Salvar Edição' : 'Cadastrar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
