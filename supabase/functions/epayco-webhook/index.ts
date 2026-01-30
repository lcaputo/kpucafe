import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
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
    const response = data.x_response || data.x_transaction_state;
    const amount = data.x_amount;

    if (!orderId) {
      console.error('No order ID found in webhook data');
      return new Response(
        JSON.stringify({ success: false, error: 'No order ID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate transaction with ePayco API (optional but recommended)
    if (refPayco) {
      try {
        const validationResponse = await fetch(
          `https://secure.epayco.co/validation/v1/reference/${refPayco}`
        );
        const validationData = await validationResponse.json();
        
        if (validationData.success && validationData.data) {
          // Use validated data
          const validatedCodResponse = validationData.data.x_cod_response;
          const validatedAmount = validationData.data.x_amount;
          
          console.log('Validated transaction:', JSON.stringify(validationData.data));
          
          // Verify amount matches order
          const { data: order } = await supabase
            .from('orders')
            .select('total')
            .eq('id', orderId)
            .single();
            
          if (order && Math.abs(order.total - Number(validatedAmount)) > 1) {
            console.error('Amount mismatch:', order.total, 'vs', validatedAmount);
            return new Response(
              JSON.stringify({ success: false, error: 'Amount mismatch' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }
        }
      } catch (validationError) {
        console.error('Error validating with ePayco:', validationError);
        // Continue with original data if validation fails
      }
    }

    // Map ePayco response codes to order status
    let orderStatus: 'pending' | 'paid' | 'cancelled' = 'pending';
    
    switch (codResponse) {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
