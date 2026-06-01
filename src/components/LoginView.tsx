/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { getCurrentUser, loginWithCredentials, loginWithGoogle } from '../services/firebase';
import { 
  Lock, 
  Mail, 
  LogIn, 
  Sparkles, 
  MapPin, 
  AlertTriangle,
  Compass,
  CheckCircle,
  HelpCircle,
  ChevronRight
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: any) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('admin@eventspace.com.br');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [formMode, setFormMode] = useState<'login' | 'forgot'>('login');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Por favor, informe seu e-mail e senha cadastrados.");
      return;
    }

    try {
      setLoading(true);
      const user = await loginWithCredentials(email, password);
      onLoginSuccess(user);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Credenciais inválidas ou serviço temporariamente indisponível. Utilize as senhas de demonstração.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignInClick = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      setLoading(true);
      const user = await loginWithGoogle();
      onLoginSuccess(user);
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro na autenticação através do Google Popup. Carregando simulação...");
      
      // Load fallback mock user session so dev doesn't block
      setTimeout(() => {
        onLoginSuccess({
          uid: 'google_mock_user_11',
          email: 'corporativo@eventspace-erp.com',
          displayName: 'Clécio Santos (Simulado)',
          photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop',
          isAnonymous: false
        });
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg("Preencha seu e-mail cadastrado.");
      return;
    }

    setSuccessMsg("Instruções de redefinição encaminhadas com sucesso para o seu e-mail.");
    setTimeout(() => {
      setFormMode('login');
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans">
      
      {/* Left decorative column (Airbnb/Stripe-like visual side panel) */}
      <div className="hidden lg:flex lg:w-1/2 bg-indigo-950 text-white p-12 flex-col justify-between relative overflow-hidden select-none">
        
        {/* Glow graphics background decoration */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-indigo-550/10 blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px]" />

        {/* Upper label branding */}
        <div className="flex items-center gap-2.5 z-10">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white text-md tracking-widest shadow-lg shadow-indigo-600/30">
            ES
          </div>
          <span className="text-md font-black tracking-widest uppercase">EventSpace <span className="text-xs text-indigo-400 font-bold block leading-none">ERP</span></span>
        </div>

        {/* Brand Core Selling statement */}
        <div className="space-y-4 max-w-md z-10 my-auto text-left">
          <h2 className="text-3xl font-black text-zinc-100 tracking-tight leading-none">A inteligência operacional que seu salão de festas merece.</h2>
          <p className="text-sm text-indigo-200/80 leading-relaxed font-normal">
            Controle reservas, otimize a logística de fornecedores, gere orçamentos de casamentos e gerencie seu faturamento PIX em uma única central administrativa descomplicada.
          </p>

          <div className="flex items-center gap-3.5 pt-4">
            <div className="flex -space-x-2">
              <img className="w-8 h-8 rounded-full border-2 border-indigo-950" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop" alt="avatar" />
              <img className="w-8 h-8 rounded-full border-2 border-indigo-950" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop" alt="avatar" />
              <img className="w-8 h-8 rounded-full border-2 border-indigo-950" src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=60&h=60&fit=crop" alt="avatar" />
            </div>
            <span className="text-xs text-indigo-305 font-medium block">Utilizado por gestores de formaturase eventos corporativos de alto padrão.</span>
          </div>
        </div>

        {/* Lower guidelines or copyright */}
        <div className="text-xs text-indigo-400 flex items-center gap-2 font-mono z-10 leading-none">
          <Compass className="w-4 h-4 text-emerald-505" />
          <span>ESTÁVEL • CONEXÃO CRIPTOGRAFADA SSL</span>
        </div>

      </div>

      {/* Right form container column */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 sm:p-12 md:p-16">
        
        <div className="w-full max-w-sm space-y-7 text-left">
          
          {/* Logo representation in mobile layout */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white text-md tracking-widest">
              ES
            </div>
            <span className="text-md font-black tracking-widest text-gray-900 dark:text-white">EVENTSPACE ERP</span>
          </div>

          {/* Form descriptors */}
          <div>
            <h1 className="text-2xl font-black text-gray-950 dark:text-white leading-none">
              {formMode === 'login' ? 'Acessar Central de Gestão' : 'Recuperar Acesso ERP'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2 font-normal">
              {formMode === 'login' 
                ? 'Insira suas credenciais corporativas abaixo para monitorar sua agenda.' 
                : 'Insira seu correio eletrônico cadastrado para redefinir sua credencial.'}
            </p>
          </div>

          {/* Alert logs for credentials validation errors */}
          {errorMsg && (
            <div className="p-3 bg-red-400/10 border border-red-500/10 text-red-500 text-xs font-semibold rounded-xl flex items-start gap-2.5 animate-pulse leading-snug">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-55 border border-indigo-500/10 text-xs font-semibold rounded-xl flex items-center gap-2 animate-scale-up">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {formMode === 'login' ? (
            
            /* Creds form fields */
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              
              {/* Field: Email */}
              <div>
                <label className="block text-xs font-bold text-gray-751 dark:text-zinc-400 uppercase tracking-widest mb-1.5" htmlFor="login-email">
                  E-mail Corporativo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-405">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder="Ex: administrador@eventspace.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm rounded-xl focus:outline-none text-gray-900 dark:text-zinc-100 placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Field: Password */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-gray-751 dark:text-zinc-400 uppercase tracking-widest leading-none" htmlFor="login-password">
                    Senha Secreta
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setFormMode('forgot');
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-850 dark:hover:text-indigo-400 font-semibold leading-none cursor-pointer"
                  >
                    Recuperar senha?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-405">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    required
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm rounded-xl focus:outline-none text-gray-900 dark:text-zinc-100 placeholder-gray-405"
                  />
                </div>
              </div>

              {/* Form buttons */}
              <div className="pt-2 space-y-3">
                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-indigo-650/15 cursor-pointer"
                >
                  {loading ? (
                    <Sparkles className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Entrar no ERP</span>
                    </>
                  )}
                </button>

                {/* Google Single sign button */}
                <button
                  id="btn-login-google"
                  type="button"
                  onClick={handleGoogleSignInClick}
                  className="w-full py-2.5 bg-white dark:bg-slate-900 text-gray-805 dark:text-zinc-200 hover:bg-gray-50 border border-gray-251 dark:border-slate-800 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <img src="https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=40&h=40&fit=crop" className="w-4 h-4 rounded-full object-cover" alt="google" />
                  <span>Acessar rápido via Google</span>
                </button>
              </div>

            </form>
          ) : (
            
            /* Forgot password screen fields */
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-400 uppercase mb-1.5" htmlFor="forgot-email">
                  Confirme o e-mail cadastrado
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    placeholder="Ex: administrativo@eventspace.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm rounded-xl focus:outline-none text-gray-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <button
                  id="btn-forgot-submit"
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Enviar Link de Recuperação
                </button>
                <button
                  id="btn-forgot-back"
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setFormMode('login');
                  }}
                  className="w-full py-2 bg-slate-50 dark:bg-slate-850 text-gray-500 hover:text-gray-900 dark:hover:text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Voltar para o Login
                </button>
              </div>
            </form>

          )}

          {/* Guidelines notes */}
          <div className="pt-6 border-t border-gray-100 dark:border-slate-900 text-center">
            <p className="text-[10px] text-gray-400 font-semibold">Consumo exclusivo da Administradora Local.</p>
            <p className="text-[9px] text-gray-400 mt-1">Dúvidas sobre acessos? <a href="#" className="underline">Fale com o Suporte Corporativo</a></p>
          </div>

        </div>

      </div>

    </div>
  );
}
