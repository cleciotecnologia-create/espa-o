/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { 
  getReservas, 
  saveReserva, 
  savePagamento, 
  getClientes, 
  getEspacos, 
  saveContrato,
  addActivityLog 
} from './db';
import { 
  triggerPaymentNotification, 
  triggerContractNotification, 
  getLessorConfigs 
} from './notifications';
import { Reserva, Cliente, Espaco, Pagamento, Contrato, StatusReserva } from '../types';

// Supported payment gateways in EventSpace Webhook Handler
export type PaymentGatewayType = 'Asaas' | 'MercadoPago' | 'Stripe' | 'Efi_Gerencianet';

// Detailed shape matching standard real-world incoming webhook payloads
export interface WebhookPayload {
  eventId: string;
  gateway: PaymentGatewayType;
  eventType: 'payment.confirmed' | 'payment.overdue' | 'payment.refunded' | 'payment.failed';
  transactionId: string;
  bookingId: string; // The primary reference linking payment to Reserva
  amountPaid: number;
  paymentMethod: 'PIX' | 'Cartão' | 'Transferência' | 'Dinheiro';
  rawPayload?: any; // Original webhook request body from third party
}

export interface WebhookHandlerResult {
  success: boolean;
  message: string;
  statusCode: number;
  details?: {
    bookingId: string;
    previousStatus: StatusReserva;
    newStatus: StatusReserva;
    paymentId: string;
    contractGenerated?: boolean;
    contractId?: string;
  };
}

/**
 * Core Webhook Handler Class
 * This parses, validates and transitions booking schedules, creates financial movements,
 * and launches corresponding contracts & customer notifications.
 */
export class WebhookHandler {
  
  /**
   * Main entrypoint for receiving payloads from Make, n8n, or direct HTTP API proxies.
   */
  static async handleIncomingWebhook(payload: WebhookPayload): Promise<WebhookHandlerResult> {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    console.log(`[Webhook ${timestamp}] Processing webhook event ${payload.eventId} from ${payload.gateway}`);

    try {
      // 1. Mandatory Parameters Sanity Check
      if (!payload.bookingId) {
        await addActivityLog(
          "Falha Webhook Gateway", 
          `Recebido webhook ${payload.eventId} sem ID de reserva de referência.`
        );
        return {
          success: false,
          message: "ID da reserva (bookingId) não fornecido na referência do webhook.",
          statusCode: 400
        };
      }

      // 2. Fetch all reservations and search for the target ID
      const bookings = await getReservas();
      const targetBooking = bookings.find(b => b.id === payload.bookingId);

      if (!targetBooking) {
        await addActivityLog(
          "Falha Webhook Gateway", 
          `Recebido webhook para reserva inexistente no ERP: ID ${payload.bookingId}`
        );
        return {
          success: false,
          message: `Reserva correspondente ao ID ${payload.bookingId} não foi localizada no banco de dados.`,
          statusCode: 404
        };
      }

      const prevStatus = targetBooking.status;

      // 3. Process according to webhook event types
      switch (payload.eventType) {
        case 'payment.confirmed':
          return await this.handleConfirmedPayment(payload, targetBooking);
          
        case 'payment.overdue':
        case 'payment.failed':
          return await this.handleOverdueOrFailedPayment(payload, targetBooking);
          
        case 'payment.refunded':
          return await this.handleRefundedPayment(payload, targetBooking);

        default:
          return {
            success: false,
            message: `Tipo de evento de webhook '${payload.eventType}' desconsiderado ou não mapeado pelo handler.`,
            statusCode: 422
          };
      }

    } catch (error: any) {
      console.error("[Webhook Handler Critical Error]", error);
      await addActivityLog(
        "Erro Webhook Reconciliação", 
        `Erro fatal ao reconciliar recebimento: ${error?.message || error}`
      );
      return {
        success: false,
        message: `Falha interna no processador de webhook: ${error?.message || "Erro desconhecido"}.`,
        statusCode: 500
      };
    }
  }

  /**
   * SUCCESS COMPENSATED: Changes status to 'Confirmado', records the Payment entry, 
   * sends receipts and compiles the digital contract with automatic forfeiture/retention clauses.
   */
  private static async handleConfirmedPayment(
    payload: WebhookPayload, 
    reserva: Reserva
  ): Promise<WebhookHandlerResult> {
    
    // Prevent double confirmation logic
    if (reserva.status === 'Confirmado' || reserva.status === 'Realizado') {
      return {
        success: true,
        message: `A reserva ID ${reserva.id} já estava ativa ou realizada anteriormente. Nenhuma ação necessária.`,
        statusCode: 200,
        details: {
          bookingId: reserva.id,
          previousStatus: reserva.status,
          newStatus: reserva.status,
          paymentId: `dup_${payload.transactionId}`
        }
      };
    }

    // A. Create the payment entry in the ERP
    const payId = payload.transactionId || "pay_auto_" + Date.now();
    const newPayment: Pagamento = {
      id: payId,
      reservaId: reserva.id,
      valor: payload.amountPaid,
      formaPagamento: payload.paymentMethod,
      status: 'Confirmado',
      dataPagamento: new Date().toISOString()
    };
    await savePagamento(newPayment);

    // B. Save target reservation with 'Confirmado' status and logging updates
    const updatedReserva: Reserva = {
      ...reserva,
      status: 'Confirmado',
      observacoes: `${reserva.observacoes || ''}\n[AUTO WEBHOOK - ${payload.gateway}] Sinal de 50% confirmado sob ID Transação ${payId}.`
    };
    await saveReserva(updatedReserva);

    // C. Recover associated Client & Space details to forward correct communication payloads
    const clients = await getClientes();
    const spaces = await getEspacos();
    const currentClient = clients.find(c => c.id === reserva.clienteId);
    const currentSpace = spaces.find(s => s.id === reserva.espacoId);

    // D. Auto trigger client receipt alerts
    if (currentClient) {
      try {
        await triggerPaymentNotification(updatedReserva, currentClient, newPayment, true);
      } catch (err) {
        console.error("Falha ao enviar notificação de webhook de pagamento do cliente:", err);
      }
    }

    // E. AUTO GENERATE CONTRACT: Compile draft with 50% reservation retention on cancellation terms
    let contractGenerated = false;
    let contractId = '';
    
    if (currentClient && currentSpace) {
      const lessor = getLessorConfigs();
      contractId = "cnt_auto_wh_" + Date.now();
      
      const contractBody = `CONTRATO DIGITAL DE GESTÃO E USO DE INFRAESTRUTURA LOCATÍCIA

I. DAS PARTES CONTRATANTES
LOCADOR: ${lessor.razaoSocial} (Nome Fantasia: ${lessor.nomeFantasia}), CNPJ/CPF: ${lessor.cnpjCpf}, endereço sede: ${lessor.endereco}.
LOCATÁRIO: ${currentClient.nome}, CPF: ${currentClient.cpf || '***.***.***-**'}, e-mail: ${currentClient.email}, telefone: ${currentClient.telefone}.

II. DO ESPAÇO E EVENTO
Fica reservada a locação cênica do espaço ${currentSpace.nome} para a realização de ${reserva.tipoEvento} em pauta oficial no dia ${new Date(reserva.dataEvento).toLocaleDateString('pt-BR')}, período ${reserva.horario}.

III. DO APERFEIÇOAMENTO FINANCEIRO
O valor total do provimento é de R$ ${reserva.valorTotal.toLocaleString('pt-BR')}, tendo sido o sinal correspondente a 50% (R$ ${payload.amountPaid.toLocaleString('pt-BR')}) faturado e conciliado via webhook integrado com o gateway de custódia ${payload.gateway}.

IV. DA CLÁUSULA COMPROMISSÓRIA DE DESISTÊNCIA E RETENÇÃO DE SINAL (ARRAS)
Em conformidade com o artigo 418 do Código Civil Brasileiro, fica estipulado que em caso de cancelamento unilateral ou desistência voluntária por parte do LOCATÁRIO em qualquer data que anteceda o evento, o valor adiantado a título de sinal (50% correspondente a R$ ${payload.amountPaid.toLocaleString('pt-BR')}) SERÁ RETIDO INTEGRALMENTE pelo LOCADOR como reparação compensatória por obstrução de pauta de locação comercial pública, não cabendo qualquer direito de reiteração de resgate, crédito ou indenização posterior.

Paraty/São Paulo, ${new Date().toLocaleDateString('pt-BR')}.

Assinado digitalmente via ERP Automação Hub.`;

      const newContract: Contrato = {
        id: contractId,
        reservaId: reserva.id,
        conteudoCustomizado: contractBody,
        createdAt: new Date().toISOString()
      };

      try {
        await saveContrato(newContract);
        contractGenerated = true;
        // Dispatch signed draft notification automatically 
        await triggerContractNotification(updatedReserva, currentClient, newContract);
      } catch (err) {
        console.error("Falha ao criar minuta automatizada pós webhook:", err);
      }
    }

    // F. Audit logs write
    await addActivityLog(
      "Reconciliação Sucedida", 
      `Webhook (${payload.gateway}): Reserva ID ${reserva.id} confirmada automaticamente. Sinal de R$ ${payload.amountPaid.toLocaleString('pt-BR')} creditado no caixa.`
    );

    return {
      success: true,
      message: `Reconciliação efetuada com sucesso! Sinal de 50% computado via ${payload.gateway}. Reserva ativa na pauta.`,
      statusCode: 250,
      details: {
        bookingId: reserva.id,
        previousStatus: 'Aguardando sinal',
        newStatus: 'Confirmado',
        paymentId: payId,
        contractGenerated,
        contractId
      }
    };
  }

  /**
   * EXPIRED OR FAILED TRANSACTION: Changes status to 'Cancelado' and registers a 'Cancelado' fiscal entry, 
   * liberating the agenda calendar automatically for other prospective leads.
   */
  private static async handleOverdueOrFailedPayment(
    payload: WebhookPayload, 
    reserva: Reserva
  ): Promise<WebhookHandlerResult> {

    // Overwrite status to 'Cancelado'
    const updatedBooking: Reserva = {
      ...reserva,
      status: 'Cancelado',
      observacoes: `${reserva.observacoes || ''}\n[AUTO WEBHOOK - ${payload.gateway}] Webhook reportou transação expirada/cancelada. Pauta liberada.`
    };
    await saveReserva(updatedBooking);

    // Cancel dynamic pending payments for this booking
    const payId = payload.transactionId || "pay_fail_" + Date.now();
    const paymentCancel: Pagamento = {
      id: payId,
      reservaId: reserva.id,
      valor: payload.amountPaid || reserva.valorSinal,
      formaPagamento: payload.paymentMethod,
      status: 'Cancelado',
      dataPagamento: new Date().toISOString()
    };
    await savePagamento(paymentCancel);

    await addActivityLog(
      "Autocancelamento por Decurso", 
      `Agenda da data ${reserva.dataEvento} liberada. Webhook do gateway ${payload.gateway} acusou expiração de pagamento do sinal.`
    );

    return {
      success: true,
      message: `Status da reserva ID ${reserva.id} modificado para 'Cancelado' por inconsistência ou vencimento de faturamento.`,
      statusCode: 200,
      details: {
        bookingId: reserva.id,
        previousStatus: reserva.status,
        newStatus: 'Cancelado',
        paymentId: payId
      }
    };
  }

  /**
   * REFUNDED: Transition booking status back to 'Cancelado' and log refunds in systemic entries.
   */
  private static async handleRefundedPayment(
    payload: WebhookPayload, 
    reserva: Reserva
  ): Promise<WebhookHandlerResult> {

    const updatedBooking: Reserva = {
      ...reserva,
      status: 'Cancelado',
      observacoes: `${reserva.observacoes || ''}\n[AUTO WEBHOOK - ESTORNO] Devolução de R$ ${payload.amountPaid} reportada pelo gateway.`
    };
    await saveReserva(updatedBooking);

    const refundId = "ref_" + Date.now();
    await savePagamento({
      id: refundId,
      reservaId: reserva.id,
      valor: -payload.amountPaid, // Negative mapping representing cash exit
      formaPagamento: payload.paymentMethod,
      status: 'Confirmado',
      dataPagamento: new Date().toISOString()
    });

    await addActivityLog(
      "Reembolso Registrado", 
      `Sinal da reserva ID ${reserva.id} estornado através do painel de custódia do ${payload.gateway}.`
    );

    return {
      success: true,
      message: `Estorno conciliado e reserva arquivada como cancelada com sucesso.`,
      statusCode: 200,
      details: {
        bookingId: reserva.id,
        previousStatus: reserva.status,
        newStatus: 'Cancelado',
        paymentId: refundId
      }
    };
  }

  /**
   * Returns copyable blueprint templates structure for Make router or n8n HTTP Request modules.
   */
  static getWebhookBlueprints() {
    return {
      n8n: {
        name: "EventSpace ERP - Reconciliador de Sinal",
        triggerType: "Webhook Node",
        recommendedMethod: "POST",
        payloadBlueprint: {
          eventId: "evt_n8n_{{ $now }}",
          gateway: "Asaas",
          eventType: "payment.confirmed",
          transactionId: "pay_asaas_84920194",
          bookingId: "inserir_id_reserva_aqui",
          amountPaid: 1500.00,
          paymentMethod: "PIX"
        }
      },
      make: {
        name: "Make.com (Integromat) - Webhook Customizado ERP",
        recommendedMethod: "POST",
        jsonPayload: `{
  "eventId": "evt_make_{{timestamp}}",
  "gateway": "MercadoPago",
  "eventType": "payment.confirmed",
  "transactionId": "{{payment_id}}",
  "bookingId": "{{external_reference}}",
  "amountPaid": {{amount}},
  "paymentMethod": "PIX"
}`
      }
    };
  }
}
