/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  getReservas, 
  getEspacos, 
  getClientes, 
  saveReserva, 
  deleteReserva,
  savePagamento,
  saveCliente,
  addActivityLog
} from '../services/db';
import { Reserva, Espaco, Cliente, StatusReserva } from '../types';
import { formatCPFOrCNPJ, formatPhone } from '../services/validation';
import { 
  triggerPaymentNotification
} from '../services/notifications';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  Edit, 
  Trash, 
  Calendar, 
  Users, 
  MapPin, 
  Hourglass, 
  CheckCircle, 
  Play, 
  FileCheck,
  Check,
  Copy,
  Loader2,
  ShieldCheck,
  QrCode,
  Download,
  RefreshCw,
  BookOpen,
  FileText,
  Lock
} from 'lucide-react';

interface AgendaViewProps {
  onNavigateToView?: (view: string, itemId?: string) => void;
}

export default function AgendaView({ onNavigateToView }: AgendaViewProps) {
  const [bookings, setBookings] = useState<Reserva[]>([]);
  const [spaces, setSpaces] = useState<Espaco[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter by Space
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('all');

  // Month navigation state
  const [currentDate, setCurrentDate] = useState(new Date());

  // Booking Register/Edit Modal state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDayISO, setSelectedDayISO] = useState('');
  const [editingBooking, setEditingBooking] = useState<Reserva | null>(null);

  // Instant PIX Payment Modal after booking creation
  const [showPixInstantModal, setShowPixInstantModal] = useState(false);
  const [createdBookingForPix, setCreatedBookingForPix] = useState<Reserva | null>(null);
  const [pixModalCopiaCola, setPixModalCopiaCola] = useState('');
  const [pixModalCopied, setPixModalCopied] = useState(false);
  const [pixModalStatus, setPixModalStatus] = useState<'idle' | 'waiting' | 'confirmed'>('idle');
  const [pixModalCountdown, setPixModalCountdown] = useState(5);

  // Inspector Popover for existing bookings
  const [selectedBookingForInspect, setSelectedBookingForInspect] = useState<Reserva | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);

  // Booking form values
  const [formClientId, setFormClientId] = useState('');
  const [registerNewClientOnFly, setRegisterNewClientOnFly] = useState(false);
  const [newClientNome, setNewClientNome] = useState('');
  const [newClientCPF, setNewClientCPF] = useState('');
  const [newClientTelefone, setNewClientTelefone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [formSpaceId, setFormSpaceId] = useState('');
  const [formTipoEvento, setFormTipoEvento] = useState('Casamento');
  const [formHorario, setFormHorario] = useState('08:00 - 18:00');
  const [formQtdConvidados, setFormQtdConvidados] = useState(80);
  const [formValorTotal, setFormValorTotal] = useState(0);
  const [formValorSinal, setFormValorSinal] = useState(0);
  const [formStatus, setFormStatus] = useState<StatusReserva>('Aguardando sinal');
  const [formMotivoBloqueio, setFormMotivoBloqueio] = useState<'Manutenção' | 'Reforma' | 'Uso Pessoal' | 'Férias' | ''>('');
  const [formObservacoes, setFormObservacoes] = useState('');

  // Auto update valorLocacao in reservation form when space or event type is selected
  useEffect(() => {
    if (formSpaceId && !editingBooking) {
      const sp = spaces.find(s => s.id === formSpaceId);
      if (sp) {
        let baseRent = sp.valorLocacao;
        const cleaningFee = sp.taxaLimpeza !== undefined ? sp.taxaLimpeza : 50;

        const evLower = (formTipoEvento || '').toLowerCase();
        const isWeddingOrDebutante = 
          evLower.includes('casamento') || 
          evLower.includes('debutante') || 
          evLower.includes('15 anos') || 
          evLower.includes('boda');

        if (isWeddingOrDebutante) {
          baseRent = 800;
        } else if (sp.id === 'espaco_1' || sp.nome?.includes('Tropical')) {
          // Normal daily rate based on day of week
          if (selectedDayISO) {
            const d = new Date(selectedDayISO + "T12:00:00");
            const day = d.getDay(); // 0 = Sunday, 6 = Saturday
            const isWeekend = day === 0 || day === 6;
            baseRent = isWeekend ? 450 : 400;
          } else {
            baseRent = 450;
          }
        }

        const totalWithFee = baseRent + cleaningFee;
        setFormValorTotal(totalWithFee);
        const pct = sp.porcentagemSinal !== undefined ? sp.porcentagemSinal : 50;
        setFormValorSinal(Math.round(totalWithFee * (pct / 100)));
      }
    }
  }, [formSpaceId, formTipoEvento, selectedDayISO, spaces, editingBooking]);

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
        `Pagamento instantâneo de sinal R$ ${amount} confirmado para '${targetClient?.nome || 'Cliente'}' via Pix Expresso (Agenda).`
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
      loadAllData();
    } catch (e) {
      console.error("Erro ao compensar pagamento do Pix expresso na Agenda:", e);
    }
  };

  useEffect(() => {
    loadAllData();
    window.addEventListener('es-database-updated', loadAllData);
    return () => {
      window.removeEventListener('es-database-updated', loadAllData);
    };
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const bks = await getReservas();
      const sps = await getEspacos();
      const clis = await getClientes();
      setBookings(bks);
      setSpaces(sps);
      setClients(clis);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // Days calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday is 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysArray: (Date | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push(new Date(year, month, i));
  }

  // Get localized month name
  const monthLabel = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Filter bookings according to active space filter selection
  const activeBookings = bookings.filter(b => selectedSpaceId === 'all' || b.espacoId === selectedSpaceId);

  // Export Agenda to CSV for the selected month and space filter
  const handleExportCSV = () => {
    const selectedMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthlyBookings = activeBookings.filter(b => b.dataEvento.startsWith(selectedMonthPrefix));

    if (monthlyBookings.length === 0) {
      alert(`Não há reservas para exportar no período de ${monthLabel}.`);
      return;
    }

    const csvHeaders = [
      "ID da Reserva",
      "Data do Evento",
      "Tipo de Evento",
      "Horario",
      "Qtd Convidados",
      "Cliente",
      "Telefone",
      "Email",
      "Espaco",
      "Valor Total (R$)",
      "Valor Sinal (R$)",
      "Status",
      "Observacoes",
      "Cadastrado Em"
    ];

    const csvRows = monthlyBookings.map(b => {
      const client = clients.find(c => c.id === b.clienteId);
      const space = spaces.find(s => s.id === b.espacoId);
      
      const rowData = [
        b.id,
        b.dataEvento.split('-').reverse().join('/'),
        b.tipoEvento,
        b.horario,
        b.qtdConvidados,
        client?.nome || 'Nao Encontrado',
        client?.telefone || '',
        client?.email || '',
        space?.nome || 'Espaco Tropical',
        b.valorTotal,
        b.valorSinal || 0,
        b.status,
        (b.observacoes || '').replace(/\r?\n|\r/g, " "),
        b.createdAt || ''
      ];

      return rowData.map(value => {
        const strVal = String(value ?? '').replace(/"/g, '""');
        return `"${strVal}"`;
      }).join(';');
    });

    const csvContent = "\uFEFF" + [csvHeaders.join(';'), ...csvRows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const spaceLabel = selectedSpaceId === 'all' ? 'todos' : (spaces.find(s => s.id === selectedSpaceId)?.nome || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '_');
    const formattedMonthLabel = monthLabel.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').toLowerCase();
    
    link.setAttribute("download", `agenda_reservas_${spaceLabel}_${formattedMonthLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to check if a day is in the past (local midnight)
  const isPastDate = (d: Date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const compareDate = new Date(d);
    compareDate.setHours(0,0,0,0);
    return compareDate < today;
  };

  // Helper to get bookings on a specific date String
  const getDayBookings = (dateStr: string) => {
    return activeBookings.filter(b => b.dataEvento === dateStr);
  };

  const handleDayClick = (dayDate: Date) => {
    const isoString = dayDate.toISOString().split('T')[0];
    const existing = getDayBookings(isoString);

    if (existing.length > 0) {
      // Inspect booking (even in the past, to view historical audits/details)
      setSelectedBookingForInspect(existing[0]);
    } else {
      if (isPastDate(dayDate)) {
        // Prevent reserving on a past date
        return;
      }
      // Create new booking on empty day
      setSelectedDayISO(isoString);
      setEditingBooking(null);
      
      // Auto pre-populate form
      if (clients.length > 0) setFormClientId(clients[0].id);
      if (spaces.length > 0) {
        const defaultSpace = spaces[0];
        setFormSpaceId(defaultSpace.id);
        setFormValorTotal(defaultSpace.valorLocacao);
        const pct = defaultSpace.porcentagemSinal !== undefined ? defaultSpace.porcentagemSinal : 50;
        setFormValorSinal(Math.round(defaultSpace.valorLocacao * (pct / 100)));
      }
      setFormTipoEvento('Casamento');
      setFormHorario('08:00 - 18:00');
      setFormQtdConvidados(80);
      setFormStatus('Orçamento');
      setFormMotivoBloqueio('');
      setFormObservacoes('');

      setRegisterNewClientOnFly(false);
      setNewClientNome('');
      setNewClientCPF('');
      setNewClientTelefone('');
      setNewClientEmail('');

      setShowBookingModal(true);
    }
  };

  const openEditBooking = (b: Reserva) => {
    setSelectedBookingForInspect(null);
    setEditingBooking(b);
    setSelectedDayISO(b.dataEvento);
    
    setFormClientId(b.clienteId);
    setFormSpaceId(b.espacoId);
    setFormTipoEvento(b.tipoEvento);
    setFormHorario(b.horario);
    setFormQtdConvidados(b.qtdConvidados);
    setFormValorTotal(b.valorTotal);
    setFormValorSinal(b.valorSinal);
    setFormStatus(b.status);
    setFormMotivoBloqueio(b.motivoBloqueio || '');
    setFormObservacoes(b.observacoes || '');

    setRegisterNewClientOnFly(false);
    setNewClientNome('');
    setNewClientCPF('');
    setNewClientTelefone('');
    setNewClientEmail('');

    setShowBookingModal(true);
  };

  const handleDeleteBooking = async (id: string) => {
    if (confirm("Tem certeza que deseja apagar permanentemente esta reserva?")) {
      try {
        await deleteReserva(id);
        setSelectedBookingForInspect(null);
        loadAllData();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleRescheduleBooking = async (booking: Reserva, newDate: string) => {
    if (!newDate) {
      alert("Por favor, selecione uma nova data.");
      return;
    }

    const currentSpace = spaces.find(s => s.id === booking.espacoId);
    const hasConflitNow = bookings.some(b => 
      b.dataEvento === newDate && 
      b.espacoId === booking.espacoId && 
      b.id !== booking.id && 
      b.status !== 'Cancelado'
    );

    if (hasConflitNow) {
      if (!confirm(`⚠️ Atenção: O espaço "${currentSpace?.nome || 'Selecionado'}" já está ocupado no dia ${newDate.split('-').reverse().join('/')}.\n\nDeseja forçar a remarcação para o mesmo dia apesar do conflito?`)) {
        return;
      }
    }

    try {
      const oldDateFmt = booking.dataEvento.split('-').reverse().join('/');
      const newDateFmt = newDate.split('-').reverse().join('/');

      const updatedReserva: Reserva = {
        ...booking,
        dataEvento: newDate,
        observacoes: `${booking.observacoes || ''}\n[REAGENDAMENTO] Data transferida administrativamente de ${oldDateFmt} para ${newDateFmt} em ${new Date().toLocaleString('pt-BR')}.`
      };

      await saveReserva(updatedReserva);

      await addActivityLog(
        "Remarcação de Pauta",
        `Reserva #${booking.id} (${booking.tipoEvento}) transferida de ${oldDateFmt} para ${newDateFmt}.`
      );

      alert(`A pauta foi transferida com absoluto sucesso para o dia ${newDateFmt}!`);
      setShowRescheduleForm(false);
      setSelectedBookingForInspect(null);
      loadAllData();
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar reagendamento: " + err.message);
    }
  };

  const handleSaveBookingForm = async (e: React.FormEvent) => {
    e.preventDefault();

    let targetClientId = formClientId;
    const isBlocking = formStatus === 'Bloqueado';

    if (isBlocking) {
      targetClientId = 'sistema_bloqueado';
    } else {
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

      if (!targetClientId) {
        alert("Por favor, selecione ou cadastre um cliente.");
        return;
      }
    }

    if (!formSpaceId || !formTipoEvento || !selectedDayISO) {
      alert("Preencha as informações obrigatórias.");
      return;
    }

    // Block all spaces at once scenario
    if (isBlocking && formSpaceId === 'todos') {
      try {
        for (const s of spaces) {
          await saveReserva({
            clienteId: 'sistema_bloqueado',
            espacoId: s.id,
            tipoEvento: formTipoEvento && formTipoEvento !== 'Casamento' ? formTipoEvento : (formMotivoBloqueio ? `Bloqueio: ${formMotivoBloqueio}` : 'Bloqueio Administrativo'),
            dataEvento: selectedDayISO,
            horario: formHorario,
            qtdConvidados: 0,
            valorTotal: 0,
            valorSinal: 0,
            status: 'Bloqueado',
            motivoBloqueio: formMotivoBloqueio || undefined,
            observacoes: formObservacoes || `Bloqueio geral da pauta para todos os espaços (${formMotivoBloqueio || 'Administrativo'})`
          });
        }
        await addActivityLog(
          "Bloqueio Geral de Pauta",
          `Todas as pautas do dia ${selectedDayISO.split('-').reverse().join('/')} foram bloqueadas administrativamente.`
        );
        setShowBookingModal(false);
        loadAllData();
        alert("Todas as pautas foram bloqueadas administrativo-preventivo com absoluto sucesso!");
        return;
      } catch (err: any) {
        alert("Erro no bloqueio geral: " + err.message);
        return;
      }
    }

    // Validação de capacidade máxima do espaço selecionado
    if (!isBlocking) {
      const selectedSpace = spaces.find(s => s.id === formSpaceId);
      if (selectedSpace) {
        const maxCap = selectedSpace.capacidade || 80;
        if (Number(formQtdConvidados) > maxCap) {
          alert(`A quantidade de convidados (${formQtdConvidados}) excede a capacidade máxima permitida para o espaço "${selectedSpace.nome}" (máximo ${maxCap} pessoas).`);
          return;
        }
      }
    }

    const payload: Omit<Reserva, 'id' | 'createdAt'> & { id?: string; motivoBloqueio?: 'Manutenção' | 'Reforma' | 'Uso Pessoal' | 'Férias' } = {
      clienteId: targetClientId,
      espacoId: formSpaceId,
      tipoEvento: isBlocking 
        ? (formTipoEvento && formTipoEvento !== 'Casamento' ? formTipoEvento : (formMotivoBloqueio ? `Bloqueio: ${formMotivoBloqueio}` : 'Bloqueio Administrativo')) 
        : formTipoEvento,
      dataEvento: selectedDayISO,
      horario: formHorario,
      qtdConvidados: isBlocking ? 0 : Number(formQtdConvidados),
      valorTotal: isBlocking ? 0 : Number(formValorTotal),
      valorSinal: isBlocking ? 0 : Number(formValorSinal),
      status: formStatus,
      observacoes: formObservacoes,
      motivoBloqueio: isBlocking ? (formMotivoBloqueio || undefined) : undefined
    };

    if (editingBooking) {
      payload.id = editingBooking.id;
    }

    try {
      const generatedId = await saveReserva(payload);

      // Create initial payment bills automatically if creating a new booking and not blocking
      if (!editingBooking && !isBlocking) {
        // Sinal payment
        await savePagamento({
          reservaId: generatedId,
          valor: Number(formValorSinal),
          formaPagamento: 'PIX',
          status: 'Pendente'
        });
        // Remaining payment
        await savePagamento({
          reservaId: generatedId,
          valor: Number(formValorTotal) - Number(formValorSinal),
          formaPagamento: 'PIX',
          status: 'Pendente'
        });
      }

      await addActivityLog(
        isBlocking ? "Bloqueio de Data" : "Salvar Reserva",
        isBlocking
          ? `Data ${selectedDayISO.split('-').reverse().join('/')} bloqueada para o espaço.`
          : `Locação salva/reagendada para o dia ${selectedDayISO.split('-').reverse().join('/')}.`
      );

      setShowBookingModal(false);
      loadAllData();

      if (!editingBooking && !isBlocking) {
        // Trigger the instant PIX payment modal!
        const fullReserva: Reserva = {
          id: generatedId,
          clienteId: targetClientId,
          espacoId: formSpaceId,
          tipoEvento: formTipoEvento,
          dataEvento: selectedDayISO,
          horario: formHorario,
          qtdConvidados: Number(formQtdConvidados),
          valorTotal: Number(formValorTotal),
          valorSinal: Number(formValorSinal),
          status: formStatus,
          observacoes: formObservacoes,
          createdAt: new Date().toISOString()
        };
        triggerPixModalForBooking(fullReserva);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusColor = (bStatus: StatusReserva, booking?: Reserva) => {
    if (bStatus === 'Bloqueado') {
      const reason = booking?.motivoBloqueio;
      switch(reason) {
        case 'Manutenção':
          return 'bg-amber-600 dark:bg-amber-700 text-white font-extrabold border border-amber-500/30';
        case 'Reforma':
          return 'bg-orange-600 dark:bg-orange-700 text-white font-extrabold border border-orange-500/30';
        case 'Uso Pessoal':
          return 'bg-purple-600 dark:bg-purple-700 text-white font-extrabold border border-purple-500/30';
        case 'Férias':
          return 'bg-teal-600 dark:bg-teal-700 text-white font-extrabold border border-teal-500/30';
        default:
          return 'bg-red-650 dark:bg-rose-900/90 text-white font-extrabold border border-red-700/45';
      }
    }
    switch(bStatus) {
      case 'Confirmado':
        return 'bg-violet-500 text-white shadow-sm border border-violet-600/30';
      case 'Realizado':
        return 'bg-emerald-500 text-white';
      case 'Aguardando sinal':
        return 'bg-amber-400 text-slate-900 font-bold';
      case 'Orçamento':
        return 'bg-cyan-500 text-white';
      case 'Cancelado':
        return 'bg-slate-400 text-white line-through opacity-60';
    }
  };

  const getStatusTooltip = (bStatus: StatusReserva, booking?: Reserva) => {
    switch (bStatus) {
      case 'Orçamento':
        return 'Orçamento: Evento pré-agendado providoriamente. O horário não está garantido de forma definitiva até o sinal.';
      case 'Aguardando sinal':
        return 'Aguardando Sinal: Proposta aceita, aguardando o pagamento de sinal (geralmente 50% ou 30%) para confirmação.';
      case 'Confirmado':
        return 'Confirmado: Sinal recebido com sucesso. Reserva ativa, data bloqueada no calendário e contrato em vigor.';
      case 'Realizado':
        return 'Realizado: O evento ocorreu e as chaves/espaço foram desocupados de forma bem-sucedida.';
      case 'Cancelado':
        return 'Cancelado: Reserva cancelada e data correspondente liberada no calendário para novos agendamentos.';
      case 'Bloqueado':
        {
          const reason = booking?.motivoBloqueio;
          if (reason) {
            return `Bloqueado Administrativo (${reason}): Este espaço ou pauta está bloqueado por motivo de ${reason}.`;
          }
          return 'Bloqueado Administrativo: Data/espaço bloqueado pelo administrador. Nenhuma reserva pública é permitida nesta data.';
        }
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search and control menu */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">Agenda de Disponibilidade</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Calendário integrado de agendamentos e períodos bloqueados para locação.</p>
        </div>

        {/* Filters and Navigation */}
        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Espaco filter */}
          <div>
            <label htmlFor="space-filter-select" className="sr-only">Filtrar por espaço</label>
            <select
              id="space-filter-select"
              value={selectedSpaceId}
              onChange={(e) => setSelectedSpaceId(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-semibold text-gray-800 dark:text-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-xs cursor-pointer"
            >
              <option value="all">Filtro: Todos os Espaços</option>
              {spaces.map(s => (
                <option key={s.id} value={s.id}>Filtro: {s.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-1">
            <button
              id="btn-prev-month"
              onClick={prevMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-zinc-305 rounded-lg cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-gray-900 dark:text-white px-3 capitalize">
              {monthLabel}
            </span>
            <button
              id="btn-next-month"
              onClick={nextMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-zinc-305 rounded-lg cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Export button */}
          <button
            id="btn-export-agenda"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm shadow-indigo-600/15"
            title="Exportar as reservas do mês selecionado para CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Agenda</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24 text-gray-500">
          <Calendar className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
          Carregando calendário de eventos...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Main 7 columns monthly grid */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm overflow-x-auto">
            <div className="min-w-[600px] lg:min-w-0">
              <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold uppercase tracking-wider text-gray-550 font-mono select-none">
                <span>Dom</span>
                <span>Seg</span>
                <span>Ter</span>
                <span>Qua</span>
                <span>Qui</span>
                <span>Sex</span>
                <span>Sáb</span>
              </div>

              <div className="grid grid-cols-7 gap-2">
              {daysArray.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="h-24 bg-slate-550/5 dark:bg-slate-900/5 rounded-xl border border-dashed border-slate-200/5 dark:border-slate-800/10"></div>;
                }

                const dayIso = day.toISOString().split('T')[0];
                const dayBookings = getDayBookings(dayIso);
                const hasBooking = dayBookings.length > 0;
                const blockedBooking = dayBookings.find(b => b.status === 'Bloqueado');
                const isBlocked = !!blockedBooking;
                const isPast = isPastDate(day);
                
                let cellClass = "";
                if (isBlocked) {
                  const reason = blockedBooking?.motivoBloqueio;
                  if (reason === 'Manutenção') {
                    cellClass = 'h-24 p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer border-amber-305 dark:border-amber-900 bg-amber-500/5 dark:bg-amber-955/10 hover:bg-amber-500/15 dark:hover:bg-amber-955/20 transition-all duration-200 transform hover:-translate-y-0.5 shadow-sm hover:shadow animate-fade-in';
                  } else if (reason === 'Reforma') {
                    cellClass = 'h-24 p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer border-orange-300 dark:border-orange-900 bg-orange-500/5 dark:bg-orange-955/10 hover:bg-orange-500/15 dark:hover:bg-orange-955/20 transition-all duration-200 transform hover:-translate-y-0.5 shadow-sm hover:shadow animate-fade-in';
                  } else if (reason === 'Uso Pessoal') {
                    cellClass = 'h-24 p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer border-purple-300 dark:border-purple-900 bg-purple-500/5 dark:bg-purple-955/10 hover:bg-purple-500/15 dark:hover:bg-purple-955/20 transition-all duration-200 transform hover:-translate-y-0.5 shadow-sm hover:shadow animate-fade-in';
                  } else if (reason === 'Férias') {
                    cellClass = 'h-24 p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer border-teal-350 dark:border-teal-900 bg-teal-500/5 dark:bg-teal-955/10 hover:bg-teal-500/15 dark:hover:bg-teal-955/20 transition-all duration-200 transform hover:-translate-y-0.5 shadow-sm hover:shadow animate-fade-in';
                  } else {
                    cellClass = 'h-24 p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer border-red-300 dark:border-rose-950 bg-rose-50/30 dark:bg-rose-950/20 hover:bg-rose-100/40 dark:hover:bg-rose-955/30 transition-all duration-200 transform hover:-translate-y-0.5 shadow-sm hover:shadow animate-fade-in';
                  }
                } else if (hasBooking) {
                  cellClass = isPast
                    ? 'h-24 p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer border-indigo-150/40 dark:border-indigo-950/60 bg-indigo-50/15 dark:bg-indigo-950/5 opacity-80 hover:opacity-100 shadow-sm transition-all duration-200 animate-fade-in'
                    : 'h-24 p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5 border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/15 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/25 shadow-sm hover:shadow animate-fade-in';
                } else if (isPast) {
                  cellClass = 'h-24 p-2.5 rounded-xl border flex flex-col justify-between border-gray-200/50 dark:border-slate-800/50 bg-gray-50/40 dark:bg-slate-900/10 text-gray-400 dark:text-zinc-650 opacity-60 cursor-not-allowed select-none animate-fade-in';
                } else {
                  cellClass = 'h-24 p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5 border-emerald-150 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-950/5 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/15 shadow-sm hover:shadow animate-fade-in';
                }
                
                return (
                  <div
                    key={`day-${day.getDate()}`}
                    id={`calendar-day-${dayIso}`}
                    onClick={() => handleDayClick(day)}
                    className={cellClass}
                  >
                    {/* Day number header */}
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-black text-gray-950 dark:text-zinc-200">
                        {day.getDate()}
                      </span>
                      {isBlocked ? (
                        <Lock className={`w-3 h-3 ${
                          blockedBooking?.motivoBloqueio === 'Manutenção' ? 'text-amber-500 fill-amber-500/10 animate-pulse' :
                          blockedBooking?.motivoBloqueio === 'Reforma' ? 'text-orange-500 fill-orange-500/10' :
                          blockedBooking?.motivoBloqueio === 'Uso Pessoal' ? 'text-purple-500 fill-purple-500/10' :
                          blockedBooking?.motivoBloqueio === 'Férias' ? 'text-teal-500 fill-teal-500/10' :
                          'text-red-500 fill-red-500/10'
                        }`} />
                      ) : hasBooking ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                      ) : null}
                    </div>

                    {/* Booking indicator line */}
                    {hasBooking ? (
                      <div className="space-y-1 w-full">
                        {dayBookings.map((b) => (
                          <div
                            key={b.id}
                            className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-md leading-tight truncate shadow-sm cursor-help hover:scale-102 transition-transform ${getStatusColor(b.status, b)}`}
                            title={`${b.tipoEvento} (${b.status}): ${getStatusTooltip(b.status, b)}`}
                          >
                            {b.tipoEvento}
                          </div>
                        ))}
                      </div>
                    ) : isPast ? (
                      <div className="flex items-center gap-1 self-start bg-gray-500/5 dark:bg-slate-800/15 text-gray-400 dark:text-zinc-500 text-[7.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-gray-200/60 dark:border-slate-800/40">
                        Dia Passado
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 self-start bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-405 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-emerald-500/10">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping"></span>
                        Disponível
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

          {/* Quick Agenda Sidebar Guide with event list */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-gray-950 dark:text-white uppercase tracking-wider mb-3 select-none pb-2 border-b border-gray-100 dark:border-slate-800">
                Resumo de Ocupação ({activeBookings.length} Reservados)
              </h3>
              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                {activeBookings.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">Nenhum evento registrado no espaço selecionado.</p>
                ) : (
                  [...activeBookings]
                    .sort((a,b) => a.dataEvento.localeCompare(b.dataEvento))
                    .map(b => {
                      const space = spaces.find(s => s.id === b.espacoId);
                      return (
                        <div 
                          key={b.id} 
                          onClick={() => setSelectedBookingForInspect(b)}
                          className="text-left text-xs p-2.5 bg-gray-50 dark:bg-slate-850 hover:bg-slate-105 border border-gray-200/60 dark:border-slate-800/60 rounded-xl cursor-pointer transition"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-gray-900 dark:text-white truncate">{b.tipoEvento}</span>
                            <span 
                              className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase cursor-help hover:opacity-90 transition-opacity ${getStatusColor(b.status, b)}`}
                              title={getStatusTooltip(b.status, b)}
                            >
                              {b.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500">{new Date(b.dataEvento + "T00:00:00").toLocaleDateString('pt-BR', { dateStyle: 'medium' })}</p>
                          <p className="text-[10px] text-indigo-500 font-medium truncate mt-0.5">{space?.nome}</p>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Quick legenda status box */}
            <div className="border-t border-gray-100 dark:border-slate-800 pt-4 mt-4 space-y-2 text-[10px] text-gray-600 dark:text-zinc-400">
              <div className="flex items-center gap-2 cursor-help" title={getStatusTooltip('Realizado')}>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
                <span>Realizado / Desocupado</span>
              </div>
              <div className="flex items-center gap-2 cursor-help" title={getStatusTooltip('Confirmado')}>
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 block"></span>
                <span>Confirmado / Pago</span>
              </div>
              <div className="flex items-center gap-2 cursor-help" title={getStatusTooltip('Aguardando sinal')}>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-455 block bg-amber-400"></span>
                <span>Aguardando Sinal</span>
              </div>
              <div className="flex items-center gap-2 cursor-help" title={getStatusTooltip('Orçamento')}>
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 block"></span>
                <span>Orçamento (Pré-reserva)</span>
              </div>
              
              <div className="pt-2 border-t border-dashed border-gray-150 dark:border-slate-800 space-y-1.5">
                <span className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-zinc-500 block font-bold">🚫 Legenda de Bloqueios</span>
                <div className="flex flex-col gap-1.5 pl-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-600 block"></span>
                    <span>Manutenção</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-600 block"></span>
                    <span>Reforma</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-600 block"></span>
                    <span>Uso Pessoal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-600 block"></span>
                    <span>Férias</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-650 block"></span>
                    <span>Outros Bloqueios</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Booking INSPECTOR Popup dialogue */}
      {selectedBookingForInspect && (
        <div className="fixed inset-0 bg-black/40 z-45 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-scale-up">
            <div className="flex justify-between items-start pb-3 border-b border-gray-100 dark:border-slate-800">
              <div>
                <span 
                  className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-help hover:opacity-90 transition-opacity ${getStatusColor(selectedBookingForInspect.status, selectedBookingForInspect)}`}
                  title={getStatusTooltip(selectedBookingForInspect.status, selectedBookingForInspect)}
                >
                  {selectedBookingForInspect.status}
                </span>
                <h3 className="text-md font-bold text-gray-900 dark:text-white mt-1.5 leading-none">
                  {selectedBookingForInspect.tipoEvento}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedBookingForInspect(null)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 hover:bg-gray-100 dark:hover:bg-slate-800 roundedLg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Details sheet */}
            <div className="space-y-4 py-4 text-xs">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-[10px] text-gray-400 uppercase leading-none font-sans">Cliente Contratante</p>
                  <p className="text-gray-900 dark:text-white font-semibold mt-0.5">
                    {selectedBookingForInspect.status === 'Bloqueado' 
                      ? "🔐 Bloqueio Geral Administrativo / Manutenção" 
                      : (clients.find(c => c.id === selectedBookingForInspect.clienteId)?.nome || "Não encontrado")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-[10px] text-gray-400 uppercase leading-none font-sans">Espaço Alugado</p>
                  <p className="text-gray-900 dark:text-white font-semibold mt-0.5">
                    {spaces.find(s => s.id === selectedBookingForInspect.espacoId)?.nome || "Não encontrado"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-slate-850 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                <div>
                  <p className="text-[10px] text-gray-400 font-sans">DATA</p>
                  <p className="text-gray-905 dark:text-white font-bold mt-0.5">
                    {new Date(selectedBookingForInspect.dataEvento + "T00:00:00").toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-sans">HORÁRIO SLOTS</p>
                  <p className="text-gray-905 dark:text-white font-bold mt-0.5">{selectedBookingForInspect.horario}</p>
                </div>
              </div>

              {/* Reschedule Inline CTA Block */}
              <div className="bg-slate-50 dark:bg-slate-950/20 p-3 rounded-xl border border-dashed border-gray-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Transferência / Remarcação</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!showRescheduleForm) {
                        setRescheduleDate(selectedBookingForInspect.dataEvento);
                      }
                      setShowRescheduleForm(!showRescheduleForm);
                    }}
                    className="text-[10px] bg-indigo-55/70 hover:bg-indigo-100 text-indigo-650 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-indigo-400 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer border border-indigo-150/40"
                  >
                    <RefreshCw className={`w-3 h-3 ${showRescheduleForm ? 'animate-spin' : ''}`} />
                    {showRescheduleForm ? 'Ocultar Painel' : '🗓️ Remarcar Data'}
                  </button>
                </div>

                {showRescheduleForm && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-fade-in text-xs text-left">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase mb-1">Selecionar Nova Data *</label>
                      <input 
                        type="date"
                        required
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-250 dark:border-slate-700 rounded-lg outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                      />
                    </div>

                    {rescheduleDate && (
                      <div className="p-2 py-1.5 rounded bg-slate-150/40 dark:bg-slate-950/50 text-[11px] leading-tight flex items-center justify-between font-mono">
                        <span className="text-gray-400">Pauta para {rescheduleDate.split('-').reverse().join('/')}:</span>
                        {bookings.some(b => b.dataEvento === rescheduleDate && b.espacoId === selectedBookingForInspect.espacoId && b.id !== selectedBookingForInspect.id && b.status !== 'Cancelado') ? (
                          <span className="text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1">⚠️ Ocupado</span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">🟢 Disponível</span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1 font-sans justify-end">
                      <button
                        type="button"
                        onClick={() => setShowRescheduleForm(false)}
                        className="py-1 px-3 bg-gray-105 hover:bg-gray-200 text-gray-700 text-[10px] font-bold rounded-md"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRescheduleBooking(selectedBookingForInspect, rescheduleDate)}
                        className="py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition shadow-sm"
                      >
                        Confirmar Reagendamento
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-[9px] text-gray-500">CONVIDADOS</span>
                  <p className="text-xs font-bold text-gray-800 dark:text-white mt-0.5">{selectedBookingForInspect.qtdConvidados}</p>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-[9px] text-gray-500">VALOR TOTAL</span>
                  <p className="text-xs font-bold text-indigo-650 dark:text-indigo-400 mt-0.5">R$ {selectedBookingForInspect.valorTotal}</p>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-[9px] text-gray-500">DEPÓSITO SINAL</span>
                  <p className="text-xs font-bold text-emerald-650 dark:text-emerald-450 mt-0.5">R$ {selectedBookingForInspect.valorSinal}</p>
                </div>
              </div>

              {selectedBookingForInspect.observacoes && (
                <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-850 dark:text-amber-400 p-2.5 rounded-lg text-[11px] leading-relaxed">
                  <strong>Observações:</strong> {selectedBookingForInspect.observacoes}
                </div>
              )}

              {/* Vínculos do Evento */}
              <div className="pt-3 border-t border-gray-100 dark:border-slate-800 space-y-2 mt-2">
                <p className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase tracking-widest font-bold font-mono">Dossiê Legal & Cadastro</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (onNavigateToView) {
                        try {
                          await addActivityLog(
                            "Auditoria - Ficha de Reserva",
                            `Visualizou o Book de Detalhes da Reserva #${selectedBookingForInspect.id} (${selectedBookingForInspect.tipoEvento})`
                          );
                        } catch (err) {
                          console.warn("Failsafe non-blocking audit logging:", err);
                        }
                        onNavigateToView('bookings', selectedBookingForInspect.id);
                        setSelectedBookingForInspect(null);
                      }
                    }}
                    className="py-2 px-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 border border-indigo-100/60 dark:border-indigo-900/30 text-indigo-750 dark:text-indigo-400 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    title="Abre a ficha cadastral e o book completo do evento"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Abrir Book
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (onNavigateToView) {
                        try {
                          await addActivityLog(
                            "Auditoria - Contrato",
                            `Visualizou o Contrato por Adesão da Reserva #${selectedBookingForInspect.id} (${selectedBookingForInspect.tipoEvento})`
                          );
                        } catch (err) {
                          console.warn("Failsafe non-blocking audit logging:", err);
                        }
                        onNavigateToView('contracts', selectedBookingForInspect.id);
                        setSelectedBookingForInspect(null);
                      }
                    }}
                    className="py-2 px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 border border-emerald-100/60 dark:border-emerald-900/30 text-emerald-750 dark:text-emerald-400 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    title="Abre e compila o Contrato de Adesão referente a esta locação"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Ver Contrato
                  </button>
                </div>
              </div>
            </div>

            {/* Actions for Inspector */}
            <div className="pt-4 border-t border-gray-100 dark:border-slate-850 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => handleDeleteBooking(selectedBookingForInspect.id)}
                className="flex-1 py-2 rounded-lg bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 border border-red-500/20 text-xs font-bold cursor-pointer transition text-center flex items-center justify-center gap-1.5"
              >
                <Trash className="w-3.5 h-3.5" />
                Excluir
              </button>
              <button
                type="button"
                onClick={() => openEditBooking(selectedBookingForInspect)}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold cursor-pointer transition text-center flex items-center justify-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking CREATE or EDIT Modal Form UI */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-gray-105 dark:border-slate-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider select-none flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                {editingBooking ? "Editar Reserva de Locação" : `Nova Reserva • ${new Date(selectedDayISO + "T00:00:00").toLocaleDateString('pt-BR')}`}
              </h3>
              <button 
                onClick={() => setShowBookingModal(false)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 hover:bg-gray-100 dark:hover:bg-slate-800 roundedLg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBookingForm} className="space-y-4 mt-4">
              
              {/* Select or Register Client (Requisito: se cadastrar reserva, já cadastra em clientes corporativos) */}
              {formStatus !== 'Bloqueado' && (
                <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-gray-150 dark:border-slate-800 animate-fade-in text-xs">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-gray-700 dark:text-zinc-350 uppercase leading-none">Cliente Contratante *</label>
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
                      required={formStatus !== 'Bloqueado'}
                      value={formClientId}
                      onChange={(e) => setFormClientId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 dark:border-slate-707 bg-white dark:bg-slate-800 text-gray-900 dark:text-zinc-250 focus:outline-none"
                    >
                      <option value="">-- Selecione o cliente existente --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.nome} (CPF/CNPJ: {c.cpf})</option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-3 pt-2.5 border-t border-gray-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider mb-1">Nome Completo *</label>
                        <input
                          type="text"
                          required={registerNewClientOnFly && formStatus !== 'Bloqueado'}
                          placeholder="Ex: Clécio Ferreira Corretor"
                          value={newClientNome}
                          onChange={(e) => setNewClientNome(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs rounded-lg border border-gray-350 dark:border-slate-705 bg-white dark:bg-slate-800 text-gray-955 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider mb-1">Documento (CPF ou CNPJ) *</label>
                        <input
                          type="text"
                          required={registerNewClientOnFly && formStatus !== 'Bloqueado'}
                          placeholder="Ex: 000.000.000-00"
                          value={newClientCPF}
                          onChange={(e) => setNewClientCPF(formatCPFOrCNPJ(e.target.value))}
                          className="w-full px-3.5 py-2 text-xs rounded-lg border border-gray-350 dark:border-slate-705 bg-white dark:bg-slate-800 text-gray-955 dark:text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider mb-1">WhatsApp / Celular *</label>
                        <input
                          type="text"
                          required={registerNewClientOnFly && formStatus !== 'Bloqueado'}
                          placeholder="Ex: (11) 99321-0012"
                          value={newClientTelefone}
                          onChange={(e) => setNewClientTelefone(formatPhone(e.target.value))}
                          className="w-full px-3.5 py-2 text-xs rounded-lg border border-gray-350 dark:border-slate-705 bg-white dark:bg-slate-800 text-gray-955 dark:text-white font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider mb-1">E-mail Corporativo *</label>
                        <input
                          type="email"
                          required={registerNewClientOnFly && formStatus !== 'Bloqueado'}
                          placeholder="Ex: clecio.corretor@outlook.com"
                          value={newClientEmail}
                          onChange={(e) => setNewClientEmail(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs rounded-lg border border-gray-350 dark:border-slate-705 bg-white dark:bg-slate-800 text-gray-955 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Space Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-755 dark:text-zinc-300 uppercase mb-1">Selecionar Espaço de Evento *</label>
                <select
                  required
                  value={formSpaceId}
                  onChange={(e) => setFormSpaceId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-350 dark:border-slate-705 bg-white dark:bg-slate-800 text-gray-900 dark:text-zinc-100 focus:outline-none"
                >
                  <option value="">-- Selecione o espaço --</option>
                  {formStatus === 'Bloqueado' && (
                    <option value="todos" className="text-red-500 font-bold">🚫 TODOS OS ESPAÇOS (Bloqueio Geral de Pauta)</option>
                  )}
                  {spaces.map(s => (
                    <option key={s.id} value={s.id}>{s.nome} (Ativo • Valor diário: R$ {s.valorLocacao})</option>
                  ))}
                </select>
              </div>

              {/* Event Type & Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Tipo de Evento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Casamento, Formatura, Corporativo"
                    value={formTipoEvento}
                    onChange={(e) => setFormTipoEvento(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Horário Slots / Janela * <span className="text-amber-500 font-bold">(Padrão: 08:00 - 18:00)</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 08:00 - 18:00"
                    value={formHorario}
                    onChange={(e) => setFormHorario(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white"
                  />
                </div>
              </div>

              {/* Guests Count & Billing totals */}
              {formStatus !== 'Bloqueado' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1 flex justify-between items-center">
                      <span>Convidados *</span>
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 font-extrabold font-sans">Máx. 80</span>
                    </label>
                    <input
                      type="number"
                      required={formStatus !== 'Bloqueado'}
                      min={1}
                      max={80}
                      value={formQtdConvidados}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val > 80) {
                          setFormQtdConvidados(80);
                        } else {
                          setFormQtdConvidados(val);
                        }
                      }}
                      className="w-full px-2 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-955 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Valor Total (R$) *</label>
                    <input
                      type="number"
                      required={formStatus !== 'Bloqueado'}
                      value={formValorTotal}
                      onChange={(e) => setFormValorTotal(Number(e.target.value))}
                      className="w-full px-2 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Sinal Exigido (R$) *</label>
                    <input
                      type="number"
                      required={formStatus !== 'Bloqueado'}
                      value={formValorSinal}
                      onChange={(e) => setFormValorSinal(Number(e.target.value))}
                      className="w-full px-2 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Status Select */}
              <div>
                <label className="block text-xs font-bold text-gray-755 dark:text-zinc-300 uppercase mb-1">Status Contratual *</label>
                <select
                  value={formStatus}
                  onChange={(e: any) => setFormStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-350 dark:border-slate-705 bg-white dark:bg-slate-800 text-gray-900 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Orçamento" title={getStatusTooltip('Orçamento')}>Orçamento (Pré-reserva)</option>
                  <option value="Aguardando sinal" title={getStatusTooltip('Aguardando sinal')}>Aguardando sinal</option>
                  <option value="Confirmado" title={getStatusTooltip('Confirmado')}>Confirmado (Reserva Ativa)</option>
                  <option value="Realizado" title={getStatusTooltip('Realizado')}>Realizado</option>
                  <option value="Cancelado" title={getStatusTooltip('Cancelado')}>Cancelado</option>
                  <option value="Bloqueado" title={getStatusTooltip('Bloqueado')}>Bloqueado Administrativo / Bloquear Data</option>
                </select>
                <div className="mt-1.5 p-2 bg-slate-50 dark:bg-slate-950/60 rounded-lg text-[10px] text-zinc-550 dark:text-zinc-400 border border-slate-100 dark:border-slate-850/60 leading-normal">
                  💡 <span className="font-extrabold capitalize">{formStatus}:</span> {getStatusTooltip(formStatus)}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Observações Operacionais</label>
                <textarea
                  rows={2}
                  placeholder="Observações de buffet, fotógrafos, restrições sonoras extras..."
                  value={formObservacoes}
                  onChange={(e) => setFormObservacoes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white"
                ></textarea>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-gray-150 dark:border-slate-850 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 text-gray-705 dark:text-zinc-300 border border-gray-200 dark:border-slate-700 text-xs font-bold rounded-lg cursor-pointer animate-fade-in"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-755 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Confirmar Reserva
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
            
            {/* Close Button Header - Only allowed once PIX is confirmed */}
            {pixModalStatus === 'confirmed' && (
              <button
                onClick={() => setShowPixInstantModal(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            )}

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
                       <p className="text-[10px] text-amber-700 dark:text-amber-450 mt-1.5 font-bold">⚠️ O pagamento do sinal via PIX é obrigatório para prosseguir nesta pauta.</p>
                     </div>
                   </div>
                 ) : (
                   <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl max-w-sm mx-auto flex items-start gap-3">
                     <span className="text-red-500 font-bold flex-shrink-0">⚠️</span>
                     <div className="text-left font-sans text-[11px] leading-snug">
                       <p className="font-extrabold text-red-800 dark:text-red-450 leading-tight">Tempo Limite Excedido!</p>
                       <p className="text-slate-400 mt-1">O prazo de conciliação bancária expirou. Clique em "Re-gerar PIX" para obter novo código, ou confirme manualmente abaixo.</p>
                       <p className="text-[10px] text-red-700 dark:text-red-450 mt-1.5 font-bold">⚠️ O pagamento do sinal via PIX é obrigatório para prosseguir nesta pauta.</p>
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
                  className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-755 text-white font-extrabold text-xs rounded-xl cursor-pointer transition shadow-lg shadow-indigo-600/15"
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
