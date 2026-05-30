/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  getReservas, 
  saveReserva, 
  saveCliente, 
  savePagamento, 
  addActivityLog 
} from '../services/db';
import { Reserva, Cliente } from '../types';
import { 
  Calendar, 
  Users, 
  Mail, 
  FileText, 
  Phone, 
  Clock, 
  QrCode, 
  Check, 
  Copy, 
  Loader2, 
  ShieldCheck, 
  Sparkles, 
  PartyPopper,
  AlertCircle,
  CheckCircle,
  MapPin,
  HelpCircle,
  Menu
} from 'lucide-react';

export default function PublicBookingView() {
  // Database datasets
  const [existingReservas, setExistingReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tipoEvento, setTipoEvento] = useState('Casamento');
  const [dataEvento, setDataEvento] = useState('');
  const [horario, setHorario] = useState('14:00 - 22:00');
  const [qtdConvidados, setQtdConvidados] = useState('200');
  const [observacoes, setObservacoes] = useState('');

  // Date validation state
  const [dateStatus, setDateStatus] = useState<'idle' | 'available' | 'busy'>('idle');

  // Checkout Flow
  const [viewState, setViewState] = useState<'form' | 'checkout' | 'success'>('form');
  const [createdBooking, setCreatedBooking] = useState<Reserva | null>(null);
  const [createdClient, setCreatedClient] = useState<Cliente | null>(null);
  const [pixPayload, setPixPayload] = useState('');
  const [pixCopied, setPixCopied] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    try {
      setLoading(true);
      const res = await getReservas();
      setExistingReservas(res);
    } catch (e) {
      console.error("Erro ao carregar dados existentes para agendamento público:", e);
    } finally {
      setLoading(false);
    }
  };

  // Re-evaluate date occupation whenever dataEvento changes
  useEffect(() => {
    if (!dataEvento) {
      setDateStatus('idle');
      return;
    }
    const alreadyOccupied = existingReservas.some(
      r => r.dataEvento === dataEvento && r.status !== 'Cancelado'
    );
    if (alreadyOccupied) {
      setDateStatus('busy');
    } else {
      setDateStatus('available');
    }
  }, [dataEvento, existingReservas]);

  // Countdown timer effect for immediate PIX dynamic simulation
  useEffect(() => {
    let timer: any;
    if (viewState === 'checkout' && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (viewState === 'checkout' && countdown === 0) {
      handleCompletePayment();
    }
    return () => clearTimeout(timer);
  }, [viewState, countdown]);

  const handleDateSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDataEvento(e.target.value);
  };

  const handleCompletePayment = async () => {
    if (!createdBooking) return;
    try {
      const amount = Math.round(Number(createdBooking.valorTotal) * 0.3);

      // Create confirmed payment record
      await savePagamento({
        reservaId: createdBooking.id,
        valor: amount,
        formaPagamento: 'PIX',
        status: 'Confirmado',
        dataPagamento: new Date().toISOString().substring(0, 10)
      });

      // Update reservation status to "Confirmado" in local database
      const confirmedBooking: Reserva = {
        ...createdBooking,
        status: 'Confirmado'
      };
      await saveReserva(confirmedBooking);

      // Add log
      await addActivityLog(
        "Auto-Agendamento Confirmado",
        `Cliente '${nome}' efetuou reserva online com pagamento PIX expresso de sinal de R$ ${amount}.`
      );

      setCountdown(0);
      setViewState('success');
    } catch (e) {
      console.error("Erro ao processar pagamento de Pix expresso público:", e);
    }
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim() || !cpf.trim() || !email.trim() || !telefone.trim() || !dataEvento) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (dateStatus === 'busy') {
      alert("A data escolhida já possui reserva ativa. Por favor, escolha outra data.");
      return;
    }

    const cleanCPF = cpf.replace(/\D/g, "");
    if (cleanCPF.length !== 11 && cleanCPF.length !== 14) {
      alert("Por favor, informe um CPF ou CNPJ de contratante válido.");
      return;
    }

    try {
      setLoading(true);

      // 1. Save New Cliente
      const clientPayload = {
        nome,
        cpf,
        telefone,
        email,
        whatsapp: telefone,
        endereco: '',
        observacoes: 'Cadastrado automaticamente via Link de Reservas Público'
      };
      const clientId = await saveCliente(clientPayload);
      const fullClient: Cliente = {
        id: clientId,
        ...clientPayload,
        createdAt: new Date().toISOString()
      };
      setCreatedClient(fullClient);

      // 2. Define Reservation pricing
      // Fixed value for Espaço Tropical rent is R$ 4.800
      const valorTotal = 4800;
      const valorSinal = Math.round(valorTotal * 0.3); // 30% sinal = 1440

      // 3. Save Reserva
      const bookingPayload = {
        clienteId: clientId,
        espacoId: "espaco_1", // Hardcoded "Espaço Tropical"
        tipoEvento,
        dataEvento,
        horario,
        qtdConvidados: Number(qtdConvidados) || 200,
        valorTotal,
        valorSinal,
        status: 'Aguardando sinal' as const,
        observacoes: observacoes || 'Reserva online de autoatendimento.'
      };
      const bookingId = await saveReserva(bookingPayload);
      const fullBooking: Reserva = {
        id: bookingId,
        ...bookingPayload,
        createdAt: new Date().toISOString()
      };
      setCreatedBooking(fullBooking);

      // 4. Generate dynamic PIX payload string
      const amount = valorSinal;
      const savedKey = localStorage.getItem('cfg_pix_key') || '42.183.904/0001-82';
      const savedName = localStorage.getItem('cfg_pix_name') || 'Holding EventSpace Administradora LTDA';
      const savedCity = localStorage.getItem('cfg_pix_city') || 'SAO PAULO';

      const cleanKey = savedKey.replace(/[^a-zA-Z0-9@.-]/g, '');
      const cleanName = savedName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 25).toUpperCase();
      const cleanCity = savedCity.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 15).toUpperCase();

      const pix_info = `0014br.gov.bcb.pix01${cleanKey.length.toString().padStart(2, '0')}${cleanKey}`;
      const merchant_info = `26${pix_info.length.toString().padStart(2, '0')}${pix_info}`;
      const amString = amount.toFixed(2);
      const amount_info = `54${amString.length.toString().padStart(2, '0')}${amString}`;
      
      const payloadStart = `000201010212${merchant_info}520400005303986${amount_info}5802BR` +
        `59${cleanName.length.toString().padStart(2, '0')}${cleanName}` +
        `60${cleanCity.length.toString().padStart(2, '0')}${cleanCity}` +
        `62070503***6304`;

      const mockCRC = "A7D2";
      const key = payloadStart + mockCRC;

      setPixPayload(key);
      setCountdown(6); // 6 seconds simulated banking match
      setViewState('checkout');
    } catch (e: any) {
      alert("Houve um erro técnico ao registrar seu agendamento: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 selection:bg-indigo-600/10">
      
      {/* Visual Navigation Bar */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-150 dark:border-slate-800/80 sticky top-0 z-40 transition-colors">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-sm shadow shadow-orange-500/20">
              ET
            </div>
            <div>
              <span className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider block">Espaço Tropical</span>
              <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest block leading-none">Canal de Reserva Oficial</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-full px-3.5 py-1">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
            <span>Agenda Aberta 2026/2027</span>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
        
        {/* VIEW 1: BOOKING FORM */}
        {viewState === 'form' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Elegant Header Hero */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden flex flex-col md:flex-row gap-6 md:items-center">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-400 via-indigo-900 to-slate-900"></div>
              
              {/* Cover Photo */}
              <div className="w-full md:w-48 h-36 rounded-2xl overflow-hidden shadow-md border-2 border-white/10 flex-shrink-0">
                <img 
                  src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800" 
                  alt="Espaço Tropical" 
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-3 z-10 flex-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/10 text-[10px] uppercase font-black tracking-widest">
                  <Sparkles className="w-3.5 h-3.5" /> Salão Climatizado com Paisagismo
                </div>
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Espaço Tropical</h1>
                <p className="text-xs text-indigo-200 leading-relaxed max-w-xl">
                  Maravilhoso salão de festas decorado com elementos tropicais, paisagismo tropical integrado, pé-direito imponente e infraestrutura de alta categoria. Perfeito para casamentos, formaturas, corporativos e aniversários inesquecíveis.
                </p>
                <div className="flex flex-wrap gap-4 pt-1 text-[11px] font-mono font-bold text-slate-350">
                  <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Até 350 convidados</div>
                  <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Excelente Localização</div>
                  <div className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Diária: R$ 4.800,00</div>
                </div>
              </div>
            </div>

            {/* Quick alert */}
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 text-xs font-bold rounded-2xl flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="font-extrabold uppercase leading-none mb-1 text-[10px]">Reservas com PIX Expresso</p>
                <p className="opacity-90 leading-snug">O sinal de 30% é liquidado no ato do agendamento para bloqueio imediato do calendário. Os 70% restantes são faturados conforme os prazos de contrato.</p>
              </div>
            </div>

            {/* Main grid form */}
            <form onSubmit={handleSubmitBooking} className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-150 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              {loading && (
                <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm z-30 flex items-center justify-center rounded-3xl">
                  <div className="text-center space-y-2">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Processando sua Pré-Reserva...</p>
                  </div>
                </div>
              )}

              {/* Sub-Header Contract details */}
              <div className="md:col-span-2 border-b border-slate-100 dark:border-slate-850 pb-2">
                <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest flex items-center gap-1.5 leading-none">
                  <Calendar className="w-4 h-4" /> 1. Disponibilidade & Data do Evento
                </h3>
              </div>

              {/* Date selection and validator */}
              <div className="space-y-1 md:col-span-1">
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
                  Data pretendida para Locação *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={dataEvento}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={handleDateSelection}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="md:col-span-1 flex items-end">
                {dateStatus === 'available' && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl leading-none flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs w-full">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span>✓ Data disponível! Garanta sua reserva.</span>
                  </div>
                )}
                {dateStatus === 'busy' && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl leading-none flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-xs w-full">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span>✗ Data Indisponível! Já foi reservada.</span>
                  </div>
                )}
                {dateStatus === 'idle' && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl leading-none flex items-center gap-2 text-slate-400 font-semibold text-xs w-full">
                    <HelpCircle className="w-4 h-4" />
                    <span>Insira a data do evento para verificar disponibilidade.</span>
                  </div>
                )}
              </div>

              {/* Step 2: Event specifications */}
              <div className="md:col-span-2 border-b border-slate-100 dark:border-slate-850 pb-2 pt-4">
                <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest flex items-center gap-1.5 leading-none">
                  <PartyPopper className="w-4 h-4" /> 2. Detalhes & Configuração do Evento
                </h3>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Tipo do Evento *</label>
                <select
                  required
                  value={tipoEvento}
                  onChange={(e) => setTipoEvento(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none"
                >
                  <option value="Casamento">Casamento</option>
                  <option value="Aniversário 15 anos">Aniversário 15 anos</option>
                  <option value="Confraternização">Confraternização</option>
                  <option value="Boda de Prata/Ouro">Boda de Prata/Ouro</option>
                  <option value="Aniversário Infantil">Aniversário Infantil</option>
                  <option value="Formatura Universitária">Formatura Universitária</option>
                  <option value="Conferência / Corporativo">Conferência / Corporativo</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Intervalo de Horário *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 14:00 - 22:00"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Quantidade de Convidados Estimada *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="350"
                  value={qtdConvidados}
                  onChange={(e) => setQtdConvidados(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Observações ou Solicitações Extras</label>
                <textarea
                  placeholder="Ex: Preciso de buffet vegetariano, indicação de som e iluminação."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium rounded-xl focus:outline-none"
                ></textarea>
              </div>

              {/* Step 3: Client Details */}
              <div className="md:col-span-2 border-b border-slate-100 dark:border-slate-850 pb-2 pt-4">
                <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest flex items-center gap-1.5 leading-none">
                  <FileText className="w-4 h-4" /> 3. Dados do Cliente Contratante
                </h3>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dr. Clécio Ferreira Corretor"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5 font-mono">CPF ou CNPJ Contratante *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">WhatsApp / Celular com DDD *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: (11) 99123-4567"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none font-mono"
                />
              </div>

              <div className="md:col-span-2 col-span-1">
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">E-mail para faturamento e contrato *</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: cleciodf.corretor@outlook.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none"
                />
              </div>

              {/* Submit CTA */}
              <div className="md:col-span-2 pt-6 border-t border-slate-100 dark:border-slate-850">
                <button
                  type="submit"
                  disabled={dateStatus === 'busy'}
                  className={`w-full py-4 text-xs font-black uppercase text-center rounded-2xl transition shadow-lg tracking-widest cursor-pointer ${
                    dateStatus === 'busy'
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-450 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                  }`}
                >
                  Concluir Pré-Reserva & Gerar Pix do Sinal
                </button>
              </div>

            </form>

            {/* Footer Institutional info */}
            <div className="text-center space-y-1 pt-4">
              <p className="text-[10px] text-slate-400 font-extrabold">ESPAÇO TROPICAL CORPORATE SYSTEMS</p>
              <p className="text-[9px] text-slate-405 leading-relaxed max-w-sm mx-auto">Ambiente auditado de locação online. Ao agendar seus termos, você concorda com as cláusulas regulamentares do sinal de entrada.</p>
            </div>

          </div>
        )}

        {/* VIEW 2: INSTANT PIX PAYMENT CHECKOUT */}
        {viewState === 'checkout' && createdBooking && (
          <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6 animate-scale-up font-sans text-center relative">
            
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-100 dark:border-indigo-900/30">
              <QrCode className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Reserva Salva! Aguardando Sinal
              </h2>
              <p className="text-[11px] text-slate-400 leading-normal max-w-xs mx-auto">
                Efetue o pagamento imediato do Pix de arras para confirmar de forma automática o bloqueio da data no calendário oficial.
              </p>
            </div>

            {/* Invoice summary info */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 space-y-2.5 text-xs text-left">
              <div className="flex justify-between items-center text-slate-500">
                <span>Espaço Escolhido:</span>
                <strong className="text-slate-800 dark:text-white font-bold">Espaço Tropical</strong>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Data Reservada:</span>
                <strong className="text-indigo-650 dark:text-indigo-400 font-bold font-mono">
                  {dataEvento.split('-').reverse().join('/')}
                </strong>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Evento:</span>
                <strong className="text-slate-850 dark:text-slate-300">{createdBooking.tipoEvento}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-500 border-t border-slate-150 dark:border-slate-800/60 pt-2 text-md">
                <span className="font-extrabold text-slate-800 dark:text-slate-200">SINAL DE ENTRADA (30%):</span>
                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                  R$ {createdBooking.valorSinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 leading-none">
                <span>Valor Total de Locação:</span>
                <span>R$ {createdBooking.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Simulated QR block layout */}
            <div className="w-40 h-40 bg-slate-50 dark:bg-slate-950 p-2 border border-slate-150 dark:border-slate-800 rounded-2xl mx-auto flex items-center justify-center relative shadow-inner">
              <div className="absolute inset-0 bg-indigo-50/10 backdrop-blur-[0.5px] flex justify-center items-center rounded-2xl">
                <div className="w-32 h-32 grid grid-cols-8 gap-0.5 overflow-hidden p-0.5 opacity-60">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-3 rounded-sm ${
                        (i * i) % 3 === 0 ? 'bg-indigo-605' : (i + i + 1) % 5 === 0 ? 'bg-slate-900' : 'bg-transparent'
                      }`}
                    ></div>
                  ))}
                </div>
              </div>
              <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl p-1 shadow border border-slate-50 dark:border-slate-800 z-10 flex items-center justify-center font-black text-[9px] text-indigo-600 dark:text-indigo-400">
                PIX
              </div>
            </div>

            {/* Code copy-paste action */}
            <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl">
              <span className="text-[9px] text-slate-450 font-mono truncate flex-1 block">
                {pixPayload}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pixPayload);
                  setPixCopied(true);
                  setTimeout(() => setPixCopied(false), 2000);
                }}
                className="p-1.5 px-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 hover:bg-indigo-100 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer flex-shrink-0"
              >
                {pixCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Pix</span>
                  </>
                )}
              </button>
            </div>

            {/* Reconciliation countdown simulation */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0 mt-0.5" />
              <div className="text-left leading-normal text-[11px]">
                <p className="font-extrabold text-amber-800 dark:text-amber-400">Guardando comprovante de depósito...</p>
                <p className="text-slate-450 mt-1">Nossa integração bancária conciliará seu pagamento em até <strong>{countdown} segundos</strong>.</p>
              </div>
            </div>

            {/* Test Manual Confirmation trigger */}
            <button
              onClick={handleCompletePayment}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
            >
              Confirmar Pagamento Imediato (Simulador)
            </button>

          </div>
        )}

        {/* VIEW 3: EVENT AGENDADO SUCCESS RECEIPTS */}
        {viewState === 'success' && createdBooking && (
          <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6 animate-scale-up font-sans text-center relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>

            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-lg shadow-emerald-500/15 animate-bounce">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Reserva Confirmada Oficialmente!
              </h2>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold leading-normal max-w-xs mx-auto uppercase tracking-wide">
                Seu evento no Espaço Tropical está oficialmente agendado.
              </p>
            </div>

            {/* Interactive receipt detailing key components */}
            <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-3.5 text-xs text-left">
              <div className="text-center font-bold text-[10px] uppercase text-indigo-600 dark:text-indigo-400 tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2">
                Recibo de Quitação de Sinal (Arras)
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Código do Registro:</span>
                <strong className="font-mono text-[9px] text-slate-800 dark:text-white">{createdBooking.id}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Espaço de Eventos:</span>
                <strong className="text-slate-800 dark:text-slate-200">Espaço Tropical</strong>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Data do Evento:</span>
                <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                  {dataEvento.split('-').reverse().join('/')}
                </strong>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Contratante / Gestor:</span>
                <strong className="text-slate-800 dark:text-white font-bold">{nome}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Tipo de Cerimônia:</span>
                <strong className="text-slate-800 dark:text-slate-350">{createdBooking.tipoEvento}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <span>Sinal Pago via PIX:</span>
                <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-black">
                  R$ {createdBooking.valorSinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Status da Diária:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-extrabold uppercase text-[8px] leading-none border border-emerald-500/10">
                  Confirmado e Pago
                </span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl text-[9px] font-mono border border-slate-150 dark:border-slate-800 text-slate-400 leading-normal tracking-wide">
              GERADO POR: BACEN_AUTO_RECONCILED_{createdBooking.id} <br/>
              AUTENTICAÇÃO: {Date.now().toString().slice(-8)}
            </div>

            {/* Quick action buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="w-full py-2.5 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
              >
                Imprimir Recibo de Agendamento
              </button>
              
              <button
                onClick={() => {
                  // Reset view
                  setNome('');
                  setCpf('');
                  setEmail('');
                  setTelefone('');
                  setDataEvento('');
                  setObservacoes('');
                  setViewState('form');
                  setDateStatus('idle');
                  loadExistingData();
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
              >
                Fazer Novo Agendamento
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
