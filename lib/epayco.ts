const EPAYCO_BASE = 'https://api.secure.payco.co';
const TEST_MODE = process.env.EPAYCO_TEST_MODE === 'true';

export class EpaycoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EpaycoError';
  }
}

async function getJwt(): Promise<string> {
  const res = await epaycoFetch(`${EPAYCO_BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      public_key: process.env.EPAYCO_PUBLIC_KEY,
      private_key: process.env.EPAYCO_PRIVATE_KEY,
    }),
  });
  const raw = await res.json();
  const data = Array.isArray(raw) ? raw[0] : raw;
  const token =
    data?.bearer_token || data?.token || data?.bearer || data?.data?.bearer_token;
  if (!token) throw new EpaycoError('No se pudo autenticar con ePayco');
  return token;
}

function authHeaders(jwt: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
    type: 'sdk-jwt',
    lang: 'JAVASCRIPT',
  };
}

async function epaycoFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    throw new EpaycoError(`Error de red al contactar ePayco: ${(err as Error).message}`);
  }
}

export async function tokenizeCard(card: {
  cardNumber: string;
  expMonth: string;
  expYear: string;
  cvc: string;
  cardHolder: string;
}): Promise<{ tokenId: string; franchise: string; mask: string }> {
  const jwt = await getJwt();
  const res = await epaycoFetch(`${EPAYCO_BASE}/v1/tokens`, {
    method: 'POST',
    headers: authHeaders(jwt),
    body: JSON.stringify({
      'card[number]': card.cardNumber.replace(/\s/g, ''),
      'card[exp_month]': card.expMonth.padStart(2, '0'),
      'card[exp_year]': card.expYear.length === 2 ? `20${card.expYear}` : card.expYear,
      'card[cvc]': card.cvc,
      'card[card_holder]': card.cardHolder,
      hasCvv: true,
      test: TEST_MODE,
    }),
  });
  if (!res.ok && res.status !== 200) {
    throw new EpaycoError(`ePayco tokenize HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.status === false) {
    const nested = data.data || {};
    const msg =
      nested.errors || nested.description || data.message ||
      'Tarjeta no válida. Verifica los datos e intenta de nuevo.';
    throw new EpaycoError(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  const token = data.data || data;
  return {
    tokenId: token.id || token.token_id || '',
    franchise: (token.franchise || '').toLowerCase(),
    mask: token.mask || '',
  };
}

export async function createCustomer(params: {
  tokenId: string;
  name: string;
  email: string;
  phone?: string;
  docType?: string;
  docNumber?: string;
}): Promise<{ customerId: string }> {
  const jwt = await getJwt();
  let phone = (params.phone || '0000000000').replace(/\D/g, '');
  if (phone.startsWith('57') && phone.length > 10) phone = phone.slice(2);

  const res = await epaycoFetch(`${EPAYCO_BASE}/payment/v1/customer/create`, {
    method: 'POST',
    headers: authHeaders(jwt),
    body: JSON.stringify({
      token_card: params.tokenId,
      name: params.name,
      email: params.email,
      doc_type: params.docType || 'CC',
      doc_number: params.docNumber || '0000000000',
      phone,
      default: true,
      test: TEST_MODE,
    }),
  });
  const data = await res.json();
  if (data.status === false) {
    throw new EpaycoError(data.message || 'Error al crear cliente ePayco');
  }
  const customerId = data.data?.customerId || data.customerId || '';
  if (!customerId) throw new EpaycoError('ePayco no devolvió customerId');
  return { customerId };
}

export interface ChargeResult {
  status: 'approved' | 'rejected' | 'pending';
  epaycoRef: string | null;
  transactionId: string | null;
  message: string;
}

export async function chargeCard(params: {
  tokenId: string;
  customerId: string;
  amount: number;
  description: string;
  invoiceNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  buyerAddress?: string;
  buyerCity?: string;
}): Promise<ChargeResult> {
  const jwt = await getJwt();
  let phone = (params.buyerPhone || '0000000000').replace(/\D/g, '');
  if (phone.startsWith('57') && phone.length > 10) phone = phone.slice(2);

  const res = await epaycoFetch(`${EPAYCO_BASE}/payment/v1/charge/create`, {
    method: 'POST',
    headers: authHeaders(jwt),
    body: JSON.stringify({
      token_card: params.tokenId,
      customer_id: params.customerId,
      doc_type: 'CC',
      doc_number: '0000000000',
      name: params.buyerName.split(' ')[0] || 'Cliente',
      last_name: params.buyerName.split(' ').slice(1).join(' ') || 'KPU',
      email: params.buyerEmail,
      phone,
      cell_phone: phone,
      address: params.buyerAddress || 'SIN DIRECCION',
      city: params.buyerCity || 'Colombia',
      department: 'Colombia',
      country: 'CO',
      bill: params.invoiceNumber,
      description: params.description,
      value: String(params.amount),
      tax: '0',
      tax_base: '0',
      currency: 'COP',
      dues: '1',
      test: TEST_MODE,
    }),
  });
  const data = await res.json();
  const tx = data.data || data;
  const estado = (tx.estado || tx.status || '').toLowerCase();
  let status: 'approved' | 'rejected' | 'pending';
  if (['aceptada', 'approved', 'aprobada'].includes(estado)) status = 'approved';
  else if (['pendiente', 'pending'].includes(estado)) status = 'pending';
  else status = 'rejected';

  return {
    status,
    epaycoRef: tx.ref_payco ? String(tx.ref_payco) : null,
    transactionId: tx.transactionID ? String(tx.transactionID) : null,
    message: tx.respuesta || tx.message || estado,
  };
}
