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
  addActivityLog,
  getEspacos,
  getClientes,
  getPagamentos
} from '../services/db';
import { Reserva, Cliente, Espaco, Pagamento } from '../types';
import { getLessorConfigs } from '../services/notifications';
import { formatCPFOrCNPJ, validateCPFOrCNPJ, formatPhone } from '../services/validation';
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
  Search,
  DollarSign,
  Send,
  ChevronRight,
  ChevronLeft,
  Info,
  ExternalLink,
  Lock,
  Printer,
  FileSignature,
  RefreshCw
} from 'lucide-react';

const isPdfFile = (src?: string) => {
  if (!src) return false;
  return src.startsWith('data:application/pdf') || src.toLowerCase().endsWith('.pdf') || src.includes('application/pdf');
};

export default function PublicBookingView() {
  // Navigation tabs for client applet
  const [activeTab, setActiveTab] = useState<'novareserva' | 'meuacesso'>('novareserva');

  // Database datasets
  const [existingReservas, setExistingReservas] = useState<Reserva[]>([]);
  const [spaces, setSpaces] = useState<Espaco[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [payments, setPayments] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);

  // New Booking Form Fields
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [tipoEvento, setTipoEvento] = useState('Casamento');
  const [dataEvento, setDataEvento] = useState('');
  const [horario, setHorario] = useState('08:00 - 18:00');
  const [qtdConvidados, setQtdConvidados] = useState('80');
  const [observacoes, setObservacoes] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState('espaco_1');
  const [consentLGPD, setConsentLGPD] = useState(false);

  // New booking date status validation
  const [dateStatus, setDateStatus] = useState<'idle' | 'available' | 'busy'>('idle');

  // Interactive Availability Calendar month/year navigation state
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  const nextCalendarMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1));
  };

  const prevCalendarMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1));
  };

  // Checkout Flow for Newly Created Bookings
  const [viewState, setViewState] = useState<'form' | 'checkout' | 'success'>('form');
  const [createdBooking, setCreatedBooking] = useState<Reserva | null>(null);
  const [createdClient, setCreatedClient] = useState<Cliente | null>(null);
  const [pixPayload, setPixPayload] = useState('');
  const [pixCopied, setPixCopied] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // My Access client tracking lookup states
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupBooking, setLookupBooking] = useState<Reserva | null>(null);
  const [lookupClient, setLookupClient] = useState<Cliente | null>(null);
  const [lookupSpace, setLookupSpace] = useState<Espaco | null>(null);
  const [lookupPayments, setLookupPayments] = useState<Pagamento[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Client updates proposal text
  const [proposalText, setProposalText] = useState('');
  const [proposalSuccess, setProposalSuccess] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);

  // Custom client PIX options
  const [pixMode, setPixMode] = useState<'sinal' | 'saldo' | 'integral' | 'custom'>('sinal');
  const [customPixAmount, setCustomPixAmount] = useState('250');
  const [clientGeneratedPixCode, setClientGeneratedPixCode] = useState('');
  const [clientPixCopied, setClientPixCopied] = useState(false);
  const [clientPixReconciling, setClientPixReconciling] = useState(false);
  const [clientPaymentComplete, setClientPaymentComplete] = useState(false);
  const [brandLogo, setBrandLogo] = useState(() => localStorage.getItem('cfg_brand_logo') || '');

  // View Contract Modal sheet
  const [showContractSheet, setShowContractSheet] = useState(false);

  useEffect(() => {
    loadExistingData();
    const handleUpdate = () => {
      setBrandLogo(localStorage.getItem('cfg_brand_logo') || '');
    };
    window.addEventListener('brand-colors-updated', handleUpdate);
    window.addEventListener('es-database-updated', loadExistingData);
    return () => {
      window.removeEventListener('brand-colors-updated', handleUpdate);
      window.removeEventListener('es-database-updated', loadExistingData);
    };
  }, []);

  // Helper parsing URL query string or Hash for target bookings
  const getBookingIdFromUrl = () => {
    // 1. URLSearchParams
    const params = new URLSearchParams(window.location.search);
    let id = params.get('booking') || params.get('id');
    if (id) return id;

    // 2. Hash parsing (e.g. #reserva?booking=res_3)
    const hash = window.location.hash;
    if (hash.includes('?')) {
      const hashParams = new URLSearchParams(hash.substring(hash.indexOf('?')));
      id = hashParams.get('booking') || hashParams.get('id');
      if (id) return id;
    }

    // 3. Fallback path pattern (e.g. #reserva/res_3)
    const hashParts = hash.split('/');
    if (hashParts.length > 1 && hashParts[0] === '#reserva') {
      return hashParts[1];
    }

    // 4. Fallback hash equals (e.g. #reserva=res_3)
    if (hash.startsWith('#reserva=')) {
      return hash.split('=')[1];
    }

    return null;
  };

  const loadExistingData = async () => {
    try {
      setLoading(true);
      const [resB, resS, resC, resP] = await Promise.all([
        getReservas(),
        getEspacos(),
        getClientes(),
        getPagamentos()
      ]);
      setExistingReservas(resB);
      setSpaces(resS);
      setClients(resC);
      setPayments(resP);
      setBrandLogo(localStorage.getItem('cfg_brand_logo') || '');

      // Check URL for direct lookup routing
      const urlBookingId = getBookingIdFromUrl();
      if (urlBookingId) {
        const foundB = resB.find(r => r.id === urlBookingId);
        if (foundB) {
          const foundC = resC.find(c => c.id === foundB.clienteId);
          const foundS = resS.find(s => s.id === foundB.espacoId);
          const associatedP = resP.filter(p => p.reservaId === foundB.id);

          setLookupBooking(foundB);
          setLookupClient(foundC || null);
          setLookupSpace(foundS || null);
          setLookupPayments(associatedP);
          setActiveTab('meuacesso');
          
          // Pre-populate proposals text
          setProposalText('');
        }
      }
    } catch (e) {
      console.error("Erro ao carregar dados existentes para agendamento público:", e);
    } finally {
      setLoading(false);
    }
  };

  // Helper to calculate custom booking pricing rates dynamically according to brochure rules
  const getDynamicRates = (spaceId: string, eventType: string, dateStr: string) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) {
      return { rent: 450, cleaning: 50 };
    }

    const evLower = (eventType || '').toLowerCase();
    const isWeddingOrDebutante = 
      evLower.includes('casamento') || 
      evLower.includes('debutante') || 
      evLower.includes('15 anos') || 
      evLower.includes('boda');

    const cleaningFee = space.taxaLimpeza !== undefined ? space.taxaLimpeza : 50;

    if (isWeddingOrDebutante) {
      return { rent: 800, cleaning: cleaningFee };
    }
    
    if (spaceId === 'espaco_1' || space.nome?.includes('Tropical')) {
      // 2. Diárias de Lazer based on date
      if (dateStr) {
        const d = new Date(dateStr + "T12:00:00");
        const day = d.getDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = day === 0 || day === 6;
        if (isWeekend) {
          return { rent: 450, cleaning: cleaningFee };
        } else {
          return { rent: 400, cleaning: cleaningFee };
        }
      }
      
      return { rent: 450, cleaning: cleaningFee };
    }
    
    return {
      rent: space.valorLocacao,
      cleaning: cleaningFee
    };
  };

  const getSignalPercent = () => {
    const space = spaces.find(s => s.id === selectedSpaceId);
    if (space && space.porcentagemSinal !== undefined) {
      return space.porcentagemSinal / 100;
    }
    const percentStr = localStorage.getItem('cfg_tax_percent') || '50';
    const num = Number(percentStr);
    return isNaN(num) ? 0.5 : num / 100;
  };

  // Re-evaluate date occupation whenever dataEvento changes
  useEffect(() => {
    if (!dataEvento) {
      setDateStatus('idle');
      return;
    }
    const alreadyOccupied = existingReservas.some(
      r => r.dataEvento === dataEvento && (r.status === 'Confirmado' || r.status === 'Realizado') && r.espacoId === selectedSpaceId
    );
    if (alreadyOccupied) {
      setDateStatus('busy');
    } else {
      setDateStatus('available');
    }
  }, [dataEvento, existingReservas, selectedSpaceId]);

  // Countdown timer effect for newly created dynamic PIX signal simulation
  useEffect(() => {
    let timer: any;
    if (viewState === 'checkout' && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [viewState, countdown]);

  const handleDateSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDataEvento(e.target.value);
  };

  // Helper to generate dynamic contract text
  const generateDefaultContractText = (booking: Reserva, client: Cliente, space: Espaco, lessor: any) => {
    const dataBr = new Date(booking.dataEvento + "T00:00:00").toLocaleDateString('pt-BR');
    const totalBr = booking.valorTotal.toLocaleString('pt-BR');
    const sinalBr = booking.valorSinal.toLocaleString('pt-BR');
    const restBr = (booking.valorTotal - booking.valorSinal).toLocaleString('pt-BR');
    const cleaningBr = (booking.taxaLimpeza !== undefined ? booking.taxaLimpeza : 250).toLocaleString('pt-BR');

    const pct = booking.valorTotal > 0 ? Math.round((booking.valorSinal / booking.valorTotal) * 100) : 50;
    const cancellationPct = space.taxaCancelamento !== undefined ? space.taxaCancelamento : 10;
    const cancellationValBase = (booking.valorTotal * cancellationPct) / 100;
    const cancellationValBr = cancellationValBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    return `INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO DE ESPAÇO PARA EVENTOS E PRESTAÇÃO DE SERVIÇOS ADJACENTES

I. DAS PARTES CONTRATANTES

LOCADOR: ${lessor.razaoSocial} (Nome Fantasia: ${lessor.nomeFantasia}), inscrito no CNPJ/CPF sob nº ${lessor.cnpjCpf}, doravante denominado simplesmente LOCADOR.

LOCATÁRIO: ${client.nome}, inscrito sob CPF/CNPJ nº ${client.cpf}, residente em ${client.endereco || 'Endereço não informado'}, doravante denominado simplesmente LOCATÁRIO.

II. DO OBJETO DO CONTRATO
O presente contrato tem por objeto a locação temporária do espaço denominado "${space.nome}", com capacidade física máxima de até ${space.capacidade} convidados, situado na sede do LOCADOR.

III. DA DATA E HORÁRIO E FINALIDADE
O espaço será alocado de forma privativa e temporária no dia ${dataBr}, no horário regulamentar das 08:00 às 18:00 (Faixa de Horário Escolhida: ${booking.horario}), para a realização de evento do tipo "${booking.tipoEvento}".
Parágrafo único: O período comercial base deste contrato compreende o horário regulamentar das 08:00 às 18:00. Caso ocorra a utilização do espaço fora das horas pactuadas, incidirão taxas extras por hora excedente de acordo com a tabela de serviços adicionais vigente.

IV. DOS VALORES E CONDIÇÕES DE PAGAMENTO
Pela locação acordada e infraestrutura fornecida, o LOCATÁRIO pagará ao LOCADOR o valor global bruto de R$ ${totalBr}.
Deste custo global, a título de arras confirmatórias de sinal de reserva para bloqueio definitivo da agenda, será liquidada a importância de R$ ${sinalBr} (Sinal de Entrada de ${pct}%).
Adicionalmente, inclui-se a taxa de higienização de R$ ${cleaningBr} sobre a conservação geral do local.
O restante de R$ ${restBr} deverá ser quitado em parcelas ou conforme os prazos específicos de faturamento do EventSpace ERP.

V. RETENÇÃO E MULTA POR CANCELAMENTO
Na hipótese de cancelamento imotivado, rescisão unilateral ou desistência voluntária da reserva pelo LOCATÁRIO, incidirá uma multa rescisória penal fixada em ${cancellationPct}% sobre o valor global do acordo, correspondendo a R$ ${cancellationValBr}. A referida taxa será cobrada ou retida com prioridade sobre o sinal depositado, visando compensar o bloqueio de agenda e os prejuízos de faturamento.

VI. DAS OBRIGAÇÕES GERAIS E RESPONSABILIDADES
O LOCATÁRIO assume total e irrestrita responsabilidade civil e criminal por eventuais danos causados por seus convidados, prepostos, fornecedores ou equipes de sonorização ao patrimônio físico estrutural ou ornamental do LOCADOR.

E, por estarem de pleno acordo, firmam o presente instrumento na data da reserva digital de forma irrevogável.

______________________________________________
${lessor.razaoSocial} (LOCADOR)

______________________________________________
${client.nome} (LOCATÁRIO)`;
  };

  // Generic Dynamic PIX key/payload string generator
  const generateDynamicPix = (amount: number) => {
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
    
    // Generate a random dynamic transaction ID to prevent same-code issues
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
    return payloadStart + finalCRC;
  };

  const handleRegenerateCheckoutPix = () => {
    if (!createdBooking) return;
    const key = generateDynamicPix(createdBooking.valorSinal);
    setPixPayload(key);
    setCountdown(60); // Reset timer to 60 seconds
  };

  // Newly created booking auto-payment
  const handleCompletePayment = async () => {
    if (!createdBooking) return;
    try {
      // Direct double booking check
      const latestReservas = await getReservas();
      const alreadyDoubleBooked = latestReservas.some(
        r => r.dataEvento === createdBooking.dataEvento && 
             r.espacoId === createdBooking.espacoId && 
             (r.status === 'Confirmado' || r.status === 'Realizado') &&
             r.id !== createdBooking.id
      );

      if (alreadyDoubleBooked) {
        alert("Atenção: Esta data acabou de ser confirmada e faturada por outro cliente via Pix prioritário. Sua transação foi cancelada.");
        return;
      }

      const amount = createdBooking.valorSinal;

      // Save confirmed payment record
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

      // Reload dataset to sync state
      await loadExistingData();

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

    if (!consentLGPD) {
      alert("Para prosseguir com a solicitação de reserva, você precisa ler e aceitar o Termo de Consentimento de Uso de Dados em conformidade com a LGPD.");
      return;
    }

    if (!nome.trim() || !cpf.trim() || !endereco.trim() || !email.trim() || !telefone.trim() || !dataEvento) {
      alert("Por favor, preencha todos os campos obrigatórios (Nome, CPF, Endereço, WhatsApp e E-mail).");
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

      // 1. Save New Cliente with LGPD constraints
      const clientPayload = {
        nome,
        cpf,
        telefone,
        email,
        whatsapp: telefone,
        endereco,
        observacoes: 'Cadastrado automaticamente via Autoatendimento Público (LGPD)',
        lgpdConsentimento: true,
        lgpdConsentimentoData: new Date().toISOString().split('T')[0],
        lgpdFinalidade: 'Gestão de reservas de salão, emissão de termos e contratos de locação e faturamento de recebíveis via Autoatendimento Público.'
      };
      const clientId = await saveCliente(clientPayload);
      const fullClient: Cliente = {
        id: clientId,
        ...clientPayload,
        createdAt: new Date().toISOString()
      };
      setCreatedClient(fullClient);

      // 2. Define Reservation pricing dynamically from chosen space
      const rates = getDynamicRates(selectedSpaceId, tipoEvento, dataEvento);
      const rentValue = rates.rent;
      const cleaningFee = rates.cleaning;
      const valorTotal = rentValue + cleaningFee;
      const signalPercent = getSignalPercent();
      const valorSinal = Math.round(valorTotal * signalPercent);

      // 3. Save Reserva
      const bookingPayload = {
        clienteId: clientId,
        espacoId: selectedSpaceId,
        tipoEvento,
        dataEvento,
        horario,
        qtdConvidados: Number(qtdConvidados) || 200,
        valorTotal,
        valorSinal,
        status: 'Aguardando sinal' as const,
        observacoes: observacoes || 'Reserva online de autoatendimento.',
        taxaLimpeza: cleaningFee
      };
      const bookingId = await saveReserva(bookingPayload);
      const fullBooking: Reserva = {
        id: bookingId,
        ...bookingPayload,
        createdAt: new Date().toISOString()
      };
      setCreatedBooking(fullBooking);

      // Trigger automatic blocking by reloading the existing bookings in memory
      await loadExistingData();

      // 4. Generate PIX
      const key = generateDynamicPix(valorSinal);
      setPixPayload(key);
      setCountdown(60); // 60 seconds mock simulation duration
      setViewState('checkout');
    } catch (e: any) {
      alert("Houve um erro técnico ao registrar seu agendamento: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Perform client reservation search
  const handleLookupBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupBooking(null);
    setLookupClient(null);
    setLookupSpace(null);

    const queryClean = searchQuery.trim().toLowerCase();
    if (!queryClean) {
      setLookupError("Forneça o CPF, CPF limpo, E-mail ou Código da locação.");
      return;
    }

    // Try finding booking by ID
    let foundB = existingReservas.find(r => r.id === queryClean || r.id?.toLowerCase() === queryClean);

    // If not found, try searching by client CPF or email
    if (!foundB) {
      const matchClient = clients.find(c => {
        const cpfCleanLookup = c.cpf.replace(/\D/g, "");
        const queryCleanDigits = queryClean.replace(/\D/g, "");
        return (
          c.email.toLowerCase().includes(queryClean) ||
          (queryCleanDigits !== "" && cpfCleanLookup === queryCleanDigits) ||
          c.nome.toLowerCase().includes(queryClean)
        );
      });

      if (matchClient) {
        // Find most recent booking for this client
        const clientBookings = existingReservas.filter(r => r.clienteId === matchClient.id);
        if (clientBookings.length > 0) {
          // sort by date desc
          clientBookings.sort((a,b) => b.dataEvento.localeCompare(a.dataEvento));
          foundB = clientBookings[0];
        }
      }
    }

    if (!foundB) {
      setLookupError("Nenhuma reserva ativa foi localizada com estes parâmetros de identificação. Verifique seus dados de faturamento.");
      return;
    }

    const foundC = clients.find(c => c.id === foundB.clienteId);
    const foundS = spaces.find(s => s.id === foundB.espacoId);
    const associatedP = payments.filter(p => p.reservaId === foundB.id);

    setLookupBooking(foundB);
    setLookupClient(foundC || null);
    setLookupSpace(foundS || null);
    setLookupPayments(associatedP);
    setClientPaymentComplete(foundB.status === 'Confirmado' || foundB.status === 'Realizado');
  };

  // Helper calculating total amount successfully paid so far
  const getAmountPaid = () => {
    if (!lookupPayments || lookupPayments.length === 0) return 0;
    return lookupPayments
      .filter(p => p.status === 'Confirmado')
      .reduce((sum, current) => sum + current.valor, 0);
  };

  // Propose custom correction to booking notes/observacoes
  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupBooking || !proposalText.trim()) return;

    try {
      setProposalLoading(true);
      setProposalSuccess(false);

      const updatedObservacoes = lookupBooking.observacoes 
        ? `${lookupBooking.observacoes}\n\n[Solicitação Cliente em ${new Date().toLocaleDateString('pt-BR')}]: ${proposalText}`
        : `[Solicitação Cliente em ${new Date().toLocaleDateString('pt-BR')}]: ${proposalText}`;

      const updatedResb: Reserva = {
        ...lookupBooking,
        observacoes: updatedObservacoes
      };

      await saveReserva(updatedResb);
      
      // Log
      await addActivityLog(
        "Atualização de Reserva (Cliente)",
        `Cliente via portal solicitou alterações na reserva '${lookupBooking.id}': "${proposalText.slice(0, 60)}..."`
      );

      setLookupBooking(updatedResb);
      setProposalText('');
      setProposalSuccess(true);
      setTimeout(() => setProposalSuccess(false), 4000);
    } catch (e: any) {
      alert("Falha ao registrar solicitação: " + e.message);
    } finally {
      setProposalLoading(false);
    }
  };

  // Generate public dynamic PIX inside client tracking access portal
  const handleClientGenerateCustomPix = (mode: 'sinal' | 'saldo' | 'integral' | 'custom') => {
    if (!lookupBooking) return;
    setPixMode(mode);

    let amount = 0;
    const paid = getAmountPaid();
    const total = lookupBooking.valorTotal;

    if (mode === 'sinal') {
      amount = lookupBooking.valorSinal;
    } else if (mode === 'saldo') {
      amount = Math.max(0, total - paid);
    } else if (mode === 'integral') {
      amount = total;
    } else {
      amount = Number(customPixAmount) || 100;
    }

    const payload = generateDynamicPix(amount);
    setClientGeneratedPixCode(payload);
  };

  // Confirm client simulated PIX deposit
  const handleSimulateClientPayment = async () => {
    if (!lookupBooking) return;

    try {
      setClientPixReconciling(true);

      let payAmount = 0;
      const paid = getAmountPaid();
      const total = lookupBooking.valorTotal;

      if (pixMode === 'sinal') {
        payAmount = lookupBooking.valorSinal;
      } else if (pixMode === 'saldo') {
        payAmount = Math.max(total - paid, 0);
      } else if (pixMode === 'integral') {
        payAmount = total;
      } else {
        payAmount = Number(customPixAmount) || 100;
      }

      await savePagamento({
        reservaId: lookupBooking.id,
        valor: payAmount,
        formaPagamento: 'PIX',
        status: 'Confirmado',
        dataPagamento: new Date().toISOString().substring(0, 10)
      });

      // Automatically elevate status to "Confirmado" if total paid reaches or surpasses sinal
      const updatedStatus = (paid + payAmount >= lookupBooking.valorSinal) ? 'Confirmado' as const : lookupBooking.status;

      const updatedVal: Reserva = {
        ...lookupBooking,
        status: updatedStatus
      };

      await saveReserva(updatedVal);

      await addActivityLog(
        "Pagamento Realizado (Portal)",
        `O cliente liquidou R$ ${payAmount} via portal de autoatendimento. Código da Reserva: ${lookupBooking.id}.`
      );

      // Reload
      const pUpdate = await getPagamentos();
      const rUpdate = await getReservas();
      setPayments(pUpdate);
      setExistingReservas(rUpdate);

      setLookupBooking(updatedVal);
      setLookupPayments(pUpdate.filter(p => p.reservaId === lookupBooking.id));
      
      setClientPixReconciling(false);
      setClientPaymentComplete(true);
      setClientGeneratedPixCode('');
    } catch (err: any) {
      alert("Houve uma falha ao enviar comprovante: " + err.message);
      setClientPixReconciling(false);
    }
  };

  // Stepper styles depending on active status
  const getStepStatus = (stepIndex: number, currentStatus: string) => {
    const statuses = ['Orçamento', 'Aguardando sinal', 'Confirmado', 'Realizado'];
    const currentIdx = statuses.indexOf(currentStatus);
    
    if (currentStatus === 'Cancelado') {
      return {
        bg: 'bg-red-500 border-red-505 text-white',
        text: 'text-red-500 font-bold',
        desc: 'Cancelado pelo Administrador'
      };
    }

    if (currentIdx >= stepIndex) {
      return {
        bg: 'bg-emerald-500 border-emerald-500 text-white',
        text: 'text-emerald-600 dark:text-emerald-450 font-bold',
        isCheck: true
      };
    } else if (currentIdx + 1 === stepIndex) {
      return {
        bg: 'bg-amber-500 border-amber-500 text-white animate-pulse',
        text: 'text-amber-600 dark:text-amber-450 font-bold',
        isCurrent: true
      };
    } else {
      return {
        bg: 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400',
        text: 'text-gray-400 dark:text-zinc-500 font-medium'
      };
    }
  };

  // Form selected Space dynamic calculations
  const activeSpaces = spaces.filter(s => s.status === 'Ativo');
  const currentSelectedSpace = spaces.find(s => s.id === selectedSpaceId) || activeSpaces[0] || { valorLocacao: 450, taxaLimpeza: 50 };

  // Active photo index for the selected space cover carousel
  const [heroPhotoIndex, setHeroPhotoIndex] = useState(0);

  // Reset indicator index when selected space changes
  useEffect(() => {
    setHeroPhotoIndex(0);
  }, [selectedSpaceId]);

  // Automatically cycle photos in the public header hero carousel if multiple photos exist
  useEffect(() => {
    const totalFotos = currentSelectedSpace?.fotos?.length || 0;
    if (totalFotos <= 1) return;

    const interval = setInterval(() => {
      setHeroPhotoIndex(prev => {
        const currentTotal = currentSelectedSpace?.fotos?.length || 0;
        if (currentTotal <= 1) return 0;
        return prev >= currentTotal - 1 ? 0 : prev + 1;
      });
    }, 4000); // cycle every 4 seconds

    return () => clearInterval(interval);
  }, [currentSelectedSpace]);

  const rates = getDynamicRates(selectedSpaceId, tipoEvento, dataEvento);
  const currentPrice = rates.rent;
  const currentCleaningFee = rates.cleaning;
  const currentTotal = currentPrice + currentCleaningFee;
  const signalPercent = getSignalPercent();
  const currentSinal = Math.round(currentTotal * signalPercent);

  const lessor = getLessorConfigs();

  // Days calculations for public interactive calendar
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

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
  const calendarMonthLabel = currentCalendarDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Helper to check if a day is in the past
  const isPastDate = (d: Date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    return d < today;
  };

  // Helper to format Date target to YYYY-MM-DD in a timezone-insensitive way
  const getDayIsoString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayNumeric = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayNumeric}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 selection:bg-indigo-600/10">
      
      {/* Visual Navigation Bar */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-150 dark:border-slate-800/85 sticky top-0 z-45 transition-colors shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2.5">
            {brandLogo ? (
              <img src={brandLogo} alt="Logo do Espaço" className="h-9 object-contain rounded-lg max-w-[150px]" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-sm shadow shadow-emerald-500/30 font-sans">
                ET
              </div>
            )}
            <div>
              <span className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider block">Espaço Tropical</span>
              <span className="text-[9px] text-emerald-550 font-bold uppercase tracking-widest block leading-none">Canal Público de Autoatendimento</span>
            </div>
          </div>
          
          {/* Header Tab Toggles & Admin Redirect */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-0.5 rounded-xl text-xs font-bold leading-none">
              <button
                onClick={() => {
                  setActiveTab('novareserva');
                  setViewState('form');
                }}
                className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                  activeTab === 'novareserva'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-450 hover:text-slate-800 dark:hover:text-zinc-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-505" />
                <span>Solicitar Locação</span>
              </button>
              <button
                onClick={() => setActiveTab('meuacesso')}
                className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                  activeTab === 'meuacesso'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-450 hover:text-slate-800 dark:hover:text-zinc-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-amber-505" />
                <span>Minha Reserva</span>
              </button>
            </div>

            {/* Painel Administrativo ERP Redirect button */}
            <button
              onClick={() => {
                window.location.href = window.location.origin + window.location.pathname;
              }}
              className="px-3 py-1.5 sm:py-2 rounded-xl bg-indigo-55/60 hover:bg-indigo-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-indigo-605 dark:text-indigo-400 font-extrabold text-xs flex items-center gap-1.5 transition-all border border-indigo-250/20 dark:border-slate-800 cursor-pointer shadow-sm"
              title="Ir para o Painel de Controle Administrativo (ERP)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Painel Administrativo</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        
        {/* ======================================= */}
        {/* TAB 1: FORM TO SUBMIT NEW RESERVATIONS */}
        {/* ======================================= */}
        {activeTab === 'novareserva' && (
          <div className="space-y-8 animate-fade-in">
            
            {viewState === 'form' && (
              <div className="space-y-8">
                {/* Visual Header Hero */}
                <div className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden flex flex-col md:flex-row gap-6 md:items-center">
                  <div className="absolute inset-0 opacity-15 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-400 via-indigo-950 to-slate-950"></div>
                  
                  {/* Cover Photo - Dynamic Slide Carousel (Auto-rolls and allows interactive sliding) */}
                  {(() => {
                    const spFotos = currentSelectedSpace?.fotos || [];
                    const totalFotos = spFotos.length;
                    
                    // Guarantee normalized bounds
                    const normalizedIndex = heroPhotoIndex < totalFotos ? heroPhotoIndex : 0;
                    const currentSrc = spFotos[normalizedIndex] || "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800";
                    const isPdf = isPdfFile(currentSrc);

                    return (
                      <div 
                        className="w-full md:w-52 h-40 rounded-2xl overflow-hidden shadow-md border border-white/10 flex-shrink-0 relative group text-center"
                      >
                        {/* Slide Content */}
                        <div 
                          className="w-full h-full cursor-pointer hover:opacity-95 transition-opacity"
                          onClick={() => {
                            window.open(currentSrc, '_blank');
                          }}
                        >
                          {isPdf ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-rose-500/25 text-rose-300 p-3 select-none animate-fade-in">
                              <FileText className="w-10 h-10 mb-1 text-rose-400" />
                              <span className="text-[10px] font-black uppercase tracking-wider text-center text-rose-300">Apresentação PDF</span>
                              <span className="text-[8px] text-slate-350 mt-0.5">Clique p/ abrir mídia</span>
                            </div>
                          ) : (
                            <img 
                              src={currentSrc} 
                              alt={`${currentSelectedSpace?.nome || 'Espaço'} - Foto ${normalizedIndex + 1}`} 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          )}
                        </div>

                        {/* Interactive Slide/Manual controls */}
                        {totalFotos > 1 && (
                          <>
                            {/* Left Navigation Chevron Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const prev = normalizedIndex === 0 ? totalFotos - 1 : normalizedIndex - 1;
                                setHeroPhotoIndex(prev);
                              }}
                              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-950/80 text-white border border-white/10 hover:bg-slate-900 transition-all opacity-0 group-hover:opacity-100 cursor-pointer z-20 hover:scale-110"
                              title="Foto anterior"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>

                            {/* Right Navigation Chevron Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = normalizedIndex === totalFotos - 1 ? 0 : normalizedIndex + 1;
                                setHeroPhotoIndex(next);
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-950/80 text-white border border-white/10 hover:bg-slate-900 transition-all opacity-0 group-hover:opacity-100 cursor-pointer z-20 hover:scale-110"
                              title="Próxima foto"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>

                            {/* Bullet dots indicator tray */}
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-950/60 px-2 py-1 rounded-full z-20 select-none">
                              {spFotos.map((_, dotIdx) => (
                                <button
                                  key={dotIdx}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHeroPhotoIndex(dotIdx);
                                  }}
                                  className={`h-1.5 rounded-full transition-all duration-300 ${
                                    dotIdx === normalizedIndex 
                                      ? 'w-3 bg-indigo-400' 
                                      : 'w-1.5 bg-white/40 hover:bg-white/70'
                                  }`}
                                  title={`Ir para foto ${dotIdx + 1}`}
                                />
                              ))}
                            </div>

                            {/* Text badge index overlay */}
                            <div className="absolute top-2 right-2 bg-slate-950/70 p-1 py-0.5 rounded text-[8px] font-mono font-bold text-slate-300 tracking-wider pointer-events-none select-none">
                              {normalizedIndex + 1} / {totalFotos}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  <div className="space-y-3.5 z-10 flex-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/10 text-[10px] uppercase font-black tracking-widest leading-none">
                      <Sparkles className="w-3.5 h-3.5" /> Locação integrada e desburocratizada
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Solicite seu Evento Online</h1>
                    <p className="text-xs text-indigo-200 leading-relaxed max-w-xl">
                      Faça o pré-agendamento automático e reserve sua data preferida em poucos instantes. O pagamento de arras liquida a reserva de forma imediata na agenda administrativa.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-1 text-[11px] font-mono font-bold text-slate-350">
                      <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-indigo-400" /> Espaço p/ até {currentSelectedSpace?.capacidade || 80} convidados</div>
                      <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-orange-400" /> Paisagismo & Pé Direito imponente</div>
                      <div className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-405" /> Taxa Limpeza: R$ {currentCleaningFee.toLocaleString('pt-BR')}</div>
                    </div>
                  </div>
                </div>

                {/* Main grid form */}
                <form onSubmit={handleSubmitBooking} className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-155 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                  {loading && (
                    <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm z-30 flex items-center justify-center rounded-3xl">
                      <div className="text-center space-y-2">
                        <Loader2 className="w-8 h-8 text-indigo-650 animate-spin mx-auto" />
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Processando dados e agendas...</p>
                      </div>
                    </div>
                  )}

                  {/* STEP 1: SPACE CHOSEN */}
                  <div className="md:col-span-2 border-b border-slate-100 dark:border-slate-850 pb-2">
                    <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest flex items-center gap-1.5 leading-none">
                      <MapPin className="w-4 h-4" /> 1. Disponibilidade & Escolha de Espaço
                    </h3>
                  </div>

                  <div className="space-y-1.5 md:col-span-1">
                    <label className="block text-[10px] font-extrabold text-slate-450 dark:text-zinc-500 uppercase tracking-widest">
                      Selecione o Salão Pretendido *
                    </label>
                    <select
                      value={selectedSpaceId}
                      onChange={(e) => setSelectedSpaceId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {activeSpaces.length > 0 ? (
                        activeSpaces.map(sp => (
                          <option key={sp.id} value={sp.id}>{sp.nome} ({sp.capacidade} convidados)</option>
                        ))
                      ) : (
                        <option value="espaco_1">Espaço Tropical (80 convidados)</option>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5 md:col-span-1">
                    <label className="block text-[10px] font-extrabold text-slate-450 dark:text-zinc-500 uppercase tracking-widest">
                      Data pretendida para Locação *
                    </label>
                    <input
                      type="date"
                      required
                      value={dataEvento}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={handleDateSelection}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    {/* INTERACTIVE AVAILABILITY CALENDAR */}
                    <div className="border-t border-slate-100 dark:border-slate-850 pt-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                        <div>
                          <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest flex items-center gap-1.5 leading-none">
                            <Calendar className="w-4 h-4 text-indigo-500" /> Calendário de Disponibilidade do Salão
                          </h4>
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 leading-normal max-w-xl">
                            As datas verdes estão livres! Clique para selecioná-la e segurá-la por até 24 horas na pauta oficial.
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/10">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Livre (Disponível)
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/10">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              Ocupado
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/10">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                              Sua Escolha
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                              Passado / Bloqueado
                            </span>
                          </div>
                        </div>

                        {/* Month navigators */}
                        <div className="flex items-center gap-1 self-end sm:self-auto bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 shadow-sm">
                          <button
                            type="button"
                            onClick={prevCalendarMonth}
                            className="p-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg cursor-pointer transition-all"
                            title="Mês anterior"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-black text-slate-800 dark:text-white px-2.5 capitalize tracking-wide select-none min-w-[110px] text-center">
                            {calendarMonthLabel}
                          </span>
                          <button
                            type="button"
                            onClick={nextCalendarMonth}
                            className="p-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg cursor-pointer transition-all"
                            title="Próximo mês"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* The Calendar Grid */}
                      <div className="bg-slate-50/50 dark:bg-slate-950/25 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-4">
                        {/* Weekday headers */}
                        <div className="grid grid-cols-7 gap-1.5 text-center text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono mb-2 select-none">
                          <span>Dom</span>
                          <span>Seg</span>
                          <span>Ter</span>
                          <span>Qua</span>
                          <span>Qui</span>
                          <span>Sex</span>
                          <span>Sáb</span>
                        </div>

                        {/* Days list */}
                        <div className="grid grid-cols-7 gap-1.5">
                          {daysArray.map((day, idx) => {
                            if (!day) {
                              return <div key={`empty-${idx}`} className="h-14 sm:h-16 bg-slate-500/5 dark:bg-slate-900/5 rounded-xl border border-dashed border-slate-200/10 dark:border-slate-800/20"></div>;
                            }

                            const labelIso = getDayIsoString(day);
                            const isPast = isPastDate(day);
                            const isBooked = existingReservas.some(
                              r => r.espacoId === selectedSpaceId && r.dataEvento === labelIso && (r.status === 'Confirmado' || r.status === 'Realizado')
                            );
                            const isSelected = dataEvento === labelIso;

                            let cellStyle = "";
                            let statusLabel = "";
                            let miniIcon: React.ReactNode = null;

                            if (isPast) {
                              cellStyle = "bg-slate-100/30 dark:bg-slate-950/10 border-slate-200/20 dark:border-slate-900/10 text-slate-400 dark:text-slate-600 cursor-not-allowed select-none opacity-40";
                              statusLabel = "Fechado";
                            } else if (isBooked) {
                              cellStyle = "bg-rose-50/70 dark:bg-rose-955/10 border-rose-150 dark:border-rose-950/30 text-rose-600 dark:text-rose-400 cursor-not-allowed relative overflow-hidden shadow-inner-white";
                              statusLabel = "Ocupado";
                              miniIcon = <Lock className="w-2.5 h-2.5 text-rose-400/80 dark:text-rose-600/70" />;
                            } else if (isSelected) {
                              cellStyle = "bg-gradient-to-br from-indigo-600 to-violet-700 hover:from-indigo-600 hover:to-violet-700 text-white border-violet-600 select-none shadow-md shadow-indigo-600/20 dark:shadow-indigo-900/30 transform scale-[1.03] cursor-pointer ring-4 ring-indigo-500/15 font-black transition-all duration-200";
                              statusLabel = "Escolhida";
                              miniIcon = (
                                <span className="inline-flex items-center justify-center w-3 h-3 bg-white/20 rounded-full">
                                  <Check className="w-2 h-2 stroke-[3]" />
                                </span>
                              );
                            } else {
                              cellStyle = "bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/15 dark:hover:bg-emerald-900/25 border-emerald-200/80 dark:border-emerald-800/40 hover:border-emerald-500 dark:hover:border-emerald-500 text-emerald-800 dark:text-emerald-355 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200";
                              statusLabel = "Livre";
                              miniIcon = <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />;
                            }

                            return (
                              <button
                                key={`day-btn-${labelIso}`}
                                type="button"
                                disabled={isPast || isBooked}
                                onClick={() => {
                                  setDataEvento(labelIso);
                                }}
                                className={`h-14 sm:h-16 p-2 rounded-xl border flex flex-col justify-between text-left relative ${cellStyle}`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="text-[11px] font-black tracking-wide leading-none">
                                    {day.getDate()}
                                  </span>
                                  {miniIcon}
                                </div>
                                <span className={`text-[7px] sm:text-[8px] font-black uppercase tracking-wider leading-none ${isPast || isBooked ? 'opacity-60' : isSelected ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  {statusLabel}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    {dateStatus === 'available' && (
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl leading-none flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs w-full">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span>Espaço disponível para o dia {dataEvento.split('-').reverse().join('/')}! Garanta sua reserva antes de outras propostas.</span>
                      </div>
                    )}
                    {dateStatus === 'busy' && (
                      <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl leading-none flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-xs w-full animate-bounce">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span>Este dia já está formalizado com outra locação na agenda. Por favor, escolha outra data.</span>
                      </div>
                    )}
                    {dateStatus === 'idle' && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl leading-none flex items-center gap-2 text-slate-400 font-semibold text-xs w-full">
                        <HelpCircle className="w-4 h-4" />
                        <span>Escolha um dia livre no calendário de disponibilidade acima para prosseguir com seu agendamento.</span>
                      </div>
                    )}
                  </div>

                  {/* STEP 2: EVENT SPECIFICATIONS */}
                  <div className="md:col-span-2 border-b border-slate-100 dark:border-slate-850 pb-2 pt-4">
                    <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest flex items-center gap-1.5 leading-none">
                      <PartyPopper className="w-4 h-4" /> 2. Detalhes & Configuração do Evento
                    </h3>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Tipo do Evento *</label>
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
                    <label className="block text-[10px] font-extrabold text-slate-450 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Intervalo de Horário * <span className="text-amber-500 font-bold">(Padrão: 08:00 - 18:00)</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 08:00 - 18:00"
                      value={horario}
                      onChange={(e) => setHorario(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 dark:text-zinc-500 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                      <span>Quantidade de Convidados Estimada *</span>
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 font-extrabold font-sans">No máx. 80 pessoas</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max={80}
                      value={qtdConvidados}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        if (val > 80) {
                          setQtdConvidados('80');
                        } else {
                          setQtdConvidados(e.target.value);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-450 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Observações ou Solicitações Extras</label>
                    <textarea
                      placeholder="Indique prestadores de serviço terceirizados contratados por você ou necessidades técnicas especiais do buffet..."
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      rows={3}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium rounded-xl focus:outline-none"
                    ></textarea>
                  </div>

                  {/* STEP 3: CLIENT DETAILS */}
                  <div className="md:col-span-2 border-b border-slate-100 dark:border-slate-850 pb-2 pt-4">
                    <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest flex items-center gap-1.5 leading-none">
                      <FileText className="w-4 h-4" /> 3. Dados do Cliente Contratante
                    </h3>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-450 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Clécio Ferreira Corretor"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 dark:text-zinc-500 uppercase tracking-widest mb-1.5 font-mono">CPF ou CNPJ Contratante *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 000.000.000-00 / 00.000.000/0001-00"
                      value={cpf}
                      onChange={(e) => setCpf(formatCPFOrCNPJ(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-450 dark:text-zinc-500 uppercase tracking-widest mb-1.5">WhatsApp / Celular com DDD *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: (11) 99123-4567"
                      value={telefone}
                      onChange={(e) => setTelefone(formatPhone(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none font-mono"
                    />
                  </div>

                  <div className="md:col-span-2 col-span-1">
                    <label className="block text-[10px] font-extrabold text-slate-450 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Endereço Residencial Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Av. Paulista, 1000, Apto 24 - São Paulo - SP"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2 col-span-1">
                    <label className="block text-[10px] font-extrabold text-slate-450 dark:text-zinc-500 uppercase tracking-widest mb-1.5">E-mail para faturamento e contrato *</label>
                    <input
                      type="email"
                      required
                      placeholder="Ex: clecio@outlook.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none"
                    />
                  </div>

                  {/* PRICING BUDGET SUMMARY SIMULATION */}
                  <div className="md:col-span-2 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-850 p-4 rounded-2xl space-y-3">
                    <h4 className="text-xs font-extrabold uppercase text-gray-800 dark:text-white pb-1.5 border-b border-slate-200 dark:border-slate-850 tracking-wider">
                      Resumo Prévio do Orçamento para Locação
                    </h4>
                    <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-500 dark:text-neutral-400">
                      <div>Diária de Locação Base:</div>
                      <div className="text-right font-mono font-bold text-slate-800 dark:text-zinc-200">
                        R$ {currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>

                      <div>Taxa de Limpeza Obrigatória:</div>
                      <div className="text-right font-mono font-bold text-slate-800 dark:text-zinc-200">
                        R$ {currentCleaningFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>

                      <div className="border-t border-slate-205 dark:border-slate-800 pt-2 font-bold text-slate-800 dark:text-zinc-200 uppercase">
                        Custo Estimado Global:
                      </div>
                      <div className="border-t border-slate-205 dark:border-slate-800 pt-2 text-right font-mono font-extrabold text-indigo-650 dark:text-indigo-400">
                        R$ {currentTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>

                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Sinal de Entrada Necessário (30% Arras):
                      </div>
                      <div className="text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        R$ {currentSinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* LGPD PUBLIC PORTAL CHECKBOX PANEL */}
                  <div className="md:col-span-2 bg-indigo-50/50 dark:bg-slate-950/40 p-4 rounded-2xl border border-indigo-100/50 dark:border-slate-800 space-y-3">
                    <div className="flex items-start gap-3">
                      <input
                        id="public-lgpd-checkbox"
                        type="checkbox"
                        checked={consentLGPD}
                        onChange={(e) => setConsentLGPD(e.target.checked)}
                        className="mt-1 w-5 h-5 text-indigo-650 border-slate-300 rounded focus:ring-indigo-600 cursor-pointer"
                      />
                      <div className="text-xs space-y-1">
                        <label htmlFor="public-lgpd-checkbox" className="font-black text-slate-850 dark:text-zinc-200 select-none cursor-pointer flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-450" />
                          Consentimento de Privacidade de Dados (Lei 13.709/18) *
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-neutral-400 leading-relaxed">
                          Ao solicitar a reserva de pauta, eu declaro consentimento livre para preenchimento e armazenamento dos meus dados pessoais essenciais (Nome, CPF/CNPJ, E-mail, Telefones e Endereço) com a finalidade única de confecção de contratos de locação física e controle de pautas de reservas. Nossos sistemas cumprem as boas práticas de segurança contra vazamentos de dados regulados pela LGPD.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Submit CTA */}
                  <div className="md:col-span-2 pt-6 border-t border-slate-100 dark:border-slate-850">
                    <button
                      type="submit"
                      disabled={dateStatus === 'busy'}
                      className={`w-full py-4 text-xs font-black uppercase text-center rounded-2xl transition shadow-lg tracking-widest cursor-pointer ${
                        dateStatus === 'busy'
                          ? 'bg-slate-250 dark:bg-slate-800 text-slate-450 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                      }`}
                    >
                      Formalizar Ficha Reservas & Gerar PIX do Sinal
                    </button>
                  </div>

                </form>
              </div>
            )}

            {/* INSTANT PIX PAYMENT CHECKOUT (FOR NEWLY CREATED) */}
            {viewState === 'checkout' && createdBooking && (
              <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6 animate-scale-up font-sans text-center relative">
                
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-100 dark:border-indigo-900/30">
                  <QrCode className="w-6 h-6 animate-pulse" />
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Ficha Pré-Agendada!
                  </h2>
                  <p className="text-[11px] text-slate-450 leading-normal max-w-xs mx-auto">
                    Efetue o sinal de {createdBooking.valorTotal > 0 ? Math.round((createdBooking.valorSinal / createdBooking.valorTotal) * 100) : 50}% via PIX para o faturamento imediato e bloqueio oficial da data em nossa agenda de reservas.
                  </p>
                </div>

                {/* invoice details summary */}
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-2.5 text-xs text-left">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Espaço de Locação:</span>
                    <strong className="text-slate-800 dark:text-white font-bold">
                      {spaces.find(s => s.id === createdBooking.espacoId)?.nome || "Espaço de Locação"}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Data Escolhida:</span>
                    <strong className="text-indigo-650 dark:text-indigo-400 font-bold font-mono">
                      {createdBooking.dataEvento.split('-').reverse().join('/')}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Finalidade / Tipo:</span>
                    <strong className="text-slate-850 dark:text-slate-300">{createdBooking.tipoEvento}</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 border-t border-slate-150 dark:border-slate-800/60 pt-2 text-md">
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 border-b border-dashed border-slate-205">SINAL DE ARRAS ({createdBooking.valorTotal > 0 ? Math.round((createdBooking.valorSinal / createdBooking.valorTotal) * 100) : 50}%):</span>
                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                      R$ {createdBooking.valorSinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 leading-none">
                    <span>Valor Integral Estimado:</span>
                    <span>R$ {createdBooking.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Visual QR code styled box */}
                <div className="w-36 h-36 bg-white p-2 border border-slate-150 dark:border-slate-800 rounded-2xl mx-auto flex items-center justify-center relative shadow-sm">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(pixPayload)}`}
                    alt="QR Code Pix"
                    className="w-32 h-32 object-contain"
                    referrerPolicy="no-referrer"
                  />
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
                        <span>Copiar Chave</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Regenerate Button */}
                <button
                  type="button"
                  onClick={handleRegenerateCheckoutPix}
                  className="w-full py-2 px-3 bg-indigo-55 dark:bg-slate-950 hover:bg-indigo-100 dark:hover:bg-slate-850 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl cursor-pointer transition flex items-center justify-center gap-1.5 border border-indigo-100 dark:border-slate-800"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Gerar Novo Código (Re-gerar PIX)</span>
                </button>

                 {/* simulated reconciliation notifier */}
                 {countdown > 0 ? (
                   <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                     <Loader2 className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0 mt-0.5" />
                     <div className="text-left leading-normal text-[11px]">
                       <p className="font-extrabold text-amber-800 dark:text-amber-400">Verificando pagamento...</p>
                       <p className="text-slate-450 mt-1">Nossa integração bancária conciliará seu depósito PIX em até <strong>{countdown} segundos</strong>.</p>
                     </div>
                   </div>
                 ) : (
                   <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                     <span className="text-red-500 font-bold flex-shrink-0 mt-0.5">⚠️</span>
                     <div className="text-left leading-normal text-[11px]">
                       <p className="font-extrabold text-red-800 dark:text-red-400">Código PIX Expirado!</p>
                       <p className="text-slate-450 mt-1">O prazo de conciliação bancária temporária encerrou. Clique em "Re-gerar PIX" para obter novo código, ou clique no botão abaixo para simular compesação manual.</p>
                     </div>
                   </div>
                 )}

                {/* 24h official hold check instruction banner */}
                <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-150 dark:border-indigo-900/40 rounded-xl flex items-start gap-3 text-left">
                  <Clock className="w-4.5 h-4.5 text-indigo-500 flex-shrink-0 mt-0.5 animate-pulse" />
                  <div className="leading-snug text-[11px]">
                    <p className="font-black text-indigo-850 dark:text-indigo-400 uppercase tracking-wide">Pauta Garantida por 24 Horas</p>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      Este pré-agendamento registrou o bloqueio da data ({createdBooking.dataEvento.split('-').reverse().join('/')}) na pauta do salão sob o status <span className="font-bold text-amber-600 dark:text-amber-400">Aguardando sinal</span>. Esta prioridade é válida por até <strong>24 horas</strong>. Caso o sinal de faturamento não seja identificado no prazo, a data será liberada automaticamente.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCompletePayment}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
                >
                  Confirmar Pagamento do Sinal (Demonstração)
                </button>

              </div>
            )}

            {/* EVENT AGENDADO SUCCESS RECEIPTS */}
            {viewState === 'success' && createdBooking && (
              <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6 animate-scale-up font-sans text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>

                <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-lg shadow-emerald-500/15 animate-bounce">
                  <ShieldCheck className="w-7 h-7" />
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Sua Locação foi Confirmada!
                  </h2>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold leading-normal max-w-xs mx-auto uppercase tracking-wide">
                    O sinal de entrada foi debitado pelo Gateway de Pagamentos.
                  </p>
                </div>

                {/* Interactive receipt */}
                <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-3 text-xs text-left">
                  <div className="text-center font-bold text-[10px] uppercase text-indigo-650 dark:text-indigo-400 tracking-widest border-b border-slate-200 dark:border-slate-850 pb-2">
                    Recibo Oficial de Quitação de Sinal
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Código do Agendamento:</span>
                    <strong className="font-mono text-[9px] text-slate-800 dark:text-white uppercase">{createdBooking.id}</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Espaço de Eventos:</span>
                    <strong className="text-slate-855 dark:text-slate-205">
                      {spaces.find(s => s.id === createdBooking.espacoId)?.nome || "Espaço Tropical"}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Data Reservada:</span>
                    <strong className="font-mono text-indigo-600 dark:text-indigo-450 font-bold">
                      {createdBooking.dataEvento.split('-').reverse().join('/')}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Contratante / Cliente:</span>
                    <strong className="text-slate-800 dark:text-white font-bold">{nome}</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-850">
                    <span>Sinal Pago via PIX:</span>
                    <strong className="font-mono text-emerald-600 dark:text-emerald-405 font-black">
                      R$ {createdBooking.valorSinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Contrato do Evento:</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-extrabold uppercase text-[7px] leading-none border border-emerald-500/10 font-mono">
                      ASSINADO DIGITALMENTE
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl text-[8px] font-mono border border-slate-150 dark:border-slate-850 text-slate-400 leading-none">
                  INTEGRAÇÃO: EVENT_GATEWAY_{createdBooking.id} <br/>
                  AUTENTICAÇÃO: {Date.now().toString().slice(-10)}
                </div>

                {/* Action CTA */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => {
                      // Navigate to client access of this specific booking
                      setLookupBooking(createdBooking);
                      setLookupClient(createdClient);
                      setLookupSpace(spaces.find(s => s.id === createdBooking.espacoId) || null);
                      setLookupPayments(payments.filter(p => p.reservaId === createdBooking.id));
                      setClientPaymentComplete(true);
                      setActiveTab('meuacesso');
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Entrar no Portal do Cliente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  
                  <button
                    onClick={() => {
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
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
                  >
                    Fazer Novo Agendamento
                  </button>
                </div>

              </div>
            )}

            {/* Footer institutional credits */}
            <div className="text-center space-y-1">
              <p className="text-[10px] text-slate-400 font-extrabold">CAMPUS GESTÃO DE EVENTOS INTEGRADAS</p>
              <p className="text-[9px] text-slate-450 leading-relaxed max-w-sm mx-auto">
                Para suporte técnico ou dúvidas cadastrais, acerte diretamente com nosso gestor de faturamento através do painel de controle administrativo.
              </p>
            </div>

          </div>
        )}

        {/* ======================================= */}
        {/* TAB 2: PORTAL DE ACESSO & LOOKUP CLIENT   */}
        {/* ======================================= */}
        {activeTab === 'meuacesso' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Search Lookup bar if not loaded */}
            {!lookupBooking ? (
              <div className="max-w-xl mx-auto space-y-6">
                
                <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-md text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-100/30">
                    <Search className="w-6 h-6 animate-pulse" />
                  </div>
                  
                  <div className="space-y-1">
                    <h2 className="text-md font-bold text-slate-900 dark:text-white uppercase tracking-wider">Acesso Privado do Cliente</h2>
                    <p className="text-[11px] text-slate-450 dark:text-zinc-400 max-w-xs mx-auto leading-normal">
                      Insira o seu CPF/CNPJ de faturamento ou o Código da locação para acompanhar pagamentos e visualizar termos.
                    </p>
                  </div>

                  <form onSubmit={handleLookupBooking} className="space-y-3.5 text-xs text-left">
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                        Identificador da Locação ou Contratante:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: res_1 ou CPF 000.000.000-00"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 text-xs font-bold rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder-slate-400"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-center leading-none tracking-widest uppercase transition flex items-center justify-center gap-2"
                    >
                      <span>Acessar Meu Painel</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </form>

                  {lookupError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl leading-relaxed text-left text-xs font-semibold text-red-600 dark:text-red-400 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <span>{lookupError}</span>
                    </div>
                  )}
                </div>

                {/* Helpful tips */}
                <div className="p-4 bg-amber-500/5 border border-amber-500/10 text-amber-800 dark:text-amber-400 text-xs leading-normal rounded-2xl space-y-1.5">
                  <p className="font-extrabold uppercase text-[10px] tracking-wider leading-none">Como encontrar o código?</p>
                  <p className="opacity-95 text-[11px] leading-relaxed">
                    Nossa equipe envia o código identificador (como <code className="bg-amber-100 dark:bg-slate-800 p-0.5 px-1 rounded text-red-600 font-mono">res_1</code> ou <code className="bg-amber-100 dark:bg-slate-800 p-0.5 px-1 rounded text-red-600 font-mono">res_2</code>) por email ou WhatsApp logo após o fechamento da proposta. Você também pode buscar utilizando apenas os numerais de seu CPF/CNPJ cadastrado.
                  </p>
                </div>

              </div>
            ) : (
              
              /* PORTAL ACTIVE SCREEN */
              <div className="space-y-8">
                
                {/* Header Welcome Card */}
                <div className="bg-gradient-to-tr from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 border border-white/5 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1 bg-indigo-700/55 px-3 py-1 rounded-full border border-indigo-500/30 font-bold text-[10px] tracking-widest uppercase text-indigo-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Painel Geral do Evento
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
                      Olá, {lookupClient?.nome || "Estimado Cliente"}
                    </h1>
                    <p className="text-xs text-indigo-200/90 max-w-lg leading-relaxed">
                      Este é o seu portal particular. Aqui você acompanha status de cobranças, envia feedbacks ao gestor do espaço e pre-visualiza o contrato da diária.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-shrink-0 font-bold text-xs">
                    <button
                      onClick={() => setShowContractSheet(true)}
                      className="p-3 bg-white/10 hover:bg-white/20 hover:text-white rounded-xl text-white transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <FileSignature className="w-4 h-4 text-amber-400" />
                      <span>Visualizar Meu Contrato</span>
                    </button>
                    <button
                      onClick={() => {
                        setLookupBooking(null);
                        setLookupClient(null);
                        setLookupSpace(null);
                        setLookupPayments([]);
                        setSearchQuery('');
                        setClientPaymentComplete(false);
                      }}
                      className="p-3 bg-red-500/20 hover:bg-red-500/35 hover:text-white rounded-xl text-red-350 transition cursor-pointer text-center"
                    >
                      Sair do Portal
                    </button>
                  </div>
                </div>

                {/* Progress stepper tracking */}
                <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
                  <div className="border-b border-slate-100 dark:border-slate-850 pb-2 flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-widest">
                      Linha do Tempo / Status de Validação
                    </h3>
                    <span className="font-mono text-[9px] text-slate-400 bg-slate-50 dark:bg-slate-950 p-1 rounded border dark:border-slate-800 uppercase font-semibold leading-none">
                      Reg: {lookupBooking.id}
                    </span>
                  </div>

                  {/* Visual Timeline drawing */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 relative pt-2">
                    
                    {/* Stepper 1: Orçamento */}
                    <div className="flex items-start sm:flex-col items-center gap-3">
                      <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold font-mono shadow-sm transition-all ${getStepStatus(0, lookupBooking.status).bg}`}>
                        {getStepStatus(0, lookupBooking.status).isCheck ? <Check className="w-4 h-4" /> : '1'}
                      </div>
                      <div className="sm:text-center space-y-1">
                        <p className={`text-xs uppercase tracking-wider leading-none ${getStepStatus(0, lookupBooking.status).text}`}>Orçamento</p>
                        <p className="text-[10px] text-slate-400 leading-normal max-w-[120px] mx-auto">Termos de contrato elaborados por telefone.</p>
                      </div>
                    </div>

                    {/* Stepper 2: Aguardando Sinal */}
                    <div className="flex items-start sm:flex-col items-center gap-3">
                      <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold font-mono shadow-sm transition-all ${getStepStatus(1, lookupBooking.status).bg}`}>
                        {getStepStatus(1, lookupBooking.status).isCheck ? <Check className="w-4 h-4" /> : '2'}
                      </div>
                      <div className="sm:text-center space-y-1">
                        <p className={`text-xs uppercase tracking-wider leading-none ${getStepStatus(1, lookupBooking.status).text}`}>Aguardando Sinal</p>
                        <p className="text-[10px] text-slate-400 leading-normal max-w-[120px] mx-auto">No aguardo do PIX de arras de 30%.</p>
                      </div>
                    </div>

                    {/* Stepper 3: Confirmado */}
                    <div className="flex items-start sm:flex-col items-center gap-3">
                      <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold font-mono shadow-sm transition-all ${getStepStatus(2, lookupBooking.status).bg}`}>
                        {getStepStatus(2, lookupBooking.status).isCheck ? <Check className="w-4 h-4" /> : '3'}
                      </div>
                      <div className="sm:text-center space-y-1">
                        <p className={`text-xs uppercase tracking-wider leading-none ${getStepStatus(2, lookupBooking.status).text}`}>Confirmado</p>
                        <p className="text-[10px] text-slate-400 leading-normal max-w-[120px] mx-auto">Data definitivamente bloqueada na agenda oficial.</p>
                      </div>
                    </div>

                    {/* Stepper 4: Realizado */}
                    <div className="flex items-start sm:flex-col items-center gap-3">
                      <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold font-mono shadow-sm transition-all ${getStepStatus(3, lookupBooking.status).bg}`}>
                        {getStepStatus(3, lookupBooking.status).isCheck ? <Check className="w-4 h-4" /> : '4'}
                      </div>
                      <div className="sm:text-center space-y-1">
                        <p className={`text-xs uppercase tracking-wider leading-none ${getStepStatus(3, lookupBooking.status).text}`}>Realizado</p>
                        <p className="text-[10px] text-slate-400 leading-normal max-w-[120px] mx-auto">Festa bem sucedida e encerrada.</p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Primary grid detailing space values on the left and dynamic PIX / feedback on the right */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Left Column: Specifications card */}
                  <div className="md:col-span-2 space-y-6">
                    
                    {/* Event summary Specifications details */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                      <h4 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider">
                        Especificações Técnicas Contratadas
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Espaço Alocado</p>
                          <p className="font-bold text-slate-850 dark:text-zinc-200">{lookupSpace?.nome || "Espaço Tropical"}</p>
                          <p className="text-[10px] text-slate-400">Capacidade p/ {lookupSpace?.capacidade || 350} pessoas</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Data e Horários</p>
                          <p className="font-bold font-mono text-indigo-600 dark:text-indigo-400">
                            {new Date(lookupBooking.dataEvento + "T00:00:00").toLocaleDateString('pt-BR', { dateStyle: 'long' })}
                          </p>
                          <p className="text-[10px] text-slate-400">Duração temporária: {lookupBooking.horario}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Tipo de Cerimônia</p>
                          <p className="font-bold text-slate-800 dark:text-zinc-300">{lookupBooking.tipoEvento}</p>
                          <p className="text-[10px] text-slate-400">Esperados: {lookupBooking.qtdConvidados} convidados</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Cliente Registrado</p>
                          <p className="font-bold text-slate-800 dark:text-zinc-300">{lookupClient?.nome}</p>
                          <p className="text-[10px] text-slate-400">E-mail: {lookupClient?.email}</p>
                        </div>
                        <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-850 space-y-1">
                          <p className="text-[9px] text-slate-450 font-extrabold uppercase">Termos Adicionais & Memorando</p>
                          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border dark:border-slate-850 border-dashed text-[11px] text-slate-600 dark:text-zinc-400 italic leading-relaxed whitespace-pre-line">
                            {lookupBooking.observacoes || "Nenhum memorando extra cadastrado por nossa assessoria de faturamento."}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Propose alterations to active observations directly to admin */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-805 p-5 rounded-3xl shadow-sm space-y-4">
                      <div>
                        <h4 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider">
                          Solicitar Ajustes ou Comunicar observações
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Deseja alterar o número de convidados, fazer solicitações ou relatar um acerto? Escreva abaixo e a informação será registrada diretamente na ficha do painel do administrador do ERP.
                        </p>
                      </div>

                      <form onSubmit={handleSendProposal} className="space-y-3">
                        <textarea
                          placeholder="Digite aqui sua mensagem ou alteração solicitada ao gestor de eventos..."
                          required
                          value={proposalText}
                          onChange={(e) => setProposalText(e.target.value)}
                          rows={3}
                          className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white rounded-xl focus:outline-none"
                        ></textarea>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[10px] text-slate-400 font-semibold italic">✓ Comunicação direta e criptografada</span>
                          <button
                            type="submit"
                            disabled={proposalLoading || !proposalText.trim()}
                            className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold p-2 px-5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                          >
                            {proposalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            <span>Enviar ao Administrador</span>
                          </button>
                        </div>
                      </form>

                      {proposalSuccess && (
                        <div className="p-3 bg-emerald-55/15 border border-emerald-500/25 rounded-xl text-emerald-600 dark:text-emerald-450 text-xs font-bold flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-505" />
                          <span>Sua mensagem foi enviada ao ERP e sincronizada com sucesso na base do administrador!</span>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Right Column: Billing, Dynamic payments & customized PIX Options */}
                  <div className="space-y-6">
                    
                    {/* Global billing summary status */}
                    <div className="bg-slate-900 text-white border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4">
                      <h4 className="text-xs font-black uppercase text-amber-400 tracking-widest block font-mono">
                        Resumo Geral do Faturamento
                      </h4>

                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between items-center text-slate-420">
                          <span>Total Contratado:</span>
                          <strong className="font-mono text-white text-md">
                            R$ {lookupBooking.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div className="flex justify-between items-center text-slate-420">
                          <span>Sinal Exigido (30%):</span>
                          <strong className="font-mono text-white">
                            R$ {lookupBooking.valorSinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div className="flex justify-between items-center text-emerald-400 border-t border-slate-800 pt-2.5">
                          <span className="font-bold">Total Pago (Quitado):</span>
                          <strong className="font-mono text-sm">
                            R$ {getAmountPaid().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div className="flex justify-between items-center text-amber-405">
                          <span>Saldo Restante:</span>
                          <strong className="font-mono text-white">
                            R$ {Math.max(0, lookupBooking.valorTotal - getAmountPaid()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      </div>

                      {/* Payment Records Ledger inside client portal */}
                      <div className="pt-3 border-t border-slate-800 space-y-2">
                        <p className="text-[9px] uppercase tracking-wider text-slate-450 font-bold block">Histórico de Quitações Sincronizado</p>
                        
                        {lookupPayments.length > 0 ? (
                          <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                            {lookupPayments.map((p, idx) => (
                              <div key={p.id || idx} className="bg-slate-950 p-2 rounded-lg border border-slate-850 flex justify-between items-center text-[10px] font-mono leading-none">
                                <div className="space-y-1 text-left">
                                  <p className="text-white font-bold">R$ {p.valor.toLocaleString('pt-BR')}</p>
                                  <p className="text-slate-400 text-[8px]">{p.dataPagamento.split('-').reverse().join('/')} - {p.formaPagamento}</p>
                                </div>
                                <span className="px-1 px-1.5 rounded bg-emerald-500/10 text-emerald-405 font-bold uppercase text-[7px] leading-none border border-emerald-500/20">
                                  {p.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] italic text-slate-400 font-mono">Nenhum pagamento registrado no momento.</p>
                        )}
                      </div>
                    </div>

                    {/* DYNAMIC PIX GENERATION ON THE FLY FOR CLIENT PORTAL */}
                    {!clientPaymentComplete && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-5">
                        <h4 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider">
                          Efetuar Pagamento / Quitação
                        </h4>

                        <div className="space-y-2.5 text-xs">
                          <p className="text-[10px] text-slate-405">Escolha uma modalidade de quitação para gerar o PIX dinâmico correspondente:</p>
                          
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold font-mono">
                            <button
                              onClick={() => handleClientGenerateCustomPix('sinal')}
                              className={`p-2 border rounded-xl rounded-lg text-center cursor-pointer transition ${pixMode === 'sinal' ? 'border-indigo-500 bg-indigo-500/5 text-indigo-650 dark:text-white' : 'border-slate-200 dark:border-slate-800 text-slate-450'}`}
                            >
                              Sinal 30% (R$ {lookupBooking.valorSinal.toLocaleString('pt-BR')})
                            </button>
                            <button
                              onClick={() => handleClientGenerateCustomPix('saldo')}
                              className={`p-2 border rounded-xl rounded-lg text-center cursor-pointer transition ${pixMode === 'saldo' ? 'border-indigo-500 bg-indigo-500/5 text-indigo-650 dark:text-white' : 'border-slate-200 dark:border-slate-800 text-slate-450'}`}
                            >
                              Saldo Restante (R$ {(lookupBooking.valorTotal - getAmountPaid()).toLocaleString('pt-BR')})
                            </button>
                            <button
                              onClick={() => handleClientGenerateCustomPix('integral')}
                              className={`p-2 border rounded-xl rounded-lg text-center cursor-pointer transition ${pixMode === 'integral' ? 'border-indigo-500 bg-indigo-500/5 text-indigo-650 dark:text-white' : 'border-slate-200 dark:border-slate-800 text-slate-450'}`}
                            >
                              Faturar Integral (R$ {lookupBooking.valorTotal.toLocaleString('pt-BR')})
                            </button>
                            <button
                              onClick={() => handleClientGenerateCustomPix('custom')}
                              className={`p-2 border rounded-xl rounded-lg text-center cursor-pointer transition ${pixMode === 'custom' ? 'border-indigo-500 bg-indigo-500/5 text-indigo-650 dark:text-white' : 'border-slate-200 dark:border-slate-800 text-slate-450'}`}
                            >
                              Outro Valor R$
                            </button>
                          </div>

                          {pixMode === 'custom' && (
                            <div className="space-y-1">
                              <label className="text-[9px] text-slate-400 font-bold block">Valor customizado para transferência (R$):</label>
                              <input
                                type="number"
                                required
                                value={customPixAmount}
                                onChange={(e) => setCustomPixAmount(e.target.value)}
                                className="w-full p-2 bg-slate-50 dark:bg-slate-950 text-xs font-bold border border-slate-205 dark:border-slate-850 rounded-xl"
                              />
                              <button
                                onClick={() => handleClientGenerateCustomPix('custom')}
                                className="w-full py-1.5 bg-slate-850 dark:bg-slate-800 text-[10px] text-white font-bold rounded-lg mt-1 cursor-pointer hover:bg-slate-900"
                              >
                                Re-calcular Chave Pix
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Interactive trigger code CTA */}
                        {!clientGeneratedPixCode ? (
                          <button
                            onClick={() => handleClientGenerateCustomPix(pixMode)}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition flex items-center justify-center gap-1.5 shadow"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>Gerar Pix Oficial Agora</span>
                          </button>
                        ) : (
                          /* Render generated details */
                          <div className="space-y-4 pt-1 animate-scale-up text-center">
                            
                            {/* Visual QR code styled box */}
                            <div className="w-32 h-32 bg-white p-2 border border-slate-160 dark:border-slate-800 rounded-2xl mx-auto flex items-center justify-center relative shadow-sm">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(clientGeneratedPixCode)}`}
                                alt="QR Code Pix"
                                className="w-28 h-28 object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>

                            {/* Copy-paste input */}
                            <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl flex items-center justify-between text-[10px] border dark:border-slate-850">
                              <span className="truncate flex-1 pr-1 font-mono text-slate-450">{clientGeneratedPixCode}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(clientGeneratedPixCode);
                                  setClientPixCopied(true);
                                  setTimeout(() => setClientPixCopied(false), 2000);
                                }}
                                className="bg-indigo-50 hover:bg-indigo-100 p-1 px-2.5 rounded text-indigo-650 font-bold transition flex items-center gap-1 flex-shrink-0 cursor-pointer text-[9px]"
                              >
                                {clientPixCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                <span>{clientPixCopied ? 'Copiou!' : 'Copia-Cola'}</span>
                              </button>
                            </div>

                            {/* Simulated payment confirmation */}
                            {clientPixReconciling ? (
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-xs rounded-xl flex items-center gap-2.5 text-left font-semibold">
                                <Loader2 className="w-4 h-4 animate-spin text-amber-500 flex-shrink-0" />
                                <div className="leading-none space-y-1">
                                  <p className="text-amber-850 leading-none">Conciliando lote no Banco Central (BACEN)...</p>
                                  <p className="text-slate-455 text-[10px] leading-none text-slate-400">Verificação automática em progresso.</p>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={handleSimulateClientPayment}
                                className="w-full py-2 bg-emerald-505 hover:bg-emerald-600 text-white hover:text-white font-extrabold text-xs tracking-wider rounded-xl transition cursor-pointer"
                              >
                                Simular Depósito & Confirmar Pagamento
                              </button>
                            )}

                          </div>
                        )}
                      </div>
                    )}

                    {clientPaymentComplete && (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-820 dark:text-emerald-400 text-xs font-semibold rounded-3xl space-y-1.5 flex flex-col items-center text-center">
                        <CheckCircle className="w-8 h-8 text-emerald-500 animate-bounce" />
                        <div>
                          <p className="font-extrabold uppercase leading-none mb-1 text-[10px] tracking-wide">Faturamento Confirmado!</p>
                          <p className="opacity-95 leading-normal text-[11px]">Muito obrigado! O processamento do sinal de arras foi quitado e o bloqueio da data foi homologado com sucesso em nosso calendário.</p>
                        </div>
                      </div>
                    )}

                  </div>

                </div>

              </div>
            )}

            {/* Footer Institutional credits */}
            <div className="text-center space-y-1">
              <p className="text-[10px] text-slate-400 font-extrabold">CAMPUS GESTÃO DE EVENTOS CORPORATIVOS</p>
              <p className="text-[9px] text-slate-455 leading-relaxed max-w-sm mx-auto">
                Espaço Tropical ERP, powered by EventSpace Corp. Protocolo de transações em conformidade estrita com o BACEN e as regulamentações governamentais de turismo.
              </p>
            </div>

          </div>
        )}

      </div>

      {/* ======================================= */}
      {/* FULL WRAPPER A4 PRINT SHEET CONTRACT PREVIEW MODAL */}
      {/* ======================================= */}
      {showContractSheet && lookupBooking && lookupClient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-100 dark:bg-slate-950 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-250 dark:border-slate-800">
            
            <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-900 px-6">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-xs font-extrabold tracking-wider uppercase text-slate-900 dark:text-white leading-none">Contrato de Locação Particular</h3>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">Reg: #{lookupBooking.id} | EventSpace ERP - Visualização do Contratante</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 hover:text-indigo-705 dark:bg-indigo-950 dark:text-indigo-405 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir PDF</span>
                </button>
                <button
                  onClick={() => setShowContractSheet(false)}
                  className="p-2 rounded-xl text-slate-400 bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 hover:text-slate-905"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Simulated Papel Oficio HTML display with details */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-14 bg-white/70 dark:bg-slate-900/45 relative">
              <div 
                id="printable-client-contract-area" 
                className="bg-white border border-neutral-300 dark:border-slate-800 shadow-xl p-8 sm:p-14 text-neutral-850 rounded-2xl relative overflow-hidden text-sm"
                style={{ backgroundImage: 'radial-gradient(#ebebeb 1px, transparent 1px)', backgroundSize: '24px 24px' }}
              >
                
                {/* Visual Watermark representing authenticity */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.012] pointer-events-none select-none">
                  <div className="w-80 h-80 rounded-full border-[18px] border-neutral-900 flex items-center justify-center">
                    <span className="font-sans text-3xl font-extrabold uppercase tracking-[0.2em] transform -rotate-12">AUTÊNTICO</span>
                  </div>
                </div>

                <div className="space-y-4 font-serif text-[12.5px] text-neutral-900 leading-relaxed text-justify relative z-10">
                  {/* Letterhead Header */}
                  <div className="text-center border-b-2 border-double border-neutral-300 pb-4 mb-6 font-sans">
                    <div className="flex justify-center items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-655 inline-block"></span>
                      <span className="text-xs font-black tracking-widest uppercase text-neutral-950">{lessor.nomeFantasia}</span>
                      <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">{lessor.razaoSocial} | CNPJ: {lessor.cnpjCpf}</p>
                    <p className="text-[9px] text-neutral-400 font-medium">{lessor.endereco}</p>
                  </div>

                  {/* Parse content */}
                  {generateDefaultContractText(
                    lookupBooking, 
                    lookupClient, 
                    lookupSpace || { nome: "Espaço Tropical", capacidade: 80, valorLocacao: 450, taxaLimpeza: 50, fotos: [], status: 'Ativo' },
                    lessor
                  ).split('\n').map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) {
                      return <div key={idx} className="h-3" />;
                    }

                    // Section titles like I., II.
                    if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+/.test(trimmed)) {
                      return (
                        <h3 key={idx} className="text-xs font-extrabold tracking-wider text-neutral-900 uppercase mt-5 mb-1.5 font-sans border-l-2 border-indigo-600 pl-2">
                          {trimmed}
                        </h3>
                      );
                    }

                    // Main Header upper
                    if (trimmed === trimmed.toUpperCase() && trimmed.length > 20 && !trimmed.startsWith('LOCADOR') && !trimmed.startsWith('LOCATÁRIO')) {
                      return (
                        <h2 key={idx} className="text-[13px] font-black text-center tracking-wide text-neutral-950 uppercase border-b border-dashed border-neutral-300 pb-1.5 my-4 font-sans">
                          {trimmed}
                        </h2>
                      );
                    }

                    // Signature block lines
                    if (trimmed.startsWith('___') || trimmed.includes('(LOCADOR)') || trimmed.includes('(LOCATÁRIO)')) {
                      return (
                        <p key={idx} className="text-center text-[10px] font-sans text-neutral-500 font-bold tracking-wide my-4">
                          {trimmed}
                        </p>
                      );
                    }

                    // Normal paragraphs
                    return (
                      <p key={idx} className="indent-6 text-justify">
                        {trimmed}
                      </p>
                    );
                  })}

                  {/* Electron Stamp */}
                  <div className="pt-8 mt-12 border-t border-neutral-200 flex justify-between items-center text-[8.5px] text-neutral-400 font-sans">
                    <span>Assinado e Auditado via Chave Eletrônica: #ES-{lookupBooking.id}</span>
                    <span>EventSpace ERP - Protocolo BACEN nº 183.904</span>
                  </div>

                </div>

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
