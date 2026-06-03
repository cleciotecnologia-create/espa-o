/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  getReservas, 
  getClientes, 
  getEspacos, 
  getContratos,
  saveContrato, 
  addActivityLog 
} from '../services/db';
import { Reserva, Cliente, Espaco, Contrato } from '../types';
import { triggerContractNotification, getLessorConfigs } from '../services/notifications';
import { 
  FileText, 
  Printer, 
  Save, 
  X, 
  FileCheck, 
  AlertTriangle, 
  ArrowRight,
  Eye,
  Check,
  Download,
  Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ContractsViewProps {
  preselectedBookingId?: string | null;
}

export default function ContractsView({ preselectedBookingId }: ContractsViewProps) {
  const [bookings, setBookings] = useState<Reserva[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [spaces, setSpaces] = useState<Espaco[]>([]);
  const [contractsHistory, setContractsHistory] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);

  // States
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [contractBodyText, setContractBodyText] = useState('');
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [brandLogo, setBrandLogo] = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('cfg_brand_logo') || '') : '');

  useEffect(() => {
    const handleUpdate = () => {
      setBrandLogo(localStorage.getItem('cfg_brand_logo') || '');
    };
    window.addEventListener('brand-colors-updated', handleUpdate);
    return () => {
      window.removeEventListener('brand-colors-updated', handleUpdate);
    };
  }, []);

  const renderStylizedHTML = () => {
    const lessor = getLessorConfigs();
    const lines = contractBodyText.split('\n');

    return (
      <div className="space-y-4 font-serif text-[13px] text-neutral-850 leading-relaxed text-justify select-none">
        {/* Letterhead Header */}
        <div className="text-center border-b-2 border-double border-neutral-300 pb-4 mb-6 font-sans">
          {brandLogo && (
            <div className="flex justify-center mb-3">
              <img src={brandLogo} alt="Logo" className="h-10 object-contain rounded-md max-w-[150px]" referrerPolicy="no-referrer" />
            </div>
          )}
          <div className="flex justify-center items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span>
            <span className="text-xs font-black tracking-widest uppercase text-neutral-900">{lessor.nomeFantasia}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
          </div>
          <p className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">{lessor.razaoSocial} | CNPJ: {lessor.cnpjCpf}</p>
          <p className="text-[9px] text-neutral-400 font-medium">{lessor.endereco}</p>
        </div>

        {/* Dynamic Parsed Content */}
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-3" />;
          }

          // Detect Section Title like I., II., III.
          if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+/.test(trimmed)) {
            return (
              <h3 key={idx} className="text-xs font-extrabold tracking-wider text-neutral-900 uppercase mt-5 mb-2 font-sans border-l-2 border-indigo-600 pl-2">
                {trimmed}
              </h3>
            );
          }

          // Main Header block
          if (trimmed === trimmed.toUpperCase() && trimmed.length > 20 && !trimmed.startsWith('LOCADOR') && !trimmed.startsWith('LOCATÁRIO') && !trimmed.startsWith('CNPJ') && !trimmed.startsWith('CPF') && !trimmed.startsWith('R$')) {
            return (
              <h2 key={idx} className="text-[14px] font-black text-center tracking-wide text-neutral-950 uppercase border-b border-dashed border-neutral-300 pb-1.5 my-5 font-sans">
                {trimmed}
              </h2>
            );
          }

          // Signature lines or dates
          if (trimmed.startsWith('___') || trimmed.includes('(LOCADOR)') || trimmed.includes('(LOCATÁRIO)') || trimmed.includes('ASSINATURA')) {
            return (
              <p key={idx} className="text-center text-[11px] font-sans text-neutral-600 font-semibold tracking-wide my-4">
                {trimmed}
              </p>
            );
          }

          // Normal paragraphs
          return (
            <p key={idx} className="text-neutral-850 indent-6 text-justify leading-relaxed">
              {trimmed}
            </p>
          );
        })}

        {/* Seal Footer */}
        <div className="pt-8 mt-12 border-t border-neutral-150 flex justify-between items-center text-[9px] text-neutral-400 font-sans select-none">
          <span>Autenticado via Chave Eletrônica: #ES-{selectedBookingId || '0000'}</span>
          <span>EventSpace ERP - Protocolo BACEN nº 183.904</span>
        </div>
      </div>
    );
  };

  useEffect(() => {
    loadContractCompilationInputs();
    window.addEventListener('es-database-updated', loadContractCompilationInputs);
    return () => {
      window.removeEventListener('es-database-updated', loadContractCompilationInputs);
    };
  }, [preselectedBookingId]);

  const loadContractCompilationInputs = async () => {
    try {
      setLoading(true);
      const bks = await getReservas();
      const clis = await getClientes();
      const sps = await getEspacos();
      const hist = await getContratos();

      setBookings(bks);
      setClients(clis);
      setSpaces(sps);
      setContractsHistory(hist);

      if (preselectedBookingId) {
        setSelectedBookingId(preselectedBookingId);
        compileText(preselectedBookingId, clis, sps, bks);
      } else if (bks.length > 0) {
        setSelectedBookingId(bks[0].id);
        compileText(bks[0].id, clis, sps, bks);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const compileText = (bId: string, currentClients = clients, currentSpaces = spaces, currentBookings = bookings) => {
    const booking = currentBookings.find(b => b.id === bId);
    if (!booking) return;

    const client = currentClients.find(c => c.id === booking.clienteId);
    const space = currentSpaces.find(s => s.id === booking.espacoId);
    const lessor = getLessorConfigs();

    const cancellationPct = space?.taxaCancelamento !== undefined ? space.taxaCancelamento : 10;
    const cancellationVal = (booking.valorTotal * cancellationPct) / 100;

    const lessorPreamble = lessor.tipoPessoa === 'PF'
      ? `LOCADOR: ${lessor.razaoSocial}, CPF nº ${lessor.cnpjCpf}${lessor.rg ? `, RG nº ${lessor.rg}` : ''}, com endereço residencial/operacional em ${lessor.endereco}, doravante denominado simplesmente LOCADOR.`
      : `LOCADOR: ${lessor.razaoSocial} (Nome Fantasia: ${lessor.nomeFantasia}), inscrito no CNPJ/CPF sob nº ${lessor.cnpjCpf}${lessor.inscricaoEstadual ? `, Inscrição Estadual: ${lessor.inscricaoEstadual}` : ''}, com endereço administrativo em ${lessor.endereco}, doravante denominado simplesmente ADMINISTRADORA/LOCADOR.`;

    const text = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS E LOCAÇÃO DE ESPAÇOS PARA EVENTOS

Pelo presente instrumento particular, as partes abaixo qualificadas têm entre si justo e acordado o seguinte:

I. DAS PARTES CONTRATANTES:

${lessorPreamble}

LOCATÁRIO(A):
Nome: ${client?.nome || '_____________________________________'}
CPF: ${client?.cpf || '_____________________'}
RG: ${client?.rg || '_____________________'}
Telefone: ${client?.telefone || '_____________________'}
E-mail: ${client?.email || '_____________________'}
Endereço: ${client?.endereco || '__________________________________________________________'}

II. DO OBJETO:
O presente contrato tem como objeto a cessão de uso temporário do espaço físico:
Espaço: ${space?.nome || '_____________________________________'}
Capacidade contratada: ${booking.qtdConvidados} convidados.
Finalidade: Realização de evento com finalidade de "${booking.tipoEvento}".

III. DA DATA E HORÁRIOS:
O evento de locação será realizado na data de:
Data do Evento: ${new Date(booking.dataEvento + "T00:00:00").toLocaleDateString('pt-BR', { dateStyle: 'long' })}
Horário do Contrato: 08:00 às 18:00 (Faixa de Horário Escolhida: ${booking.horario})
Parágrafo único: O período base contratual compreende o horário regulamentar das 08:00 às 18:00, sujeito à incidência de taxas extras e multas por uso do espaço fora do horário estipulado contratualmente.

IV. DO VALOR E FORMA DE PAGAMENTO:
1. Pela cessão de uso do espaço descrito, o(a) LOCATÁRIO(A) pagará a quantia total de:
Custo Global: R$ ${booking.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
2. Fica pactuado um sinal de garantia, correspondente a 30% do montante, cuja quitação de R$ ${booking.valorSinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} servirá de adiantamento contra arrependimento de reserva.

V. CLÁUSULA DE CANCELAMENTO E DEVOLUÇÃO (MULTA PENAL):
Em caso de rescisão unilateral, cancelamento de reserva voluntária ou desistência por iniciativa do(a) LOCATÁRIO(A), incidirá multa de ${cancellationPct}% sobre o valor global do contrato, perfazendo o montante total de R$ ${cancellationVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Este valor é retido pelo LOCADOR a título de indenização prefixada por bloqueio de pauta e impossibilidade de novas locações para a data estabelecida.

VI. CLÁUSULA DE SEGURANÇA E RESPONSABILIDADES:
O LOCATÁRIO responsabiliza-se integralmente por quaisquer atos, acidentes de segurança, danos patrimoniais e de infraestrutura provocados por seus convidados. Som é permitido até os termos legais estabelecidos pela prefeitura local.

Por estarem justos e acertados, assinam o presente contrato digital em duas vias.

São Paulo, ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}.

______________________________________________
${lessor.razaoSocial} (LOCADOR)

______________________________________________
${client?.nome || '(LOCATÁRIO)'} (ASSINATURA)`;

    setContractBodyText(text);
  };

  const handleBookingChange = (bId: string) => {
    setSelectedBookingId(bId);
    compileText(bId);
  };

  const handleSaveContract = async () => {
    if (!selectedBookingId) return;

    try {
      const contractId = "cnt_" + Date.now();
      await saveContrato({
        id: contractId,
        reservaId: selectedBookingId,
        pdfUrl: '',
        conteudoCustomizado: contractBodyText
      });

      await addActivityLog("Contrato Inteligente", `Documento contratual e termos gerados para a Reserva ID: ${selectedBookingId}`);
      
      setSaveStatusMessage("Contrato arquivado com sucesso!");
      setTimeout(() => setSaveStatusMessage(null), 3000);
      
      // Automatic notifications triggers
      const booking = bookings.find(b => b.id === selectedBookingId);
      const client = booking ? clients.find(c => c.id === booking.clienteId) : null;
      if (booking && client) {
        const fullContrato: Contrato = {
          id: contractId,
          reservaId: selectedBookingId,
          pdfUrl: '',
          conteudoCustomizado: contractBodyText,
          createdAt: new Date().toISOString()
        };
        await triggerContractNotification(booking, client, fullContrato);
      }

      // Refresh history
      const hist = await getContratos();
      setContractsHistory(hist);
    } catch (e) {
      console.error(e);
      setSaveStatusMessage("Erro ao arquivar contrato.");
      setTimeout(() => setSaveStatusMessage(null), 3000);
    }
  };

  // Printable action
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Incapaz de carregar janela de impressão. Certifique-se que popups estejam liberados.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Contrato - EventSpace ERP</title>
          <style>
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: 14px;
              line-height: 1.6;
              padding: 40px;
              color: #000;
              background-color: #fff;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
              font-family: inherit;
            }
            @media print {
              body {
                padding: 0;
              }
              button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <pre>${contractBodyText}</pre>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 1000);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // High-fidelity PDF export with brand assets and layout intact
  const handleExportPdf = async () => {
    const target = document.getElementById('contract-pdf-render-target');
    if (!target) return;

    try {
      setExportingPdf(true);
      setSaveStatusMessage("Gerando PDF com diagramação original...");

      // Short delay to ensure image assets render complete
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(target, {
        scale: 2, // Retains extreme clarity for printed/scanned text
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Draw initial page
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      // Handle multi-page generation seamlessly
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      const filename = `Contrato_Reserva_${selectedBookingId || Date.now()}.pdf`;
      pdf.save(filename);
      
      await addActivityLog("Contrato PDF", `Download de proposta de contrato PDF realizado para a Reserva ID: ${selectedBookingId}`);
      setSaveStatusMessage("PDF exportado com sucesso!");
      setTimeout(() => setSaveStatusMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatusMessage("Erro ao exportar PDF.");
      setTimeout(() => setSaveStatusMessage(null), 3000);
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24 text-gray-500">
        <FileText className="w-8 h-8 animate-bounce mx-auto mb-2 text-indigo-505" />
        Carregando copilador de contratos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Offscreen container specifically for rendering high-fidelity PDF without responsive layout wrapping */}
      <div className="absolute left-[-9999px] top-[-9999px]" aria-hidden="true">
        <div 
          id="contract-pdf-render-target" 
          className="bg-white p-12 text-black w-[800px]"
          style={{ 
            fontFamily: 'Times New Roman, Times, serif',
            color: '#000000',
            backgroundColor: '#ffffff'
          }}
        >
          {renderStylizedHTML()}
        </div>
      </div>

      {/* Upper header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-901 dark:text-white leading-tight">Módulo de Contratos</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 font-sans">Compilador ágil de contratos jurídicos e termos de locação de espaços integrados com faturamento.</p>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 p-12 text-center rounded-2xl max-w-sm mx-auto">
          <p className="text-sm text-gray-500">Cadastre uma reserva ativa na agenda para emitir termos legais.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Settings panel Column */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-5 rounded-xl shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-bold font-mono text-gray-500 dark:text-zinc-400 uppercase tracking-widest pb-2 border-b border-gray-100 dark:border-slate-800">
                Ligar à Reserva
              </h3>

              {/* Selector */}
              <div>
                <label htmlFor="compilation-booking-select" className="sr-only">Selecione uma reserva</label>
                <select
                  id="compilation-booking-select"
                  value={selectedBookingId}
                  onChange={(e) => handleBookingChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 text-gray-805 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {bookings.map(b => {
                    const cli = clients.find(c => c.id === b.clienteId);
                    return (
                      <option key={b.id} value={b.id}>
                        {b.tipoEvento} — {cli?.nome || 'Cliente'} (Data: {b.dataEvento})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Terms alert */}
              <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-gray-100 dark:border-slate-800/80 prose dark:prose-invert">
                <h4 className="text-xs font-bold text-gray-800 dark:text-zinc-200">Campos Inteligentes integrados:</h4>
                <ul className="text-[11px] text-gray-500 space-y-1 mt-1.5 list-disc pl-4 font-sans leading-relaxed">
                  <li>Injeta dados qualificatórios completos do Locador</li>
                  <li>Injeta dados qualificatórios completos do Locatário</li>
                  <li>Insere data, horário slots e valores diários</li>
                  <li>Auto-calcula margens de sinal de entrada (30%)</li>
                </ul>
              </div>

              <div className="space-y-2">
                <button
                  id="btn-save-contract"
                  onClick={handleSaveContract}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Gravar no Histórico</span>
                </button>

                <button
                  id="btn-export-pdf"
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="w-full py-2.5 bg-emerald-650 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
                >
                  {exportingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{exportingPdf ? "Gerando PDF..." : "Baixar PDF Diagramado"}</span>
                </button>

                <button
                  id="btn-print-contract"
                  onClick={handlePrint}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-zinc-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer transition flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Original (Navegador)</span>
                </button>
              </div>

              {saveStatusMessage && (
                <div className="text-center p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 dark:text-indigo-400 text-xs font-semibold border border-indigo-500/10 rounded-lg max-w-sm mx-auto flex items-center justify-center gap-1.5 animate-pulse">
                  <Check className="w-4 h-4" />
                  <span>{saveStatusMessage}</span>
                </div>
              )}
            </div>

            {/* Micro History list */}
            <div>
              <h3 className="text-xs font-bold font-mono text-gray-505 dark:text-zinc-400 uppercase tracking-widest pb-2 border-b border-gray-100 dark:border-slate-800 mb-3 select-none">
                Histórico Recente ({contractsHistory.length})
              </h3>
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {contractsHistory.length === 0 ? (
                  <p className="text-[10px] text-gray-400 py-3 text-center">Nenhum termo gerado anteriormente.</p>
                ) : (
                  contractsHistory.map(h => {
                    const matchingBooking = bookings.find(b => b.id === h.reservaId);
                    const matchingClient = matchingBooking ? clients.find(c => c.id === matchingBooking.clienteId) : null;
                    return (
                      <div 
                        key={h.id} 
                        onClick={() => {
                          setSelectedBookingId(h.reservaId);
                          setContractBodyText(h.conteudoCustomizado || '');
                        }}
                        className="p-2 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-850 hover:bg-slate-105 rounded-lg text-[11px] cursor-pointer transition flex items-center justify-between"
                      >
                        <span className="truncate font-medium text-gray-801 dark:text-white leading-none">
                          {matchingBooking?.tipoEvento || 'Contrato'} - {matchingClient?.nome || 'Cliente'}
                        </span>
                        <span className="font-mono text-[9px] text-gray-400 flex-shrink-0">
                          {new Date(h.createdAt + "T00:00:00").toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Editable text / stylized preview sheet */}
          <div className="lg:col-span-2 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850 p-3 px-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 p-0.5 bg-gray-150 dark:bg-slate-800 rounded-lg max-w-fit">
                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer select-none ${
                    activeTab === 'editor'
                      ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Editar Termos</span>
                </button>
                <button
                  id="tab-contract-preview"
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer select-none ${
                    activeTab === 'preview'
                      ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                  <span>Pré-visualização Estilizada</span>
                </button>
              </div>
              <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-mono font-semibold self-center">
                {activeTab === 'editor' ? '✍️ Modo Edição' : '✨ Simulação Papel Ofício A4'}
              </span>
            </div>

            {activeTab === 'editor' ? (
              <div className="flex-1 bg-white border border-gray-200 shadow-md p-8 sm:p-12 rounded-xl text-black min-h-[500px]">
                <textarea
                  id="contract-body-editor"
                  value={contractBodyText}
                  onChange={(e) => setContractBodyText(e.target.value)}
                  placeholder="Escreva os termos do contrato..."
                  className="w-full h-full min-h-[500px] border-none outline-none resize-none font-sans text-sm text-zinc-900 leading-relaxed overflow-y-auto focus:ring-0 bg-transparent scrollbar-none"
                  style={{ fontFamily: 'Times New Roman, Times, serif' }}
                />
              </div>
            ) : (
              <div 
                id="contract-print-preview-paper" 
                className="flex-1 bg-white border border-neutral-350 shadow-2xl p-8 sm:p-14 rounded-2xl text-black min-h-[500px] relative overflow-hidden transition-all duration-300 transform"
                style={{ backgroundImage: 'radial-gradient(#f0f0f0 1px, transparent 1px)', backgroundSize: '24px 24px' }}
              >
                {/* Visual Premium Watermark representing authenticity */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.015] pointer-events-none select-none">
                  <div className="w-96 h-96 rounded-full border-[20px] border-neutral-900 flex items-center justify-center">
                    <span className="font-sans text-4xl font-extrabold uppercase tracking-[0.2em] transform -rotate-12">AUTÊNTICO</span>
                  </div>
                </div>

                {renderStylizedHTML()}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
