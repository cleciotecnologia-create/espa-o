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
  Check
} from 'lucide-react';

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

  useEffect(() => {
    loadContractCompilationInputs();
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

    const text = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS E LOCAÇÃO DE ESPAÇOS PARA EVENTOS

Pelo presente instrumento particular, as partes abaixo qualificadas têm entre si justo e acordado o seguinte:

I. DAS PARTES CONTRATANTES:

LOCADOR: ${lessor.razaoSocial} (Nome Fantasia: ${lessor.nomeFantasia}), inscrito no CNPJ/CPF sob nº ${lessor.cnpjCpf}${lessor.inscricaoEstadual ? `, Inscrição Estadual: ${lessor.inscricaoEstadual}` : ''}, com endereço administrativo em ${lessor.endereco}, doravante denominado simplesmente ADMINISTRADORA/LOCADOR.

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
Faixa de Horário acordada: ${booking.horario}

IV. DO VALOR E FORMA DE PAGAMENTO:
1. Pela cessão de uso do espaço descrito, o(a) LOCATÁRIO(A) pagará a quantia total de:
Custo Global: R$ ${booking.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
2. Fica pactuado um sinal de garantia, correspondente a 30% do montante, cuja quitação de R$ ${booking.valorSinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} servirá de adiantamento contra arrependimento de reserva.

V. CLÁUSULA DE SEGURANÇA E DEVOLUÇÃO:
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
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs rounded-xl cursor-pointer transition flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Gravar Contrato no Histórico</span>
                </button>

                <button
                  id="btn-print-contract"
                  onClick={handlePrint}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-850 hover:bg-gray-200 text-gray-700 dark:text-zinc-300 font-semibold text-xs border border-gray-250 dark:border-slate-750 rounded-xl cursor-pointer transition flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / Exportar PDF</span>
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

          {/* Editable text preview sheet */}
          <div className="lg:col-span-2 flex flex-col space-y-4">
            <div className="flex justify-between items-center bg-gray-55 dark:bg-slate-850 p-2.5 px-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">Editor e Visualização Pré-Impressão</span>
              <span className="text-[10px] text-gray-400 font-mono">Modo A4 Papel Editor</span>
            </div>

            <div className="flex-1 bg-white border border-gray-200 shadow-lg p-8 sm:p-12 rounded-xl text-black min-h-[500px]">
              <textarea
                id="contract-body-editor"
                value={contractBodyText}
                onChange={(e) => setContractBodyText(e.target.value)}
                className="w-full h-full min-h-[500px] border-none outline-none resize-none font-sans text-sm text-zinc-900 leading-relaxed overflow-y-auto focus:ring-0 bg-transparent scrollbar-none"
                style={{ fontFamily: 'Times New Roman, Times, serif' }}
              ></textarea>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
