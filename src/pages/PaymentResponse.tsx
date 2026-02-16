import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertCircle, Home, Package, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

type PaymentStatus = 'success' | 'pending' | 'failed' | 'rejected' | 'loading';

interface TransactionInfo {
  ref_payco: string;
  invoice: string;
  description: string;
  amount: string;
  currency: string;
  status: string;
  response: string;
  payment_method: string;
}

const STATUS_CONFIG = {
  success: {
    icon: CheckCircle,
    title: '¡Pago Exitoso!',
    message: 'Tu pedido ha sido procesado correctamente. Recibirás un email con los detalles.',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
  },
  pending: {
    icon: Clock,
    title: 'Pago Pendiente',
    message: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
  },
  failed: {
    icon: XCircle,
    title: 'Pago Fallido',
    message: 'Hubo un problema con tu pago. Por favor intenta de nuevo.',
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
  rejected: {
    icon: AlertCircle,
    title: 'Pago Rechazado',
    message: 'Tu pago fue rechazado. Verifica tus datos e intenta con otro método de pago.',
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
  loading: {
    icon: Loader2,
    title: 'Verificando...',
    message: 'Estamos verificando el estado de tu pago.',
    color: 'text-muted-foreground',
    bg: 'bg-muted',
  },
};

function mapCodResponseToStatus(codResponse: string): PaymentStatus {
  switch (codResponse) {
    case '1': return 'success';
    case '2': return 'rejected';
    case '3': return 'pending';
    case '4': return 'failed';
    default: return 'pending';
  }
}

function mapCodResponseToOrderStatus(codResponse: string): 'paid' | 'pending' | 'cancelled' {
  switch (codResponse) {
    case '1': return 'paid';
    case '2': return 'cancelled';
    case '3': return 'pending';
    case '4': return 'cancelled';
    default: return 'pending';
  }
}

export default function PaymentResponse() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [transaction, setTransaction] = useState<TransactionInfo | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const cartCleared = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const handleSuccess = useCallback(() => {
    if (!cartCleared.current) {
      cartCleared.current = true;
      clearCart();
    }
  }, [clearCart]);

  // Process initial params from ePayco redirect
  useEffect(() => {
    const refPayco = searchParams.get('ref_payco');
    const codResponse = searchParams.get('x_cod_response') || searchParams.get('x_cod_transaction_state');
    const invoice = searchParams.get('x_id_invoice') || searchParams.get('x_extra1');
    const extra1 = searchParams.get('x_extra1');

    if (refPayco) {
      // Has ref_payco → fetch from ePayco validation API
      fetchFromEpayco(refPayco);
    } else if (codResponse) {
      // Has inline params
      const transInfo: TransactionInfo = {
        ref_payco: searchParams.get('x_ref_payco') || 'N/A',
        invoice: invoice || 'N/A',
        description: searchParams.get('x_description') || 'Pedido KPU Café',
        amount: searchParams.get('x_amount') || '0',
        currency: 'COP',
        status: codResponse,
        response: searchParams.get('x_response') || searchParams.get('x_transaction_state') || 'N/A',
        payment_method: searchParams.get('x_franchise') || 'N/A',
      };
      setTransaction(transInfo);
      setOrderId(extra1 || invoice || null);

      const paymentStatus = mapCodResponseToStatus(codResponse);
      setStatus(paymentStatus);
      if (paymentStatus === 'success') handleSuccess();
      if (paymentStatus === 'pending') setIsPolling(true);
    } else {
      // No params at all - check if we have an order to poll
      setStatus('pending');
      setIsPolling(true);
    }
  }, [searchParams, handleSuccess]);

  const fetchFromEpayco = async (refPayco: string) => {
    try {
      const response = await fetch(`https://secure.epayco.co/validation/v1/reference/${refPayco}`);
      const data = await response.json();

      if (data.success && data.data) {
        const txData = data.data;
        setTransaction({
          ref_payco: txData.x_ref_payco,
          invoice: txData.x_id_invoice,
          description: txData.x_description,
          amount: txData.x_amount,
          currency: txData.x_currency_code,
          status: txData.x_cod_response,
          response: txData.x_response,
          payment_method: txData.x_franchise,
        });

        const oid = txData.x_extra1 || txData.x_id_invoice;
        setOrderId(oid);

        const paymentStatus = mapCodResponseToStatus(txData.x_cod_response);
        setStatus(paymentStatus);

        if (paymentStatus === 'success') {
          handleSuccess();
          // Also update order from client side as backup
          if (oid) {
            await supabase
              .from('orders')
              .update({ status: 'paid', payment_reference: txData.x_ref_payco })
              .eq('id', oid);
          }
        } else if (paymentStatus === 'pending') {
          setIsPolling(true);
        }
      } else {
        setStatus('pending');
        setIsPolling(true);
      }
    } catch (error) {
      console.error('Error fetching transaction:', error);
      setStatus('pending');
      setIsPolling(true);
    }
  };

  // Poll order status from DB (detects webhook updates)
  useEffect(() => {
    if (!isPolling || !orderId || status === 'success') return;

    const pollOrderStatus = async () => {
      try {
        const { data } = await supabase
          .from('orders')
          .select('status, payment_reference')
          .eq('id', orderId)
          .single();

        if (data) {
          if (data.status === 'paid') {
            setStatus('success');
            handleSuccess();
            setIsPolling(false);
            if (transaction) {
              setTransaction(prev => prev ? { ...prev, response: 'Aceptada' } : prev);
            }
          } else if (data.status === 'cancelled') {
            setStatus('failed');
            setIsPolling(false);
          }
        }
      } catch (err) {
        console.error('Error polling order status:', err);
      }
    };

    // Poll every 5 seconds
    pollOrderStatus();
    pollingRef.current = setInterval(pollOrderStatus, 5000);

    // Stop polling after 5 minutes
    const timeout = setTimeout(() => {
      setIsPolling(false);
      if (pollingRef.current) clearInterval(pollingRef.current);
    }, 5 * 60 * 1000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearTimeout(timeout);
    };
  }, [isPolling, orderId, status, handleSuccess, transaction]);

  // Also subscribe to realtime changes
  useEffect(() => {
    if (!orderId || status === 'success') return;

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData.status === 'paid') {
            setStatus('success');
            handleSuccess();
            setIsPolling(false);
          } else if (newData.status === 'cancelled') {
            setStatus('failed');
            setIsPolling(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, status, handleSuccess]);

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-card rounded-2xl p-8 shadow-lg text-center">
            <div className={`w-20 h-20 ${config.bg} rounded-full flex items-center justify-center mx-auto mb-6`}>
              <Icon className={`h-10 w-10 ${config.color} ${status === 'loading' ? 'animate-spin' : ''}`} />
            </div>

            <h1 className="font-display text-2xl font-bold text-card-foreground mb-2">
              {config.title}
            </h1>
            <p className="text-muted-foreground mb-8">
              {config.message}
            </p>

            {isPolling && status === 'pending' && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Esperando confirmación del pago...</span>
              </div>
            )}

            {transaction && (
              <div className="bg-background rounded-xl p-6 mb-8 text-left">
                <h3 className="font-semibold text-foreground mb-4">Detalles de la transacción</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Referencia:</span>
                    <span className="font-medium text-foreground">{transaction.ref_payco}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pedido:</span>
                    <span className="font-medium text-foreground">{transaction.invoice?.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium text-foreground">
                      ${Number(transaction.amount).toLocaleString('es-CO')} {transaction.currency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Método:</span>
                    <span className="font-medium text-foreground">{transaction.payment_method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estado:</span>
                    <span className={`font-medium ${config.color}`}>{transaction.response}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/')}
                className="btn-kpu-outline flex items-center justify-center gap-2"
              >
                <Home className="h-5 w-5" />
                Volver al Inicio
              </button>

              {status === 'success' && (
                <button
                  onClick={() => navigate('/mis-pedidos')}
                  className="btn-kpu flex items-center justify-center gap-2"
                >
                  <Package className="h-5 w-5" />
                  Ver Mis Pedidos
                </button>
              )}

              {(status === 'failed' || status === 'rejected') && (
                <button
                  onClick={() => navigate(-1)}
                  className="btn-kpu flex items-center justify-center gap-2"
                >
                  Intentar de nuevo
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
