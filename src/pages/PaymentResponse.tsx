import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertCircle, Home, Package } from 'lucide-react';
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

export default function PaymentResponse() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [transaction, setTransaction] = useState<TransactionInfo | null>(null);

  useEffect(() => {
    const refPayco = searchParams.get('ref_payco');
    
    if (!refPayco) {
      // Try to get status from URL params directly (ePayco sends various params)
      const codResponse = searchParams.get('x_cod_response') || searchParams.get('x_cod_transaction_state');
      const invoice = searchParams.get('x_id_invoice') || searchParams.get('x_extra1');
      const amount = searchParams.get('x_amount');
      const description = searchParams.get('x_description');
      const response = searchParams.get('x_response') || searchParams.get('x_transaction_state');
      
      if (codResponse) {
        const transInfo: TransactionInfo = {
          ref_payco: searchParams.get('x_ref_payco') || 'N/A',
          invoice: invoice || 'N/A',
          description: description || 'Pedido KPU Café',
          amount: amount || '0',
          currency: 'COP',
          status: codResponse,
          response: response || 'N/A',
          payment_method: searchParams.get('x_franchise') || 'N/A',
        };
        
        setTransaction(transInfo);
        
        // Map ePayco response codes
        switch (codResponse) {
          case '1':
            setStatus('success');
            clearCart();
            break;
          case '2':
            setStatus('rejected');
            break;
          case '3':
            setStatus('pending');
            break;
          case '4':
            setStatus('failed');
            break;
          default:
            setStatus('pending');
        }
      } else {
        setStatus('pending');
      }
      return;
    }

    // Fetch transaction info from ePayco API
    const fetchTransaction = async () => {
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

          // Update order status based on payment result
          if (txData.x_extra1) {
            let newStatus: 'paid' | 'pending' | 'cancelled' = 'pending';
            
            switch (txData.x_cod_response) {
              case '1':
                newStatus = 'paid';
                setStatus('success');
                clearCart();
                break;
              case '2':
                setStatus('rejected');
                break;
              case '3':
                newStatus = 'pending';
                setStatus('pending');
                break;
              case '4':
                newStatus = 'cancelled';
                setStatus('failed');
                break;
              default:
                setStatus('pending');
            }

            // Update order in database
            await supabase
              .from('orders')
              .update({ 
                status: newStatus,
                payment_reference: txData.x_ref_payco,
              })
              .eq('id', txData.x_extra1);
          }
        }
      } catch (error) {
        console.error('Error fetching transaction:', error);
        setStatus('pending');
      }
    };

    fetchTransaction();
  }, [searchParams, clearCart]);

  const statusConfig = {
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
      icon: Clock,
      title: 'Verificando...',
      message: 'Estamos verificando el estado de tu pago.',
      color: 'text-muted-foreground',
      bg: 'bg-muted',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-card rounded-2xl p-8 shadow-lg text-center">
            <div className={`w-20 h-20 ${config.bg} rounded-full flex items-center justify-center mx-auto mb-6`}>
              <Icon className={`h-10 w-10 ${config.color}`} />
            </div>

            <h1 className="font-display text-2xl font-bold text-card-foreground mb-2">
              {config.title}
            </h1>
            <p className="text-muted-foreground mb-8">
              {config.message}
            </p>

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
