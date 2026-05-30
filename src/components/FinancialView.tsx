/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  getPagamentos, 
  getReservas, 
  getClientes, 
  savePagamento, 
  deletePagamento, 
  addActivityLog 
} from '../services/db';
import { Pagamento, Reserva, Cliente } from '../types';
import { 
  Plus, 
  Coins, 
  Trash, 
  X, 
  Check, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  FileSpreadsheet, 
  Filter 
} from 'lucide-react';

export default function FinancialView() {
  const [payments, setPayments] = useState<Pagamento[]>([]);
  const [bookings, setBookings] = useState<Reserva[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<'receivables' | 'payables'>('receivables');

  // Modal manual entry
  const [showModal, setShowModal] = useState(false);

  // Form Fields
  const [formType, setFormType] = useState<'receivable' | 'payable'>('receivable');
  const [formReservaId, setFormReservaId] = useState(''); // Can bind to a book or have general category name (e.g. "despesa_energia")
  const [formValor, setFormValor] = useState(500);
  const [formForma, setFormForma] = useState<'PIX' | 'Cartão' | 'Dinheiro' | 'Transferência'>('PIX');
  const [formStatus, setFormStatus] = useState<'Pendente' | 'Confirmado'>('Confirmado');
  const [manualDescription, setManualDescription] = useState('Despesa Geral');

  useEffect(() => {
    loadFinances();
  }, []);

  const loadFinances = async () => {
    try {
      setLoading(true);
      const pay = await getPagamentos();
      const bks = await getReservas();
      const clis = await getClientes();
      setPayments(pay);
      setBookings(bks);
      setClients(clis);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async (pay: Pagamento) => {
    try {
      const updated: Pagamento = {
        ...pay,
        status: 'Confirmado',
        dataPagamento: new Date().toISOString().substring(0, 10)
      };
      await savePagamento(updated);
      await addActivityLog("Financeiro", `Pagamento confirmado manualmente: R$ ${pay.valor} via ${pay.formaPagamento}.`);
      loadFinances();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteEntry = async (id: string, value: number) => {
    if (confirm(`Remover lançamento de R$ ${value.toLocaleString()}?`)) {
      try {
        await deletePagamento(id);
        loadFinances();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If it's a payable, write "despesa_<name>" inside the relationship field
    const finalReservaId = formType === 'payable' 
      ? `despesa_${manualDescription.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}` 
      : formReservaId;

    if (!finalReservaId) {
      alert("Favor descrever ou vincular uma reserva ativa.");
      return;
    }

    try {
      await savePagamento({
        reservaId: finalReservaId,
        valor: Number(formValor),
        formaPagamento: formForma,
        status: formStatus,
        dataPagamento: formStatus === 'Confirmado' ? new Date().toISOString().substring(0, 10) : undefined
      });

      setShowModal(false);
      loadFinances();
    } catch (e) {
      console.error(e);
    }
  };

  // Metrics Cash Flow Calculators
  const cashInflows = payments
    .filter(p => p.status === 'Confirmado' && !p.reservaId.startsWith('despesa_'))
    .reduce((sum, p) => sum + p.valor, 0);

  const cashOutflows = payments
    .filter(p => p.status === 'Confirmado' && p.reservaId.startsWith('despesa_'))
    .reduce((sum, p) => sum + p.valor, 0);

  const netBalance = cashInflows - cashOutflows;

  // Split calculations
  const receivablesList = payments.filter(p => !p.reservaId.startsWith('despesa_'));
  const payablesList = payments.filter(p => p.reservaId.startsWith('despesa_'));

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-905 dark:text-white leading-tight">Módulo Financeiro</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Controle de fluxo de caixa, pagamentos confirmados, sinal de contrato e despesas prediais.</p>
        </div>
        <button
          id="btn-add-transaction"
          onClick={() => {
            setFormType('payable');
            setManualDescription('Limpeza do salão');
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-750 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Lançar Movimento</span>
        </button>
      </div>

      {/* Cash Flow Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card Entry */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest font-sans">Total Recebido (Entradas)</span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-450 mt-1 font-mono">
              R$ {cashInflows.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        {/* Card Outgoings */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest font-sans">Total Desembolsado (Saídas)</span>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-455 mt-1 font-mono">
              R$ {cashOutflows.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </div>

        {/* Net Cash Balance */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest font-sans">Saldo Líquido</span>
            <p className={`text-2xl font-black mt-1 font-mono ${netBalance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}`}>
              R$ {netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className={`p-3.5 rounded-xl ${netBalance >= 0 ? 'bg-indigo-55 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' : 'bg-rose-50 text-rose-55'}`}>
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Tabs list toggle */}
      <div className="flex border-b border-gray-250 dark:border-slate-805 gap-6 select-none leading-none">
        <button
          onClick={() => setActiveTab('receivables')}
          className={`pb-3 text-sm font-bold transition-all relative cursor-pointer ${
            activeTab === 'receivables' 
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' 
              : 'text-gray-400 hover:text-gray-900 dark:hover:text-zinc-200'
          }`}
        >
          Contas a Receber (Projetos / Eventos)
        </button>
        <button
          onClick={() => setActiveTab('payables')}
          className={`pb-3 text-sm font-bold transition-all relative cursor-pointer ${
            activeTab === 'payables' 
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' 
              : 'text-gray-400 hover:text-gray-900 dark:hover:text-zinc-200'
          }`}
        >
          Contas a Pagar (Despesas & Serviços)
        </button>
      </div>

      {loading ? (
        <div className="text-center py-24 text-gray-500">
          <Coins className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-505" />
          Carregando registros...
        </div>
      ) : activeTab === 'receivables' ? (
        
        /* Contas a receber table */
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-105 dark:border-slate-800 text-[10px] uppercase font-mono text-gray-400 bg-slate-50 dark:bg-slate-950/20 py-2">
                <th className="p-3.5 pl-5 font-bold">Reserva Vinculada</th>
                <th className="p-3.5 font-bold">Cliente</th>
                <th className="p-3.5 font-bold">Forma de Entrada</th>
                <th className="p-3.5 font-bold">Valor</th>
                <th className="p-3.5 font-bold">Data de Faturamento</th>
                <th className="p-3.5 font-bold">Status</th>
                <th className="p-3.5 pr-5 font-bold text-center">Dar Baixa manual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-zinc-250">
              {receivablesList.map((pay) => {
                const b = bookings.find(res => res.id === pay.reservaId);
                const client = b ? clients.find(c => c.id === b.clienteId) : null;
                
                return (
                  <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/20 transition">
                    <td className="p-3.5 pl-5">
                      <p className="font-bold text-gray-901 dark:text-white">{b?.tipoEvento || 'Entrada Avulsa'}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID PGTO: {pay.id}</p>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-800 dark:text-zinc-300">
                      {client?.nome || 'Cliente avulso'}
                    </td>
                    <td className="p-3.5 font-medium">
                      {pay.formaPagamento}
                    </td>
                    <td className="p-3.5 font-bold text-indigo-650 dark:text-indigo-400 font-mono">
                      R$ {pay.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 font-semibold font-mono text-slate-500">
                      {pay.dataPagamento ? new Date(pay.dataPagamento + "T00:00:00").toLocaleDateString('pt-BR') : 'Aguardando fluxo'}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider ${
                        pay.status === 'Confirmado' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-955 dark:text-amber-400'
                      }`}>
                        {pay.status}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-center">
                      <div className="flex gap-2 justify-center items-center">
                        {pay.status === 'Pendente' && (
                          <button
                            id={`btn-manual-confirm-${pay.id}`}
                            onClick={() => handleConfirmPayment(pay)}
                            className="p-1 px-2.5 bg-emerald-500 hover:bg-emerald-650 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Quitar recebimento"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Quitar</span>
                          </button>
                        )}
                        <button
                          id={`btn-delete-finance-${pay.id}`}
                          onClick={() => handleDeleteEntry(pay.id, pay.valor)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/5 rounded-lg border border-transparent transition cursor-pointer"
                          title="Excluir lançamento"
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

      ) : (

        /* Contas a pagar table */
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-105 dark:border-slate-800 text-[10px] uppercase font-mono text-gray-400 bg-slate-50 dark:bg-slate-950/20 py-2">
                <th className="p-3.5 pl-5 font-bold">Descrição da Despesa</th>
                <th className="p-3.5 font-bold">Tipo de Carga</th>
                <th className="p-3.5 font-bold">Forma de Saída</th>
                <th className="p-3.5 font-bold">Valor Pago</th>
                <th className="p-3.5 font-bold">Data de Quitação</th>
                <th className="p-3.5 font-bold">Status</th>
                <th className="p-3.5 pr-5 font-bold text-center">Controles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-zinc-250">
              {payablesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-405">Nenhuma despesa de saída registrada ainda.</td>
                </tr>
              ) : (
                payablesList.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/20 transition">
                    <td className="p-3.5 pl-5">
                      <p className="font-bold text-gray-905 dark:text-white capitalize">
                        {pay.reservaId.replace('despesa_', '').replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] text-gray-404 font-mono">PGTO REF: {pay.id}</p>
                    </td>
                    <td className="p-3.5 font-semibold text-indigo-500">Custo Geral Imóvel</td>
                    <td className="p-3.5 font-medium">{pay.formaPagamento}</td>
                    <td className="p-3.5 font-bold text-rose-600 font-mono">
                      - R$ {pay.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 font-semibold font-mono text-slate-450">
                      {pay.dataPagamento ? new Date(pay.dataPagamento + "T00:00:00").toLocaleDateString('pt-BR') : 'Pendente de faturamento'}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase ${
                        pay.status === 'Confirmado' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400' : 'bg-amber-100 text-amber-805'
                      }`}>
                        {pay.status === 'Confirmado' ? 'Liquidado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-center">
                      <div className="flex gap-2 justify-center">
                        {pay.status === 'Pendente' && (
                          <button
                            id={`btn-confirm-payable-${pay.id}`}
                            onClick={() => handleConfirmPayment(pay)}
                            className="p-1 px-2.5 bg-emerald-500 hover:bg-emerald-650 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            Quitar
                          </button>
                        )}
                        <button
                          id={`btn-delete-payable-${pay.id}`}
                          onClick={() => handleDeleteEntry(pay.id, pay.valor)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/5 rounded-lg border border-transparent transition cursor-pointer"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      )}

      {/* Manual Entry Transaction registry Modal popup UI */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-md font-bold text-gray-905 dark:text-white">
                Faturar Movimento Manual (Contas a Receber/Pagar)
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 hover:bg-gray-100 dark:hover:bg-slate-800 roundedLg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4 mt-4 text-xs font-sans">
              
              {/* Type toggle selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-350 uppercase mb-1.5">Natureza do Lançamento *</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50 dark:bg-slate-950/20 rounded-xl border border-gray-100 dark:border-slate-850">
                  <button
                    type="button"
                    onClick={() => setFormType('receivable')}
                    className={`p-2 rounded-lg text-xs font-bold transition cursor-pointer-all ${
                      formType === 'receivable' 
                        ? 'bg-emerald-500 text-white shadow-sm' 
                        : 'text-gray-500 dark:text-zinc-400'
                    }`}
                  >
                    Entrada (A Receber)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('payable')}
                    className={`p-2 rounded-lg text-xs font-bold transition cursor-pointer-all ${
                      formType === 'payable' 
                        ? 'bg-rose-500 text-white shadow-sm' 
                        : 'text-gray-500 dark:text-zinc-400'
                    }`}
                  >
                    Saída (A Pagar)
                  </button>
                </div>
              </div>

              {/* Dynamic Context selector */}
              {formType === 'receivable' ? (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Vincular a uma Reserva Ativa *</label>
                  <select
                    required
                    value={formReservaId}
                    onChange={(e) => setFormReservaId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-905 focus:outline-none"
                  >
                    <option value="">-- Selecione o evento contratado --</option>
                    {bookings.map(b => (
                      <option key={b.id} value={b.id}>{b.tipoEvento} (Total: R$ {b.valorTotal})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-gray-751 dark:text-zinc-300 uppercase mb-1">Descreva a Despesa Predial / Operação *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Energia elétrica CELESC, Limpeza predial"
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white"
                  />
                </div>
              )}

              {/* Value & Payments options */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Valor do movimento *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formValor}
                    onChange={(e) => setFormValor(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-950 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Forma de Liquidação *</label>
                  <select
                    value={formForma}
                    onChange={(e: any) => setFormForma(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-909 dark:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-55"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartão">Cartão de Crédito</option>
                    <option value="Dinheiro">Dinheiro Físico</option>
                    <option value="Transferência">TED / DOC</option>
                  </select>
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Status de quitação do movimento *</label>
                <select
                  value={formStatus}
                  onChange={(e: any) => setFormStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-zinc-200 focus:outline-none"
                >
                  <option value="Confirmado">Pago / Confirmado imediatamente</option>
                  <option value="Pendente">Pendente de lançamento / Provisionado</option>
                </select>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-gray-150 dark:border-slate-850 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 text-gray-707 border border-gray-200 dark:border-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Lançar Movimento
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
