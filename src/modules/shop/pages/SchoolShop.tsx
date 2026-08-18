import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ShopProductsPage from "@/modules/shop/pages/ShopProducts";
import ShopOrdersPage from "@/modules/shop/pages/ShopOrders";
import ShopCategoriesPage from "@/modules/shop/pages/ShopCategories";
import ShopCouponsPage from "@/modules/shop/pages/ShopCoupons";

export default function SchoolShopPage() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">School shop</h1>
        <p className="text-sm text-muted-foreground">
          Manage catalog, coupons, and fulfillment. Students, parents, and teachers order from their
          portals at /student/shop, /parent/shop, and /teacher/shop.
        </p>
      </div>
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <div className="-m-4 md:-m-6">
            <ShopProductsPage />
          </div>
        </TabsContent>
        <TabsContent value="categories">
          <div className="-m-4 md:-m-6">
            <ShopCategoriesPage />
          </div>
        </TabsContent>
        <TabsContent value="orders">
          <div className="-m-4 md:-m-6">
            <ShopOrdersPage />
          </div>
        </TabsContent>
        <TabsContent value="coupons">
          <div className="-m-4 md:-m-6">
            <ShopCouponsPage />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
