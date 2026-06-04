/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, User, Mail, Eye, EyeOff, Save, Sparkles, Image as ImageIcon } from 'lucide-react';
import { saveSystemUser } from '../services/db';
import { SystemUser } from '../types';

interface EditProfileModalProps {
  currentUser: any;
  onClose: () => void;
  onProfileUpdated: (updatedUser: any) => void;
}

export default function EditProfileModal({ currentUser, onClose, onProfileUpdated }: EditProfileModalProps) {
  const [nome, setNome] = useState(currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [password, setPassword] = useState(currentUser?.senhaSecreta || '123456');
  const [photoURL, setPhotoURL] = useState(currentUser?.photoURL || '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch password on mount if we can find this user from the local system users database
  React.useEffect(() => {
    const fetchCurrentPassword = async () => {
      try {
        const localUsersStr = localStorage.getItem('es_system_users');
        if (localUsersStr) {
          const users = JSON.parse(localUsersStr);
          const match = users.find((u: any) => u.email.toLowerCase() === currentUser?.email?.toLowerCase());
          if (match && match.senhaSecreta) {
            setPassword(match.senhaSecreta);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar senha atual:", err);
      }
    };
    fetchCurrentPassword();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!nome.trim()) {
      setErrorMsg("O nome é obrigatório.");
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg("Informe um e-mail corporativo válido.");
      return;
    }
    if (!password.trim() || password.length < 4) {
      setErrorMsg("A senha deve ter no mínimo 4 caracteres.");
      return;
    }

    // Protection for Developer email modification
    if (currentUser?.email?.toLowerCase() === 'clecioferreiracorretor@gmail.com') {
      if (email.trim().toLowerCase() !== 'clecioferreiracorretor@gmail.com') {
        setErrorMsg("O e-mail do desenvolvedor mestre (clecioferreiracorretor@gmail.com) é protegido contra mudanças.");
        return;
      }
    }

    try {
      setLoading(true);

      // Create payload matching SystemUser
      const updatedUserPayload: Omit<SystemUser, 'id' | 'createdAt'> & { id?: string; createdAt?: string } = {
        id: currentUser.uid || currentUser.id || "usr_" + Date.now(),
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        senhaSecreta: password,
        role: currentUser.role || 'operador',
        nivelAcesso: currentUser.nivelAcesso || (currentUser.role === 'operador' ? 'Usuário' : 'Admin'),
        photoURL: photoURL.trim(),
        createdAt: currentUser.createdAt || new Date().toISOString()
      };

      // 1. Save to database / local list
      await saveSystemUser(updatedUserPayload);

      // 2. Sync local user session active in browser
      const updatedSession = {
        ...currentUser,
        displayName: nome.trim(),
        email: email.trim().toLowerCase(),
        photoURL: photoURL.trim(),
        senhaSecreta: password
      };
      localStorage.setItem('es_user_session', JSON.stringify(updatedSession));

      // 3. Inform success
      setSuccessMsg("Perfil atualizado com sucesso!");
      
      // Dispatch updating event to sync brand-colors & Sidebar
      window.dispatchEvent(new Event('brand-colors-updated'));
      window.dispatchEvent(new Event('es-database-updated'));

      setTimeout(() => {
        onProfileUpdated(updatedSession);
        onClose();
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Erro ao atualizar dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in font-sans p-4">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden flex flex-col justify-between">
        
        {/* Banner with radial decor */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600" />
        
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-900">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                <span>Editar Meu Perfil</span>
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">Gerencie suas credenciais operacionais do ERP.</p>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            
            {/* Field: Nome */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Nome de Exibição
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Seu nome completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm rounded-xl focus:outline-none text-slate-900 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Field: E-mail */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                E-mail Corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  disabled={currentUser?.email?.toLowerCase() === 'clecioferreiracorretor@gmail.com'}
                  placeholder="Ex: seu-operador@eventspace.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm rounded-xl focus:outline-none text-slate-900 dark:text-zinc-100 disabled:opacity-60"
                />
              </div>
              {currentUser?.email?.toLowerCase() === 'clecioferreiracorretor@gmail.com' && (
                <p className="text-[10px] text-slate-400 mt-1 font-medium">O e-mail do desenvolvedor master é fixo.</p>
              )}
            </div>

            {/* Field: Senha com Visualização Toggled */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Senha Secreta de Acesso
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="mínimo de 4 dígitos"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm rounded-xl focus:outline-none text-slate-900 dark:text-zinc-100 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? "Ocultar senha" : "Ver senha"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Field: URL da Foto */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                URL da Foto de Perfil
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <input
                  type="url"
                  placeholder="Ex: https://images.unsplash.com/photo-..."
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm rounded-xl focus:outline-none text-slate-900 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Messages */}
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/10 text-rose-600 dark:text-rose-450 text-xs font-semibold rounded-xl leading-snug">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-xl">
                {successMsg}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-900">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-600 dark:text-zinc-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-indigo-650/10 cursor-pointer"
              >
                {loading ? (
                  <Sparkles className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
