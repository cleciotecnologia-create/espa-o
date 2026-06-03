/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where,
  onSnapshot
} from 'firebase/firestore';
import { db, isLocalMode, handleFirestoreError, OperationType } from './firebase';
import { Cliente, Espaco, Reserva, Pagamento, Contrato, ActivityLog, SystemUser } from '../types';

// Let's seed initial mock data for gorgeous dashboard charts, scheduling calendars, spaces and clients on first load details
const INITIAL_SPACES: Espaco[] = [
  {
    id: "espaco_1",
    nome: "Espaço Tropical",
    capacidade: 80,
    valorLocacao: 450,
    taxaLimpeza: 50,
    taxaCancelamento: 10,
    porcentagemSinal: 50,
    descricao: "Espaço Tropical - Lazer e Eventos\nMomentos inesquecíveis com família e amigos! 🌴\n\nDIÁRIAS DE LAZER (Ideal para churrascos, aniversários e reuniões):\n• Segunda a Sexta-feira: R$ 400,00\n• Sábados, Domingos e Feriados: R$ 450,00\n• Taxa de Limpeza (Obrigatória): R$ 50,00\n• Horário Regular: 08:00 às 18:00 (Eventos noturnos a combinar)\n\nPACOTE ESPECIAL (Casamentos e Debutantes):\n• Valor Promocional: R$ 800,00 (+ taxa de limpeza)\n• Logística Inclusa:\n  - 1º Dia: Disponibilidade para ornamentação e montagem (durante o dia)\n  - 1ª Noite (Evento): Realização da festa no horário combinado\n  - 2º Dia: Prazo para retirada da decoração e desmontagem\n\nESTRUTURA E FACILIDADES:\n• Piscinas: Adulto e Infantil\n• Acomodação: 1 suíte climatizada (Ar-condicionado)\n• Mobiliário: 35 cadeiras e 8 mesas\n• Área Gourmet: Churrasqueira, Freezer e Cooktop (4 bocas - não fornecemos o botijão de gás)\n• Tecnologia: Wi-Fi, Alexa, TV e Caixa de Som profissional\n• Sanitários: 3 femininos e 2 masculinos\n\nInstagram: @espaco.tropical1 | WhatsApp: (75) 99154-4045",
    fotos: ["https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&q=80&w=800"],
    status: 'Ativo'
  }
];

const INITIAL_CLIENTS: Cliente[] = [
  {
    id: "cli_1",
    nome: "Ana Carolina Albuquerque",
    cpf: "182.493.810-44",
    rg: "32.493.102-X",
    telefone: "(11) 98112-4022",
    whatsapp: "(11) 98112-4022",
    email: "carolina.albuquerque@gestaoeventos.com",
    endereco: "Av. Paulista, 1200 - Bela Vista, São Paulo - SP",
    observacoes: "Noiva exigente. Solicita atendimento especializado para buffet vegetariano.",
    createdAt: new Date().toISOString()
  },
  {
    id: "cli_2",
    nome: "Rodrigo Mendes Vieira (Tech Solutions)",
    cpf: "349.821.492-55",
    rg: "29.381.192-3",
    telefone: "(11) 99321-0012",
    whatsapp: "(11) 99321-0012",
    email: "mendes.techsolutions@corporation.com",
    endereco: "Rua Funchal, 450 - Vila Olímpia, São Paulo - SP",
    observacoes: "Diretor administrativo da Tech Solutions. Pagamentos corporativos pós-faturados ou via PIX rápido.",
    createdAt: new Date().toISOString()
  },
  {
    id: "cli_3",
    nome: "Juliana Castro Menezes",
    cpf: "219.832.012-88",
    rg: "12.839.290-7",
    telefone: "(21) 97722-1920",
    whatsapp: "(21) 97722-1920",
    email: "juliana_menezes@outlook.com",
    endereco: "Rua Copacabana, 301 - Rio de Janeiro - RJ",
    observacoes: "Mãe da debutante Isabella Castro. Evento de 15 anos com banda ao vivo integrada e decoração em tons rosé.",
    createdAt: new Date().toISOString()
  }
];

// Generates correct iso dates around the current month dynamic
const getRelativeDateISO = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const INITIAL_BOOKINGS: Reserva[] = [
  {
    id: "res_1",
    clienteId: "cli_1",
    espacoId: "espaco_1",
    tipoEvento: "Casamento",
    dataEvento: getRelativeDateISO(15), // 15 days in future
    horario: "08:00 - 18:00",
    qtdConvidados: 60,
    valorTotal: 850, // 800 rent + 50 cleaning fee
    valorSinal: 425,
    status: 'Confirmado',
    observacoes: "Sinal do casamento quitado. Decoração clássica e floral.",
    createdAt: new Date().toISOString(),
    taxaLimpeza: 50
  },
  {
    id: "res_2",
    clienteId: "cli_2",
    espacoId: "espaco_1",
    tipoEvento: "Confraternização",
    dataEvento: getRelativeDateISO(5), // 5 days in future
    horario: "12:00 - 20:00",
    qtdConvidados: 45,
    valorTotal: 500, // 450 weekend + 50 cleaning fee
    valorSinal: 250,
    status: 'Aguardando sinal',
    observacoes: "Necessita de gerador extra para telão de LED externo.",
    createdAt: new Date().toISOString(),
    taxaLimpeza: 50
  },
  {
    id: "res_3",
    clienteId: "cli_3",
    espacoId: "espaco_1",
    tipoEvento: "Aniversário 15 anos",
    dataEvento: getRelativeDateISO(-5), // 5 days in past
    horario: "18:00 - 01:00",
    qtdConvidados: 70,
    valorTotal: 850, // 800 special package + 50
    valorSinal: 400,
    status: 'Realizado',
    observacoes: "A debutante amou a iluminação ambiente. Evento finalizado com sucesso.",
    createdAt: new Date().toISOString(),
    taxaLimpeza: 50
  },
  {
    id: "res_4",
    clienteId: "cli_1",
    espacoId: "espaco_1",
    tipoEvento: "Boda de Prata",
    dataEvento: getRelativeDateISO(30), // 30 days in future
    horario: "08:00 - 18:00",
    qtdConvidados: 50,
    valorTotal: 850, // 800 package + 50
    valorSinal: 400,
    status: 'Orçamento',
    observacoes: "Pre-reserva agendada por telefone.",
    createdAt: new Date().toISOString(),
    taxaLimpeza: 50
  }
];

const INITIAL_PAYMENTS: Pagamento[] = [
  {
    id: "pay_1",
    reservaId: "res_1",
    valor: 425,
    formaPagamento: "PIX",
    status: "Confirmado",
    dataPagamento: getRelativeDateISO(-10)
  },
  {
    id: "pay_2",
    reservaId: "res_1",
    valor: 425,
    formaPagamento: "PIX",
    status: "Pendente"
  },
  {
    id: "pay_3",
    reservaId: "res_2",
    valor: 250,
    formaPagamento: "Transferência",
    status: "Pendente"
  },
  {
    id: "pay_4",
    reservaId: "res_3",
    valor: 400,
    formaPagamento: "Dinheiro",
    status: "Confirmado",
    dataPagamento: getRelativeDateISO(-15)
  },
  {
    id: "pay_5",
    reservaId: "res_3",
    valor: 450,
    formaPagamento: "Cartão",
    status: "Confirmado",
    dataPagamento: getRelativeDateISO(-5)
  },
  // Contas a pagar extras (mock)
  {
    id: "pay_out_1",
    reservaId: "despesa_manutencao",
    valor: 450,
    formaPagamento: "PIX",
    status: "Confirmado",
    dataPagamento: getRelativeDateISO(-8)
  },
  {
    id: "pay_out_2",
    reservaId: "despesa_energia",
    valor: 850,
    formaPagamento: "Transferência",
    status: "Confirmado",
    dataPagamento: getRelativeDateISO(-3)
  },
  {
    id: "pay_out_3",
    reservaId: "despesa_seguranca",
    valor: 600,
    formaPagamento: "PIX",
    status: "Pendente"
  }
];

const INITIAL_CONTRACTS: Contrato[] = [
  {
    id: "cnt_1",
    reservaId: "res_1",
    conteudoCustomizado: "CONTRATO DE LOCAÇÃO DE ESPAÇO PARA EVENTOS\n\nLOCADOR: EventSpace ERP Ltda\nLOCATÁRIO: Ana Carolina Albuquerque\n\nOBJETO: Locação do Salão Realeza Classical no dia 2026-06-15 das 08:00 às 18:00 para realização de Casamento. O uso do espaço fora do horário estipulado contratualmente poderá estar sujeito a cobrança de taxas extras por hora excedente.\n\nVALOR: R$ 4.800,00, com sinal de R$ 1.500,00 já liquidado.\n\nCláusulas gerais aplicadas.",
    createdAt: getRelativeDateISO(-10)
  },
  {
    id: "cnt_3",
    reservaId: "res_3",
    conteudoCustomizado: "CONTRATO DE LOCAÇÃO DE ESPAÇO PARA EVENTOS\n\nLOCADOR: EventSpace ERP Ltda\nLOCATÁRIO: Juliana Castro Menezes\n\nOBJETO: Locação do Industrial Studio Loft no dia 2026-05-25 para Aniversário 15 anos.\n\nVALOR: R$ 2.900,00 quitados integralmente.\n\nFinalizado.",
    createdAt: getRelativeDateISO(-15)
  }
];

const INITIAL_LOGS: ActivityLog[] = [
  {
    id: "log_1",
    usuario: "Clécio Santos (Admin)",
    acao: "Acesso ao Sistema",
    detalhes: "Dashboard empresarial consultada com sucesso",
    timestamp: new Date().toISOString()
  },
  {
    id: "log_2",
    usuario: "Clécio Santos (Admin)",
    acao: "Login Sucedido",
    detalhes: "Sessão iniciada usando autenticação master",
    timestamp: new Date().toISOString()
  }
];

const INITIAL_SYSTEM_USERS: SystemUser[] = [
  {
    id: "usr_dev_master",
    nome: "Clécio Ferreira (Dev)",
    email: "clecioferreiracorretor@gmail.com",
    senhaSecreta: "123456",
    role: "desenvolvedor",
    nivelAcesso: "Admin",
    createdAt: new Date().toISOString()
  }
];

// Helper to initialize local data structure in storage
function initLocalDB() {
  const needsMigration = !localStorage.getItem('es_spaces') || 
                         localStorage.getItem('es_spaces')?.includes('"capacidade":350') || 
                         localStorage.getItem('es_spaces')?.includes('"valorLocacao":4800') ||
                         !localStorage.getItem('es_spaces')?.includes('450');

  if (needsMigration) {
    localStorage.setItem('es_spaces', JSON.stringify(INITIAL_SPACES));
  } else {
    try {
      const stored = localStorage.getItem('es_spaces');
      if (stored) {
        const parsed = JSON.parse(stored);
        let modified = false;
        parsed.forEach((x: any) => {
          if (x.taxaLimpeza === undefined) {
            x.taxaLimpeza = 50;
            modified = true;
          }
        });
        if (modified) {
          localStorage.setItem('es_spaces', JSON.stringify(parsed));
        }
      }
    } catch (_) {}
  }

  if (!localStorage.getItem('es_clients')) {
    localStorage.setItem('es_clients', JSON.stringify(INITIAL_CLIENTS));
  }
  const needsBookingReset = !localStorage.getItem('es_bookings') || 
                            localStorage.getItem('es_bookings')?.includes('"valorTotal":5050') ||
                            localStorage.getItem('es_bookings')?.includes('espaco_2') ||
                            !localStorage.getItem('es_bookings')?.includes('"taxaLimpeza":50');

  if (needsBookingReset) {
    localStorage.setItem('es_bookings', JSON.stringify(INITIAL_BOOKINGS));
    localStorage.setItem('es_payments', JSON.stringify(INITIAL_PAYMENTS));
  } else {
    try {
      const stored = localStorage.getItem('es_bookings');
      if (stored) {
        const parsed = JSON.parse(stored);
        let modified = false;
        parsed.forEach((x: any) => {
          if (x.taxaLimpeza === undefined) {
            x.taxaLimpeza = 50;
            modified = true;
          }
        });
        if (modified) {
          localStorage.setItem('es_bookings', JSON.stringify(parsed));
        }
      }
    } catch (_) {}
  }
  if (!localStorage.getItem('es_payments') || needsBookingReset) {
    localStorage.setItem('es_payments', JSON.stringify(INITIAL_PAYMENTS));
  }
  if (!localStorage.getItem('es_contracts')) {
    localStorage.setItem('es_contracts', JSON.stringify(INITIAL_CONTRACTS));
  }
  if (!localStorage.getItem('es_logs')) {
    localStorage.setItem('es_logs', JSON.stringify(INITIAL_LOGS));
  }
  const currentUsers = localStorage.getItem('es_system_users');
  const needsUsersMigration = !currentUsers || 
                             currentUsers.includes('admin@eventspace.com.br') || 
                             currentUsers.includes('cleciopav@hotmail.com') ||
                             !currentUsers.includes('nivelAcesso');
  if (needsUsersMigration) {
    localStorage.setItem('es_system_users', JSON.stringify(INITIAL_SYSTEM_USERS));
  }
}

// Call initially
if (typeof window !== 'undefined') {
  initLocalDB();

  // Initialize real-time sync with Firestore database if active
  if (!isLocalMode && db) {
    try {
      // Assistive remote database seeder in Firestore
      const seedFirestoreIfEmpty = async () => {
        try {
          const usersSnap = await getDocs(collection(db, 'system_users'));
          if (usersSnap.empty) {
            console.log("Seeding system_users in Firestore...");
            for (const u of INITIAL_SYSTEM_USERS) {
              await setDoc(doc(db, 'system_users', u.id), u);
            }
          } else {
            // Verify if the user clecioferreiracorretor@gmail.com is explicitly in Firestore system_users
            const checkQuery = query(collection(db, 'system_users'), where('email', '==', 'clecioferreiracorretor@gmail.com'));
            const checkSnap = await getDocs(checkQuery);
            if (checkSnap.empty) {
              console.log("Force inserting master operator: clecioferreiracorretor@gmail.com");
              const clecioUser = INITIAL_SYSTEM_USERS.find(e => e.email === 'clecioferreiracorretor@gmail.com');
              if (clecioUser) {
                await setDoc(doc(db, 'system_users', clecioUser.id), clecioUser);
              }
            }
            
            // Clean up other users in the Firestore "system_users" collection to make sure we "apagar todos os usuarios" other than clecioferreiracorretor@gmail.com
            for (const docSnap of usersSnap.docs) {
              const data = docSnap.data();
              if (data.email && data.email.toLowerCase() !== 'clecioferreiracorretor@gmail.com') {
                console.log(`De-seeding non-dev user from Firestore: ${data.email}`);
                await deleteDoc(doc(db, 'system_users', docSnap.id));
              }
            }
          }

          const spacesSnap = await getDocs(collection(db, 'espacos'));
          if (spacesSnap.empty) {
            console.log("Seeding espacos in Firestore...");
            for (const s of INITIAL_SPACES) {
              await setDoc(doc(db, 'espacos', s.id), s);
            }
          }

          const clientsSnap = await getDocs(collection(db, 'clientes'));
          if (clientsSnap.empty) {
            console.log("Seeding clientes in Firestore...");
            for (const c of INITIAL_CLIENTS) {
              await setDoc(doc(db, 'clientes', c.id), c);
            }
          }

          const bookingsSnap = await getDocs(collection(db, 'reservas'));
          if (bookingsSnap.empty) {
            console.log("Seeding reservas in Firestore...");
            for (const b of INITIAL_BOOKINGS) {
              await setDoc(doc(db, 'reservas', b.id), b);
            }
          }

          const paymentsSnap = await getDocs(collection(db, 'pagamentos'));
          if (paymentsSnap.empty) {
            console.log("Seeding pagamentos in Firestore...");
            for (const p of INITIAL_PAYMENTS) {
              await setDoc(doc(db, 'pagamentos', p.id), p);
            }
          }

          const contractsSnap = await getDocs(collection(db, 'contratos'));
          if (contractsSnap.empty) {
            console.log("Seeding contratos in Firestore...");
            for (const co of INITIAL_CONTRACTS) {
              await setDoc(doc(db, 'contratos', co.id), co);
            }
          }

          const logsSnap = await getDocs(collection(db, 'logs'));
          if (logsSnap.empty) {
            console.log("Seeding logs in Firestore...");
            for (const l of INITIAL_LOGS) {
              await setDoc(doc(db, 'logs', l.id), l);
            }
          }
        } catch (e) {
          console.warn("Auto-seeding Firestore was offline or bypassed by permissions:", e);
        }
      };
      seedFirestoreIfEmpty();

      // 1. Listen to 'espacos'
      onSnapshot(collection(db, 'espacos'), (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem('es_spaces', JSON.stringify(items));
        window.dispatchEvent(new Event('es-database-updated'));
      }, (err) => {
        console.warn("Real-time sync error on 'espacos':", err);
      });

      // 2. Listen to 'clientes'
      onSnapshot(collection(db, 'clientes'), (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem('es_clients', JSON.stringify(items));
        window.dispatchEvent(new Event('es-database-updated'));
      }, (err) => {
        console.warn("Real-time sync error on 'clientes':", err);
      });

      // 3. Listen to 'reservas'
      onSnapshot(collection(db, 'reservas'), (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem('es_bookings', JSON.stringify(items));
        window.dispatchEvent(new Event('es-database-updated'));
      }, (err) => {
        console.warn("Real-time sync error on 'reservas':", err);
      });

      // 4. Listen to 'pagamentos'
      onSnapshot(collection(db, 'pagamentos'), (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem('es_payments', JSON.stringify(items));
        window.dispatchEvent(new Event('es-database-updated'));
      }, (err) => {
        console.warn("Real-time sync error on 'pagamentos':", err);
      });

      // 5. Listen to 'contratos'
      onSnapshot(collection(db, 'contratos'), (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem('es_contracts', JSON.stringify(items));
        window.dispatchEvent(new Event('es-database-updated'));
      }, (err) => {
        console.warn("Real-time sync error on 'contratos':", err);
      });

      // 6. Listen to 'logs'
      onSnapshot(collection(db, 'logs'), (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
        localStorage.setItem('es_logs', JSON.stringify(items));
        window.dispatchEvent(new Event('es-database-updated'));
      }, (err) => {
        console.warn("Real-time sync error on 'logs':", err);
      });

      // 7. Listen to 'system_users'
      onSnapshot(collection(db, 'system_users'), (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem('es_system_users', JSON.stringify(items));
        window.dispatchEvent(new Event('es-database-updated'));
      }, (err) => {
        console.warn("Real-time sync error on 'system_users':", err);
      });
    } catch (error) {
      console.error("Failed to start Firestore real-time onSnapshot listeners:", error);
    }
  }
}

// Helper to interact with Local DB
const getLocalData = <T>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem(key) || '[]');
};

const setLocalData = <T>(key: string, data: T[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(data));
  }
};

/* =========================================
   GENERIC LOG WRITER HELPERS
   ========================================= */
export async function addActivityLog(acao: string, detalhes: string) {
  const usuario = "Clécio Santos (Admin)";
  const log: ActivityLog = {
    id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000000),
    usuario,
    acao,
    detalhes,
    timestamp: new Date().toISOString()
  };

  if (!isLocalMode && db) {
    try {
      await setDoc(doc(collection(db, 'logs'), log.id), log);
    } catch (e) {
      // Rollback to local log and print warning
      console.warn("Failed to write live Firestore log, saving locally:", e);
      const logs = getLocalData<ActivityLog>('es_logs');
      logs.unshift(log);
      setLocalData('es_logs', logs.slice(0, 300));
    }
  } else {
    const logs = getLocalData<ActivityLog>('es_logs');
    logs.unshift(log);
    setLocalData('es_logs', logs.slice(0, 300)); // limit logs size to 300
  }
}

/* =========================================
   ESPACÓS (Spaces) MANAGEMENT
   ========================================= */
export async function getEspacos(): Promise<Espaco[]> {
  const path = 'espacos';
  if (!isLocalMode && db) {
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Espaco));
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
  }
  return getLocalData<Espaco>('es_spaces');
}

export async function saveEspaco(espaco: Omit<Espaco, 'id'> & { id?: string }): Promise<string> {
  const path = 'espacos';
  const id = espaco.id || "espaco_" + Date.now();
  const fullEspaco: Espaco = { ...espaco, id } as Espaco;

  if (!isLocalMode && db) {
    try {
      await setDoc(doc(db, path, id), fullEspaco);
      await addActivityLog("Salvar Espaço", `Espaço '${espaco.nome}' salvo com sucesso.`);
      return id;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${path}/${id}`);
    }
  }

  // Local state operations
  const items = getLocalData<Espaco>('es_spaces');
  const index = items.findIndex(i => i.id === id);
  if (index >= 0) {
    items[index] = fullEspaco;
  } else {
    items.push(fullEspaco);
  }
  setLocalData('es_spaces', items);
  await addActivityLog("Salvar Espaço", `Espaço '${espaco.nome}' gravado localmente.`);
  return id;
}

export async function deleteEspaco(id: string): Promise<void> {
  const path = 'espacos';
  if (!isLocalMode && db) {
    try {
      await deleteDoc(doc(db, path, id));
      await addActivityLog("Excluir Espaço", `Removido código do espaço ID: ${id}`);
      return;
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${path}/${id}`);
    }
  }

  const items = getLocalData<Espaco>('es_spaces');
  const filtered = items.filter(i => i.id !== id);
  setLocalData('es_spaces', filtered);
  await addActivityLog("Excluir Espaço", `Espaço ID ${id} removido localmente.`);
}

/* =========================================
   CLIENTES (Clients) MANAGEMENT
   ========================================= */
export async function getClientes(): Promise<Cliente[]> {
  const path = 'clientes';
  if (!isLocalMode && db) {
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Cliente));
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
  }
  return getLocalData<Cliente>('es_clients');
}

export async function saveCliente(cliente: Omit<Cliente, 'id' | 'createdAt'> & { id?: string, createdAt?: string }): Promise<string> {
  const path = 'clientes';
  const id = cliente.id || "cli_" + Date.now();
  const createdAt = cliente.createdAt || new Date().toISOString();
  const fullCliente: Cliente = { ...cliente, id, createdAt } as Cliente;

  if (!isLocalMode && db) {
    try {
      await setDoc(doc(db, path, id), fullCliente);
      await addActivityLog("Salvar Cliente", `Cliente '${cliente.nome}' salvo com sucesso.`);
      return id;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${path}/${id}`);
    }
  }

  const items = getLocalData<Cliente>('es_clients');
  const index = items.findIndex(i => i.id === id);
  if (index >= 0) {
    items[index] = fullCliente;
  } else {
    items.push(fullCliente);
  }
  setLocalData('es_clients', items);
  await addActivityLog("Salvar Cliente", `Cliente '${cliente.nome}' gravado localmente.`);
  return id;
}

export async function deleteCliente(id: string): Promise<void> {
  const path = 'clientes';
  if (!isLocalMode && db) {
    try {
      await deleteDoc(doc(db, path, id));
      await addActivityLog("Excluir Cliente", `Cliente ID ${id} removido.`);
      return;
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${path}/${id}`);
    }
  }

  const items = getLocalData<Cliente>('es_clients');
  const filtered = items.filter(i => i.id !== id);
  setLocalData('es_clients', filtered);
  await addActivityLog("Excluir Cliente", `Cliente ID ${id} removido localmente.`);
}

/* =========================================
   RESERVAS (Reservas) MANAGEMENT
   ========================================= */
export async function getReservas(): Promise<Reserva[]> {
  const path = 'reservas';
  if (!isLocalMode && db) {
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Reserva));
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
  }
  return getLocalData<Reserva>('es_bookings');
}

export async function saveReserva(reserva: Omit<Reserva, 'id' | 'createdAt'> & { id?: string, createdAt?: string }): Promise<string> {
  const path = 'reservas';
  const id = reserva.id || "res_" + Date.now();
  const createdAt = reserva.createdAt || new Date().toISOString();
  const fullReserva: Reserva = { ...reserva, id, createdAt } as Reserva;

  if (!isLocalMode && db) {
    try {
      await setDoc(doc(db, path, id), fullReserva);
      await addActivityLog("Salvar Reserva", `Locação criada/editada em ${reserva.dataEvento} (Status: ${reserva.status}).`);
      return id;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${path}/${id}`);
    }
  }

  const items = getLocalData<Reserva>('es_bookings');
  const index = items.findIndex(i => i.id === id);
  if (index >= 0) {
    items[index] = fullReserva;
  } else {
    items.push(fullReserva);
  }
  setLocalData('es_bookings', items);
  await addActivityLog("Salvar Reserva", `Locação ID ${id} gravada localmente.`);
  return id;
}

export async function deleteReserva(id: string): Promise<void> {
  const path = 'reservas';
  if (!isLocalMode && db) {
    try {
      await deleteDoc(doc(db, path, id));
      await addActivityLog("Excluir Reserva", `Reserva apagada do banco: ID ${id}`);
      return;
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${path}/${id}`);
    }
  }

  const items = getLocalData<Reserva>('es_bookings');
  const filtered = items.filter(i => i.id !== id);
  setLocalData('es_bookings', filtered);
  await addActivityLog("Excluir Reserva", `Reserva ID ${id} excluída localmente.`);
}

/* =========================================
   PAGAMENTOS (Payments / Financials)
   ========================================= */
export async function getPagamentos(): Promise<Pagamento[]> {
  const path = 'pagamentos';
  if (!isLocalMode && db) {
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Pagamento));
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
  }
  return getLocalData<Pagamento>('es_payments');
}

export async function savePagamento(pagamento: Omit<Pagamento, 'id'> & { id?: string }): Promise<string> {
  const path = 'pagamentos';
  const id = pagamento.id || "pay_" + Date.now();
  const fullPagamento: Pagamento = { ...pagamento, id } as Pagamento;

  if (!isLocalMode && db) {
    try {
      await setDoc(doc(db, path, id), fullPagamento);
      await addActivityLog("Registrar Pagamento", `Lançamento de R$ ${pagamento.valor} finalizado (${pagamento.status}).`);
      return id;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${path}/${id}`);
    }
  }

  const items = getLocalData<Pagamento>('es_payments');
  const index = items.findIndex(i => i.id === id);
  if (index >= 0) {
    items[index] = fullPagamento;
  } else {
    items.push(fullPagamento);
  }
  setLocalData('es_payments', items);
  await addActivityLog("Registrar Pagamento", `Lançamento de R$ ${pagamento.valor} incluído no financeiro local.`);
  return id;
}

export async function deletePagamento(id: string): Promise<void> {
  const path = 'pagamentos';
  if (!isLocalMode && db) {
    try {
      await deleteDoc(doc(db, path, id));
      await addActivityLog("Remover Lançamento Financeiro", `Removido pagamento ID ${id}`);
      return;
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${path}/${id}`);
    }
  }

  const items = getLocalData<Pagamento>('es_payments');
  const filtered = items.filter(i => i.id !== id);
  setLocalData('es_payments', filtered);
  await addActivityLog("Excluir Lançamento", `Pagamento ID ${id} removido localmente.`);
}

/* =========================================
   CONTRATOS (Contracts)
   ========================================= */
export async function getContratos(): Promise<Contrato[]> {
  const path = 'contratos';
  if (!isLocalMode && db) {
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Contrato));
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
  }
  return getLocalData<Contrato>('es_contracts');
}

export async function saveContrato(contrato: Omit<Contrato, 'id' | 'createdAt'> & { id?: string, createdAt?: string }): Promise<string> {
  const path = 'contratos';
  const id = contrato.id || "cnt_" + Date.now();
  const createdAt = contrato.createdAt || new Date().toISOString();
  const fullContrato: Contrato = { ...contrato, id, createdAt } as Contrato;

  if (!isLocalMode && db) {
    try {
      await setDoc(doc(db, path, id), fullContrato);
      await addActivityLog("Arquivo de Contrato", `Contrato e termos atualizados para Reserva ID ${contrato.reservaId}.`);
      return id;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${path}/${id}`);
    }
  }

  const items = getLocalData<Contrato>('es_contracts');
  const index = items.findIndex(i => i.id === id);
  if (index >= 0) {
    items[index] = fullContrato;
  } else {
    items.push(fullContrato);
  }
  setLocalData('es_contracts', items);
  await addActivityLog("Documentação de Contrato", `Salvo contrato ID ${id} no repositório local.`);
  return id;
}

/* =========================================
   LOGS OF ACTIVITIES LIST
   ========================================= */
export async function getLogs(): Promise<ActivityLog[]> {
  const path = 'logs';
  if (!isLocalMode && db) {
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)).sort((a,b) => b.timestamp.localeCompare(a.timestamp));
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
  }
  return getLocalData<ActivityLog>('es_logs');
}

/* =========================================
   SYSTEM USERS MANAGEMENT
   ========================================= */
export async function getSystemUsers(): Promise<SystemUser[]> {
  const path = 'system_users';
  if (!isLocalMode && db) {
    try {
      const snap = await getDocs(collection(db, path));
      if (snap.size > 0) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemUser));
      }
    } catch (e) {
      console.warn("Falha ao obter operadores remotos, servindo locais:", e);
    }
  }
  return getLocalData<SystemUser>('es_system_users');
}

export async function saveSystemUser(user: Omit<SystemUser, 'id' | 'createdAt'> & { id?: string, createdAt?: string }): Promise<string> {
  const path = 'system_users';
  const id = user.id || "usr_" + Date.now();
  const createdAt = user.createdAt || new Date().toISOString();
  const fullUser: SystemUser = { ...user, id, createdAt } as SystemUser;

  if (!isLocalMode && db) {
    try {
      await setDoc(doc(db, path, id), fullUser);
      await addActivityLog("Controle de Operadores", `Operador ${user.nome} (${user.role}) atualizado.`);
      return id;
    } catch (e) {
      console.warn("Falha de gravação remota de usuário:", e);
    }
  }

  const items = getLocalData<SystemUser>('es_system_users');
  const index = items.findIndex(i => i.id === id);
  if (index >= 0) {
    items[index] = fullUser;
  } else {
    items.push(fullUser);
  }
  setLocalData('es_system_users', items);
  await addActivityLog("Controle de Operadores", `Salvo operador ${user.nome} (${user.role}) localmente.`);
  return id;
}

export async function deleteSystemUser(id: string): Promise<void> {
  const items = getLocalData<SystemUser>('es_system_users');
  const targetUser = items.find(u => u.id === id);
  if (id === 'usr_dev_master' || (targetUser && targetUser.email.toLowerCase() === 'clecioferreiracorretor@gmail.com')) {
    throw new Error("O usuário dev do sistema (clecioferreiracorretor@gmail.com) é protegido e não pode ser apagado.");
  }

  const path = 'system_users';
  if (!isLocalMode && db) {
    try {
      await deleteDoc(doc(db, path, id));
      await addActivityLog("Controle de Operadores", `Operador ID ${id} excluído de forma persistente.`);
      return;
    } catch (e) {
      console.warn("Falha de exclusão remota:", e);
    }
  }

  const updated = items.filter(i => i.id !== id);
  setLocalData('es_system_users', updated);
  await addActivityLog("Controle de Operadores", `Removido operador ID ${id} localmente.`);
}

