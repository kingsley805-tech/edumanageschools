import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ShopProductsPage from "@/modules/shop/pages/ShopProducts";
import ShopOrdersPage from "@/modules/shop/pages/ShopOrders";

export default function SchoolShopPage() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-0">
          <div className="-m-4 md:-m-6">
            <ShopProductsPage />
          </div>
        </TabsContent>
        <TabsContent value="orders" className="mt-0">
          <div className="-m-4 md:-m-6">
            <ShopOrdersPage />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
