import Header from '@/components/Header';
import Hero from '@/components/Hero';
import ProductsSection from '@/components/ProductsSection';
import SubscriptionSection from '@/components/SubscriptionSection';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <ProductsSection />
        <SubscriptionSection />
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
};

export default Index;
