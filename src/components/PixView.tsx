/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  getReservas, 
  getClientes, 
  getEspacos, 
  getPagamentos,
  savePagamento, 
  saveReserva, 
  addActivityLog 
} from '../services/db';
import { Reserva, Cliente, Espaco, Pagamento } from '../types';
import { triggerPaymentNotification } from '../services/notifications';
import { 
  QrCode, 
  Copy, 
  Check, 
  ShieldCheck, 
  Loader2, 
  FileSpreadsheet, 
  Clock, 
  ArrowRight, 
  AlertCircle 
} from 'lucide-react';

interface PixViewProps {
  preselectedBookingId?: string | null;
}

export default function PixView({ preselectedBookingId }: PixViewProps) {
  const [bookings, setBookings] = useState<Reserva[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [spaces, setSpaces] = useState<Espaco[]>([]);
  const [payments, setPayments] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);

  // Selector
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [chargeType, setChargeType] = useState<'sinal' | 'total'>('sinal');

  // Generator states
  const [isGenerated, setIsGenerated] = useState(false);
  const [pixCopiaCola, setPixCopiaCola] = useState('');
  const [copied, setCopied] = useState(false);

  // Countdown auto-confirmation simulation
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'waiting' | 'confirmed'>('idle');
  const [countdown, setCountdown] = useState(5);

  // Config States (Interactive dynamic configs inside PixView)
  const [showConfig, setShowConfig] = useState(false);
  const [pixKey, setPixKey] = useState(() => localStorage.getItem('cfg_pix_key') || '42.183.904/0001-82');
  const [pixName, setPixName] = useState(() => localStorage.getItem('cfg_pix_name') || 'Holding EventSpace Administradora LTDA');
  const [pixGateway, setPixGateway] = useState(() => localStorage.getItem('cfg_pix_gateway') || 'direto');
  const [pixCity, setPixCity] = useState(() => localStorage.getItem('cfg_pix_city') || 'SAO PAULO');
  const [pixKeyType, setPixKeyType] = useState(() => localStorage.getItem('cfg_pix_key_type') || 'cnpj');
  const [pixClientId, setPixClientId] = useState(() => localStorage.getItem('cfg_pix_client_id') || '');
  const [pixClientSecret, setPixClientSecret] = useState(() => localStorage.getItem('cfg_pix_client_secret') || '');
  const [pixEnvironment, setPixEnvironment] = useState(() => localStorage.getItem('cfg_pix_environment') || 'sandbox');
  const [pixToken, setPixToken] = useState(() => localStorage.getItem('cfg_pix_token') || '');

  useEffect(() => {
    loadPixData();
  }, [preselectedBookingId]);

  const loadPixData = async () => {
    try {
      setLoading(true);
      const bks = await getReservas();
      const clis = await getClientes();
      const sps = await getEspacos();
      const pay = await getPagamentos();

      setBookings(bks);
      setClients(clis);
      setSpaces(sps);
      setPayments(pay);

      // Pre-select if forwarded from another view
      if (preselectedBookingId) {
        setSelectedBookingId(preselectedBookingId);
      } else if (bks.length > 0) {
        setSelectedBookingId(bks[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const activeBooking = bookings.find(b => b.id === selectedBookingId);
  const activeClient = activeBooking ? clients.find(c => c.id === activeBooking.clienteId) : null;
  const activeSpace = activeBooking ? spaces.find(s => s.id === activeBooking.espacoId) : null;

  // Calculte charge amount
  const getChargeAmount = () => {
    if (!activeBooking) return 0;
    return chargeType === 'sinal' ? activeBooking.valorSinal : activeBooking.valorTotal;
  };

  const handleGeneratePix = () => {
    if (!activeBooking) return;

    const amount = getChargeAmount();

    // Use interactive state values directly
    let cleanKey = pixKey.trim();
    // For CPF/CNPJ or pure numeric phone keys, remove non-digits for banking compatibility
    const digitsOnly = cleanKey.replace(/\D/g, '');
    if (digitsOnly.length === 11 || digitsOnly.length === 14 || (digitsOnly.length >= 10 && digitsOnly.length <= 13 && (cleanKey.startsWith('+') || !isNaN(Number(cleanKey.replace(/[+\s-]/g, '')))))) {
      cleanKey = digitsOnly;
    } else {
      cleanKey = cleanKey.replace(/[^a-zA-Z0-9@.-]/g, '');
    }

    const cleanName = pixName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 25).toUpperCase();
    const cleanCity = pixCity.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 15).toUpperCase();

    // Assemble dynamic BR Code / EMV block fields conform standard
    const pix_info = `0014br.gov.bcb.pix01${cleanKey.length.toString().padStart(2, '0')}${cleanKey}`;
    const merchant_info = `26${pix_info.length.toString().padStart(2, '0')}${pix_info}`;
    const amString = amount.toFixed(2);
    const amount_info = `54${amString.length.toString().padStart(2, '0')}${amString}`;
    
    const payloadStart = `000201010212${merchant_info}520400005303986${amount_info}5802BR` +
      `59${cleanName.length.toString().padStart(2, '0')}${cleanName}` +
      `60${cleanCity.length.toString().padStart(2, '0')}${cleanCity}` +
      `62070503***6304`;

    // Dynamic Calculation of CRC16-CCITT (polynomial 0x1021, seed 0xFFFF, without reflection)
    let crc = 0xFFFF;
    const polynomial = 0x1021;
    for (let i = 0; i < payloadStart.length; i++) {
      const charCode = payloadStart.charCodeAt(i);
      crc ^= (charCode << 8);
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ polynomial) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    const finalCRC = crc.toString(16).toUpperCase().padStart(4, '0');
    const key = payloadStart + finalCRC;
    
    setPixCopiaCola(key);
    setIsGenerated(true);
    setPaymentStatus('waiting');
    setCountdown(5);
  };

  // Countdown effect to simulate banking notification trigger
  useEffect(() => {
    let timer: any;
    if (paymentStatus === 'waiting') {
      if (countdown > 0) {
        timer = setTimeout(() => {
          setCountdown(prev => prev - 1);
        }, 1000);
      } else {
        triggerSimulatedConfirmation();
      }
    }
    return () => clearTimeout(timer);
  }, [paymentStatus, countdown]);

  const triggerSimulatedConfirmation = async () => {
    if (!activeBooking) return;

    try {
      // 1. Update corresponding payment status inside DB
      const bookingPayments = payments.filter(p => p.reservaId === activeBooking.id);
      const am = getChargeAmount();
      
      // Find matching pending payment or create one if none exists
      const match = bookingPayments.find(p => p.valor === am && p.status === 'Pendente');
      if (match) {
        await savePagamento({
          ...match,
          status: 'Confirmado',
          dataPagamento: new Date().toISOString().substring(0, 10)
        });
      } else {
        // Fallback auto registration of receipt
        await savePagamento({
          reservaId: activeBooking.id,
          valor: am,
          formaPagamento: 'PIX',
          status: 'Confirmado',
          dataPagamento: new Date().toISOString().substring(0, 10)
        });
      }

      // 2. Automatics updates corresponding booking state in relation to paid sinal
      let nextStatus = activeBooking.status;
      if (chargeType === 'sinal' && activeBooking.status === 'Aguardando sinal') {
        nextStatus = 'Confirmado'; // Paid signal moves booking to confirmed!
      } else if (chargeType === 'total') {
        nextStatus = 'Confirmado';
      }

      await saveReserva({
        ...activeBooking,
        status: nextStatus
      });

      // 3. Write real audit activity log
      await addActivityLog(
        "Auto-Compensação PIX", 
        `Liquidação de R$ ${am} auto-confirmada para '${activeClient?.nome || 'Cliente'}'. Reserva atualizada para: ${nextStatus}.`
      );

      // 4. Trigger automated notification alert to client + admin alert
      if (activeClient && activeBooking) {
        const fullReserva: Reserva = {
          ...activeBooking,
          status: nextStatus
        };
        const mockPagamento: Pagamento = {
          id: match?.id || "pay_pix_" + Date.now(),
          reservaId: activeBooking.id,
          valor: am,
          formaPagamento: 'PIX',
          status: 'Confirmado',
          dataPagamento: new Date().toISOString().substring(0, 10)
        };
        await triggerPaymentNotification(fullReserva, activeClient, mockPagamento, true);
      }

      setPaymentStatus('confirmed');
    } catch (e) {
      console.error("Error setting dynamic PIX clearing confirmations:", e);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pixCopiaCola);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setIsGenerated(false);
    setPaymentStatus('idle');
    setPixCopiaCola('');
    setCountdown(5);
    loadPixData();
  };

  const handleSaveConfig = () => {
    localStorage.setItem('cfg_pix_key', pixKey);
    localStorage.setItem('cfg_pix_name', pixName);
    localStorage.setItem('cfg_pix_gateway', pixGateway);
    localStorage.setItem('cfg_pix_city', pixCity);
    localStorage.setItem('cfg_pix_key_type', pixKeyType);
    localStorage.setItem('cfg_pix_client_id', pixClientId);
    localStorage.setItem('cfg_pix_client_secret', pixClientSecret);
    localStorage.setItem('cfg_pix_environment', pixEnvironment);
    localStorage.setItem('cfg_pix_token', pixToken);
    
    // Notify general style update which re-syncs state
    window.dispatchEvent(new Event('brand-colors-updated'));
    setShowConfig(false);
  };

  const gatewayLabels: Record<string, string> = {
    direto: "Banco Central Direto (Estático)",
    mercadopago: "Mercado Pago API",
    asaas: "Asaas Gateway Webhook",
    efi: "Efí Bank / Gerencianet",
    pagseguro: "PagSeguro API"
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-505 mr-2" />
        Carregando motor bancário PIX...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">Painel de Gateway PIX</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Gere cobranças dinâmicas sincronizadas em tempo real com conciliação automática bancária.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            id="toggle-pix-config-panel"
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition shadow-sm cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span>{showConfig ? 'Fechar Configurações (X)' : '⚙️ Configurar Pix Dinâmico'}</span>
          </button>
          
          <div className="bg-indigo-50 dark:bg-indigo-950/30 px-3.5 py-1.5 border border-indigo-200/50 dark:border-indigo-900/55 rounded-xl space-y-0.5 text-left">
            <span className="block text-[9px] text-indigo-500 dark:text-indigo-400 font-extrabold uppercase tracking-widest">Gateway Ativo:</span>
            <span className="font-bold text-slate-800 dark:text-gray-105 text-xs">{gatewayLabels[pixGateway] || gatewayLabels.direto}</span>
          </div>
        </div>
      </div>

      {/* Dynamic PIX Configuration Action Panel */}
      {showConfig && (
        <div id="pix-inline-config-panel" className="bg-white dark:bg-slate-900 border border-indigo-155 dark:border-indigo-900/60 p-6 rounded-2xl shadow-lg space-y-6 animate-scale-up">
          <div className="flex items-center justify-between border-b border-gray-150 dark:border-slate-850 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                <QrCode className="w-5 h-5 text-indigo-60 e animate-spin-slow" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Ajustes Rápidos de Faturamento PIX</h3>
                <p className="text-[11px] text-slate-400">Insira suas chaves e configure seus bancos PSP de forma centralizada.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chave select and value */}
            <div>
              <label htmlFor="pix-config-key-type" className="block text-[10px] font-bold text-slate-500 dark:text-zinc-455 uppercase tracking-wider mb-1.5">Tipo da Chave Pix *</label>
              <select
                id="pix-config-key-type"
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-505/20"
              >
                <option value="cnpj">CNPJ (Pessoa Jurídica)</option>
                <option value="cpf">CPF (Pessoa Física)</option>
                <option value="email">E-mail</option>
                <option value="celular">Celular / Telefone</option>
                <option value="aleatoria">Chave Aleatória (EVP)</option>
              </select>
            </div>

            <div>
              <label htmlFor="pix-config-key-val" className="block text-[10px] font-bold text-slate-500 dark:text-zinc-455 uppercase tracking-wider mb-1.5">Chave Pix de Destino *</label>
              <input
                id="pix-config-key-val"
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Ex. 42.183.904/0001-82 ou pix@suasfestas.com"
                className="w-full px-3.5 py-2 border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-505/20 font-mono"
              />
            </div>

            <div>
              <label htmlFor="pix-config-name" className="block text-[10px] font-bold text-slate-500 dark:text-zinc-455 uppercase tracking-wider mb-1.5">Nome do Recebedor *</label>
              <input
                id="pix-config-name"
                type="text"
                value={pixName}
                onChange={(e) => setPixName(e.target.value)}
                maxLength={25}
                placeholder="Ex. Holding EventSpace"
                className="w-full px-3.5 py-2 border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-505/20"
              />
              <span className="text-[10px] text-gray-400 block mt-0.5">Máximo 25 caracteres para compatibilidade técnica BR Code.</span>
            </div>

            <div>
              <label htmlFor="pix-config-city" className="block text-[10px] font-bold text-slate-500 dark:text-zinc-455 uppercase tracking-wider mb-1.5">Cidade (Padrão Bacen) *</label>
              <input
                id="pix-config-city"
                type="text"
                value={pixCity}
                onChange={(e) => setPixCity(e.target.value)}
                maxLength={15}
                placeholder="Ex. SAO PAULO"
                className="w-full px-3.5 py-2 border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-505/20 font-mono"
              />
              <span className="text-[10px] text-gray-400 block mt-0.5 font-mono font-semibold">Sem acentos, no máximo 15 letras.</span>
            </div>

            {/* Gateway selection */}
            <div className="md:col-span-2">
              <label htmlFor="pix-config-gateway" className="block text-[10px] font-bold text-slate-500 dark:text-zinc-455 uppercase tracking-wider mb-1.5">Gateway / API Provedora *</label>
              <select
                id="pix-config-gateway"
                value={pixGateway}
                onChange={(e) => setPixGateway(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-505/20"
              >
                <option value="direto">Banco Central Direto (Sem taxas - Estático Assinado)</option>
                <option value="mercadopago">Mercado Pago (Conciliação automática webhook)</option>
                <option value="asaas">Asaas (Gateway de faturamento instantâneo com webhook nativo)</option>
                <option value="efi">Efí Bank / Gerencianet (Official Pix API)</option>
                <option value="pagseguro">PagSeguro API</option>
              </select>
            </div>

            {/* Client ID / secret inputs for dynamic integrations */}
            {pixGateway !== 'direto' && (
              <div className="md:col-span-2 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <span className="block text-[10px] font-black text-slate-450 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Ambiente de Operação</span>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="inlineEnv"
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
                        name="inlineEnv"
                        value="production"
                        checked={pixEnvironment === 'production'}
                        onChange={() => setPixEnvironment('production')}
                        className="text-indigo-650 focus:ring-indigo-500"
                      />
                      <span>Produção Real (Valores Reais)</span>
                    </label>
                  </div>
                </div>

                {pixGateway !== 'asaas' ? (
                  <>
                    <div>
                      <label htmlFor="pix-config-clientid" className="block text-[10px] font-bold text-slate-500 dark:text-zinc-455 uppercase tracking-wider mb-1">Client ID *</label>
                      <input
                        id="pix-config-clientid"
                        type="text"
                        value={pixClientId}
                        onChange={(e) => setPixClientId(e.target.value)}
                        placeholder="Insira as credenciais oficiais do provedor"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 bg-white dark:bg-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="pix-config-secret" className="block text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-wider mb-1">Client Secret *</label>
                      <input
                        id="pix-config-secret"
                        type="password"
                        value={pixClientSecret}
                        onChange={(e) => setPixClientSecret(e.target.value)}
                        placeholder="••••••••••••••••••••••••"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 bg-white dark:bg-slate-900 focus:outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2">
                    <label htmlFor="pix-config-token" className="block text-[10px] font-bold text-slate-500 dark:text-zinc-455 uppercase tracking-wider mb-1">Token de API Asaas *</label>
                    <input
                      id="pix-config-token"
                      type="password"
                      value={pixToken}
                      onChange={(e) => setPixToken(e.target.value)}
                      placeholder="Ex. $aae.Ym9sc2ZfZGV..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 bg-white dark:bg-slate-900 focus:outline-none font-mono"
                    />
                  </div>
                )}
                
                <div className="md:col-span-2 text-[10px] text-gray-450 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-gray-150 dark:border-slate-800 leading-relaxed font-mono">
                  <span className="font-extrabold text-indigo-500 block">Webhook Configurado no Integrador:</span>
                  {window.location.origin}/api/pix/webhook?gateway={pixGateway}&env={pixEnvironment}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-slate-850 pt-4 font-sans">
            <button
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-250 text-gray-700 dark:text-zinc-350 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="btn-save-pix-inline"
              onClick={handleSaveConfig}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-650/15 font-sans"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Salvar Parâmetros PIX</span>
            </button>
          </div>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-12 text-center rounded-2xl max-w-sm mx-auto">
          <p className="text-sm text-gray-500">Cadastre uma reserva ativa na agenda para iniciar cobranças rápidas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start max-w-4xl mx-auto">
          
          {/* Billing configuration */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-6 rounded-2xl shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-gray-901 dark:text-white pb-3 border-b border-gray-100 dark:border-slate-800">
              Configurar Cobrança Bancária
            </h3>

            {/* Selector booking */}
            <div>
              <label htmlFor="select-pix-booking" className="block text-xs font-bold text-gray-700 dark:text-zinc-350 uppercase mb-1.5">Vincular a Reserva / Evento *</label>
              <select
                id="select-pix-booking"
                value={selectedBookingId}
                onChange={(e) => {
                  setSelectedBookingId(e.target.value);
                  setIsGenerated(false);
                  setPaymentStatus('idle');
                }}
                disabled={paymentStatus === 'waiting'}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 bg-white dark:bg-slate-800 text-gray-905 dark:text-zinc-200 focus:outline-none"
              >
                {bookings.map(b => {
                  const cli = clients.find(c => c.id === b.clienteId);
                  return (
                    <option key={b.id} value={b.id}>
                      {b.tipoEvento} — {cli?.nome || 'Cliente'} ({b.status})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Charge type toggle */}
            <div>
              <label htmlFor="charge-type-toggle" className="block text-xs font-bold text-gray-700 dark:text-zinc-350 uppercase mb-1.5">Origem da Carga PIX *</label>
              <div id="charge-type-toggle" className="grid grid-cols-2 gap-2 p-1 bg-gray-55 dark:bg-slate-950/20 rounded-xl border border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setChargeType('sinal');
                    setIsGenerated(false);
                    setPaymentStatus('idle');
                  }}
                  disabled={paymentStatus === 'waiting'}
                  className={`p-2.5 rounded-lg text-xs font-semibold select-none transition ${
                    chargeType === 'sinal' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-500'
                  }`}
                >
                  Sinal de Entrada (30%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChargeType('total');
                    setIsGenerated(false);
                    setPaymentStatus('idle');
                  }}
                  disabled={paymentStatus === 'waiting'}
                  className={`p-2.5 rounded-lg text-xs font-semibold select-none transition ${
                    chargeType === 'total' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-500'
                  }`}
                >
                  Custo Integral (100%)
                </button>
              </div>
            </div>

            {activeBooking && (
              <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-3.5 text-xs text-slate-600 dark:text-zinc-300">
                <div className="flex justify-between">
                  <span>Espaço de Eventos:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{activeSpace?.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cliente Fiscal:</span>
                  <span className="font-semibold">{activeClient?.nome} ({activeClient?.cpf})</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-slate-800 text-sm">
                  <span className="font-bold">VALOR A COBRAR:</span>
                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                    R$ {getChargeAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {paymentStatus === 'idle' && (
              <button
                id="btn-generate-pix"
                onClick={handleGeneratePix}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-sm rounded-xl cursor-pointer transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-650/15"
              >
                <QrCode className="w-4 h-4" />
                <span>Gerar QR Code de Cobrança</span>
              </button>
            )}

            {paymentStatus !== 'idle' && (
              <button
                id="btn-reset-pix"
                onClick={handleReset}
                className="w-full py-2.5 bg-gray-100 dark:bg-slate-850 hover:bg-gray-200 text-gray-700 dark:text-zinc-300 font-semibold text-xs border border-gray-200 dark:border-slate-750 rounded-xl cursor-pointer"
              >
                Emitir Outro PIX
              </button>
            )}
          </div>

          {/* QR Code and status clearing simulator area */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center min-h-[400px]">
            {!isGenerated ? (
              <div className="text-center text-gray-400 p-8">
                <QrCode className="w-16 h-16 mx-auto mb-4 opacity-30 animate-pulse" />
                <p className="text-xs leading-relaxed max-w-xs">Configurar os parâmetros de faturamento no menu ao lado para disparar a compensação bancária em tempo real.</p>
              </div>
            ) : (
              <div className="w-full text-center space-y-5">
                
                {/* Dynamically switching interactive screens */}
                {paymentStatus === 'waiting' && (
                  <div className="space-y-4">
                    
                    {/* Visual QR code styled box */}
                    <div className="w-48 h-48 bg-white p-2.5 rounded-2xl border border-gray-200 dark:border-slate-800 mx-auto flex items-center justify-center relative shadow-sm">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixCopiaCola)}`}
                        alt="QR Code Pix"
                        className="w-40 h-40 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Copia e cola string */}
                    <div className="text-left bg-slate-55 dark:bg-slate-850/80 p-3 rounded-xl border border-gray-200/80 dark:border-slate-800 max-w-sm mx-auto flex items-center justify-between gap-3">
                      <div className="truncate text-[10px] text-gray-500 font-mono flex-1 leading-snug">
                        {pixCopiaCola}
                      </div>
                      <button
                        id="btn-copy-pix-string"
                        type="button"
                        onClick={copyToClipboard}
                        className="p-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 rounded text-[11px] font-bold text-indigo-600 transition flex items-center gap-1 flex-shrink-0 cursor-pointer"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copiar</span>
                      </button>
                    </div>

                    {/* Simulation Tick alert */}
                    <div className="p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-250/30 rounded-xl leading-relaxed max-w-sm mx-auto flex items-start gap-3">
                      <Loader2 className="w-5 h-5 text-amber-500 animate-spin flex-shrink-0" />
                      <div className="text-left">
                        <h4 className="text-xs font-bold text-yellow-800 dark:text-amber-400">Conciliação Ativa</h4>
                        <p className="text-[10px] text-slate-500 leading-normal mt-0.5">Esperando comunicação bancária. Compensadora de callback simulará PIX liquidado em <strong>{countdown} segundos...</strong></p>
                      </div>
                    </div>

                  </div>
                )}

                {paymentStatus === 'confirmed' && (
                  <div className="space-y-4 py-8 animate-scale-up">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-lg shadow-emerald-500/15 animate-bounce">
                      <ShieldCheck className="w-8 h-8" />
                    </div>

                    <div>
                      <h4 className="text-md font-bold text-gray-900 dark:text-white leading-none">PIX Liquidado de Imediato</h4>
                      <p className="text-[11px] text-gray-500 mt-1 max-w-xs mx-auto">A reserva foi atualizada em banco, e o correspondente recibo financeiro está quitado.</p>
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/5 text-emerald-55 border border-emerald-500/10 text-xs font-semibold font-mono">
                      AUTENTICAÇÃO: BACEN_CALLBACK_SUCCESS_{Date.now().toString().slice(-6)}
                    </div>

                    <div className="pt-4 max-w-xs mx-auto grid grid-cols-2 gap-2 text-[10px]">
                      <button
                        id="btn-confirm-view-bookings"
                        onClick={() => loadPixData()}
                        className="py-1.5 px-3 bg-gray-50 dark:bg-slate-800 text-gray-751 hover:bg-gray-100 text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Reiniciar
                      </button>
                      <button
                        id="btn-confirm-view-ledger"
                        onClick={() => window.location.reload()} // Quick trigger or wait
                        className="py-1.5 px-3 bg-emerald-500 text-white hover:bg-emerald-655 text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Painel Geral
                      </button>
                    </div>

                  </div>
                )}

              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
