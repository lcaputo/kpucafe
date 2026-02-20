import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const epaycoPrivateKey = Deno.env.get('EPAYCO_PRIVATE_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ePayco sends data as form-urlencoded or GET params
    let data: Record<string, string> = {};
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      url.searchParams.forEach((value, key) => {
        data[key] = value;
      });
    } else if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await req.text();
        const params = new URLSearchParams(text);
        params.forEach((value, key) => {
          data[key] = value;
        });
      } else if (contentType.includes('application/json')) {
        data = await req.json();
      }
    }

    console.log('ePayco webhook received:', JSON.stringify(data));

    // Extract relevant fields (ePayco uses x_ prefix)
    const refPayco = data.x_ref_payco || data.ref_payco;
    const orderId = data.x_extra1 || data.x_id_invoice;
    const codResponse = data.x_cod_response || data.x_cod_transaction_state;

    if (!orderId) {
      console.error('No order ID found in webhook data');
      return new Response(
        JSON.stringify({ success: false, error: 'No order ID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify ePayco signature if private key is configured
    if (epaycoPrivateKey) {
      const xSignature = data.x_signature;
      const xCustIdCliente = data.x_cust_id_cliente;
      const xAmount = data.x_amount;
      const xCurrency = data.x_currency_code;

      if (xSignature && xCustIdCliente && xAmount && xCurrency && refPayco) {
        const signatureString = `${xCustIdCliente}^${epaycoPrivateKey}^${refPayco}^${codResponse}^${xAmount}^${xCurrency}`;
        const expectedSignature = await sha256Hex(signatureString);
        
        if (xSignature !== expectedSignature) {
          console.error('Invalid ePayco signature');
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid signature' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
          );
        }
        console.log('ePayco signature verified successfully');
      } else {
        console.error('Missing signature fields in webhook data');
        return new Response(
          JSON.stringify({ success: false, error: 'Missing signature fields' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    } else {
      console.warn('EPAYCO_PRIVATE_KEY not set - signature verification skipped');
    }

    // Mandatory validation with ePayco API
    if (!refPayco) {
      console.error('No payment reference for validation');
      return new Response(
        JSON.stringify({ success: false, error: 'No payment reference' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let validatedCodResponse: string | null = null;

    try {
      const validationResponse = await fetch(
        `https://secure.epayco.co/validation/v1/reference/${refPayco}`
      );
      const validationData = await validationResponse.json();
      
      if (validationData.success && validationData.data) {
        validatedCodResponse = String(validationData.data.x_cod_response);
        const validatedAmount = validationData.data.x_amount;
        
        console.log('Validated transaction:', JSON.stringify(validationData.data));
        
        // Verify amount matches order exactly
        const { data: order } = await supabase
          .from('orders')
          .select('total')
          .eq('id', orderId)
          .single();
          
        if (order && order.total !== Number(validatedAmount)) {
          console.error('Amount mismatch:', order.total, 'vs', validatedAmount);
          return new Response(
            JSON.stringify({ success: false, error: 'Amount mismatch' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
      } else {
        console.error('ePayco validation failed:', JSON.stringify(validationData));
        return new Response(
          JSON.stringify({ success: false, error: 'Payment validation failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    } catch (validationError) {
      console.error('Error validating with ePayco:', validationError);
      return new Response(
        JSON.stringify({ success: false, error: 'Payment validation unavailable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    // Use validated response code (not the one from the webhook payload)
    const trustedCodResponse = validatedCodResponse || codResponse;

    // Map ePayco response codes to order status
    let orderStatus: 'pending' | 'paid' | 'cancelled' = 'pending';
    
    switch (trustedCodResponse) {
      case '1': // Aceptada
        orderStatus = 'paid';
        break;
      case '2': // Rechazada
      case '4': // Fallida
        orderStatus = 'cancelled';
        break;
      case '3': // Pendiente
      default:
        orderStatus = 'pending';
        break;
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: orderStatus,
        payment_reference: refPayco,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update order' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Order ${orderId} updated to status: ${orderStatus}`);

    return new Response(
      JSON.stringify({ success: true, status: orderStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
