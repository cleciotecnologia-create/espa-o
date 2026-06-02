/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getReservas, getClientes, getEspacos, saveReserva, deleteReserva, saveCliente, savePagamento, addActivityLog } from '../services/db';
import { Reserva, Cliente, Espaco, StatusReserva } from '../types';
import { formatCPFOrCNPJ, formatPhone } from '../services/validation';
import { 
  triggerBookingConfirmation,
  triggerBookingCancellation,
  triggerEventReminder,
  triggerPaymentNotification
} from '../services/notifications';
import { 
  FileSpreadsheet, 
  Search, 
  Trash, 
  Edit, 
  Plus, 
  QrCode, 
  FileText, 
  Eye, 
  Clock, 
  X, 
  MapPin, 
  AlertTriangle,
  ChevronDown,
  Bell,
  Check,
  Copy,
  Loader2,
  ShieldCheck,
  Share2,
  RefreshCw
} from 'lucide-react';

interface BookingsViewProps {
  onNavigateToView: (view: string, itemId?: string) => void;
  focusedBookingId?: string | null;
}

export default function BookingsView({ onNavigateToView, focusedBookingId }: BookingsViewProps) {
  const [bookings, setBookings] = useState<Reserva[]>([]);
  const [copiedBookingId, setCopiedBookingId] = useState<string | null>(null);

  const handleCopyClientLink = (bookingId: string) => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const link = `${origin}${pathname}#reserva?booking=${bookingId}`;
    navigator.clipboard.writeText(link);
    setCopiedBookingId(bookingId);
    setTimeout(() => setCopiedBookingId(null), 2000);
  };
  const [clients, setClients] = useState<Cliente[]>([]);
  const [spaces, setSpaces] = useState<Espaco[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters and Query
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [spaceFilter, setSpaceFilter] = useState<string>('all');

  // Form edit modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Reserva | null>(null);

  // Instant PIX Payment Modal after booking creation
  const [showPixInstantModal, setShowPixInstantModal] = useState(false);
  const [createdBookingForPix, setCreatedBookingForPix] = useState<Reserva | null>(null);
  const [pixModalCopiaCola, setPixModalCopiaCola] = useState('');
  const [pixModalCopied, setPixModalCopied] = useState(false);
  const [pixModalStatus, setPixModalStatus] = useState<'idle' | 'waiting' | 'confirmed'>('idle');
  const [pixModalCountdown, setPixModalCountdown] = useState(5);

  // Form inputs
  const [clientId, setClientId] = useState('');
  const [registerNewClientOnFly, setRegisterNewClientOnFly] = useState(false);
  const [newClientNome, setNewClientNome] = useState('');
  const [newClientCPF, setNewClientCPF] = useState('');
  const [newClientTelefone, setNewClientTelefone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [tipoEvento, setTipoEvento] = useState('Casamento');
  const [dataEvento, setDataEvento] = useState('');
  const [horario, setHorario] = useState('08:00 - 18:00');
  const [qtdConvidados, setQtdConvidados] = useState(80);
  const [taxaLimpeza, setTaxaLimpeza] = useState(0);
  const [valorTotal, setValorTotal] = useState(0);
  const [valorSinal, setValorSinal] = useState(0);
  const [status, setStatus] = useState<StatusReserva>('Orçamento');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    loadAllBookings();
    window.addEventListener('es-database-updated', loadAllBookings);
    return () => {
      window.removeEventListener('es-database-updated', loadAllBookings);
    };
  }, [focusedBookingId]);

  // Adjust form total valuations upon space select, event type, or date
  useEffect(() => {
    if (spaceId && !editingBooking) {
      const sp = spaces.find(s => s.id === spaceId);
      if (sp) {
        const fee = sp.taxaLimpeza !== undefined ? sp.taxaLimpeza : 50;
        setTaxaLimpeza(fee);

        let baseRent = sp.valorLocacao;
        const evLower = (tipoEvento || '').toLowerCase();
        const isWeddingOrDebutante = 
          evLower.includes('casamento') || 
          evLower.includes('debutante') || 
          evLower.includes('15 anos') || 
          evLower.includes('boda');

        if (isWeddingOrDebutante) {
          baseRent = 800;
        } else if (sp.id === 'espaco_1' || sp.nome?.includes('Tropical')) {
          if (dataEvento) {
            const d = new Date(dataEvento + "T12:00:00");
            const day = d.getDay(); // 0 = Sunday, 6 = Saturday
            const isWeekend = day === 0 || day === 6;
            baseRent = isWeekend ? 450 : 400;
          } else {
            baseRent = 450;
          }
        }

        const pct = sp.porcentagemSinal !== undefined ? sp.porcentagemSinal : 50;
        setValorTotal(baseRent + fee);
        setValorSinal(Math.round((baseRent + fee) * (pct / 100)));
      }
    }
  }, [spaceId, tipoEvento, dataEvento, spaces, editingBooking]);

  const handleTaxaLimpezaChange = (val: number) => {
    setTaxaLimpeza(val);
    const sp = spaces.find(s => s.id === spaceId);
    if (sp) {
      let baseRent = sp.valorLocacao;
      const evLower = (tipoEvento || '').toLowerCase();
      const isWeddingOrDebutante = 
        evLower.includes('casamento') || 
        evLower.includes('debutante') || 
        evLower.includes('15 anos') || 
        evLower.includes('boda');

      if (isWeddingOrDebutante) {
        baseRent = 800;
      } else if (sp.id === 'espaco_1' || sp.nome?.includes('Tropical')) {
        if (dataEvento) {
          const d = new Date(dataEvento + "T12:00:00");
          const day = d.getDay(); // 0 = Sunday, 6 = Saturday
          const isWeekend = day === 0 || day === 6;
          baseRent = isWeekend ? 450 : 400;
        } else {
          baseRent = 450;
        }
      }

      const pct = sp.porcentagemSinal !== undefined ? sp.porcentagemSinal : 50;
      setValorTotal(baseRent + val);
      setValorSinal(Math.round((baseRent + val) * (pct / 100)));
    }
  };

  // Countdown timer effect for immediate PIX simulation
  useEffect(() => {
    let timer: any;
    if (showPixInstantModal && pixModalStatus === 'waiting') {
      if (pixModalCountdown > 0) {
        timer = setTimeout(() => {
          setPixModalCountdown(prev => prev - 1);
        }, 1000);
      }
    }
    return () => clearTimeout(timer);
  }, [showPixInstantModal, pixModalStatus, pixModalCountdown]);

  const triggerPixModalForBooking = (booking: Reserva) => {
    const amount = booking.valorSinal || Math.round(booking.valorTotal * 0.3);
    const savedKey = localStorage.getItem('cfg_pix_key') || '42.183.904/0001-82';
    const savedName = localStorage.getItem('cfg_pix_name') || 'Holding EventSpace Administradora LTDA';
    const savedCity = localStorage.getItem('cfg_pix_city') || 'SAO PAULO';

    let cleanKey = savedKey.trim();
    // For CPF/CNPJ or pure numeric phone keys, remove non-digits for banking compatibility
    const digitsOnly = cleanKey.replace(/\D/g, '');
    if (digitsOnly.length === 11 || digitsOnly.length === 14 || (digitsOnly.length >= 10 && digitsOnly.length <= 13 && (cleanKey.startsWith('+') || !isNaN(Number(cleanKey.replace(/[+\s-]/g, '')))))) {
      cleanKey = digitsOnly;
    } else {
      cleanKey = cleanKey.replace(/[^a-zA-Z0-9@.-]/g, '');
    }

    const cleanName = savedName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 25).toUpperCase();
    const cleanCity = savedCity.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 15).toUpperCase();

    const pix_info = `0014br.gov.bcb.pix01${cleanKey.length.toString().padStart(2, '0')}${cleanKey}`;
    const merchant_info = `26${pix_info.length.toString().padStart(2, '0')}${pix_info}`;
    const amString = amount.toFixed(2);
    const amount_info = `54${amString.length.toString().padStart(2, '0')}${amString}`;
    
    const randTxSuffix = Math.floor(100 + Math.random() * 900).toString(); // 3-digit random
    const payloadStart = `000201010212${merchant_info}520400005303986${amount_info}5802BR` +
      `59${cleanName.length.toString().padStart(2, '0')}${cleanName}` +
      `60${cleanCity.length.toString().padStart(2, '0')}${cleanCity}` +
      `62070503${randTxSuffix}6304`;

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

    setPixModalCopiaCola(key);
    setCreatedBookingForPix(booking);
    setPixModalStatus('waiting');
    setPixModalCountdown(60);
    setShowPixInstantModal(true);
  };

  const handleConfirmPixModalPayment = async () => {
    if (!createdBookingForPix) return;
    try {
      const amount = createdBookingForPix.valorSinal || Math.round(createdBookingForPix.valorTotal * 0.3);
      const targetClient = clients.find(c => c.id === createdBookingForPix.clienteId);

      // Create a confirmed payment record
      await savePagamento({
        reservaId: createdBookingForPix.id,
        valor: amount,
        formaPagamento: 'PIX',
        status: 'Confirmado',
        dataPagamento: new Date().toISOString().substring(0, 10)
      });

      // Update reservation status to "Confirmado"
      const updatedBooking: Reserva = {
        ...createdBookingForPix,
        status: 'Confirmado'
      };
      await saveReserva(updatedBooking);

      // Log success
      await addActivityLog(
        "Pix Expresso Liquidado",
        `Pagamento instantâneo de sinal R$ ${amount} confirmado para '${targetClient?.nome || 'Cliente'}' via Pix Expresso.`
      );

      // Send payment notification
      if (targetClient) {
        const mockPayRecord = {
          id: "pay_pix_" + Date.now(),
          reservaId: createdBookingForPix.id,
          valor: amount,
          formaPagamento: 'PIX' as const,
          status: 'Confirmado' as const,
          dataPagamento: new Date().toISOString().substring(0, 10)
        };
        await triggerPaymentNotification(updatedBooking, targetClient, mockPayRecord, true);
      }

      setPixModalStatus('confirmed');
      loadAllBookings();
    } catch (e) {
      console.error("Erro ao compensar pagamento do Pix expresso:", e);
    }
  };

  const loadAllBookings = async () => {
    try {
      setLoading(true);
      const bks = await getReservas();
      const clis = await getClientes();
      const sps = await getEspacos();
      setBookings(bks);
      setClients(clis);
      setSpaces(sps);

      // If redirected with a specific Booking focused (e.g. from search)
      if (focusedBookingId) {
        const found = bks.find(b => b.id === focusedBookingId);
        if (found) {
          setSearchQuery(found.tipoEvento);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingBooking(null);
    setClientId(clients[0]?.id || '');
    setSpaceId(spaces[0]?.id || '');
    setTipoEvento('Casamento');
    const today = new Date().toISOString().split('T')[0];
    setDataEvento(today);
    setHorario('08:00 - 18:00');
    setQtdConvidados(80);
    setTaxaLimpeza(0);
    setStatus('Orçamento');
    setObservacoes('');
    setRegisterNewClientOnFly(false);
    setNewClientNome('');
    setNewClientCPF('');
    setNewClientTelefone('');
    setNewClientEmail('');
    setShowFormModal(true);
  };

  const handleOpenEditModal = (b: Reserva) => {
    setEditingBooking(b);
    setClientId(b.clienteId);
    setSpaceId(b.espacoId);
    setTipoEvento(b.tipoEvento);
    setDataEvento(b.dataEvento);
    setHorario(b.horario);
    setQtdConvidados(b.qtdConvidados);
    setTaxaLimpeza(b.taxaLimpeza !== undefined ? b.taxaLimpeza : 0);
    setValorTotal(b.valorTotal);
    setValorSinal(b.valorSinal);
    setStatus(b.status);
    setObservacoes(b.observacoes || '');
    setRegisterNewClientOnFly(false);
    setNewClientNome('');
    setNewClientCPF('');
    setNewClientTelefone('');
    setNewClientEmail('');
    setShowFormModal(true);
  };

  const handleDelete = async (id: string, eventName: string) => {
    if (confirm(`Tem certeza que deseja desmarcar a reserva "${eventName}"? Este processo é definitivo.`)) {
      try {
        await deleteReserva(id);
        loadAllBookings();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSaveFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let targetClientId = clientId;

    if (registerNewClientOnFly && !editingBooking) {
      if (!newClientNome.trim() || !newClientCPF.trim() || !newClientTelefone.trim() || !newClientEmail.trim()) {
        alert("Preencha todos os dados obrigatórios do novo cliente!");
        return;
      }
      try {
        const cleanCPF = newClientCPF.replace(/\D/g, "");
        if (cleanCPF.length !== 11 && cleanCPF.length !== 14) {
          alert("O documento CPF/CNPJ informado é inválido. Por favor, verifique.");
          return;
        }
        const generatedClientId = await saveCliente({
          nome: newClientNome,
          cpf: newClientCPF,
          telefone: newClientTelefone,
          email: newClientEmail,
          whatsapp: newClientTelefone,
          endereco: '',
          observacoes: 'Cadastrado automaticamente via Ficha de Reserva na agenda'
        });
        targetClientId = generatedClientId;
      } catch (err: any) {
        alert("Erro ao cadastrar novo cliente de forma expressa: " + err.message);
        return;
      }
    }

    if (!targetClientId || !spaceId || !tipoEvento || !dataEvento) {
      alert("Todos os campos sinalizados com * são obrigatórios.");
      return;
    }

    const payload: Omit<Reserva, 'id' | 'createdAt'> & { id?: string } = {
      clienteId: targetClientId,
      espacoId: spaceId,
      tipoEvento,
      dataEvento,
      horario,
      qtdConvidados: Number(qtdConvidados),
      valorTotal: Number(valorTotal),
      valorSinal: Number(valorSinal),
      status,
      observacoes,
      taxaLimpeza: Number(taxaLimpeza)
    };

    if (editingBooking) {
      payload.id = editingBooking.id;
    }

    try {
      const savedId = await saveReserva(payload);
      setShowFormModal(false);
      loadAllBookings();

      // Trigger automated notification dispatches
      const targetClient = clients.find(c => c.id === targetClientId);
      const targetSpace = spaces.find(s => s.id === spaceId);
      if (targetClient && targetSpace) {
        const fullReserva: Reserva = {
          id: savedId,
          clienteId: targetClientId,
          espacoId: spaceId,
          tipoEvento,
          dataEvento,
          horario,
          qtdConvidados: Number(qtdConvidados),
          valorTotal: Number(valorTotal),
          valorSinal: Number(valorSinal),
          status,
          observacoes,
          createdAt: editingBooking ? editingBooking.createdAt : new Date().toISOString(),
          taxaLimpeza: Number(taxaLimpeza)
        };

        if (!editingBooking) {
          // Send instant confirmation alert to guest + alerts administrators
          await triggerBookingConfirmation(fullReserva, targetClient, targetSpace);
          // Show the instant PIX payment modal right away!
          triggerPixModalForBooking(fullReserva);
        } else if (status === 'Cancelado' && editingBooking.status !== 'Cancelado') {
          // Send automatic cancellation notice
          await triggerBookingCancellation(fullReserva, targetClient, targetSpace);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter listings
  const filteredBookings = bookings.filter(b => {
    const client = clients.find(c => c.id === b.clienteId);
    const space = spaces.find(s => s.id === b.espacoId);
    
    // Quick search
    const matchesSearch = 
      b.tipoEvento.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client?.nome || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (space?.nome || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesSpace = spaceFilter === 'all' || b.espacoId === spaceFilter;

    return matchesSearch && matchesStatus && matchesSpace;
  });

  const getStatusStyle = (st: StatusReserva) => {
    switch (st) {
      case 'Confirmado':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400 border-violet-200';
      case 'Realizado':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-250';
      case 'Aguardando sinal':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-250';
      case 'Orçamento':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-400 border-cyan-200';
      case 'Cancelado':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-450 border-rose-200 opacity-70';
    }
  };

  const getStatusTooltip = (bStatus: StatusReserva) => {
    switch (bStatus) {
      case 'Orçamento':
        return 'Orçamento: Evento pré-agendado provisoriamente. O horário não está garantido de forma definitiva até o sinal.';
      case 'Aguardando sinal':
        return 'Aguardando Sinal: Proposta aceita, aguardando o pagamento de sinal (geralmente 50% ou 30%) para confirmação.';
      case 'Confirmado':
        return 'Confirmado: Sinal recebido com sucesso. Reserva ativa, data bloqueada no calendário e contrato em vigor.';
      case 'Realizado':
        return 'Realizado: O evento ocorreu e as chaves/espaço foram desocupados de forma bem-sucedida.';
      case 'Cancelado':
        return 'Cancelado: Reserva cancelada e data correspondente liberada no calendário para novos agendamentos.';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-none">Gestão de Reservas</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2">Emissão de contratos, controle financeiro de adiantamento de sinal e vistorias de ocupação.</p>
        </div>
        <button
          id="btn-add-booking"
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-750 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md cursor-pointer transition-all hover:scale-101"
        >
          <Plus className="w-4 h-4" />
          <span>Lançar Reserva</span>
        </button>
      </div>

      {/* Advanced search filters */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center">
        
        {/* Search Input text */}
        <div className="relative flex-1 w-full">
          <label htmlFor="bookings-search-input" className="sr-only">Buscar reserva</label>
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-405">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="bookings-search-input"
            type="text"
            placeholder="Pesquisar por evento, cliente ou espaço..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-800 text-xs font-semibold rounded-xl bg-gray-50 dark:bg-slate-850 text-gray-900 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex gap-3 w-full md:w-auto items-center">
          <div>
            <label htmlFor="filter-status-select" className="sr-only">Filtrar por status</label>
            <select
              id="filter-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-2 border border-gray-200 dark:border-slate-800 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 text-gray-805 dark:text-zinc-300"
            >
              <option value="all">Status: Todos</option>
              <option value="Orçamento">Orçamento</option>
              <option value="Aguardando sinal">Aguardando sinal</option>
              <option value="Confirmado">Confirmado</option>
              <option value="Realizado">Realizado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-space-select" className="sr-only">Filtrar por espaço</label>
            <select
              id="filter-space-select"
              value={spaceFilter}
              onChange={(e) => setSpaceFilter(e.target.value)}
              className="px-2.5 py-2 border border-gray-200 dark:border-slate-800 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 text-gray-805 dark:text-zinc-300"
            >
              <option value="all">Espaço: Todos</option>
              {spaces.map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {loading ? (
        <div className="text-center py-24 text-gray-500">
          <FileSpreadsheet className="w-8 h-8 animate-pulse mx-auto mb-2 text-indigo-505" />
          Buscando registros cadastrados de reservas...
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 rounded-xl p-16 text-center max-w-sm mx-auto">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-xs text-gray-500">Nenhum agendamento de contrato atende às restrições predefinidas.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 rounded-xl shadow-sm overflow-x-auto">
          
          <table id="bookings-ledger-table" className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800/80 text-[10px] uppercase font-mono text-gray-400 select-none bg-slate-50 dark:bg-slate-950/20">
                <th className="py-3 px-5 font-bold">Cliente</th>
                <th className="py-3 px-5 font-bold">Espaço Alocado</th>
                <th className="py-3 px-5 font-bold">Evento / Data</th>
                <th className="py-3 px-4 font-bold">Horário</th>
                <th className="py-3 px-4 font-bold">Convidados</th>
                <th className="py-3 px-4 font-bold">Valores (Total / Sinal)</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-5 font-bold text-center">Faturamento & Contratos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 text-xs">
              {filteredBookings.map((b) => {
                const client = clients.find(c => c.id === b.clienteId);
                const space = spaces.find(s => s.id === b.espacoId);
                
                return (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/40 transition">
                    
                    {/* Cliente */}
                    <td className="py-4 px-5">
                      <p className="font-bold text-gray-900 dark:text-zinc-100 leading-tight">{client?.nome || 'Não encontrado'}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">CPF: {client?.cpf || '000.000.000-00'}</p>
                    </td>

                    {/* Espaco */}
                    <td className="py-4 px-5 font-semibold text-gray-850 dark:text-zinc-200">
                      {space?.nome || 'Espaço indefinido'}
                    </td>

                    {/* Data Evento */}
                    <td className="py-4 px-5">
                      <p className="font-bold text-gray-900 dark:text-zinc-100">{b.tipoEvento}</p>
                      <p className="text-[10px] text-indigo-500 font-mono mt-0.5">
                        {new Date(b.dataEvento + "T00:00:00").toLocaleDateString('pt-BR', { dateStyle: 'long' })}
                      </p>
                    </td>

                    {/* Horario */}
                    <td className="py-4 px-4 font-semibold text-gray-700 dark:text-zinc-350">
                      {b.horario}
                    </td>

                    {/* Convidados */}
                    <td className="py-4 px-4 font-bold text-gray-800 dark:text-zinc-300 font-mono">
                      {b.qtdConvidados}
                    </td>

                    {/* Valores */}
                    <td className="py-4 px-4">
                      <p className="font-bold text-indigo-650 dark:text-indigo-400 font-mono">Total: R$ {b.valorTotal.toLocaleString('pt-BR')}</p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 font-mono">Sinal: R$ {b.valorSinal.toLocaleString('pt-BR')}</p>
                      {b.taxaLimpeza !== undefined && b.taxaLimpeza > 0 && (
                        <p className="text-[9px] text-amber-500 font-medium mt-0.5 font-mono">Limpeza: R$ {b.taxaLimpeza.toLocaleString('pt-BR')}</p>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-4">
                      <span 
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border cursor-help hover:opacity-90 transition-opacity ${getStatusStyle(b.status)}`}
                        title={getStatusTooltip(b.status)}
                      >
                        {b.status}
                      </span>
                    </td>

                    {/* Operations shortcut links */}
                    <td className="py-4 px-5">
                      <div className="flex items-center justify-center gap-2">
                        {/* Interactive PIX action shortcut */}
                        <button
                          id={`btn-action-pix-${b.id}`}
                          onClick={() => onNavigateToView('pix', b.id)}
                          className="p-1 px-2.5 bg-amber-500/10 hover:bg-amber-500 hover:text-white rounded-lg text-amber-600 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                          title="Cobrar via PIX Gateway"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>PIX</span>
                        </button>

                        {/* Interactive Contract action shortcut */}
                        <button
                          id={`btn-action-contract-${b.id}`}
                          onClick={() => onNavigateToView('contracts', b.id)}
                          className="p-1 px-2.5 bg-indigo-500/10 hover:bg-indigo-600 hover:text-white rounded-lg text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                          title="Faturar Contrato PDF"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Contrato</span>
                        </button>

                        {/* Interactive Copy Client Link shortcut */}
                        <button
                          id={`btn-copy-client-link-${b.id}`}
                          onClick={() => handleCopyClientLink(b.id)}
                          className={`p-1 px-2.5 rounded-lg font-bold text-[10px] flex items-center gap-1 transition cursor-pointer ${
                            copiedBookingId === b.id 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white'
                          }`}
                          title="Copiar Link para Cliente Acessar Ficha"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>{copiedBookingId === b.id ? 'Copiado!' : 'Link Cliente'}</span>
                        </button>

                        {/* Interactive Manual Reminder trigger */}
                        <button
                          id={`btn-manual-reminder-${b.id}`}
                          onClick={async () => {
                            if (client && space) {
                              try {
                                await triggerEventReminder(b, client, space);
                                alert(`Lembrete de evento enviado com sucesso via e-mail e SMS para ${client.nome}!`);
                              } catch (err: any) {
                                alert(`Falha ao disparar lembrete: ${err.message}`);
                              }
                            } else {
                              alert("Cliente ou espaço correspondente não pôde ser carregado.");
                            }
                          }}
                          className="p-1 px-2.5 bg-rose-500/10 hover:bg-rose-600 hover:text-white rounded-lg text-rose-600 dark:text-rose-450 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                          title="Enviar Lembrete Automático"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>Lembrete</span>
                        </button>

                        {/* Standard edit */}
                        <button
                          id={`btn-edit-booking-${b.id}`}
                          onClick={() => handleOpenEditModal(b)}
                          className="p-1.5 bg-gray-50 dark:bg-slate-800 hover:text-indigo-500 rounded-lg text-gray-500 hover:bg-indigo-500/10 transition cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* Standard trash */}
                        <button
                          id={`btn-delete-booking-${b.id}`}
                          onClick={() => handleDelete(b.id, b.tipoEvento)}
                          className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:text-red-500 rounded-lg text-gray-500 hover:bg-red-500/10 transition cursor-pointer"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>

        </div>
      )}

      {/* Insert / Edit Booking modal UI form */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-250 dark:border-slate-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-md font-bold text-gray-905 dark:text-white">
                {editingBooking ? "Configurar Detalhes de locação" : "Lançar Nova Ficha de Reserva"}
              </h3>
              <button 
                onClick={() => setShowFormModal(false)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 hover:bg-gray-100 dark:hover:bg-slate-800 roundedLg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFormSubmit} className="space-y-4 mt-4 text-xs font-sans">
              
              {/* Select or Register Client (Requisito: se cadastrar reserva, já cadastra em clientes corporativos) */}
              <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-gray-150 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-gray-700 dark:text-zinc-300 uppercase leading-none">Cliente Contratante *</label>
                  {!editingBooking && (
                    <label className="flex items-center gap-1.5 text-[10px] font-extrabold text-indigo-650 dark:text-indigo-400 select-none cursor-pointer leading-none">
                      <input
                        type="checkbox"
                        checked={registerNewClientOnFly}
                        onChange={(e) => setRegisterNewClientOnFly(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                      />
                      <span>Cadastrar Novo Cliente</span>
                    </label>
                  )}
                </div>

                {!registerNewClientOnFly ? (
                  <select
                    required
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-zinc-250 focus:outline-none"
                  >
                    <option value="">-- Selecione o cliente existente --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.nome} (CPF/CNPJ: {c.cpf})</option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-3 pt-2.5 border-t border-gray-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 tracking-wider uppercase mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        required={registerNewClientOnFly}
                        placeholder="Ex: Clécio Ferreira Corretor"
                        value={newClientNome}
                        onChange={(e) => setNewClientNome(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 tracking-wider uppercase mb-1">Documento (CPF ou CNPJ) *</label>
                      <input
                        type="text"
                        required={registerNewClientOnFly}
                        placeholder="Ex: 000.000.000-00"
                        value={newClientCPF}
                        onChange={(e) => setNewClientCPF(formatCPFOrCNPJ(e.target.value))}
                        className="w-full px-3.5 py-2 text-xs rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 tracking-wider uppercase mb-1">WhatsApp / Celular *</label>
                      <input
                        type="text"
                        required={registerNewClientOnFly}
                        placeholder="Ex: (11) 99321-0012"
                        value={newClientTelefone}
                        onChange={(e) => setNewClientTelefone(formatPhone(e.target.value))}
                        className="w-full px-3.5 py-2 text-xs rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-955 dark:text-white font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 tracking-wider uppercase mb-1">E-mail Corporativo / Faturamento *</label>
                      <input
                        type="email"
                        required={registerNewClientOnFly}
                        placeholder="Ex: clecio.corretor@outlook.com"
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Select Space */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Espaço Recomendado *</label>
                <select
                  required
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-zinc-250' focus:outline-none"
                >
                  <option value="">-- Selecione o espaço físico --</option>
                  {spaces.map(s => (
                    <option key={s.id} value={s.id}>{s.nome} (Valor base: R$ {s.valorLocacao.toLocaleString('pt-BR')})</option>
                  ))}
                </select>
              </div>

              {/* Event Type & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Título do Evento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Casamento Camila & Tom"
                    value={tipoEvento}
                    onChange={(e) => setTipoEvento(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Data Agendada *</label>
                  <input
                    type="date"
                    required
                    value={dataEvento}
                    onChange={(e) => setDataEvento(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Times & Guests */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Faixa de Horário *</label>
                  <input
                    type="text"
                    required
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1 flex justify-between items-center">
                    <span>Quantidade de Convidados *</span>
                    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-extrabold font-sans">No máx. 80</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={80}
                    value={qtdConvidados}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val > 80) {
                        setQtdConvidados(80);
                      } else {
                        setQtdConvidados(val);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white"
                  />
                </div>
              </div>

              {/* Billings inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950/20 p-3 rounded-lg border border-dashed border-gray-205 dark:border-slate-800/80">
                <div>
                  <label className="block text-[10px] font-bold text-teal-600 dark:text-teal-450 mb-1">Locação Base (R$)</label>
                  <input
                    type="number"
                    disabled
                    value={spaces.find(s => s.id === spaceId)?.valorLocacao || 0}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-100 dark:bg-slate-900 text-gray-400 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-600 dark:text-amber-550 mb-1">Limpeza (R$) *</label>
                  <input
                    type="number"
                    required
                    value={taxaLimpeza}
                    onChange={(e) => handleTaxaLimpezaChange(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-amber-200 bg-white dark:bg-slate-850 text-gray-950 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-indigo-650 dark:text-indigo-400 mb-1">Total Geral (R$) *</label>
                  <input
                    type="number"
                    required
                    value={valorTotal}
                    onChange={(e) => setValorTotal(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-indigo-200 bg-white dark:bg-slate-850 text-gray-950 dark:text-white font-mono"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">Sinal de Entrada (Adiantamento 30%) *</label>
                  <input
                    type="number"
                    required
                    value={valorSinal}
                    onChange={(e) => setValorSinal(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-emerald-200 bg-white dark:bg-slate-850 text-gray-955 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-705 dark:text-zinc-300 uppercase mb-1">Status da Etapa *</label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-zinc-200 focus:outline-none"
                >
                  <option value="Orçamento" title={getStatusTooltip('Orçamento')}>Orçamento</option>
                  <option value="Aguardando sinal" title={getStatusTooltip('Aguardando sinal')}>Aguardando sinal</option>
                  <option value="Confirmado" title={getStatusTooltip('Confirmado')}>Confirmado</option>
                  <option value="Realizado" title={getStatusTooltip('Realizado')}>Realizado</option>
                  <option value="Cancelado" title={getStatusTooltip('Cancelado')}>Cancelado</option>
                </select>
                <div className="mt-1.5 p-2 bg-slate-50 dark:bg-slate-950/60 rounded-lg text-[10px] text-zinc-550 dark:text-zinc-400 border border-slate-100 dark:border-slate-850/60 leading-normal font-sans">
                  💡 <span className="font-extrabold capitalize">{status}:</span> {getStatusTooltip(status)}
                </div>
              </div>

              {/* Obs */}
              <div>
                <label className="block text-xs font-bold text-gray-750 dark:text-zinc-300 uppercase mb-5">Instruções de Suporte (Alimentação, montagem etc)</label>
                <textarea
                  rows={2}
                  placeholder="Detone pedidos particulares..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                ></textarea>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-gray-150 dark:border-slate-850 flex justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 text-gray-709 dark:text-zinc-350 border border-gray-100 dark:border-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Lançar Reserva
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* INSTANT PIX PAYMENT MODAL (REQUISITO: quando faz a reserva, gerar pix na hora e pagar) */}
      {showPixInstantModal && createdBookingForPix && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative space-y-6 animate-scale-up">
            
            {/* Close Button Header */}
            <button
              onClick={() => setShowPixInstantModal(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Identity */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-100 dark:border-indigo-900/30">
                <QrCode className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                Ficha de Reserva & PIX Expresso!
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Reserva pré-agendada! Forneça o QR Code ou cópia do PIX para o faturamento imediato de sinal.
              </p>
            </div>

            {/* Quick Details Checkbox */}
            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-500">
                <span>Evento:</span>
                <strong className="text-slate-800 dark:text-white font-bold">{createdBookingForPix.tipoEvento}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Data Escolhida:</span>
                <strong className="text-indigo-660 dark:text-indigo-400 font-mono font-bold">
                  {createdBookingForPix.dataEvento.split('-').reverse().join('/')}
                </strong>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Espaço de Eventos:</span>
                <strong className="text-slate-800 dark:text-slate-200">
                  {spaces.find(s => s.id === createdBookingForPix.espacoId)?.nome || "Selecionado"}
                </strong>
              </div>
              <div className="flex justify-between items-center text-slate-500 border-t border-slate-150 dark:border-slate-800/80 pt-2 text-md">
                <span className="font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide">SINAL DE ENTRADA (30%):</span>
                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                  R$ {(createdBookingForPix.valorSinal || Math.round(createdBookingForPix.valorTotal * 0.3)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span>Valor Total da Reserva:</span>
                <span className="font-mono">R$ {createdBookingForPix.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Main Interactive Screen */}
            {pixModalStatus === 'waiting' ? (
              <div className="space-y-4">
                {/* Visual QR code styled box */}
                <div className="w-40 h-40 bg-white p-2 border border-slate-150 dark:border-slate-800 rounded-2xl mx-auto flex items-center justify-center relative shadow-sm">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(pixModalCopiaCola)}`}
                    alt="QR Code Pix"
                    className="w-36 h-36 object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Copia e cola code copy box */}
                <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-850 border border-slate-150 dark:border-slate-800 rounded-xl max-w-sm mx-auto">
                  <span className="text-[10px] text-slate-400 font-mono truncate flex-1 block">
                    {pixModalCopiaCola}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pixModalCopiaCola);
                      setPixModalCopied(true);
                      setTimeout(() => setPixModalCopied(false), 2000);
                    }}
                    className="p-1.5 px-3 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 rounded-lg text-[10px] font-bold text-indigo-650 dark:text-indigo-400 transition flex items-center gap-1 flex-shrink-0 cursor-pointer"
                  >
                    {pixModalCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-505 font-bold">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar Código</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Regenerate Button */}
                <button
                  type="button"
                  onClick={() => createdBookingForPix && triggerPixModalForBooking(createdBookingForPix)}
                  className="w-full max-w-sm mx-auto py-2 px-3 bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-750 text-indigo-650 dark:text-indigo-400 font-bold text-xs rounded-xl cursor-pointer transition flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Gerar Novo Código (Re-gerar PIX)</span>
                </button>

                 {/* Simulation indicator block */}
                 {pixModalCountdown > 0 ? (
                   <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl max-w-sm mx-auto flex items-start gap-3">
                     <Loader2 className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-spin flex-shrink-0" />
                     <div className="text-left font-sans text-[11px] leading-snug">
                       <p className="font-extrabold text-amber-800 dark:text-amber-450 leading-tight">Conciliando com Banco Central...</p>
                       <p className="text-slate-400 mt-1">Aguardando liquidação simulada. Chave ativa por mais <strong>{pixModalCountdown} segundos</strong>.</p>
                     </div>
                   </div>
                 ) : (
                   <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl max-w-sm mx-auto flex items-start gap-3">
                     <span className="text-red-500 font-bold flex-shrink-0">⚠️</span>
                     <div className="text-left font-sans text-[11px] leading-snug">
                       <p className="font-extrabold text-red-800 dark:text-red-450 leading-tight">Tempo Limite Excedido!</p>
                       <p className="text-slate-400 mt-1">O prazo de conciliação bancária expirou. Clique em "Re-gerar PIX" para obter novo código, ou confirme manualmente abaixo.</p>
                     </div>
                   </div>
                 )}

                {/* Instant confirmation trigger button */}
                <button
                  type="button"
                  onClick={handleConfirmPixModalPayment}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl cursor-pointer transition shadow-md shadow-emerald-500/15"
                >
                  Confirmar Pagamento Manualmente (Simulador)
                </button>
              </div>
            ) : (
              <div className="space-y-4 py-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-55 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-lg shadow-emerald-500/20 animate-bounce">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-901 dark:text-white uppercase tracking-wider leading-none">PIX Compensado com Sucesso!</h4>
                  <p className="text-[11px] text-slate-400 leading-normal max-w-xs mx-auto">O sinal de entrada foi debitado pelo Gateway e a reserva para este evento foi promovida para: <strong className="text-emerald-500">CONFIRMADO</strong>.</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-lg text-[9px] font-mono border border-slate-150 dark:border-slate-800 text-slate-400 tracking-tight leading-none">
                  AUTENTICAÇÃO: BACEN_EXPRESS_AUTO_CONFIRM_{Date.now().toString().slice(-6)}
                </div>

                <button
                  onClick={() => setShowPixInstantModal(false)}
                  className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold text-xs rounded-xl cursor-pointer transition shadow-lg shadow-indigo-600/15"
                >
                  Concluir e Voltar
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
