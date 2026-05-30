/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getReservas, getClientes, getEspacos, getPagamentos } from '../services/db';
import { Reserva, Cliente, Espaco, Pagamento } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  TrendingUp, 
  CalendarRange, 
  CheckSquare, 
  LineChart, 
  Award, 
  ChevronDown 
} from 'lucide-react';

export default function ReportsView() {
  const [bookings, setBookings] = useState<Reserva[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [spaces, setSpaces] = useState<Espaco[]>([]);
  const [payments, setPayments] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async () => {
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24 text-gray-500">
        <LineChart className="w-8 h-8 animate-spin text-indigo-505 mr-2" />
        Carregando painel de business intelligence...
      </div>
    );
  }

  // 1. Calculate Monthly Revenues BarChart data
  const monthlyIncomes: { [key: string]: number } = {};
  payments.filter(p => p.status === 'Confirmado' && !p.reservaId.startsWith('despesa_')).forEach(p => {
    if (p.dataPagamento) {
      // e.g. "2026-05-30" -> get month index
      const date = new Date(p.dataPagamento + "T00:00:00");
      const label = date.toLocaleDateString('pt-BR', { month: 'short' });
      monthlyIncomes[label] = (monthlyIncomes[label] || 0) + p.valor;
    }
  });

  const chartRevenuesData = Object.keys(monthlyIncomes).map(k => ({
    name: k,
    Faturamento: monthlyIncomes[k]
  }));

  // 2. Space Distribution PieChart data (Compare occupancy)
  const spaceDistribution: { [key: string]: number } = {};
  bookings.forEach(b => {
    const sp = spaces.find(s => s.id === b.espacoId);
    const label = sp ? sp.nome : 'Outros';
    spaceDistribution[label] = (spaceDistribution[label] || 0) + 1;
  });

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
  const chartPieData = Object.keys(spaceDistribution).map(k => ({
    name: k,
    value: spaceDistribution[k]
  }));

  // 3. Budgets vs Booking funnel analytics: count of bookings per status
  const budgetCount = bookings.filter(b => b.status === 'Orçamento').length;
  const waitingCount = bookings.filter(b => b.status === 'Aguardando sinal').length;
  const confirmedCount = bookings.filter(b => b.status === 'Confirmado').length;
  const cancellationCount = bookings.filter(b => b.status === 'Cancelado').length;

  const funnelData = [
    { name: 'Em Orçamento', volume: budgetCount },
    { name: 'Sinal pendente', volume: waitingCount },
    { name: 'Confirmados', volume: confirmedCount },
    { name: 'Cancelados', volume: cancellationCount }
  ];

  // 4. Client Leaderboard by Booking count and total billing contribution
  const clientLeaderboard = clients.map(c => {
    const clientBks = bookings.filter(b => b.clienteId === c.id);
    const contributionTotal = clientBks.reduce((sum, b) => sum + b.valorTotal, 0);
    return {
      nome: c.nome,
      eventosCount: clientBks.length,
      contribuicao: contributionTotal
    };
  })
  .sort((a,b) => b.contribuicao - a.contribuicao)
  .slice(0, 5);

  // 5. Total calculations
  const totalReceivedGlobal = payments
    .filter(p => p.status === 'Confirmado' && !p.reservaId.startsWith('despesa_'))
    .reduce((sum, p) => sum + p.valor, 0);

  const averageTicket = bookings.length > 0 ? (totalReceivedGlobal / bookings.length) : 0;

  return (
    <div className="space-y-6">
      
      {/* Upper header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-901 dark:text-white leading-tight">Painel de Métricas e Relatórios</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 font-sans">Visualizadores gráficos de faturamento mensal, liderança de espaços alugados e funil de conversão.</p>
      </div>

      {/* Analytics KPI header summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        
        {/* Metric 1 */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-4 rounded-xl shadow-sm text-left">
          <span className="text-[10px] uppercase font-bold text-gray-505 font-mono">Faturamento Líquido Geral</span>
          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">R$ {totalReceivedGlobal.toLocaleString('pt-BR')}</p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-4 rounded-xl shadow-sm text-left">
          <span className="text-[10px] uppercase font-bold text-gray-505 font-mono">Reserva Ticket Médio</span>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">R$ {averageTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-4 rounded-xl shadow-sm text-left">
          <span className="text-[10px] uppercase font-bold text-gray-505 font-mono">Agendamentos Realizados</span>
          <p className="text-lg font-black text-gray-950 dark:text-white mt-1 font-mono">{bookings.length} eventos</p>
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-4 rounded-xl shadow-sm text-left">
          <span className="text-[10px] uppercase font-bold text-gray-505 font-mono">Taxa de Conversão de Orçados</span>
          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
            {bookings.length > 0 ? ((confirmedCount / bookings.length) * 100).toFixed(0) : 0}%
          </p>
        </div>

      </div>

      {/* Core charts layout grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Monthly Revenues Bar chart area */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-5 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-901 dark:text-white select-none">Histórico Mensal de Faturamento (R$)</h3>
          
          <div className="h-64">
            {chartRevenuesData.length === 0 ? (
              <p className="text-xs text-gray-400 text-center pt-24">Aguardando liquidação de mais recebidos pia PIX.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRevenuesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip formatter={(value) => `R$ ${value.toLocaleString()}`} />
                  <Bar dataKey="Faturamento" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={35} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Space distributions pie-charts column */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-5 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-901 dark:text-white select-none">Giro e Ocupação de Espaço</h3>

          <div className="h-44 relative">
            {chartPieData.length === 0 ? (
              <p className="text-xs text-gray-450 text-center pt-16">Nenhum espaço físico agendado.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Sub legend table color list */}
          <div className="space-y-2 text-[11px] leading-relaxed text-gray-600 dark:text-zinc-400">
            {chartPieData.map((d, index) => (
              <div key={d.name} className="flex justify-between items-center pr-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <span className="font-semibold truncate max-w-[140px] text-gray-901 dark:text-zinc-300">{d.name}</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-white font-mono">{d.value} diárias</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Secondary analytics details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Funnel list layout details */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-5 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-901 dark:text-white select-none">Métricas de Funil Comercial (Status)</h3>
          
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="volume" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Client leaderboard layout card */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-5 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-901 dark:text-white select-none pb-2 border-b border-gray-100 dark:border-slate-800">
              Contratantes Líderes de Faturamento
            </h3>
            <div className="divide-y divide-gray-100 dark:divide-slate-800/60 mt-2 text-xs">
              {clientLeaderboard.length === 0 ? (
                <p className="text-xs text-gray-400 py-12 text-center">Nenhum histórico faturado.</p>
              ) : (
                clientLeaderboard.map((cli, idx) => (
                  <div key={cli.nome} className="py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px] text-gray-600 dark:text-zinc-300">
                        {idx + 1}
                      </div>
                      <span className="font-bold text-gray-950 dark:text-white truncate max-w-[170px]">{cli.nome}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">R$ {cli.contribuicao.toLocaleString('pt-BR')}</p>
                      <p className="text-[10px] text-gray-400">{cli.eventosCount} agendamentos</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-500 rounded-lg text-[10.5px]">
            <Award className="w-4 h-4 text-indigo-505 flex-shrink-0" />
            <p className="leading-snug">Identifique perfis corporativos recorrentes de casamentos organizadores no ERP para aplicar descontos de fidelidade.</p>
          </div>
        </div>

      </div>

    </div>
  );
}
