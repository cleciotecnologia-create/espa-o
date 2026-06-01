/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getEspacos, saveEspaco, deleteEspaco } from '../services/db';
import { Espaco } from '../types';
import { Plus, Edit, Trash, Image, Check, X, AlertTriangle, Eye, Upload, FileText, ChevronLeft, ChevronRight, Trash2, Camera } from 'lucide-react';

const isPdfFile = (src?: string) => {
  if (!src) return false;
  return src.startsWith('data:application/pdf') || src.toLowerCase().endsWith('.pdf') || src.includes('application/pdf');
};


export default function SpacesView() {
  const [spaces, setSpaces] = useState<Espaco[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSpace, setEditingSpace] = useState<Espaco | null>(null);

  const [brandLogo, setBrandLogo] = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('cfg_brand_logo') || '') : '');
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setBrandLogo(localStorage.getItem('cfg_brand_logo') || '');
    };
    window.addEventListener('brand-colors-updated', handleUpdate);
    return () => {
      window.removeEventListener('brand-colors-updated', handleUpdate);
    };
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setLogoUploading(true);

    const reader = new FileReader();
    reader.onloadend = () => {
      const resultString = reader.result as string;
      localStorage.setItem('cfg_brand_logo', resultString);
      setBrandLogo(resultString);
      window.dispatchEvent(new Event('brand-colors-updated'));
      setLogoUploading(false);
    };
    reader.onerror = () => {
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // Form Fields
  const [nome, setNome] = useState('');
  const [capacidade, setCapacidade] = useState(80);
  const [valorLocacao, setValorLocacao] = useState(3000);
  const [taxaLimpeza, setTaxaLimpeza] = useState(250);
  const [taxaCancelamento, setTaxaCancelamento] = useState(10);
  const [porcentagemSinal, setPorcentagemSinal] = useState(50);
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [fotos, setFotos] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [activePhotoIndices, setActivePhotoIndices] = useState<Record<string, number>>({});

  const handleAddPhotoCard = (sp: Espaco, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = async () => {
      const resultString = reader.result as string;
      const currentFotos = sp.fotos || [];
      const updatedFotos = [...currentFotos, resultString];
      const updatedSpace = { ...sp, fotos: updatedFotos };
      try {
        await saveEspaco(updatedSpace);
        setActivePhotoIndices(prev => ({ ...prev, [sp.id]: updatedFotos.length - 1 }));
        // Dispatch custom event to notify external listeners about database change
        window.dispatchEvent(new Event('brand-colors-updated'));
        loadSpaces();
      } catch (err) {
        console.error("Erro ao salvar foto no espaço:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhotoCard = async (sp: Espaco, indexToRemove: number) => {
    const currentFotos = sp.fotos || [];
    if (currentFotos.length === 0) return;
    
    if (confirm("Tem certeza que deseja remover esta foto de " + sp.nome + "?")) {
      const updatedFotos = currentFotos.filter((_, i) => i !== indexToRemove);
      const updatedSpace = { ...sp, fotos: updatedFotos };
      try {
        await saveEspaco(updatedSpace);
        setActivePhotoIndices(prev => {
          const currentActive = prev[sp.id] || 0;
          const newActive = currentActive >= updatedFotos.length ? Math.max(0, updatedFotos.length - 1) : currentActive;
          return { ...prev, [sp.id]: newActive };
        });
        window.dispatchEvent(new Event('brand-colors-updated'));
        loadSpaces();
      } catch (err) {
        console.error("Erro ao remover foto do espaço:", err);
      }
    }
  };

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
    setTaxaLimpeza(250);
    setTaxaCancelamento(10);
    setPorcentagemSinal(50);
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
    setTaxaLimpeza(sp.taxaLimpeza !== undefined ? sp.taxaLimpeza : 250);
    setTaxaCancelamento(sp.taxaCancelamento !== undefined ? sp.taxaCancelamento : 10);
    setPorcentagemSinal(sp.porcentagemSinal !== undefined ? sp.porcentagemSinal : 50);
    setDescricao(sp.descricao);
    setStatus(sp.status);
    setFotos(sp.fotos || []);
    setShowModal(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setUploadProgress(isPdf ? "Enviando arquivo PDF..." : "Enviando foto...");

    const reader = new FileReader();
    reader.onloadend = () => {
      const resultString = reader.result as string;
      setFotos(prev => [...prev, resultString]);
      setUploadProgress(isPdf ? "PDF carregado com sucesso!" : "Foto carregada com sucesso!");
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
      taxaLimpeza: Number(taxaLimpeza),
      taxaCancelamento: Number(taxaCancelamento),
      porcentagemSinal: Number(porcentagemSinal),
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

      {/* Brand Logo Integration Card */}
      <div className="bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-indigo-100 dark:border-slate-800/80 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center p-2 relative overflow-hidden group/logo shadow-sm shrink-0">
            {brandLogo ? (
              <img src={brandLogo} alt="Logomarca do Espaço" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <Image className="w-6 h-6 text-slate-400" />
            )}
            {brandLogo && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('cfg_brand_logo');
                  setBrandLogo('');
                  window.dispatchEvent(new Event('brand-colors-updated'));
                }}
                className="absolute inset-0 bg-red-600/95 text-white font-bold opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center text-[10px] uppercase cursor-pointer"
                title="Remover Logomarca"
              >
                Remover
              </button>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>Logomarca da Empresa / Espaço</span>
              <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500 text-white font-extrabold rounded-md uppercase">Atalho Ativo</span>
            </h3>
            <p className="text-xs text-slate-550 dark:text-zinc-400 mt-0.5 max-w-md leading-relaxed">
              Carregue a imagem da sua logo aqui. Ela será exibida no rodapé, cabeçalho administrativo e no Canal de Clientes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <input 
            type="file" 
            id="brand-logo-upload-space" 
            accept="image/*" 
            className="hidden" 
            onChange={handleLogoUpload}
          />
          <button
            type="button"
            onClick={() => document.getElementById('brand-logo-upload-space')?.click()}
            disabled={logoUploading}
            className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-705 text-white rounded-xl text-xs font-bold leading-none cursor-pointer transition shadow-sm"
          >
            {logoUploading ? "Salvando..." : "Enviar Logomarca"}
          </button>
          
          <button
            type="button"
            onClick={() => {
              alert("Dica de fotos do salão:\n\n1. Role esta página até o espaço desejado (ex: Espaço Tropical).\n2. Clique no botão de editar ('lápis') no canto inferior direito do card.\n3. Vá até a seção 'Mídia e Fotos do Local' no formulário.\n4. Arraste ou clique para enviar as fotos do salão!\n5. Elas serão salvas no cadastro do espaço.");
            }}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-bold leading-none cursor-pointer transition border border-gray-150 dark:border-slate-700"
          >
            Onde colocar fotos do salão?
          </button>
        </div>
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
                {(() => {
                  const spFotos = sp.fotos || [];
                  const totalFotos = spFotos.length;
                  const curIndex = activePhotoIndices[sp.id] !== undefined ? activePhotoIndices[sp.id] : 0;
                  const normalizedIndex = curIndex < totalFotos ? curIndex : 0;
                  const currentSrc = spFotos[normalizedIndex] || "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800";
                  const isPdf = isPdfFile(currentSrc);

                  return (
                    <div className="w-full h-full relative">
                      {isPdf ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 p-4 select-none">
                          <FileText className="w-12 h-12 mb-1" />
                          <span className="text-xs font-bold uppercase tracking-wider">Apresentação PDF ({normalizedIndex + 1}/{totalFotos || 1})</span>
                          <span className="text-[10px] text-gray-400 mt-1">Clique no olho para abrir</span>
                        </div>
                      ) : (
                        <img 
                          src={currentSrc} 
                          alt={`${sp.nome} - Foto ${normalizedIndex + 1}`} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      )}

                      {/* Photo actions overlay inside group hover */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex flex-col justify-between p-3 opacity-0 group-hover:opacity-100 z-10">
                        {/* Upper row: view and delete current photo */}
                        <div className="flex justify-between items-center w-full">
                          <button
                            type="button"
                            onClick={() => window.open(currentSrc, '_blank')}
                            className="p-1.5 bg-white/90 dark:bg-slate-900/90 hover:bg-white text-slate-800 dark:text-white rounded-lg shadow-sm transition hover:scale-110 cursor-pointer"
                            title="Visualizar mídia em tela cheia"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <div className="flex items-center gap-1.5">
                            {/* Option to ADD a photo directly */}
                            <label className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition hover:scale-110 cursor-pointer" title="Adicionar Foto diretamente">
                              <Camera className="w-3.5 h-3.5" />
                              <input 
                                type="file" 
                                accept="image/*,application/pdf" 
                                className="hidden" 
                                onChange={(e) => handleAddPhotoCard(sp, e)} 
                              />
                            </label>

                            {/* Option to REMOVE the active photo */}
                            {totalFotos > 0 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePhotoCard(sp, normalizedIndex)}
                                className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition hover:scale-110 cursor-pointer"
                                title="Remover esta foto / arquivo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Middle row: Carousel controls if > 1 page */}
                        {totalFotos > 1 ? (
                          <div className="flex justify-between items-center w-full px-1">
                            <button
                              type="button"
                              onClick={() => {
                                const prev = normalizedIndex === 0 ? totalFotos - 1 : normalizedIndex - 1;
                                setActivePhotoIndices(p => ({ ...p, [sp.id]: prev }));
                              }}
                              className="p-1 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-white rounded-full shadow hover:bg-white transition-all transform hover:scale-105 cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-[10px] text-white font-extrabold bg-slate-950/70 py-0.5 px-2 rounded-full font-mono">
                              {normalizedIndex + 1} / {totalFotos}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const next = normalizedIndex === totalFotos - 1 ? 0 : normalizedIndex + 1;
                                setActivePhotoIndices(p => ({ ...p, [sp.id]: next }));
                              }}
                              className="p-1 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-white rounded-full shadow hover:bg-white transition-all transform hover:scale-105 cursor-pointer"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <span className="text-[9px] text-white/70 bg-slate-950/50 py-0.5 px-1.5 rounded font-medium select-none font-sans">
                              {totalFotos} mídias • Passe o mouse para gerenciar
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                
                {/* Active/Inactive state badge */}
                <div className="absolute top-3 left-3 z-20 pointer-events-none">
                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider ${
                    sp.status === 'Ativo' 
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                      : 'bg-rose-500 text-white'
                  }`}>
                    {sp.status}
                  </span>
                </div>
                
                {/* Price Label */}
                <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm text-white px-2.5 py-1.5 rounded-md text-right border border-white/10 flex flex-col items-end pointer-events-none">
                  <span className="text-xs font-mono font-bold leading-none">R$ {sp.valorLocacao.toLocaleString('pt-BR')}/dia</span>
                  <span className="text-[10px] text-emerald-350 leading-none mt-1 font-mono">Limpeza: R$ {(sp.taxaLimpeza !== undefined ? sp.taxaLimpeza : 250).toLocaleString('pt-BR')}</span>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-md font-bold text-gray-900 dark:text-white truncate">{sp.nome}</h3>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1 font-mono flex flex-wrap justify-between gap-1">
                    <span>Capacidade: {sp.capacidade} Convds</span>
                    <span className="text-emerald-600 dark:text-emerald-450">Limpeza: R$ {(sp.taxaLimpeza !== undefined ? sp.taxaLimpeza : 250).toLocaleString('pt-BR')}</span>
                    <span className="text-rose-600 dark:text-rose-400">Multa Canc: {sp.taxaCancelamento !== undefined ? sp.taxaCancelamento : 10}%</span>
                    <span className="text-blue-600 dark:text-blue-400">Sinal Padrão: {sp.porcentagemSinal !== undefined ? sp.porcentagemSinal : 50}%</span>
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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Capacidade *</label>
                  <input
                    type="number"
                    required
                    min="10"
                    max="10000"
                    value={capacidade}
                    onChange={(e) => setCapacidade(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Locação *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={valorLocacao}
                    onChange={(e) => setValorLocacao(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Limpeza *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={taxaLimpeza}
                    onChange={(e) => setTaxaLimpeza(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Multa Canc. % *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={taxaCancelamento}
                    onChange={(e) => setTaxaCancelamento(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-700 dark:text-zinc-300 uppercase mb-1">Sinal Padrão % *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    value={porcentagemSinal}
                    onChange={(e) => setPorcentagemSinal(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  accept="image/*,application/pdf" 
                  className="hidden" 
                  onChange={handleFileUpload}
                />

                <div 
                  onClick={triggerUploadInput}
                  className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex flex-col justify-center items-center"
                >
                  <Upload className="w-6 h-6 text-indigo-500 mb-2 cursor-pointer" />
                  <span className="text-xs font-bold text-gray-800 dark:text-zinc-200">Clique para enviar foto ou PDF comercial</span>
                  <span className="text-[10px] text-gray-400 mt-1">Formato PNG, JPG ou PDF de até 10MB</span>
                </div>

                {uploadProgress && (
                  <p className="text-[11px] font-bold text-indigo-650 dark:text-indigo-400 mt-1">{uploadProgress}</p>
                )}

                {/* Grid of uploaded images */}
                {fotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3 p-2 bg-gray-50 dark:bg-slate-850 rounded-lg">
                    {fotos.map((src, index) => (
                      <div key={index} className="h-14 rounded-md overflow-hidden relative border border-gray-300 bg-white dark:bg-slate-900 flex items-center justify-center cursor-pointer group/thumb">
                        {isPdfFile(src) ? (
                          <div onClick={() => window.open(src, '_blank')} className="w-full h-full flex flex-col items-center justify-center text-rose-600 bg-rose-50 dark:bg-rose-950/20 px-1">
                            <FileText className="w-5 h-5 mb-0.5" />
                            <span className="text-[8px] font-bold uppercase truncate max-w-full">PDF Doc</span>
                          </div>
                        ) : (
                          <img onClick={() => window.open(src, '_blank')} src={src} alt="Uploaded" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFotos(prev => prev.filter((_, i) => i !== index));
                          }}
                          className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-0.5 text-[10px] font-bold flex items-center justify-center w-4 h-4 shadow shadow-black hover:scale-110 z-20 cursor-pointer text-center"
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
