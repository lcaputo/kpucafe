import { useEffect, useState, useCallback } from 'react';

declare global {
  interface Window {
    ePayco?: {
      checkout: {
        configure: (config: EpaycoConfig) => EpaycoHandler;
      };
    };
  }
}

interface EpaycoConfig {
  key: string;
  test: boolean;
}

interface EpaycoHandler {
  open: (data: EpaycoPaymentData) => void;
}

export interface EpaycoPaymentData {
  name: string;
  description: string;
  invoice: string;
  currency: string;
  amount: string;
  tax_base: string;
  tax: string;
  country: string;
  lang: string;
  external: string;
  confirmation: string;
  response: string;
  name_billing?: string;
  address_billing?: string;
  type_doc_billing?: string;
  mobilephone_billing?: string;
  number_doc_billing?: string;
  email_billing?: string;
  extra1?: string;
  extra2?: string;
  extra3?: string;
}

const EPAYCO_SCRIPT_URL = 'https://checkout.epayco.co/checkout.js';

// Set to true for test mode, false for production
const EPAYCO_TEST_MODE = true;

export function useEpayco() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [handler, setHandler] = useState<EpaycoHandler | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  // Fetch public key from API
  useEffect(() => {
    const fetchPublicKey = async () => {
      try {
        const res = await fetch('/api/payments/epayco-key');
        const data = await res.json();
        if (data?.publicKey) {
          setPublicKey(data.publicKey);
        }
      } catch (err) {
        console.error('Failed to fetch ePayco key:', err);
      }
    };
    fetchPublicKey();
  }, []);

  useEffect(() => {
    if (!publicKey) return;

    // Check if script is already loaded
    if (window.ePayco) {
      const epaycoHandler = window.ePayco.checkout.configure({
        key: publicKey,
        test: EPAYCO_TEST_MODE,
      });
      setHandler(epaycoHandler);
      setIsLoaded(true);
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector(`script[src="${EPAYCO_SCRIPT_URL}"]`);
    if (existingScript) {
      return;
    }

    setIsLoading(true);

    const script = document.createElement('script');
    script.src = EPAYCO_SCRIPT_URL;
    script.async = true;
    script.setAttribute('data-epayco-key', publicKey);

    script.onload = () => {
      if (window.ePayco) {
        const epaycoHandler = window.ePayco.checkout.configure({
          key: publicKey,
          test: EPAYCO_TEST_MODE,
        });
        setHandler(epaycoHandler);
        setIsLoaded(true);
      }
      setIsLoading(false);
    };

    script.onerror = () => {
      console.error('Failed to load ePayco script');
      setIsLoading(false);
    };

    document.body.appendChild(script);

    return () => {
      // Cleanup is optional since we want to keep the script loaded
    };
  }, [publicKey]);

  const openCheckout = useCallback((paymentData: EpaycoPaymentData) => {
    if (handler) {
      handler.open(paymentData);
    } else {
      console.error('ePayco handler not initialized');
    }
  }, [handler]);

  return {
    isLoaded,
    isLoading: isLoading || !publicKey,
    openCheckout,
    testMode: EPAYCO_TEST_MODE,
  };
}
