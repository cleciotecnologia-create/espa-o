/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getEspacos, saveEspaco, deleteEspaco } from '../services/db';
import { Espaco } from '../types';
import { Plus, Edit, Trash, Image, Check, X, AlertTriangle, Eye, Upload } from 'lucide-react';

export default function SpacesView() {
  const [spaces, setSpaces] = useState<Espaco[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSpace, setEditingSpace] = useState<Espaco | null>(null);

  // Form Fields
  const [nome, setNome] = useState('');
  const [capacidade, setCapacidade] = useState(200);
  const [valorLocacao, setValorLocacao] = useState(3000);
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [fotos, setFotos] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    try {
      setLoading(true);
      const data = await getEspacos();
      setSpaces(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingSpace(null);
    setNome('');
    setCapacidade(200);
    setValorLocacao(3000);
    setDescricao('');
    setStatus('Ativo');
    setFotos([]);
    setShowModal(true);
  };

  const openEditModal = (sp: Espaco) => {
    setEditingSpace(sp);
    setNome(sp.nome);
    setCapacidade(sp.capacidade);
    setValorLocacao(sp.valorLocacao);
    setDescricao(sp.descricao);
    setStatus(sp.status);
    setFotos(sp.fotos || []);
    setShowModal(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadProgress("Enviando foto...");
    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultString = reader.result as string;
      setFotos(prev => [...prev, resultString]);
      setUploadProgress("Foto carregada com sucesso!");
      setTimeout(() => setUploadProgress(null), 2000);
    };
    reader.onerror = () => {
      setUploadProgress("Falha no upload.");
      setTimeout(() => setUploadProgress(null), 2000);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !descricao.trim()) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    // Default photo if empty
    const finalFotos = fotos.length > 0 ? fotos : ["https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800"];

    const payload: Omit<Espaco, 'id'> & { id?: string } = {
      nome,
      capacidade: Number(capacidade),
      valorLocacao: Number(valorLocacao),
      descricao,
      status,
      fotos: finalFotos
    };

    if (editingSpace) {
      payload.id = editingSpace.id;
    }

    try {
      await saveEspaco(payload);
      setShowModal(false);
      loadSpaces();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja remover o espaço "${name}"?`)) {
      try {
        await deleteEspaco(id);
        loadSpaces();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const triggerUploadInput = () => {
    document.getElementById('space-file-input')?.click();
  };

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">Gestão de Espaços</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Cadastre e configure os salões de festa, chácaras e buffets da sua empresa.</p>
        </div>
        <button
          id="btn-add-space"
          onClick={openAddModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-750 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/10 cursor-pointer hover:scale-101 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Espaço</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-24 text-gray-500">
          <Upload className="w-8 h-8 animate-bounce mx-auto mb-2 text-indigo-505" />
          Buscando espaços cadastrados...
        </div>
      ) : spaces.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-800 rounded-2xl py-20 text-center max-w-xl mx-auto">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h4 className="text-md font-bold text-gray-900 dark:text-zinc-100">Nenhum Espaço Encontrado</h4>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">Comece incluindo um salão ou chácara para que seus clientes possam agendar reservas.</p>
          <button
            onClick={openAddModal}
            className="mt-5 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
          >
            Adicionar Espaço
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {spaces.map((sp) => (
            <div 
              key={sp.id} 
              id={`space-card-${sp.id}`}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 rounded-xl overflow-hidden shadow-sm hover:shadow-lg dark:hover:shadow-slate-950/70 transition-all flex flex-col justify-between"
            >
              
              {/* Media banner */}
              <div className="h-48 bg-slate-100 dark:bg-slate-950 relative overflow-hidden group">
                <img 
                  src={sp.fotos?.[0] || "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800"} 
                  alt={sp.nome} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                
                {/* Active/Inactive state badge */}
                <div className="absolute top-3 left-3">
                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider ${
                    sp.status === 'Ativo' 
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                      : 'bg-rose-500 text-white'
                  }`}>
                    {sp.status}
                  </span>
                </div>
                
                {/* Price Label */}
                <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-md text-xs font-mono font-bold border border-white/10">
                  R$ {sp.valorLocacao.toLocaleString('pt-BR')}/dia
                </div>
              </div>

              {/* Body */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-md font-bold text-gray-900 dark:text-white truncate">{sp.nome}</h3>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1 font-mono">
                    Capacidade Máxima: {sp.capacidade} Convidados
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 line-clamp-3 leading-relaxed text-slate-600">
                    {sp.descricao}
                  </p>
                </div>

                {/* Operations */}
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-1">
                  <span className="text-[10px] text-gray-400 font-monoID uppercase leading-none truncate">ID: {sp.id}</span>
                  <div className="flex gap-2">
                    <button
                      id={`btn-edit-space-${sp.id}`}
                      onClick={() => openEditModal(sp)}
                      className="p-2 bg-gray-50 dark:bg-slate-800 rounded-lg text-gray-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-200 dark:border-slate-700 transition"
                      title="Editar espaço"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`btn-delete-space-${sp.id}`}
                      onClick={() => handleDelete(sp.id, sp.nome)}
                      className="p-2 bg-rose-500/5 hover:bg-rose-500/20 rounded-lg text-rose-500 hover:text-rose-600 border border-rose-500/10 transition"
                      title="Excluir espaço"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Registry Modal dialogue UI */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-md font-bold text-gray-900 dark:text-white">
                {editingSpace ? "Editar Espaço de Eventos" : "Cadastrar Novo Espaço"}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 hover:bg-gray-100 dark:hover:bg-slate-800 roundedLg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              
              {/* Field 1 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Nome Comercial do Espaço *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Salão Imperial, Mansão Tulipa"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Group */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Capacidade (Pessoas) *</label>
                  <input
                    type="number"
                    required
                    min="10"
                    max="10000"
                    value={capacidade}
                    onChange={(e) => setCapacidade(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Valor de Locação (R$/dia) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={valorLocacao}
                    onChange={(e) => setValorLocacao(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Status Select */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Status Operacional *</label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-zinc-200 focus:outline-none"
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>

              {/* Descricao */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Descrição & Infraestrutura Inclusa *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detone infraestrutura de buffet, acessibilidade, banheiros, vagas de estacionamento..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                ></textarea>
              </div>

              {/* Photos upload area */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1.5">Mídia e Fotos do Local</label>
                
                {/* Simulated file selector button */}
                <input 
                  type="file" 
                  id="space-file-input" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileUpload}
                />

                <div 
                  onClick={triggerUploadInput}
                  className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex flex-col justify-center items-center"
                >
                  <Upload className="w-6 h-6 text-indigo-500 mb-2 cursor-pointer" />
                  <span className="text-xs font-bold text-gray-800 dark:text-zinc-200">Clique para enviar uma foto comercial</span>
                  <span className="text-[10px] text-gray-400 mt-1">Formato PNG, JPG de até 5MB</span>
                </div>

                {uploadProgress && (
                  <p className="text-[11px] font-bold text-indigo-650 dark:text-indigo-400 mt-1">{uploadProgress}</p>
                )}

                {/* Grid of uploaded images */}
                {fotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3 p-2 bg-gray-50 dark:bg-slate-850 rounded-lg">
                    {fotos.map((src, index) => (
                      <div key={index} className="h-14 rounded-md overflow-hidden relative border border-gray-300">
                        <img src={src} alt="Uploaded" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFotos(prev => prev.filter((_, i) => i !== index))}
                          className="absolute -top-1 -right-1 bg-red-650 text-white rounded-full p-0.5 text-xs font-bold flex items-center justify-center w-4 h-4 shadow shadow-black hover:scale-110"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-gray-150 dark:border-slate-850 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Salvar Espaço
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
