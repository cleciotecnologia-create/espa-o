/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Workflow, 
  Users, 
  Link, 
  Lock, 
  Clock, 
  QrCode, 
  FileText, 
  Sparkles, 
  Send, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  Copy, 
  RefreshCw, 
  HelpCircle,
  FileCheck,
  Zap,
  Check,
  Calendar,
  DollarSign
} from 'lucide-react';
import { getClientes, getEspacos, saveCliente, saveReserva, saveContrato, addActivityLog, getReservas } from '../services/db';
import { formatCPFOrCNPJ, validateCPFOrCNPJ } from '../services/validation';
import { getLessorConfigs, triggerPaymentNotification, triggerContractNotification } from '../services/notifications';
import { WebhookHandler, WebhookPayload, WebhookHandlerResult } from '../services/webhookHandler';
import { Cliente, Espaco, Reserva, Pagamento, Contrato } from '../types';

export default function FunnelView() {
  // Configs & Data States
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [espacos, setEspacos] = useState<Espaco[]>([]);
  const lessor = getLessorConfigs();

  // Selected values for step 1
  const [selectedClienteId, setSelectedClienteId] = useState<string>('');
  const [selectedEspacoId, setSelectedEspacoId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(Date.now() + 86405000 * 15).toISOString().substring(0, 10) // 15 days from now
  );
  const [selectedHour, setSelectedHour] = useState<string>('18:00 - 02:00');
  const [tipoEvento, setTipoEvento] = useState<string>('Casamento');
  const [numQtdConvidados, setNumQtdConvidados] = useState<number>(150);

  // States for mandatory Client data (demanded at reservation level)
  const [clientNome, setClientNome] = useState<string>('');
  const [clientCPF, setClientCPF] = useState<string>('');
  const [clientTelefone, setClientTelefone] = useState<string>('');
  const [clientEndereco, setClientEndereco] = useState<string>('');
  const [clientEmail, setClientEmail] = useState<string>('');

  // Simulation current index state (1 to 4)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [logs, setLogs] = useState<string[]>([]);
  const [bookingId, setBookingId] = useState<string>('');
  const [pixStatus, setPixStatus] = useState<'pendente' | 'pago'>('pendente');
  const [timeLeft, setTimeLeft] = useState<number>(3600); // 1 hour countdown
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Webhook Simulator State
  const [webhookGateway, setWebhookGateway] = useState<'Asaas' | 'MercadoPago' | 'Stripe' | 'Efi_Gerencianet'>('Asaas');
  const [webhookEventType, setWebhookEventType] = useState<'payment.confirmed' | 'payment.overdue' | 'payment.failed' | 'payment.refunded'>('payment.confirmed');
  const [webhookMethod, setWebhookMethod] = useState<'PIX' | 'Cartão' | 'Transferência' | 'Dinheiro'>('PIX');
  const [webhookResult, setWebhookResult] = useState<WebhookHandlerResult | null>(null);
  const [customBookingId, setCustomBookingId] = useState<string>('');
  
  // Loaded variables for simulation references
  const activeCliente = clientes.find(c => c.id === selectedClienteId);
  const activeEspaco = espacos.find(s => s.id === selectedEspacoId);
  
  const estimatedTotal = activeEspaco ? activeEspaco.valorLocacao : 2500;
  const pct = activeEspaco && activeEspaco.porcentagemSinal !== undefined ? activeEspaco.porcentagemSinal : 50;
  const estimatedSignal = estimatedTotal * (pct / 100);

  // Toast status feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Synchronize dynamic booking ID with webhook simulator ID
  useEffect(() => {
    if (bookingId) {
      setCustomBookingId(bookingId);
    }
  }, [bookingId]);

  // Synchronize client form fields with selected client details
  useEffect(() => {
    if (selectedClienteId && clientes.length > 0) {
      const current = clientes.find(c => c.id === selectedClienteId);
      if (current) {
        setClientNome(current.nome || '');
        setClientCPF(formatCPFOrCNPJ(current.cpf || ''));
        setClientTelefone(current.telefone || '');
        setClientEndereco(current.endereco || '');
        setClientEmail(current.email || '');
      }
    }
  }, [selectedClienteId, clientes]);

  // Load existing clients & spaces
  useEffect(() => {
    async function loadData() {
      try {
        const cList = await getClientes();
        const sList = await getEspacos();
        setClientes(cList);
        setEspacos(sList);
        
        if (cList.length > 0) setSelectedClienteId(cList[0].id);
        if (sList.length > 0) setSelectedEspacoId(sList[0].id);
      } catch (err) {
        console.error("Erro ao carregar dados para o simulador:", err);
      }
    }
    loadData();
    
    // Add initial log entry
    addSimulateLog("Esteira Inicializada. Selecione o Cliente e o Espaço para iniciar o funil de reserva de 50%.");
  }, []);

  // Timer logic for Step 4
  useEffect(() => {
    let interval: any = null;
    if (isTimerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerActive) {
      setIsTimerActive(false);
      addSimulateLog("ALERTA: O tempo de 1 hora expirou! Reserva temporária liberada automaticamente.");
      setCurrentStep(1); // Reset back or fail
      setToastMessage("Tempo esgotado para o pagamento do sinal!");
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft]);

  const addSimulateLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev]);
  };

  const showToast = (msg: string) => {
    const text = typeof msg === 'string' ? msg : 'Mensagem enviada';
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Generates Central Bank of Brazil compliant dynamic PIX payload (EMV standard BR Code)
  const generateDynamicPixString = () => {
    const amString = estimatedSignal.toFixed(2);
    const txId = "EXP" + Math.floor(100000000 + Math.random() * 900000000);
    const payloadStart = `00020101021226870014br.gov.bcb.pix2565api.eventspace.com.br/v2/${txId}520400005303986540${amString.length.toString().padStart(2, '0')}${amString}5802BR5915EventSpace ERP6009SAO PAULO62070503***6304`;

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

  // STEP 1: Commits the reservation, requires complete customer details, saves updated client records, and compiles the contract draft
  const handleReservarAndAdvance = async () => {
    if (!selectedClienteId || !selectedEspacoId) {
      showToast("Por favor, selecione um cliente e um espaço primeiro.");
      return;
    }

    if (!clientNome.trim()) {
      showToast("Insira o nome completo do contratante!");
      return;
    }
    if (!clientCPF.trim()) {
      showToast("CPF ou CNPJ é obrigatório para a formalização do contrato!");
      return;
    }
    if (!validateCPFOrCNPJ(clientCPF)) {
      showToast("O documento CPF/CNPJ informado é inválido. Por favor, verifique os dígitos.");
      return;
    }
    if (!clientTelefone.trim()) {
      showToast("Telefone celular de contrato é obrigatório!");
      return;
    }
    if (!clientEndereco.trim()) {
      showToast("Endereço residencial/comercial completo é obrigatório para as cláusulas de foro!");
      return;
    }

    addSimulateLog(`Iniciando checkout de reserva expressa para ${clientNome}...`);

    try {
      // A. Overwrite/merge full client credentials in database so signatures and records are consistent
      const originalClient = clientes.find(c => c.id === selectedClienteId);
      const updatedClient: Cliente = {
        id: selectedClienteId,
        nome: clientNome,
        cpf: clientCPF,
        telefone: clientTelefone,
        endereco: clientEndereco,
        email: clientEmail,
        createdAt: originalClient?.createdAt || new Date().toISOString()
      };
      await saveCliente(updatedClient);
      
      // Update local React list
      setClientes(prev => prev.map(c => c.id === selectedClienteId ? updatedClient : c));
      addSimulateLog(`✓ Ficha cadastral do Locatário validada e gravada: CPF ${clientCPF}`);

      // B. Create the reservation in 'Aguardando sinal'
      const tempId = "res_auto_" + Date.now();
      const payload: Reserva = {
        id: tempId,
        clienteId: selectedClienteId,
        espacoId: selectedEspacoId,
        tipoEvento: tipoEvento,
        dataEvento: selectedDate,
        horario: selectedHour,
        qtdConvidados: numQtdConvidados,
        valorTotal: estimatedTotal,
        valorSinal: estimatedSignal,
        status: 'Aguardando sinal',
        observacoes: `RESERVA PROVISÓRIA EXECUTADA: CPF ${clientCPF} | Endereço: ${clientEndereco}. Bloqueio de 1h ativo.`,
        createdAt: new Date().toISOString()
      };

      const savedId = await saveReserva(payload);
      setBookingId(savedId);

      // Start 1 hour countdown
      setTimeLeft(3600);
      setIsTimerActive(true);
      setPixStatus('pendente');

      addSimulateLog(`✓ Reserva temporária nº ${savedId} gerada no ERP pautada em 'Aguardando sinal'.`);
      addSimulateLog(`🔒 OPERAÇÃO COMERCIAL PROTEGIDA: Espaço retirado de circulação pública por 1 hora.`);

      // C. Compile and save the contract immediately containing the 50% sign-up retention term
      await generateContractDraft(savedId, updatedClient);

      // D. Advance straight to Step 2 (Contract draft view)
      setCurrentStep(2);
      showToast("Reserva pré-feita! Minuta do contrato gerada com sucesso.");
    } catch (err: any) {
      console.error(err);
      addSimulateLog(`❌ Erro no fechamento preliminar da reserva: ${err?.message || err}`);
    }
  };

  // COMPILING DETAILED BI-PARTE LEGALLY COMPLIANT CONTRACT DRAFT WITH RETENTION COVENANT
  const generateContractDraft = async (reservaId: string, cli: Cliente) => {
    if (!activeEspaco) return;
    
    addSimulateLog("Compilando termos regulamentares da minuta contratual...");

    const pct = activeEspaco.porcentagemSinal !== undefined ? activeEspaco.porcentagemSinal : 50;
    const pctStr = pct === 50 ? '50% (cinquenta por cento)' : `${pct}%`;

    const contractBody = `CONTRATO DE BENEFICIAMENTO E LOCAÇÃO TEMPORÁRIA DE INFRAESTRUTURA LOCATÍCIA

I. DAS PARTES CONTRATANTES
LOCADOR: ${lessor.razaoSocial} (Nome Fantasia: ${lessor.nomeFantasia}), inscrito no CNPJ/CPF sob nº ${lessor.cnpjCpf}, com endereço sede em ${lessor.endereco}.
LOCATÁRIO: ${cli.nome}, inscrito sob CPF nº ${cli.cpf}, residente e domiciliado no endereço: ${cli.endereco || 'Não Informado'}, e-mail: ${cli.email || 'Não Informado'} e telefone contractar principal: ${cli.telefone}.

II. DO OBJETO E AGENDAMENTO
Fica locada em caráter temporário a dependência cênica do espaço ${activeEspaco.nome} para a realização de evento corporativo/social da categoria ${tipoEvento}, pautado exclusivamente no dia ${new Date(selectedDate).toLocaleDateString('pt-BR')}, período sugerido de ${selectedHour} (Horário Contratual Padrão: 08:00 às 18:00), para o contingente de até ${numQtdConvidados} convidados. O uso do espaço fora do período regulamentar das 08:00 às 18:00 poderá acarretar a cobrança de taxas extras.

III. DOS AJUSTES FINANCEIROS E DEPÓSITO DE ARRAS
A contraprestação ajustada da diária é de R$ ${estimatedTotal.toLocaleString('pt-BR')}, tendo como cláusula irrevogável de bloqueio e confirmação o adiantamento compulsório de sinal confirmatório correspondante a ${pctStr} do montante, totalizando R$ ${estimatedSignal.toLocaleString('pt-BR')}.

IV. DA CLÁUSULA COMPROMISSÓRIA DE DESISTÊNCIA E RETENÇÃO DE SINAL (ART. 418 DO CÓDIGO CIVIL)
Em perfeito e estrito acordo com as disposições contidas no Artigo 418 do Código Civil Brasileiro, fica expressamente convencionado entre as partes que:
a) Em hipótese de desistência imotivada, cancelamento unilateral ou rescisão voluntária comunicada por parte do LOCATÁRIO em qualquer prazo que anteceda o evento, o montante pago a título de sinal (R$ ${estimatedSignal.toLocaleString('pt-BR')}) SERÁ RETIDO INTEGRALMENTE pelo LOCADOR a título de indenização suplementar (Arras Confirmatórias) pelo bloqueio, inutilização e decurso ordinário de pauta indisponibilizada no calendário público do espaço, não constituindo causa legítima para reembolso, devolução parcial, compensamento ou crédito futuro.
b) Eventuais adiamentos serão avaliados por mera liberalidade e condicionados a multas de remanejamento administrativo adicionais.

V. VIGÊNCIA E FORO DE ELEIÇÃO
Elegem as partes o foro da comarca da sede do locador para dirimir possíveis litígios.

Paraty/São Paulo, ${new Date().toLocaleDateString('pt-BR')}.

Documento assinado digitalmente via módulo integrado EventSpace ERP.`;

    try {
      const contractId = "cnt_auto_" + Date.now();
      const mockContract: Contrato = {
        id: contractId,
        reservaId: reservaId,
        pdfUrl: '',
        conteudoCustomizado: contractBody,
        createdAt: new Date().toISOString()
      };
      await saveContrato(mockContract);

      // Deliver contract simulation notifications
      await triggerContractNotification(
        {
          id: reservaId,
          clienteId: selectedClienteId,
          espacoId: selectedEspacoId,
          tipoEvento,
          dataEvento: selectedDate,
          horario: selectedHour,
          qtdConvidados: numQtdConvidados,
          valorTotal: estimatedTotal,
          valorSinal: estimatedSignal,
          status: 'Aguardando sinal',
          createdAt: new Date().toISOString()
        },
        cli,
        mockContract
      );

      addSimulateLog(`✓ Minuta contratual gerada autonomamente e registrada no ERP.`);
      addSimulateLog(`✉ Notificação WhatsApp do link contratual disparada com sucesso.`);
    } catch (err: any) {
      console.error(err);
      addSimulateLog(`⚠️ Falha ao salvar contrato no cartório digital.`);
    }
  };

  // STEP 3: Process simulator payment confirmation (PIX or Dinheiro)
  const handlePixPayment = async (method: 'PIX' | 'Dinheiro') => {
    if (!bookingId || !activeCliente || !activeEspaco) return;

    addSimulateLog(`Confirmando faturamento do sinal de 50% (R$ ${estimatedSignal.toLocaleString('pt-BR')}) via ${method}...`);

    try {
      // 1. Log Payment transaction inside the ERP Ledger
      const pagID = "pay_auto_" + Date.now();
      const mockPayment: Pagamento = {
        id: pagID,
        reservaId: bookingId,
        valor: estimatedSignal,
        formaPagamento: method,
        status: 'Confirmado',
        dataPagamento: new Date().toISOString().substring(0, 10)
      };

      // 2. Transition reservation status to confirmed
      const clientPayload: Cliente = {
        id: selectedClienteId,
        nome: clientNome,
        cpf: clientCPF,
        telefone: clientTelefone,
        endereco: clientEndereco,
        email: clientEmail,
        createdAt: activeCliente?.createdAt || new Date().toISOString()
      };

      const payload: Reserva = {
        id: bookingId,
        clienteId: selectedClienteId,
        espacoId: selectedEspacoId,
        tipoEvento: tipoEvento,
        dataEvento: selectedDate,
        horario: selectedHour,
        qtdConvidados: numQtdConvidados,
        valorTotal: estimatedTotal,
        valorSinal: estimatedSignal,
        status: 'Confirmado',
        observacoes: `RESERVA CONFIRMADA E CONTRATUALIZADA. Sinal de 50% pago via ${method}. Contratante: CPF ${clientCPF} sob retenção regulamentar.`,
        createdAt: new Date().toISOString()
      };

      await saveReserva(payload);
      setIsTimerActive(false); // Stop the countdown
      setPixStatus('pago');

      addSimulateLog(`✓ Reconciliação Concluída: Faturamento compensado no ERP.`);
      addSimulateLog(`🔓 Agenda comercial oficialmente trancada e indisponível para demais proponentes.`);

      // Dispatch real notifications
      await triggerPaymentNotification(payload, clientPayload, mockPayment, true);
      addSimulateLog(`✉ Notificação WhatsApp de liquidação emitida com sucesso.`);

      // Advance to Step 4 (Reserva Ativada !)
      setCurrentStep(4);
      showToast("Faturamento compensado! Reserva ativada em definitivo.");
    } catch (err: any) {
      console.error(err);
      addSimulateLog(`❌ Erro comercial ao tentar liquidar faturamento: ${err?.message || err}`);
    }
  };



  const handleReset = () => {
    setCurrentStep(1);
    setBookingId('');
    setPixStatus('pendente');
    setIsTimerActive(false);
    setTimeLeft(3600);
    setLogs([]);
    setWebhookResult(null);
    addSimulateLog("Fila reiniciada. Pronta para nova simulação.");
  };

  const handleTriggerWebhook = async () => {
    const targetId = customBookingId || bookingId;
    if (!targetId) {
      showToast("Selecione ou crie uma reserva provisória no painel antes de simular webhook!");
      return;
    }

    const payload: WebhookPayload = {
      eventId: "evt_sim_" + Date.now().toString(36),
      gateway: webhookGateway,
      eventType: webhookEventType,
      transactionId: "pay_sim_" + Math.floor(Math.random() * 100000),
      bookingId: targetId,
      amountPaid: estimatedSignal,
      paymentMethod: webhookMethod
    };

    addSimulateLog(`🛰️ SIMULANDO WEBHOOK EXTERNO [${webhookGateway}] -> Envio de '${webhookEventType}' ao ERP relacionado à Reserva ${targetId}`);

    try {
      const result = await WebhookHandler.handleIncomingWebhook(payload);
      setWebhookResult(result);

      if (result.success) {
        showToast(`Webhook processado: ${result.message}`);
        addSimulateLog(`✓ Reconciliação Sucedida: Código ${result.statusCode} | ${result.message}`);
        
        if (webhookEventType === 'payment.confirmed') {
          setPixStatus('pago');
          setIsTimerActive(false);
          setCurrentStep(7); // Jump straight to active contract finalized!
        } else if (webhookEventType === 'payment.failed' || webhookEventType === 'payment.overdue' || webhookEventType === 'payment.refunded') {
          setPixStatus('pendente');
          setIsTimerActive(false);
          setCurrentStep(1); // Back to startup state
        }
      } else {
        showToast(`Alerta Webhook: ${result.message}`);
        addSimulateLog(`⚠️ Rejeição de Webhook [${result.statusCode}] | Resposta: ${result.message}`);
      }
    } catch (err: any) {
      console.error(err);
      addSimulateLog(`❌ Erro no processamento do Simulador de Webhook: ${err?.message || err}`);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* Dynamic Toast Feedback Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-slate-900 border border-slate-755 text-white p-4 rounded-xl shadow-2xl transition duration-500 animate-slide-in">
          <Zap className="w-5 h-5 text-indigo-400 animate-pulse" />
          <span className="text-xs font-bold font-sans">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-850 gap-4">
        <div>
          <span className="text-xs font-extrabold text-indigo-650 bg-indigo-50 dark:bg-slate-900 dark:text-indigo-305 px-2.5 py-1 rounded-lg uppercase tracking-wider font-mono">
            Pipeline Estratégico ERP
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 flex items-center gap-2">
            <Workflow className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Esteira Comercial 50%
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Automatize o ciclo operacional completo: Captação de contatos, envio de links de datas disponíveis, bloqueio relâmpago de 1 hora, faturamento de sinal de 50%, e assinatura contratual com termos de retenção de capital.
          </p>
        </div>
        
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:text-indigo-650 dark:text-slate-400 dark:hover:text-white border border-slate-250 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Reiniciar Funil
        </button>
      </div>

      {/* Step Progress Tracker bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-5 rounded-2xl shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          {[
            { step: 1, label: "1. Ficha de Reserva", color: "border-cyan-500 text-cyan-605" },
            { step: 2, label: "2. Minuta do Contrato", color: "border-blue-500 text-blue-605" },
            { step: 3, label: "3. Faturamento (Sinal 50%)", color: "border-orange-500 text-orange-605" },
            { step: 4, label: "4. Reserva Ativa", color: "border-emerald-500 text-emerald-605" }
          ].map((item) => {
            const isActive = currentStep === item.step;
            const isCompleted = currentStep > item.step;
            return (
              <div 
                key={item.step} 
                className={`flex flex-col items-center p-3 rounded-xl border text-xs transition duration-300 ${
                  isActive 
                    ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 text-indigo-750 dark:text-indigo-455 font-extrabold scale-102 ring-2 ring-indigo-500/20' 
                    : isCompleted 
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-300 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 font-semibold opacity-85'
                    : 'bg-slate-55 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-400'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] mb-1.5 ${
                  isActive 
                    ? 'bg-indigo-600 text-white' 
                    : isCompleted 
                    ? 'bg-emerald-505 text-white' 
                    : 'bg-slate-205 dark:bg-slate-850 text-slate-500'
                }`}>
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : item.step}
                </div>
                <span className="text-[10px] uppercase font-bold tracking-tight block truncate w-full">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Workbench Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Step-by-step Interactive Action Console */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* STEP 1: Clientes cadastrados de canal em contato */}
          <div className={`bg-white dark:bg-slate-900 border rounded-2xl p-6 shadow-sm space-y-5 transition duration-300 ${
            currentStep === 1 ? 'border-indigo-500 ring-2 ring-indigo-500/15' : 'border-slate-200 dark:border-slate-850 opacity-80'
          }`}>
            <div className="flex justify-between items-center bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">1</span>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-md flex items-center gap-1.5">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Passo 1: Ficha de Reserva & Dados de Contrato
                </h3>
              </div>
              <span className="text-[10px] bg-indigo-50 text-indigo-100 dark:bg-slate-800 dark:text-indigo-400 font-bold px-2.5 py-1 rounded-lg font-mono">
                CADASTRO OBRIGATÓRIO
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed font-sans mt-1">
              Forneça as informações obrigatórias para a emissão da minuta contratual no ato de sua reserva (CPF, endereço completo do contratante e número de celular). 
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-slate-600">
              <div>
                <label className="block text-slate-400 uppercase tracking-widest mb-1">Cliente Indicado</label>
                <select
                  value={selectedClienteId}
                  onChange={(e) => {
                    setSelectedClienteId(e.target.value);
                    addSimulateLog(`Cliente alterado para: ${clientes.find(c => c.id === e.target.value)?.nome}`);
                  }}
                  disabled={currentStep > 1}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 outline-none leading-tight font-medium"
                >
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} ({c.telefone})</option>
                  ))}
                  {clientes.length === 0 && <option>Carregando clientes...</option>}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-widest mb-1 font-sans">Espaço Desejado</label>
                <select
                  value={selectedEspacoId}
                  onChange={(e) => {
                    setSelectedEspacoId(e.target.value);
                    addSimulateLog(`Espaço alterado para: ${espacos.find(s => s.id === e.target.value)?.nome}`);
                  }}
                  disabled={currentStep > 1}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 outline-none leading-tight font-medium"
                >
                  {espacos.map(s => (
                    <option key={s.id} value={s.id}>{s.nome} - Diária R$ {s.valorLocacao.toLocaleString('pt-BR')}</option>
                  ))}
                  {espacos.length === 0 && <option>Carregando espaços...</option>}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold text-slate-600">
              <div>
                <label className="block text-slate-400 uppercase tracking-widest mb-1 font-sans">Data Sugerida</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  disabled={currentStep > 1}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-widest mb-1 font-sans">Categoria do Evento</label>
                <select
                  value={tipoEvento}
                  onChange={(e) => setTipoEvento(e.target.value)}
                  disabled={currentStep > 1}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="Casamento">Casamento</option>
                  <option value="Aniversário 15 anos">Aniversário 15 anos</option>
                  <option value="Confraternização">Confraternização</option>
                  <option value="Show / Balada">Show / Balada</option>
                  <option value="Corporativo">Corporativo</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-widest mb-1 font-sans">Qtd. Convidados</label>
                <input
                  type="number"
                  value={numQtdConvidados}
                  onChange={(e) => setNumQtdConvidados(Number(e.target.value))}
                  disabled={currentStep > 1}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            {/* OBRIGATORIEDADE DOS DADOS PESSOAIS PARA GERACAO DE CONTRATO */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850 space-y-3 font-sans text-xs">
              <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-extrabold uppercase tracking-widest block font-mono">
                📋 Dados Adicionais do Locatário para Emissão de Contrato (Obrigatório)
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={clientNome}
                    onChange={(e) => setClientNome(e.target.value)}
                    disabled={currentStep > 1}
                    placeholder="Nome Completo do Locatário"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] uppercase mb-1">CPF (ou CNPJ) *</label>
                  <input
                    type="text"
                    value={clientCPF}
                    onChange={(e) => setClientCPF(formatCPFOrCNPJ(e.target.value))}
                    disabled={currentStep > 1}
                    maxLength={18}
                    placeholder="Ex: 000.000.000-00 ou 00.000.000/0000-00"
                    className={`w-full px-3 py-2 border rounded-lg outline-none font-mono text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white ${
                      clientCPF ? (validateCPFOrCNPJ(clientCPF) ? 'border-emerald-500 focus:ring-1 focus:ring-emerald-500' : 'border-rose-500 focus:ring-1 focus:ring-rose-500') : 'border-slate-200 dark:border-slate-800'
                    }`}
                  />
                  {clientCPF && (
                    <span className={`text-[10px] block mt-1 font-semibold font-sans ${
                      validateCPFOrCNPJ(clientCPF) ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {validateCPFOrCNPJ(clientCPF) ? '✓ Documento válido' : '✗ CPF ou CNPJ inválido ou incompleto'}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase mb-1">Endereço Residencial Completo</label>
                  <input
                    type="text"
                    value={clientEndereco}
                    onChange={(e) => setClientEndereco(e.target.value)}
                    disabled={currentStep > 1}
                    placeholder="Rua, Número, Bairro, Cidade - UF"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase mb-1">WhatsApp Principal</label>
                    <input
                      type="text"
                      value={clientTelefone}
                      onChange={(e) => setClientTelefone(e.target.value)}
                      disabled={currentStep > 1}
                      placeholder="(24) 99999-5555"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase mb-1">E-mail</label>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      disabled={currentStep > 1}
                      placeholder="locatario@email.com"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {currentStep === 1 && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleReservarAndAdvance}
                  className={`px-5 py-2.5 text-white text-xs font-extrabold rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer ${
                    (!clientNome || !validateCPFOrCNPJ(clientCPF) || !clientEndereco || !clientTelefone)
                      ? 'bg-slate-400 cursor-not-allowed opacity-80'
                      : 'bg-indigo-650 hover:bg-indigo-700'
                  }`}
                  disabled={!clientNome || !validateCPFOrCNPJ(clientCPF) || !clientEndereco || !clientTelefone}
                >
                  <FileText className="w-4.5 h-4.5 text-amber-300" />
                  Efetuar Reserva e Ir para Tela de Contrato
                </button>
              </div>
            )}
          </div>

          {/* STEP 2: Minuta contratual com dados do locatário e regras de retenção */}
          <div className={`bg-white dark:bg-slate-900 border rounded-2xl p-6 shadow-sm space-y-4 transition duration-300 ${
            currentStep === 2 ? 'border-indigo-500 ring-2 ring-indigo-500/15' : 'border-slate-200 dark:border-slate-850 opacity-80'
          }`}>
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 font-sans">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-950 text-white flex items-center justify-center text-xs font-bold">2</span>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-md flex items-center gap-1.5 font-sans">
                  <FileCheck className="w-5 h-5 text-blue-600" />
                  Passo 2: Assinatura da Minuta do Contrato
                </h3>
              </div>
              {currentStep > 2 && <CheckCircle className="w-5 h-5 text-emerald-500" />}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              Abaixo apresentamos a minuta integrada em tempo real com o CPF e endereço informados na ficha de reserva, incluindo as pautas de retenção de capital.
            </p>

            {currentStep >= 2 ? (
              <div className="space-y-4">
                {/* Parchment preview box */}
                <div className="p-4 bg-slate-950 text-slate-350 border border-slate-755 rounded-xl space-y-3 font-mono text-[10px] leading-relaxed max-h-72 overflow-y-auto">
                  <span className="text-[9px] text-indigo-400 font-extrabold tracking-wider underline uppercase block mb-1">Pauta do Acordo Comercial</span>
                  <div className="whitespace-pre-wrap text-[10px] font-sans">
                    {`INSTRUMENTO PARTICULRAR DE LOCAÇÃO IMPOSITIVA DE INFRAESTRUTURA E RESCISÃO

I. DAS PARTES CONTRATANTES
LOCADOR: ${lessor.razaoSocial} (Nome Fantasia: ${lessor.nomeFantasia}), inscrito sob CNPJ nº ${lessor.cnpjCpf}, com sede em ${lessor.endereco}.
LOCATÁRIO: ${clientNome}, portador do CPF nº ${clientCPF}, residente no endereço situado em: ${clientEndereco}, e-mail de contato: ${clientEmail || 'Não informado'} e WhatsApp: ${clientTelefone}.

II. DO OBJETO E AGENDAMENTO
Constitui objeto deste a cessão temporária do espaço comercial ${activeEspaco?.nome || 'Espaço de Eventos'} para o agendamento da modalidade ${tipoEvento} no dia ${new Date(selectedDate).toLocaleDateString('pt-BR')}, período sugerido: ${selectedHour} (Horário Contratual Padrão: 08:00 às 18:00), para o contingente de até ${numQtdConvidados} convidados. O uso do espaço fora do período regulamentar das 08:00 às 18:00 poderá acarretar a cobrança de taxas extras.

III. DO VALOR DO CONTRATO E GARANTIA DE SINAL (ARRAS)
O valor total ajustado para a locação em tela é de R$ ${estimatedTotal.toLocaleString('pt-BR')}. Fica estritamente convencionado que o bloqueio permanente da agenda comercial se dará exclusivamente após a quitação do sinal confirmatório correspondente a 50% (cinquenta por cento) do montante, totalizando R$ ${estimatedSignal.toLocaleString('pt-BR')}, servindo como princípio de pagamento conforme as diretrizes contratuais vigentes.

IV. DA CLÁUSULA COMPREENSIVA DE DESISTÊNCIA E PERDA INTEGRAL DO SINAL (ART. 418 DO CÓDIGO CIVIL)
Com fundamento rigoroso nas diretrizes dos artigos 417 a 420 do Código Civil Brasileiro (Arras), as partes acordam que:
a) Em hipótese de desistência imotivada ou cancelamento voluntário comunicado por livre iniciativa do LOCATÁRIO, o sinal dado a título de princípio de faturamento (R$ ${estimatedSignal.toLocaleString('pt-BR')}) CONSTITUIRÁ ARRAS PERDIDAS EM FAVOR DO LOCADOR, sendo este montante RETIDO INTEGRALMENTE para cobertura legítima de perdas comerciais pelo trancamento da pauta de agenda.
b) Em nenhuma circunstância o cancelamento unilateral por parte do contratante gerará direito a devoluções, restituições, cartas de crédito ou postergações de datas sem expedição de anuência do locador.

V. VIGÊNCIA E FORO DE ELEIÇÃO
Elegem as partes o foro principal da comarca do holding LOCADOR para dirimir quaisquer dúvidas.`}
                  </div>
                </div>

                {/* Warning callout for Article 418 */}
                <div className="p-3 bg-rose-50 dark:bg-rose-955/10 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-1">
                  <span className="text-[10px] text-red-650 dark:text-red-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5 font-sans">
                    ⚖️ CLÁUSULA DE FORÇA JURÍDICA: ARTIGO 418 DO CÓDIGO CIVIL DO BRASIL
                  </span>
                  <p className="text-[10.5px] text-slate-650 dark:text-slate-450 leading-relaxed font-sans">
                    A retenção compulsória dos 50% de sinal dado como entrada é plenamente amparada pela lei civil brasileira como contrapartida legítima pelo barramento comercial de reserva na agenda.
                  </p>
                </div>

                {currentStep === 2 && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentStep(3);
                        setTimeLeft(3600); // 1 hour (3600s)
                        setIsTimerActive(true);
                        addSimulateLog(`✓ Locatário aceitou os termos da pauta jurídica com CPF ${clientCPF}.`);
                        addSimulateLog(`🔒 TIMER DE COBRANÇA ATIVADO: 1 hora para compensação do sinal antes de expirar o trancamento.`);
                      }}
                      className="px-5 py-2.5 bg-blue-650 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition shadow-sm flex items-center gap-1 cursor-pointer font-sans"
                    >
                      <span>Concordar e Avançar para Faturamento PIX</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-400 italic font-sans">
                Aguardando preenchimento dos dados do locatário na ficha de reserva...
              </div>
            )}
          </div>

          {/* STEP 3: Faturamento Sinal (50%) com PIX dinâmico ou dinheiro */}
          <div className={`bg-white dark:bg-slate-900 border rounded-2xl p-6 shadow-sm space-y-4 transition duration-300 ${
            currentStep === 3 ? 'border-orange-500 ring-2 ring-indigo-500/15' : 'border-slate-200 dark:border-slate-850 opacity-80'
          }`}>
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 font-sans">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-950 text-white flex items-center justify-center text-xs font-bold">3</span>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-md flex items-center gap-1.5 font-sans">
                  <QrCode className="w-5 h-5 text-orange-500" />
                  Passo 3: Faturamento & Liquidação de Sinal (50%)
                </h3>
              </div>
              {currentStep > 3 && <CheckCircle className="w-5 h-5 text-emerald-500 font-sans" />}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed font-sans mb-1">
              A reserva temporária está garantida na agenda sob a pauta de faturamento padrão. Complete o repasse do sinal de 50% para validar o trancamento definitivo da data unificada.
            </p>

            {currentStep >= 3 ? (
              <div className="space-y-4">
                
                {/* 1 Hour Countdown visual warning block */}
                {pixStatus === 'pendente' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-amber-50/50 dark:bg-slate-955/20 p-4 rounded-xl border border-amber-250">
                    <div className="md:col-span-8 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 rounded-full h-2 bg-amber-500 animate-ping"></span>
                        <span className="font-extrabold font-mono text-[10px] text-amber-800 dark:text-amber-400 uppercase tracking-widest leading-none">
                          ⚠️ TEMPO LIMITE DE TRANCAMENTO DA DATA (1 HORA)
                        </span>
                      </div>
                      <p className="text-[10.5px] text-amber-700 dark:text-amber-400 font-sans leading-tight">
                        Este faturamento tem validade de 1 hora. Caso o sinal de 50% não de entrada no prazo, o sistema liberará a data na agenda.
                      </p>
                    </div>

                    <div className="md:col-span-4 bg-slate-950 border border-slate-800 p-3 rounded-lg text-center select-none relative overflow-hidden font-mono">
                      <span className="text-[8px] text-slate-400 tracking-wider font-extrabold uppercase block font-mono">Tempo Restante</span>
                      <span className="font-mono text-xl font-bold text-white block py-0.5 tracking-wider">
                        {formatCountdown(timeLeft)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-slate-50 dark:bg-slate-955 rounded-xl border border-slate-200 dark:border-slate-850 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Invoice detail */}
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider font-mono">Detalhamento Financeiro</span>
                        <div className="flex justify-between items-center mt-1 border-b border-slate-200 dark:border-slate-800 pb-1 text-xs">
                          <span className="text-slate-600 dark:text-slate-450 font-sans">Serviço de Diária Total:</span>
                          <span className="font-bold font-mono text-slate-955 dark:text-slate-200">R$ {estimatedTotal.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1 pb-1 text-xs bg-indigo-50/20 px-1.5 py-1 rounded font-sans">
                          <span className="font-extrabold text-indigo-750 dark:text-indigo-400">Sinal Confirmatório (50%):</span>
                          <span className="font-extrabold font-mono text-indigo-650 dark:text-indigo-305">R$ {estimatedSignal.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-lg space-y-1.5 text-[10px] text-slate-500 font-sans">
                        <span className="font-extrabold text-slate-705 dark:text-slate-300 block uppercase tracking-tight">🏦 Padrão de Conciliação BACEN</span>
                        <p className="leading-relaxed">
                          O PIX dinâmico opera conforme regulamentação do Banco Central do Brasil. A leitura do QR Code gera imediata compensação contratual no painel EventSpace.
                        </p>
                      </div>
                    </div>

                    {/* QR Code and Copy Paste */}
                    <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-2xl shadow-sm text-center">
                      {pixStatus === 'pendente' ? (
                        <div className="space-y-3 w-full">
                          <div className="w-28 h-28 bg-slate-100 dark:bg-slate-955 flex items-center justify-center rounded-lg border border-slate-205 dark:border-slate-850 relative mx-auto">
                            <QrCode className="w-20 h-20 text-slate-800 dark:text-slate-300" />
                            <div className="absolute inset-0 bg-indigo-500/5"></div>
                          </div>

                          <div className="text-center font-sans">
                            <span className="text-[9px] font-mono font-bold uppercase bg-amber-50 text-amber-700 dark:bg-slate-850 dark:text-amber-400 tracking-tight px-2.5 py-0.5 rounded-lg border border-amber-200/50">
                              EMISSÃO CONFORME BACEN COPIE E COLA
                            </span>
                          </div>

                          {/* Copy Field block */}
                          <div className="space-y-1 text-left font-sans">
                            <span className="text-[8px] text-slate-400 uppercase font-bold text-center block tracking-wide font-mono">PIX Copia e Cola</span>
                            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-955 p-1.5 rounded-lg border border-slate-200 dark:border-slate-850">
                              <span className="font-mono text-[9px] text-indigo-650 dark:text-indigo-405 truncate flex-1 leading-none">{generateDynamicPixString()}</span>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(generateDynamicPixString());
                                  showToast("Chave Copia e Cola copiada para a área de transferência!");
                                }}
                                className="p-1 px-2.5 bg-indigo-50 dark:bg-slate-850 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100 transition"
                              >
                                Copiar
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 w-full pt-1 font-sans">
                            <button
                              onClick={() => handlePixPayment('PIX')}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold rounded-lg tracking-wider transition uppercase cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Confirmar Liquidação do Sinal (50%)
                            </button>
                            <button
                              onClick={() => handlePixPayment('Dinheiro')}
                              className="w-full py-1 text-[9px] text-slate-400 hover:text-indigo-600 transition"
                            >
                              Receber e Assinalar em Dinheiro/Espécie
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center space-y-3 py-6 font-sans">
                          <CheckCircle className="w-12 h-12 text-emerald-510 mx-auto animate-bounce" />
                          <div>
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 dark:bg-emerald-955 dark:text-emerald-400 font-extrabold px-2.5 py-1 rounded">
                              SINAL COMPENSADO COM SUCESSO
                            </span>
                            <p className="text-[9px] text-slate-405 mt-1 font-mono">Ref ID Reserva: {bookingId}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-400 italic font-sans text-center">
                Aguardando a concordância contratual para emitir o faturamento...
              </div>
            )}
          </div>

          {/* STEP 4: Reserva Ativada de forma irreversível */}
          <div className={`bg-white dark:bg-slate-900 border rounded-2xl p-6 shadow-sm space-y-4 transition duration-300 ${
            currentStep === 4 ? 'border-emerald-500 ring-2 ring-emerald-500/15' : 'border-slate-205 dark:border-slate-850 opacity-80'
          }`}>
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 font-sans">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-950 text-white flex items-center justify-center text-xs font-bold font-sans">4</span>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-md flex items-center gap-1.5 font-sans">
                  <FileCheck className="w-5 h-5 text-emerald-500" />
                  Passo 4: Linha de Pauta Ativada no ERP da Holding
                </h3>
              </div>
              {currentStep === 4 && (
                <span className="text-[9px] bg-emerald-100 text-emerald-850 font-extrabold px-2 py-0.5 rounded uppercase font-mono animate-pulse">
                  CONFIRMADA PERMANENTE
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              Com o repasse de faturamento compensado em sistema e o contrato firmado com pauta de retenção, a vaga comercial é confirmada permanentemente na timeline da administradora.
            </p>

            {currentStep >= 4 ? (
              <div className="space-y-4 font-sans">
                
                {/* Visual Lock status audit checklist */}
                <div className="p-4 bg-slate-900 text-slate-350 border border-slate-755 rounded-xl space-y-3 font-mono text-[10px]">
                  <span className="text-[9px] text-amber-500 font-extrabold uppercase tracking-widest block font-sans">🔒 STATUS JURÍDICO-COMERCIAL DA VAGA:</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 leading-tight font-sans font-sans">
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> <b>Imóvel Bloqueado:</b> {activeEspaco?.nome}
                      </p>
                      <p className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> <b>Arras Compensada:</b> R$ {estimatedSignal.toLocaleString('pt-BR')} (50%)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> <b>Locatário Indexado:</b> CPF {clientCPF}
                      </p>
                      <p className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> <b>Cláusula Art. 418 Ativa:</b> Sinal retido se houver cancelamento
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 rounded-xl flex items-start gap-2.5 text-[11px]">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Reserva Consolidada com Sucesso Legal!</h5>
                    <p className="text-slate-650 dark:text-slate-400 mt-1 leading-relaxed font-sans">
                      A agenda comercial da holding foi confirmada permanentemente. A cláusula legal de retenção de capital do sinal cobre integralmente o risco de desistência imotivada (Diretriz do Artigo 418 do Código Civil). O contrato digital contendo os dados do locatário, CPF e as assinaturas eletrônicas das partes, o recibo de arras compensado e as notificações em lote automáticas para WhatsApp foram finalizados e faturados!
                    </p>
                  </div>
                </div>

              </div>
            ) : null}
          </div>

          {/* STEP 7: Contrato com pauta de rescisão / perda do sinal */}
          {false && (
          <div className="hidden">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-950 text-white flex items-center justify-center text-xs font-bold">7</span>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-md flex items-center gap-1.5">
                  <FileCheck className="w-5 h-5 text-rose-500" />
                  Passo 7: Contrato Inteligente com Cláusulas de Retenção
                </h3>
              </div>
              {currentStep === 7 && (
                <span className="text-[9px] bg-red-50 text-red-700 font-extrabold px-2.5 py-1 rounded-md animate-pulse">
                  ESTEIRA CONCLUÍDA
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              O contrato de pauta jurídica amarra de forma robusta e automatizada as regras de cancelamento: se o locatário desistir, perde-se os 50% de sinal dados anteriormente.
            </p>

            {currentStep >= 7 && (
              <div className="space-y-4">
                
                {/* Contract text block preview */}
                <div className="p-4 bg-slate-900 text-slate-350 border border-slate-750 rounded-xl space-y-3">
                  <span className="text-[10px] text-amber-500 font-extrabold uppercase tracking-widest block">Cláusula Destacada do Acordo:</span>
                  
                  <div className="p-3 bg-red-950/20 border border-red-900/60 text-[11px] text-red-200 font-semibold leading-relaxed rounded-lg space-y-2 font-mono">
                    <p>
                      "CLÁUSULA IV: DO APERFEIÇOAMENTO, DESISTÊNCIA E PERDA INTEGRAL DO SINAL (ARRAS)"
                    </p>
                    <p>
                      "Fica expressamente convencionado pelas partes que o valor pago de R$ {estimatedSignal.toLocaleString('pt-BR')} a título de sinal constitui princípio de pagamento (Arras Confirmatórias), regido sob as diretivas do Artigo 418 do Código Civil. Em hipótese de arrependimento, cancelamento voluntário ou desistência unilateral antes da quitação total por parte do LOCATÁRIO, o montante correspondente aos 50% pagos a título de sinal SERÁ RETIDO INTEGRALMENTE EM FAVOR DO LOCADOR, de forma irrevogável e irretratável, como prévia de perdas e danos pelo barramento comercial de reserva na agenda do espaço, sem qualquer direito de estorno ou restituição."
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 rounded-xl flex items-start gap-2.5">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Pipeline Totalmente Automatizado com Sucesso!</h5>
                    <p className="text-[11px] text-emerald-700 dark:text-slate-400 mt-1 leading-relaxed font-sans">
                      A reserva está 100% ativa, o faturamento do sinal de 50% está registrado na Tesouraria Financeira interna do ERP, e o contrato contendo a pauta de retenção de capital foi devidamente despachado, indexado e notificado via WhatsApp do assinante.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {currentStep < 7 && (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                Aguardando a liquidação do sinal para emitir a minuta contratual correspondente...
              </div>
            )}
          </div>
          )}

        </div>

        {/* Live Simulation Audit Logs & Automated Pipeline Tips */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Live Action log audit console */}
          <div className="bg-slate-950 border border-slate-800 text-white p-5 rounded-2xl space-y-4 shadow-xl font-mono">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-2.5">
              <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wide">
                <Workflow className="w-4 h-4" />
                Console de Auditoria
              </h4>
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            </div>

            <div className="h-64 overflow-y-auto space-y-2.5 text-[10px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {logs.map((log, idx) => (
                <p key={idx} className={`${idx === 0 ? 'text-indigo-300 font-extrabold' : 'text-slate-450'}`}>
                  {log}
                </p>
              ))}
              {logs.length === 0 && (
                <p className="text-slate-500 italic text-center py-12 font-sans">Nenhuma ação registrada.</p>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between text-[9px] text-slate-400">
              <span>Status Fila: Ativo</span>
              <span>Modo Simulação local</span>
            </div>
          </div>

          {/* DICAS E BOAS PRÁTICAS DE AUTOMAÇÃO */}
          <div className="bg-gradient-to-br from-indigo-950/10 to-transparent bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-5 rounded-2xl shadow-sm space-y-4">
            <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
              Dicas & Engenharia da Operação
            </h4>

            <div className="space-y-4 font-sans text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
              
              <div className="space-y-1">
                <span className="font-extrabold text-slate-800 dark:text-white flex items-center gap-1 uppercase text-[10px] tracking-wider">
                  💡 1. Disparadores WhatsApp Dinâmicos
                </span>
                <p>
                  Para escalar o envio do link livre, use o webhook do ERP conectado a ferramentas como <strong>N8N</strong>, <strong>Make</strong> ou <strong>Zapier</strong>. O link de autoatendimento reduz em até 70% o tempo operacional de atendimento e triagem.
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-extrabold text-slate-800 dark:text-white flex items-center gap-1 uppercase text-[10px] tracking-wider">
                  🕒 2. Rotinas de Limpeza (Cron Jobs)
                </span>
                <p>
                  Defina um Cron de hora em hora (<code>0 * * * *</code>) que faz uma query varrendo reservas Pendentes criadas há mais de 60 minutos e altera o status para cancelado, liberando as datas automaticamente na agenda.
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-extrabold text-slate-800 dark:text-white flex items-center gap-1 uppercase text-[10px] tracking-wider">
                  ⚡ 3. Webhooks de Reconciliação PIX
                </span>
                <p>
                  Conecte o ERP com sua API do banco (Gateway Asaas, Efí, Mercado Pago, Inter, etc.) de modo que a notificação de Webhook instantânea liquide a reserva provisória em segundos, gerando segurança máxima de data segura contra duplas locações.
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-extrabold text-slate-800 dark:text-white flex items-center gap-1 uppercase text-[10px] tracking-wider">
                  ⚖ 4. Força Jurídica das Arras (Art. 418)
                </span>
                <p>
                  Sempre emita o contrato informando que os 50% representam <strong>Arras Confirmatórias</strong> de garantia. Isso constitui base legal sólida contra processos de desavença financeira e cancelamento por desistência.
                </p>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* WEBHOOK AUTOMATION HUB */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-4 gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-slate-950 rounded-xl text-indigo-650">
              <Workflow className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-md font-black text-slate-900 dark:text-white">
                🔌 Hub de Automação & Webhooks Externos (n8n / Make)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Integre soluções de automação e simule disparos remotos alterando o status comercial de reservas e gerando contratos automaticamente.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
            SIMULATING HTTP POST
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel: blueprint selection & mock JSON */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-950 text-slate-350 p-4 rounded-xl border border-slate-855 space-y-3 font-mono text-[11px]">
              <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                <span className="text-indigo-400 font-extrabold text-[10px] uppercase tracking-wider">
                  📋 Payload de Integração Sugerido (JSON)
                </span>
                <span className="text-slate-500 text-[10px]">
                  Reserva Atual: {customBookingId || 'Nenhuma'}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-slate-500 text-[10px]">// Envie este JSON em chamadas HTTP POST no seu fluxo do n8n / Make:</p>
                <pre className="bg-slate-905 p-3 rounded border border-slate-900 overflow-x-auto text-xs text-emerald-400 leading-relaxed max-h-56">
                  {JSON.stringify({
                    eventId: "evt_webhook_" + Date.now().toString(36),
                    gateway: webhookGateway,
                    eventType: webhookEventType,
                    transactionId: "pay_trans_849201",
                    bookingId: customBookingId || "res_123_exemplo",
                    amountPaid: estimatedSignal,
                    paymentMethod: webhookMethod
                  }, null, 2)}
                </pre>
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 mt-2">
                <span>Mapeado em src/services/webhookHandler.ts</span>
                <button
                  type="button"
                  onClick={() => {
                    const txt = JSON.stringify({
                      eventId: "evt_webhook_" + Date.now().toString(36),
                      gateway: webhookGateway,
                      eventType: webhookEventType,
                      transactionId: "pay_trans_849201",
                      bookingId: customBookingId || "res_123_exemplo",
                      amountPaid: estimatedSignal,
                      paymentMethod: webhookMethod
                    }, null, 2);
                    navigator.clipboard.writeText(txt);
                    showToast("Modelo JSON copiado para a área de transferência!");
                  }}
                  className="hover:text-indigo-400 cursor-pointer select-none flex items-center gap-1 transition-colors text-[10px] text-indigo-300 font-bold"
                >
                  <Copy className="w-3.5 h-3.5" /> Copiar JSON
                </button>
              </div>
            </div>

            <div className="p-4 bg-amber-50/50 dark:bg-amber-955/10 border border-amber-100 dark:border-amber-950/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-sans space-y-1">
              <span className="font-extrabold uppercase tracking-tight flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Como Conectar seu Fluxo Externo:
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                1. No seu <strong>n8n</strong> ou <strong>Make.com</strong>, capture o evento do gateway (Asaas, Mercado Pago, etc.).<br/>
                2. Encaminhe um nó de requisição HTTP (POST) para despachar o payload acima ao ERP.<br/>
                3. O faturamento e os termos contrativos de cancelamento (perda integral de 50% de sinal) serão vinculados de forma unificada!
              </p>
            </div>
          </div>

          {/* Right panel: Active controls of simulator */}
          <div className="lg:col-span-5 bg-slate-55 dark:bg-slate-950/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-850 space-y-5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              Testador Operacional de Webhooks
            </h3>

            <div className="space-y-4 text-xs font-bold text-slate-705 dark:text-slate-300">
              <div>
                <label className="block text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider mb-1">ID da Reserva Alvo</label>
                <input
                  type="text"
                  value={customBookingId}
                  onChange={(e) => setCustomBookingId(e.target.value)}
                  placeholder="Ex: res_auto_17..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl focus:border-indigo-500 outline-none leading-tight font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider mb-1">Gateway</label>
                  <select
                    value={webhookGateway}
                    onChange={(e) => setWebhookGateway(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl focus:border-indigo-500 outline-none leading-tight font-medium"
                  >
                    <option value="Asaas">Asaas</option>
                    <option value="MercadoPago">Mercado Pago</option>
                    <option value="Stripe">Stripe</option>
                    <option value="Efi_Gerencianet">Efí (Gerencianet)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider mb-1">Método</label>
                  <select
                    value={webhookMethod}
                    onChange={(e) => setWebhookMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-955 text-slate-900 dark:text-white rounded-xl focus:border-indigo-505 outline-none leading-tight font-medium"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartão">Cartão</option>
                    <option value="Transferência">TED/PIX</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider mb-1">Status Reportado</label>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {[
                    { type: 'payment.confirmed', label: 'Compensado (Confirmadamente)', color: 'border-emerald-250 dark:border-emerald-950 text-emerald-800 dark:text-emerald-400' },
                    { type: 'payment.overdue', label: 'Esgotado (Atraso)', color: 'border-amber-250 dark:border-amber-950 text-amber-700 dark:text-amber-400' },
                    { type: 'payment.failed', label: 'Falha ou Estorno', color: 'border-red-250 dark:border-red-950 text-red-700 dark:text-red-400' },
                    { type: 'payment.refunded', label: 'Reembolsado', color: 'border-blue-250 dark:border-blue-950 text-blue-700 dark:text-blue-405' }
                  ].map((evt) => {
                    const isSel = webhookEventType === evt.type;
                    return (
                      <button
                        key={evt.type}
                        type="button"
                        onClick={() => setWebhookEventType(evt.type as any)}
                        className={`p-2 rounded-xl border text-left font-bold transition flex flex-col justify-between cursor-pointer ${
                          isSel 
                            ? 'bg-indigo-600 border-indigo-650 text-white shadow-sm ring-2 ring-indigo-500/20'
                            : `bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 ${evt.color}`
                        }`}
                      >
                        <span className="block truncate">{evt.label}</span>
                        <span className={`text-[8px] font-mono mt-1 font-medium ${isSel ? 'text-indigo-200' : 'text-slate-450'}`}>
                          {evt.type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleTriggerWebhook}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer mt-2 text-xs"
              >
                <Send className="w-4 h-4 text-indigo-200" />
                Simular Recebimento de Webhook
              </button>

              {webhookResult && (
                <div className="p-3.5 bg-slate-900 border border-slate-850 text-slate-350 rounded-xl font-mono text-[10px] space-y-1.5">
                  <div className="flex justify-between text-indigo-400 font-bold border-b border-slate-800 pb-1 uppercase tracking-wide">
                    <span>Resultado do Disparo</span>
                    <span className={webhookResult.success ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}>
                      Status: {webhookResult.statusCode}
                    </span>
                  </div>
                  <p><span className="text-slate-500">Mapeado:</span> {webhookResult.success ? "Com Sucesso" : "Recusado"}</p>
                  <p><span className="text-slate-500">Resposta:</span> {webhookResult.message}</p>
                  {webhookResult.details && (
                    <div className="bg-slate-955 p-2 rounded text-[9px] text-slate-400 border border-slate-900/50 space-y-0.5">
                      <p>• Reserva ID: {webhookResult.details.bookingId}</p>
                      <p>• Novo Status ERP: <span className="font-bold text-slate-105">{webhookResult.details.newStatus}</span></p>
                      <p>• Compensa Lançamento: {webhookResult.details.paymentId}</p>
                      {webhookResult.details.contractGenerated && (
                        <p className="text-emerald-400 font-bold">• ✓ Contrato e faturamento gerados autonomamente!</p>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
