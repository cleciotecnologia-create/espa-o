/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getClientes, saveCliente, deleteCliente, getReservas } from '../services/db';
import { formatCPFOrCNPJ, validateCPFOrCNPJ } from '../services/validation';
import { Cliente, Reserva } from '../types';
import { Plus, Edit, Trash, Users, Search, X, Check, FileCheck, CircleDollarSign, Calendar } from 'lucide-react';

export default function ClientsView() {
  const [clients, setClients] = useState<Cliente[]>([]);
  const [bookings, setBookings] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);

  // Form Fields
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [telefone, setTelefone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    loadClientsData();
  }, []);

  const loadClientsData = async () => {
    try {
      setLoading(true);
      const data = await getClientes();
      const bks = await getReservas();
      setClients(data);
      setBookings(bks);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingClient(null);
    setNome('');
    setCpf('');
    setRg('');
    setTelefone('');
    setWhatsapp('');
    setEmail('');
    setEndereco('');
    setObservacoes('');
    setShowModal(true);
  };

  const handleOpenEditModal = (c: Cliente) => {
    setEditingClient(c);
    setNome(c.nome);
    setCpf(formatCPFOrCNPJ(c.cpf));
    setRg(c.rg || '');
    setTelefone(c.telefone);
    setWhatsapp(c.whatsapp || '');
    setEmail(c.email);
    setEndereco(c.endereco || '');
    setObservacoes(c.observacoes || '');
    setShowModal(true);
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja apagar o registro do cliente "${name}"? Todas as reservas vinculadas continuarão no sistema.`)) {
      try {
        await deleteCliente(id);
        loadClientsData();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !cpf.trim() || !telefone.trim() || !email.trim()) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    if (!validateCPFOrCNPJ(cpf)) {
      alert("CPF ou CNPJ inválido. Por favor, corrija o documento para prosseguir.");
      return;
    }

    const payload: Omit<Cliente, 'id' | 'createdAt'> & { id?: string } = {
      nome,
      cpf,
      rg,
      telefone,
      whatsapp,
      email,
      endereco,
      observacoes
    };

    if (editingClient) {
      payload.id = editingClient.id;
    }

    try {
      await saveCliente(payload);
      setShowModal(false);
      loadClientsData();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter clients dynamically by search terms with support for formatted and unformatted inputs (CPF, CNPJ, phone numbers)
  const filteredClients = clients.filter(c => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;

    // Remove any non-alphanumeric characters for raw number searching (useful for CPF/CNPJ and telephones)
    const cleanTerm = term.replace(/\D/g, '');
    const cleanCpf = c.cpf.replace(/\D/g, '');
    const cleanTelefone = c.telefone.replace(/\D/g, '');
    const cleanWhatsapp = (c.whatsapp || '').replace(/\D/g, '');

    const matchesName = c.nome.toLowerCase().includes(term);
    const matchesEmail = c.email.toLowerCase().includes(term);
    const matchesCpf = c.cpf.toLowerCase().includes(term) || (cleanTerm && cleanCpf.includes(cleanTerm));
    const matchesTelefone = c.telefone.toLowerCase().includes(term) || 
                            (cleanTerm && cleanTelefone.includes(cleanTerm)) || 
                            (cleanTerm && cleanWhatsapp.includes(cleanTerm));

    return matchesName || matchesEmail || matchesCpf || matchesTelefone;
  });

  return (
    <div className="space-y-6">
      
      {/* Search menu and add button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">Clientes Cadastrados</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Diretório integrado de clientes corporativos e contratantes físicos de eventos.</p>
        </div>
        <button
          id="btn-add-client"
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-750 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Cliente</span>
        </button>
      </div>

      {/* Search Input bar */}
      <div className="relative max-w-md">
        <label htmlFor="clients-search-input" className="sr-only">Buscar cliente</label>
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          id="clients-search-input"
          type="text"
          placeholder="Filtrar por nome, CPF ou e-mail..."
          className="w-full pl-9 pr-4 py-2 border border-gray-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-400"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-24 text-gray-500">
          <Users className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
          Carregando fichas cadastrais...
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 shadow-sm border border-gray-200 dark:border-slate-805 rounded-xl p-12 text-center max-w-sm mx-auto">
          <p className="text-sm text-gray-500">Nenhum cliente atende aos parâmetros de pesquisa filtrados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
          {filteredClients.map((cli) => {
            const clientReservations = bookings.filter(b => b.clienteId === cli.id);
            const activeBookingsCount = clientReservations.filter(b => b.status === 'Confirmado').length;

            return (
              <div 
                key={cli.id} 
                id={`client-card-${cli.id}`}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-5 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  
                  {/* Card head layout */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-705 dark:text-indigo-400 text-sm border border-gray-205 dark:border-slate-700/60 uppercase">
                      {cli.nome.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-gray-950 dark:text-white truncate">{cli.nome}</h3>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-mono">CPF: {cli.cpf} {cli.rg ? `• RG: ${cli.rg}` : ''}</p>
                    </div>
                  </div>

                  {/* Body contact details list */}
                  <div className="mt-4 space-y-2 text-xs border-t border-gray-100 dark:border-slate-800/60 pt-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">E-mail:</span>
                      <a href={`mailto:${cli.email}`} className="text-gray-800 dark:text-zinc-250 hover:underline truncate max-w-[190px]">{cli.email}</a>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Telefone:</span>
                      <span className="text-gray-800 dark:text-zinc-250 font-mono">{cli.telefone}</span>
                    </div>
                    {cli.whatsapp && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">WhatsApp:</span>
                        <span className="text-emerald-600 dark:text-emerald-450 font-bold font-mono">{cli.whatsapp}</span>
                      </div>
                    )}
                    {cli.endereco && (
                      <div className="flex flex-col mt-1">
                        <span className="text-gray-400 mb-0.5">Endereço Comercial:</span>
                        <span className="text-gray-700 dark:text-zinc-350 text-[11px] truncate leading-normal" title={cli.endereco}>{cli.endereco}</span>
                      </div>
                    )}
                    {cli.observacoes && (
                      <div className="bg-amber-100/30 dark:bg-amber-950/20 text-yellow-800 dark:text-amber-400 p-2 rounded-lg text-[10px] leading-relaxed mt-2.5">
                        <strong>Obs:</strong> {cli.observacoes}
                      </div>
                    )}
                  </div>

                </div>

                {/* Operations Footer info */}
                <div className="mt-5 pt-3.5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 bg-slate-50 dark:bg-slate-950/30 px-2 py-1 rounded">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{clientReservations.length} total • <strong className="text-emerald-600">{activeBookingsCount} confirmados</strong></span>
                  </div>

                  <div className="flex gap-1">
                    <button
                      id={`btn-edit-client-${cli.id}`}
                      onClick={() => handleOpenEditModal(cli)}
                      className="p-1.5 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg border border-gray-205 dark:border-slate-700 transition"
                      title="Editar ficha"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`btn-delete-client-${cli.id}`}
                      onClick={() => handleDeleteClient(cli.id, cli.nome)}
                      className="p-1.5 bg-rose-500/5 hover:bg-rose-500/20 text-rose-500 hover:text-rose-600 rounded-lg border border-rose-500/10 transition"
                      title="Excluir ficha"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Client Modal popup UI */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-md font-bold text-gray-905 dark:text-white">
                {editingClient ? "Editar Ficha de Cliente" : "Adicionar Cliente"}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 hover:bg-gray-100 dark:hover:bg-slate-800 roundedLg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 mt-4 text-xs">
              
              {/* Field: Nome */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Nome Completo (ou Razão Social) *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do contratante"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Group: CPF / RG */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">CPF (ou CNPJ) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPFOrCNPJ(e.target.value))}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none ${
                      cpf ? (validateCPFOrCNPJ(cpf) ? 'border-emerald-500 focus:ring-1 focus:ring-emerald-500' : 'border-rose-500 focus:ring-1 focus:ring-rose-500') : 'border-gray-300 dark:border-slate-700'
                    }`}
                  />
                  {cpf && (
                    <span className={`block text-[10px] mt-1 font-semibold ${
                      validateCPFOrCNPJ(cpf) ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {validateCPFOrCNPJ(cpf) ? '✓ Documento válido' : '✗ CPF ou CNPJ inválido'}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Cédula RG</label>
                  <input
                    type="text"
                    placeholder="Ex: 00.000.000-0"
                    value={rg}
                    onChange={(e) => setRg(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-301 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-909 dark:text-white"
                  />
                </div>
              </div>

              {/* Group: Contact devices */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Telefone Principal *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ex: (11) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-301 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-909 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">WhatsApp direto</label>
                  <input
                    type="tel"
                    placeholder="Ex: (11) 98888-8888"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-301 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-909 dark:text-white"
                  />
                </div>
              </div>

              {/* Field: Email */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">E-mail de Faturamento *</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: cliente@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>

              {/* Field: Address */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Endereço de Correspondência</label>
                <input
                  type="text"
                  placeholder="Rua, Número, Bairro, Cidade, Estado"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>

              {/* Field: Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Observações Internas</label>
                <textarea
                  rows={2.5}
                  placeholder="Informe restrições Alimentares, preferências e observações diversas importantes..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                ></textarea>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-gray-150 dark:border-slate-850 flex justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 text-gray-709 dark:text-zinc-300 border border-gray-200 dark:border-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-755 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Confirmar Cadastro
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
