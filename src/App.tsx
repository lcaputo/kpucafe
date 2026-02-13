import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Checkout from "./pages/Checkout";
import PaymentResponse from "./pages/PaymentResponse";
import MyOrders from "./pages/MyOrders";
import MySubscriptions from "./pages/MySubscriptions";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminShipping from "./pages/admin/AdminShipping";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminCoupons from "./pages/admin/AdminCoupons";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/pago-respuesta" element={<PaymentResponse />} />
              <Route path="/mis-pedidos" element={<MyOrders />} />
              <Route path="/mis-suscripciones" element={<MySubscriptions />} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={<AdminDashboard />}>
                <Route path="productos" element={<AdminProducts />} />
                <Route path="pedidos" element={<AdminOrders />} />
                <Route path="clientes" element={<AdminCustomers />} />
                <Route path="envios" element={<AdminShipping />} />
                <Route path="suscripciones" element={<AdminSubscriptions />} />
                <Route path="cupones" element={<AdminCoupons />} />
              </Route>
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
