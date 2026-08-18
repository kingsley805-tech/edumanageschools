import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { formatMoney } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Heart,
  CreditCard,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatEdgeFunctionError } from "@/lib/invokeEdgeFunction";
import {
  parsePaystackReturnSearch,
  shouldAttemptPaystackConfirm,
  isExplicitPaystackFailure,
} from "@/billing/lib/paystackReturnParams";
import {
  confirmShopPaystackPaymentFromReturn,
  initializeShopPaystackCheckout,
  shopPaystackReturnUrl,
} from "@/modules/shop/lib/paystackShop";
import {
  addToCart,
  fetchParentChildren,
  fetchShopSchoolContext,
  fetchStudentForUser,
  listActiveProducts,
  listCartItems,
  listCategories,
  listMyOrders,
  listWishlistIds,
  placeOrder,
  removeCartItem,
  toggleWishlist,
  updateCartQuantity,
} from "@/modules/shop/lib/shopApi";
import type { ShopCartItem, ShopCategory, ShopOrder, ShopPortalRole, ShopProduct } from "@/modules/shop/lib/types";

const TYPE_LABELS: Record<string, string> = {
  uniform: "Uniform",
  book: "Books",
  stationery: "Stationery",
  sports: "Sports",
  accessory: "Accessories",
  digital: "Digital",
  general: "General",
};

type Props = {
  portalRole: ShopPortalRole;
};

export default function ShopStorefront({ portalRole }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("GHS");
  const [schoolName, setSchoolName] = useState("School Shop");
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [cart, setCart] = useState<ShopCartItem[]>([]);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockOnly, setStockOnly] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ShopProduct | null>(null);
  const [tab, setTab] = useState("browse");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "shipping">("pickup");
  const [shippingAddress, setShippingAddress] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [notes, setNotes] = useState("");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [children, setChildren] = useState<{ id: string; full_name: string; admission_number: string | null }[]>([]);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  const paymentReturn = useMemo(
    () => parsePaystackReturnSearch(window.location.search),
    [],
  );

  const money = useCallback((n: number) => formatMoney(Number(n || 0), currency), [currency]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ctx = await fetchShopSchoolContext(user.id);
      setSchoolId(ctx.schoolId);
      setCurrency(ctx.currency);
      setSchoolName(ctx.schoolName);
      setProfileName(ctx.profile.full_name || "");
      setProfileEmail(ctx.profile.email || user.email || "");
      setCustomerName((prev) => prev || ctx.profile.full_name || "");
      setCustomerEmail((prev) => prev || ctx.profile.email || user.email || "");
      setCustomerPhone((prev) => prev || ctx.profile.phone || "");

      const [productRows, categoryRows, cartRows, wishIds, orderRows] = await Promise.all([
        listActiveProducts(ctx.schoolId),
        listCategories(ctx.schoolId),
        listCartItems(user.id, ctx.schoolId),
        listWishlistIds(user.id, ctx.schoolId),
        listMyOrders(user.id, ctx.schoolId),
      ]);
      setProducts(productRows);
      setCategories(categoryRows);
      setCart(cartRows);
      setWishlist(wishIds);
      setOrders(orderRows);

      if (portalRole === "student") {
        const student = await fetchStudentForUser(user.id);
        if (student) setStudentId(student.id);
      } else if (portalRole === "parent") {
        const kids = await fetchParentChildren(user.id);
        setChildren(kids);
        setStudentId((prev) => prev || kids[0]?.id || null);
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Unable to load shop");
    } finally {
      setLoading(false);
    }
  }, [user, portalRole]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [user?.id, portalRole]);

  const runPaymentConfirm = useCallback(async () => {
    if (!shouldAttemptPaystackConfirm(paymentReturn)) {
      if (paymentReturn && isExplicitPaystackFailure(paymentReturn.status)) {
        toast.error("Payment was not completed.");
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      }
      return;
    }
    setConfirmingPayment(true);
    try {
      const result = await confirmShopPaystackPaymentFromReturn(paymentReturn);
      if (result.ok) {
        toast.success(result.duplicate ? "Payment already recorded" : "Payment successful");
        setTab("orders");
        await refresh();
      } else {
        toast.error(result.error ?? "Could not confirm payment");
      }
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    } catch (e) {
      toast.error(formatEdgeFunctionError(e, "paystack"));
    } finally {
      setConfirmingPayment(false);
    }
  }, [paymentReturn, refresh]);

  useEffect(() => {
    void runPaymentConfirm();
  }, [runPaymentConfirm]);

  const validateCheckout = () => {
    if (!cart.length) {
      toast.error("Your cart is empty");
      return false;
    }
    if (!customerName.trim()) {
      toast.error("Enter your name");
      return false;
    }
    if (fulfillment === "shipping" && !shippingAddress.trim()) {
      toast.error("Enter a delivery address");
      return false;
    }
    return true;
  };

  const submitOrder = async () => {
    if (!user || !schoolId) throw new Error("Not signed in");
    return placeOrder({
      schoolId,
      items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      studentId,
      portalRole,
      fulfillmentMethod: fulfillment,
      shippingAddress: fulfillment === "shipping" ? shippingAddress.trim() : undefined,
      couponCode: couponCode.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const onCheckoutPayAtSchool = async () => {
    if (!user || !schoolId || !validateCheckout()) return;
    setBusy(true);
    try {
      const result = await submitOrder();
      toast.success(`Order ${result.order_number} placed — pay at the school shop`);
      setCheckoutOpen(false);
      setCartOpen(false);
      setCouponCode("");
      setNotes("");
      setTab("orders");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  const onCheckoutPayOnline = async () => {
    if (!user || !schoolId || !validateCheckout()) return;
    setBusy(true);
    try {
      const result = await submitOrder();
      const checkoutUrl = await initializeShopPaystackCheckout({
        shop_order_id: result.order_id,
        callback_url: shopPaystackReturnUrl(portalRole),
        email: customerEmail.trim() || profileEmail || undefined,
      });
      window.location.href = checkoutUrl;
    } catch (e) {
      toast.error(formatEdgeFunctionError(e, "paystack"));
      setBusy(false);
    }
  };

  const payUnpaidOrder = async (order: ShopOrder) => {
    setPayingOrderId(order.id);
    try {
      const checkoutUrl = await initializeShopPaystackCheckout({
        shop_order_id: order.id,
        callback_url: shopPaystackReturnUrl(portalRole),
        email: customerEmail.trim() || profileEmail || undefined,
      });
      window.location.href = checkoutUrl;
    } catch (e) {
      toast.error(formatEdgeFunctionError(e, "paystack"));
      setPayingOrderId(null);
    }
  };

  const cartCount = useMemo(() => cart.reduce((n, i) => n + Number(i.quantity || 0), 0), [cart]);
  const cartSubtotal = useMemo(
    () => cart.reduce((n, i) => n + Number(i.product?.price || 0) * Number(i.quantity || 0), 0),
    [cart],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (typeFilter !== "all" && p.product_type !== typeFilter) return false;
      if (categoryFilter !== "all" && p.category_id !== categoryFilter) return false;
      if (stockOnly && !p.is_digital && p.stock_qty <= 0) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (TYPE_LABELS[p.product_type] || p.product_type).toLowerCase().includes(q)
      );
    });
  }, [products, query, typeFilter, categoryFilter, stockOnly]);

  const wishlistProducts = useMemo(
    () => products.filter((p) => wishlist.has(p.id)),
    [products, wishlist],
  );

  const onAddToCart = async (product: ShopProduct, qty = 1) => {
    if (!user || !schoolId) return;
    if (!product.is_digital && product.stock_qty <= 0) {
      toast.error("Out of stock");
      return;
    }
    setBusy(true);
    try {
      await addToCart({ schoolId, userId: user.id, productId: product.id, quantity: qty });
      const rows = await listCartItems(user.id, schoolId);
      setCart(rows);
      toast.success(`${product.name} added to cart`);
      setCartOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add to cart");
    } finally {
      setBusy(false);
    }
  };

  const onToggleWish = async (product: ShopProduct) => {
    if (!user || !schoolId) return;
    const saved = wishlist.has(product.id);
    try {
      await toggleWishlist({
        schoolId,
        userId: user.id,
        productId: product.id,
        currentlySaved: saved,
      });
      setWishlist((prev) => {
        const next = new Set(prev);
        if (saved) next.delete(product.id);
        else next.add(product.id);
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Wishlist update failed");
    }
  };

  const onCartQty = async (item: ShopCartItem, nextQty: number) => {
    setBusy(true);
    try {
      await updateCartQuantity(item.id, nextQty);
      if (!user || !schoolId) return;
      setCart(await listCartItems(user.id, schoolId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update cart");
    } finally {
      setBusy(false);
    }
  };

  const onRemoveCart = async (item: ShopCartItem) => {
    setBusy(true);
    try {
      await removeCartItem(item.id);
      if (!user || !schoolId) return;
      setCart(await listCartItems(user.id, schoolId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove item");
    } finally {
      setBusy(false);
    }
  };

  const productCard = (product: ShopProduct) => {
    const out = !product.is_digital && product.stock_qty <= 0;
    const wished = wishlist.has(product.id);
    const categoryName = categories.find((c) => c.id === product.category_id)?.name;
    const metaParts = [
      categoryName || TYPE_LABELS[product.product_type] || product.product_type,
      product.is_digital ? "Digital" : out ? "Out of stock" : null,
    ].filter(Boolean);

    return (
      <Card
        key={product.id}
        role="button"
        tabIndex={0}
        className="cursor-pointer rounded-2xl border-0 bg-card p-3 shadow-[0_4px_18px_rgba(0,0,0,0.08)] transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setDetailProduct(product)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDetailProduct(product);
          }
        }}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Package className="h-10 w-10 opacity-40" />
            </div>
          )}
          {out ? (
            <span className="absolute left-2 top-2 rounded-md bg-background/95 px-2 py-0.5 text-[11px] font-medium shadow-sm">
              Out of stock
            </span>
          ) : null}
          <button
            type="button"
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-white text-foreground shadow-sm transition hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              void onToggleWish(product);
            }}
            aria-label={wished ? "Remove from wishlist" : "Save to wishlist"}
          >
            <Heart className={`h-4 w-4 ${wished ? "fill-red-500 text-red-500" : "text-foreground/80"}`} />
          </button>
        </div>
        <CardContent className="space-y-3 px-1 pb-1 pt-3">
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-lg font-bold leading-tight text-foreground">{product.name}</p>
            <p className="truncate text-sm text-muted-foreground">{metaParts.join(" · ")}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-bold tracking-tight text-[#002D5E] dark:text-sky-300">
              {money(product.price)}
            </p>
            <Button
              size="sm"
              disabled={busy || out}
              className="h-9 rounded-full bg-foreground px-4 text-background hover:bg-foreground/90"
              onClick={(e) => {
                e.stopPropagation();
                void onAddToCart(product);
              }}
            >
              Add
              <ShoppingCart className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout role={portalRole}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <header className="flex flex-col gap-5 rounded-2xl border border-neutral-800 bg-black px-5 py-6 text-white sm:px-7 sm:py-7 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 space-y-2.5">
            <div className="inline-flex items-center gap-2 text-neutral-400">
              <ShoppingBag className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="text-[11px] font-medium uppercase tracking-[0.2em]">School Shop</span>
            </div>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {schoolName}
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-neutral-400">
              Uniforms, books, stationery and more — order online and collect from school or request delivery.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full shrink-0 rounded-full border-0 bg-white px-5 text-black shadow-none hover:bg-neutral-100 md:w-auto"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Cart ({cartCount})
            <span className="ml-2 font-semibold tabular-nums">{money(cartSubtotal)}</span>
          </Button>
        </header>

        {loading || confirmingPayment ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {confirmingPayment ? "Confirming payment…" : "Loading shop…"}
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="browse">Browse</TabsTrigger>
              <TabsTrigger value="wishlist">Wishlist ({wishlist.size})</TabsTrigger>
              <TabsTrigger value="orders">My orders ({orders.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search products, SKU, type…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="md:w-44">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="md:w-44">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={stockOnly ? "default" : "outline"}
                  onClick={() => setStockOnly((v) => !v)}
                >
                  In stock
                </Button>
              </div>

              {filtered.length === 0 ? (
                <Card className="border-dashed shadow-none">
                  <CardContent className="py-16 text-center text-muted-foreground">
                    No products match your filters.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map(productCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="wishlist" className="space-y-4">
              {wishlistProducts.length === 0 ? (
                <Card className="border-dashed shadow-none">
                  <CardContent className="py-16 text-center text-muted-foreground">
                    Saved items will appear here.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {wishlistProducts.map(productCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="orders" className="space-y-3">
              {orders.length === 0 ? (
                <Card className="border-dashed shadow-none">
                  <CardContent className="py-16 text-center text-muted-foreground">
                    You have not placed any shop orders yet.
                  </CardContent>
                </Card>
              ) : (
                orders.map((order) => (
                  <Card key={order.id} className="shadow-none">
                    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
                      <div>
                        <CardTitle className="text-base">{order.order_number}</CardTitle>
                        <CardDescription>
                          {new Date(order.created_at).toLocaleString()} · {order.fulfillment_method}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="capitalize">
                          {order.payment_status}
                        </Badge>
                        <Badge className="capitalize">{order.fulfillment_status.replace("_", " ")}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(order.items ?? []).map((item) => (
                        <div key={item.id} className="flex justify-between gap-3 text-sm">
                          <span className="text-muted-foreground">
                            {item.product_name} × {item.quantity}
                          </span>
                          <span className="font-medium">{money(item.line_total)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                        <span>Total</span>
                        <span>{money(order.total)}</span>
                      </div>
                      {Number(order.discount) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Discount applied: {money(order.discount)}
                          {order.coupon_code ? ` (${order.coupon_code})` : ""}
                        </p>
                      )}
                      {order.payment_status === "unpaid" && Number(order.total) > 0 && (
                        <Button
                          className="mt-2 w-full sm:w-auto"
                          size="sm"
                          disabled={payingOrderId === order.id}
                          onClick={() => void payUnpaidOrder(order)}
                        >
                          {payingOrderId === order.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CreditCard className="mr-2 h-4 w-4" />
                          )}
                          Pay online
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Your cart</SheetTitle>
            <SheetDescription>
              {cartCount} item{cartCount === 1 ? "" : "s"} · {money(cartSubtotal)}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto py-4">
            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Cart is empty.</p>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-lg border p-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
                    {item.product?.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium">{item.product?.name || "Product"}</p>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => void onRemoveCart(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-sm font-semibold">
                      {money(Number(item.product?.price || 0) * Number(item.quantity))}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        disabled={busy}
                        onClick={() => void onCartQty(item, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        disabled={busy}
                        onClick={() => void onCartQty(item, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <SheetFooter className="gap-2 sm:flex-col">
            <Button
              className="w-full"
              disabled={!cart.length || busy}
              onClick={() => {
                setCartOpen(false);
                setCheckoutOpen(true);
              }}
            >
              Checkout · {money(cartSubtotal)}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Checkout</SheetTitle>
            <SheetDescription>
              Pay online or place the order and pay at the school shop desk.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
            </div>
            {portalRole === "parent" && children.length > 0 && (
              <div className="space-y-2">
                <Label>For child (optional)</Label>
                <Select
                  value={studentId || "none"}
                  onValueChange={(v) => setStudentId(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select child" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not linked to a child</SelectItem>
                    {children.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                        {c.admission_number ? ` · ${c.admission_number}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Fulfillment</Label>
              <Select
                value={fulfillment}
                onValueChange={(v) => setFulfillment(v as "pickup" | "shipping")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">School pickup</SelectItem>
                  <SelectItem value="shipping">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {fulfillment === "shipping" && (
              <div className="space-y-2">
                <Label>Delivery address</Label>
                <Textarea
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  rows={3}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Coupon code</Label>
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Order notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold">{money(cartSubtotal)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Signed in as {profileName || profileEmail}. Final total applies after any valid coupon.
              </p>
            </div>
          </div>
          <SheetFooter className="gap-2 sm:flex-col">
            <Button
              className="w-full"
              disabled={busy || !cart.length}
              onClick={() => void onCheckoutPayOnline()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Pay online · {money(cartSubtotal)}
            </Button>
            <Button
              className="w-full"
              variant="outline"
              disabled={busy || !cart.length}
              onClick={() => void onCheckoutPayAtSchool()}
            >
              Place order (pay at school)
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={!!detailProduct} onOpenChange={(open) => !open && setDetailProduct(null)}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          {detailProduct && (
            <>
              <SheetHeader>
                <SheetTitle>{detailProduct.name}</SheetTitle>
                <SheetDescription>
                  {TYPE_LABELS[detailProduct.product_type] || detailProduct.product_type}
                  {detailProduct.sku ? ` · SKU ${detailProduct.sku}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-4">
                <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
                  {detailProduct.image_url ? (
                    <img
                      src={detailProduct.image_url}
                      alt={detailProduct.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Package className="h-10 w-10 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-2xl font-semibold tracking-tight">{money(detailProduct.price)}</p>
                  {detailProduct.is_digital ? <Badge variant="outline">Digital</Badge> : null}
                  {!detailProduct.is_digital && detailProduct.stock_qty <= 0 ? (
                    <Badge variant="secondary">Out of stock</Badge>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {detailProduct.description || "No description provided."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {detailProduct.is_digital
                    ? "Digital item — no physical stock required."
                    : `${detailProduct.stock_qty} available in stock.`}
                </p>
              </div>
              <SheetFooter className="mt-auto gap-2 border-t pt-4 sm:flex-col">
                <Button
                  className="w-full"
                  disabled={busy || (!detailProduct.is_digital && detailProduct.stock_qty <= 0)}
                  onClick={() => void onAddToCart(detailProduct)}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add to cart
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => void onToggleWish(detailProduct)}
                >
                  <Heart
                    className={`mr-2 h-4 w-4 ${
                      wishlist.has(detailProduct.id) ? "fill-red-500 text-red-500" : ""
                    }`}
                  />
                  {wishlist.has(detailProduct.id) ? "Saved" : "Save to wishlist"}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
