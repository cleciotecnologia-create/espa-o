/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Cliente {
  id: string;
  nome: string;
  cpf: string;
  rg?: string;
  telefone: string;
  whatsapp?: string;
  email: string;
  endereco?: string;
  observacoes?: string;
  createdAt: string;
}

export interface Espaco {
  id: string;
  nome: string;
  capacidade: number;
  valorLocacao: number;
  taxaLimpeza?: number;
  taxaCancelamento?: number;
  porcentagemSinal?: number;
  descricao: string;
  fotos: string[]; // URLs or base64
  status: 'Ativo' | 'Inativo';
}

export type StatusReserva = 'Orçamento' | 'Aguardando sinal' | 'Confirmado' | 'Realizado' | 'Cancelado';

export interface Reserva {
  id: string;
  clienteId: string;
  espacoId: string;
  tipoEvento: string;
  dataEvento: string; // YYYY-MM-DD
  horario: string; // "14:00 - 22:00" etc
  qtdConvidados: number;
  valorTotal: number;
  valorSinal: number;
  status: StatusReserva;
  observacoes?: string;
  createdAt: string;
  taxaLimpeza?: number;
}

export interface Pagamento {
  id: string;
  reservaId: string;
  valor: number;
  formaPagamento: 'PIX' | 'Cartão' | 'Dinheiro' | 'Transferência';
  status: 'Pendente' | 'Confirmado' | 'Cancelado';
  dataPagamento?: string;
}

export interface Contrato {
  id: string;
  reservaId: string;
  pdfUrl?: string;
  conteudoCustomizado?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  usuario: string;
  acao: string;
  detalhes: string;
  timestamp: string;
}

export interface Notificacao {
  id: string;
  reservaId?: string;
  clienteId?: string;
  tipo: 'Email' | 'SMS';
  destinatario: string; // e.g. "carolina@outlook.com" or "+5511981124022"
  assunto?: string;
  mensagem: string;
  status: 'Enviado' | 'Falha' | 'Simulado';
  dataEnvio: string;
  gatilho: 'Confirmação' | 'Lembrete' | 'Pagamento' | 'Contrato' | 'Admin_Alerta';
}

export interface NotifConfigs {
  sendgridApiKey: string;
  sendgridVerifiedSender: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  enableEmail: boolean;
  enableSms: boolean;
  simulationMode: boolean; // defaults to true for smooth demo and fail-safes
  adminEmail: string;
  adminPhone: string;
  useCustomSmtp?: boolean;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  smtpSenderName?: string;
  smtpSenderEmail?: string;
}

export interface LessorConfigs {
  nomeFantasia: string;
  razaoSocial: string;
  cnpjCpf: string;
  inscricaoEstadual?: string;
  telefone: string;
  email: string;
  endereco: string;
  representanteNome: string;
  representanteCpf: string;
}

export interface SystemUser {
  id: string;
  nome: string;
  email: string;
  senhaSecreta: string;
  role: 'superadmin' | 'administrador' | 'operador' | 'desenvolvedor';
  createdAt: string;
}


