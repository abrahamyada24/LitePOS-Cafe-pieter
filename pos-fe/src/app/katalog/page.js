/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const API_URL = RAW_API_URL.replace(/\/api$/, "").replace(/\/$/, "");

export default function KatalogPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
  const [tableNumber, setTableNumber] = useState("");
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailCartItemId, setDetailCartItemId] = useState(null);
  const [detailQty, setDetailQty] = useState(1);
  const [detailNotes, setDetailNotes] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setTableNumber((params.get("table") || params.get("meja") || "").trim().toUpperCase());
    }
    fetchCatalog();
  }, []);

  const tableOrderRequested = Boolean(tableNumber);
  const isTableMode = tableOrderRequested && settings?.enableTableOrder === true;

  const fetchCatalog = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`${API_URL}/api/catalog`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Katalog belum tersedia.");
      const regularProducts = Array.isArray(json.data.products) ? json.data.products.map(product => ({
        ...product,
        originalPrice: Number(product.originalPrice ?? product.price),
        price: Number(product.effectivePrice ?? product.price)
      })) : [];
      const packageProducts = Array.isArray(json.data.packages) ? json.data.packages.map(pkg => ({
        ...pkg,
        id: `pkg-${pkg.id}`,
        packageId: pkg.id,
        originalPrice: Number(pkg.price),
        price: Number(pkg.price)
      })) : [];
      setProducts([...regularProducts, ...packageProducts]);
      setCategories([
        ...(Array.isArray(json.data.categories) ? json.data.categories : []),
        ...(packageProducts.length > 0 ? [{ id: 'PACKAGE', name: 'Paket' }] : [])
      ]);
      setSettings(json.data.settings || null);
    } catch (error) {
      setLoadError(error.message || "Gagal mengambil katalog.");
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(Number(number) || 0);
  };

  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    return `${API_URL}${imageUrl}`;
  };

  const isUnlimitedStock = (item) => {
    return item?.isUnlimitedStock === true || item?.isUnlimitedStock === 1 || item?.isUnlimitedStock === "1";
  };

  const getStockLabel = (product) => {
    if (isUnlimitedStock(product)) return "Tersedia";
    const stock = Number(product.stock) || 0;
    return stock <= 5 ? `Sisa ${stock}` : `${stock} tersedia`;
  };

  const isProductAvailable = (product) => {
    return isUnlimitedStock(product) || Number(product.stock || 0) > 0;
  };

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  const filteredProducts = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchSearch = !keyword || product.name.toLowerCase().includes(keyword);
      const matchCategory = selectedCategory === "All" || String(product.categoryId) === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const getProductCartQty = (productId) => {
    return cart.filter((item) => item.id === productId).reduce((sum, item) => sum + item.quantity, 0);
  };

  const addToCart = (product, qty = 1, notes = "") => {
    const quantity = Math.max(1, Number(qty) || 1);
    const cleanNotes = String(notes || "").trim();
    const currentQty = getProductCartQty(product.id);

    if (!isUnlimitedStock(product) && currentQty + quantity > Number(product.stock || 0)) {
      alert("Jumlah melebihi stok yang tersedia.");
      return;
    }

    const cartItemId = `${product.id}-${cleanNotes.toLowerCase() || "regular"}`;
    setCart((prev) => {
      const existing = prev.find((item) => item.cartItemId === cartItemId);
      if (existing) {
        return prev.map((item) =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [
        ...prev,
        {
          cartItemId,
          id: product.id,
          packageId: product.packageId || null,
          name: product.name,
          categoryName: product.category?.name || null,
          price: Number(product.price),
          originalPrice: Number(product.originalPrice ?? product.price),
          discountAmount: Number(product.discountAmount || 0),
          imageUrl: product.imageUrl,
          stock: product.stock,
          isUnlimitedStock: product.isUnlimitedStock,
          quantity,
          notes: cleanNotes,
        },
      ];
    });

    setSelectedProduct(null);
    setDetailCartItemId(null);
    setDetailQty(1);
    setDetailNotes("");
  };

  const updateCartQuantity = (cartItemId, quantity) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId !== cartItemId) return item;
          const nextQty = Math.max(0, Number(quantity) || 0);
          if (!isUnlimitedStock(item) && nextQty > Number(item.stock || 0)) {
            alert("Jumlah melebihi stok yang tersedia.");
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeCartItem = (cartItemId) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const decreaseProductQuantity = (productId) => {
    setCart((prev) => {
      const regularIndex = prev.findIndex((item) => item.id === productId && !item.notes);
      const fallbackIndex = prev.findLastIndex((item) => item.id === productId);
      const targetIndex = regularIndex >= 0 ? regularIndex : fallbackIndex;

      if (targetIndex < 0) return prev;

      return prev
        .map((item, index) =>
          index === targetIndex ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0);
    });
  };

  const openProductDetail = (product) => {
    const productItems = cart.filter((item) => item.id === product.id);
    const editableItem =
      productItems.find((item) => !item.notes) ||
      (productItems.length === 1 ? productItems[0] : null);

    setSelectedProduct(product);
    setDetailCartItemId(editableItem?.cartItemId || null);
    setDetailQty(editableItem?.quantity || 1);
    setDetailNotes(editableItem?.notes || "");
  };

  const closeProductDetail = () => {
    setSelectedProduct(null);
    setDetailCartItemId(null);
    setDetailQty(1);
    setDetailNotes("");
  };

  const saveProductDetail = () => {
    if (!selectedProduct) return;

    const quantity = Math.max(0, Number(detailQty) || 0);
    const cleanNotes = String(detailNotes || "").trim();
    const cartItemId = `${selectedProduct.id}-${cleanNotes.toLowerCase() || "regular"}`;
    const otherProductQty = cart
      .filter((item) => item.id === selectedProduct.id && item.cartItemId !== detailCartItemId)
      .reduce((sum, item) => sum + item.quantity, 0);

    if (
      !isUnlimitedStock(selectedProduct) &&
      otherProductQty + quantity > Number(selectedProduct.stock || 0)
    ) {
      alert("Jumlah melebihi stok yang tersedia.");
      return;
    }

    setCart((prev) => {
      const withoutEditedItem = detailCartItemId
        ? prev.filter((item) => item.cartItemId !== detailCartItemId)
        : prev;

      if (quantity === 0) return withoutEditedItem;

      const sameItem = withoutEditedItem.find((item) => item.cartItemId === cartItemId);
      if (sameItem) {
        return withoutEditedItem.map((item) =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [
        ...withoutEditedItem,
        {
          cartItemId,
          id: selectedProduct.id,
          packageId: selectedProduct.packageId || null,
          name: selectedProduct.name,
          categoryName: selectedProduct.category?.name || null,
          price: Number(selectedProduct.price),
          imageUrl: selectedProduct.imageUrl,
          stock: selectedProduct.stock,
          isUnlimitedStock: selectedProduct.isUnlimitedStock,
          quantity,
          notes: cleanNotes,
        },
      ];
    });

    closeProductDetail();
  };

  const submitTableOrder = async () => {
    if (!isTableMode) {
      alert("Fitur order meja sedang tidak aktif.");
      return;
    }
    if (!tableNumber) {
      alert("Nomor meja tidak ditemukan.");
      return;
    }
    if (cart.length === 0) {
      alert("Keranjang masih kosong.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/catalog/table-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber,
          customerName,
          note: orderNote,
          items: cart.map((item) => ({
            productId: item.id,
            packageId: item.packageId || null,
            qty: item.quantity,
            notes: item.notes || null,
          })),
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Gagal mengirim order.");

      setOrderSuccess(json.data);
      setCart([]);
      setShowCart(false);
      setCustomerName("");
      setOrderNote("");
    } catch (error) {
      alert(error.message || "Gagal mengirim order.");
    } finally {
      setSubmitting(false);
    }
  };

  const openWhatsApp = (product) => {
    let phone = settings?.phone || "";
    if (!phone) {
      alert("Nomor WhatsApp toko belum diatur.");
      return;
    }
    if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
    phone = phone.replace(/\D/g, "");
    const message = product
      ? `Halo, saya ingin bertanya tentang produk *${product.name}* (Harga: ${formatRupiah(product.price)}).`
      : "Halo, saya ingin bertanya tentang katalog toko Anda.";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="h-20 bg-white border border-stone-100 rounded-2xl animate-pulse" />
          <div className="h-12 bg-white border border-stone-100 rounded-2xl animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-28 bg-white border border-stone-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center px-6 text-center">
        <div className="w-full max-w-sm bg-white border border-stone-100 rounded-2xl p-6 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} />
          </div>
          <h1 className="text-lg font-black text-gray-900">Katalog belum terbuka</h1>
          <p className="text-sm text-gray-500 mt-2">{loadError}</p>
          <button
            type="button"
            onClick={fetchCatalog}
            className="mt-5 w-full h-11 rounded-xl bg-gray-900 text-white font-bold"
          >
            Muat Ulang
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-gray-900 pb-28">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center shrink-0">
              {settings?.logoUrl ? (
                <img src={getImageUrl(settings.logoUrl)} alt="Logo toko" className="w-full h-full object-cover" />
              ) : (
                <Utensils size={23} className="text-stone-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-gray-950 leading-tight truncate">
                {settings?.storeName || "Menu"}
              </h1>
              <p className="text-xs text-gray-500 truncate">
                {isTableMode ? "Pesanan meja" : settings?.address || "Katalog toko"}
              </p>
            </div>
            {isTableMode && (
              <div className="px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm font-black">
                Meja {tableNumber}
              </div>
            )}
          </div>

          {isTableMode && (
            <div className="mt-4 grid grid-cols-3 rounded-2xl bg-stone-100 border border-stone-200 p-1 text-[11px] font-black text-center">
              <div className="py-2 rounded-xl bg-white shadow-sm text-gray-950">Pilih</div>
              <div className="py-2 rounded-xl text-gray-500">Review</div>
              <div className="py-2 rounded-xl text-gray-500">Kirim</div>
            </div>
          )}

          {tableOrderRequested && settings && !settings.enableTableOrder && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              Order meja sedang tidak aktif. Katalog ditampilkan dalam mode publik biasa.
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-stone-100 border border-stone-200 px-3 h-12">
            <Search size={18} className="text-gray-400 shrink-0" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari menu"
              className="bg-transparent outline-none flex-1 text-sm font-semibold placeholder:text-gray-400"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="p-1 text-gray-400">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {[{ id: "All", name: "Semua" }, ...categories].map((category) => {
            const id = String(category.id);
            const active = selectedCategory === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedCategory(id)}
                className={`shrink-0 h-10 px-4 rounded-full border text-sm font-bold ${
                  active
                    ? "bg-gray-950 text-white border-gray-950"
                    : "bg-white text-gray-600 border-stone-200"
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 pt-2">
        {filteredProducts.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-gray-400">
            <ShoppingBag size={46} className="mb-3 opacity-60" />
            <p className="font-bold">Menu tidak ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredProducts.map((product) => {
              const imageUrl = getImageUrl(product.imageUrl);
              const qtyInCart = getProductCartQty(product.id);
              const available = isProductAvailable(product);

              return (
                <article
                  key={product.id}
                  onClick={() => openProductDetail(product)}
                  className="bg-white border border-stone-200 rounded-2xl p-3 flex gap-3 shadow-sm active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="w-24 h-24 rounded-2xl bg-stone-100 border border-stone-100 overflow-hidden flex items-center justify-center shrink-0">
                    {imageUrl ? (
                      <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={28} className="text-stone-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-gray-400 truncate">
                        {product.category?.name || "Menu"}
                      </p>
                      <h2 className="font-black text-gray-950 leading-snug mt-0.5 line-clamp-2">
                        {product.name}
                      </h2>
                      <p className="text-xs font-bold text-gray-500 mt-1">{getStockLabel(product)}</p>
                      {product.isDiscountActive && (
                        <span className="inline-flex mt-1 px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-black uppercase">
                          {product.discountLabel || "Promo"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-end justify-between gap-3 mt-2">
                      <div>
                        {product.isDiscountActive && <p className="text-[10px] text-gray-400 line-through">{formatRupiah(product.originalPrice)}</p>}
                        <p className={`font-black ${product.isDiscountActive ? 'text-red-600' : 'text-gray-950'}`}>{formatRupiah(product.price)}</p>
                      </div>
                      {isTableMode ? (
                        qtyInCart > 0 ? (
                          <div
                            className="h-10 flex items-center rounded-xl border border-emerald-700 overflow-hidden"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => decreaseProductQuantity(product.id)}
                              className="w-10 h-10 flex items-center justify-center text-emerald-800 active:bg-emerald-50"
                              aria-label={`Kurangi ${product.name}`}
                            >
                              <Minus size={17} />
                            </button>
                            <span className="w-8 text-center text-sm font-black text-gray-950">
                              {qtyInCart}
                            </span>
                            <button
                              type="button"
                              disabled={!available || (!isUnlimitedStock(product) && qtyInCart >= Number(product.stock || 0))}
                              onClick={() => addToCart(product)}
                              className="w-10 h-10 flex items-center justify-center bg-emerald-700 text-white disabled:bg-gray-300"
                              aria-label={`Tambah ${product.name}`}
                            >
                              <Plus size={17} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!available}
                            onClick={(event) => {
                              event.stopPropagation();
                              addToCart(product);
                            }}
                            className="h-10 w-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center disabled:bg-gray-300"
                            aria-label={`Tambah ${product.name}`}
                          >
                            <Plus size={18} />
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openWhatsApp(product);
                          }}
                          className="h-10 w-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center"
                        >
                          <MessageCircle size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end"
          role="dialog"
          aria-modal="true"
          aria-label="Detail menu"
        >
          <div className="w-full bg-white rounded-t-3xl max-h-[88vh] overflow-y-auto">
            <div className="max-w-3xl mx-auto">
              <div className="p-4 flex items-center justify-between border-b border-stone-100">
                <button type="button" onClick={closeProductDetail} className="p-2 rounded-full bg-stone-100">
                  <ChevronLeft size={20} />
                </button>
                <p className="font-black">Detail Menu</p>
                <button type="button" onClick={closeProductDetail} className="p-2 rounded-full bg-stone-100">
                  <X size={18} />
                </button>
              </div>

              <div className="p-4">
                <div className="aspect-[4/3] rounded-3xl bg-stone-100 border border-stone-100 overflow-hidden flex items-center justify-center">
                  {getImageUrl(selectedProduct.imageUrl) ? (
                    <img
                      src={getImageUrl(selectedProduct.imageUrl)}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={54} className="text-stone-300" />
                  )}
                </div>

                <div className="pt-4">
                  <p className="text-xs font-bold text-emerald-700">{selectedProduct.category?.name || "Menu"}</p>
                  <h2 className="text-2xl font-black text-gray-950 mt-1">{selectedProduct.name}</h2>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <div>
                      {selectedProduct.isDiscountActive && <p className="text-xs text-gray-400 line-through">{formatRupiah(selectedProduct.originalPrice)}</p>}
                      <p className={`text-xl font-black ${selectedProduct.isDiscountActive ? 'text-red-600' : ''}`}>{formatRupiah(selectedProduct.price)}</p>
                    </div>
                    <span className="text-xs font-bold rounded-full bg-stone-100 px-3 py-1.5 text-gray-600">
                      {getStockLabel(selectedProduct)}
                    </span>
                  </div>
                </div>

                {isTableMode ? (
                  <div className="pt-5 space-y-3">
                    <textarea
                      value={detailNotes}
                      onChange={(event) => setDetailNotes(event.target.value)}
                      placeholder="Catatan item"
                      rows={2}
                      className="w-full rounded-2xl bg-stone-50 border border-stone-200 px-4 py-3 text-sm outline-none focus:border-emerald-600 resize-none"
                    />

                    <div className="flex items-center gap-3">
                      <div className="h-12 flex items-center border border-stone-200 rounded-2xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setDetailQty((prev) => Math.max(0, prev - 1))}
                          className="w-12 h-12 flex items-center justify-center text-gray-600"
                          aria-label={`Kurangi ${selectedProduct.name}`}
                        >
                          <Minus size={18} />
                        </button>
                        <div className="w-12 text-center font-black">{detailQty}</div>
                        <button
                          type="button"
                          onClick={() =>
                            setDetailQty((prev) =>
                              Math.min(isUnlimitedStock(selectedProduct) ? 999 : Number(selectedProduct.stock || 1), prev + 1)
                            )
                          }
                          className="w-12 h-12 flex items-center justify-center text-gray-600"
                          aria-label={`Tambah ${selectedProduct.name}`}
                        >
                          <Plus size={18} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={saveProductDetail}
                        className={`h-12 flex-1 rounded-2xl text-white font-black flex items-center justify-center gap-2 ${
                          detailQty === 0
                            ? detailCartItemId
                              ? "bg-red-600"
                              : "bg-gray-700"
                            : "bg-emerald-700"
                        }`}
                      >
                        {detailQty === 0 ? (
                          detailCartItemId ? <Trash2 size={18} /> : <X size={18} />
                        ) : detailCartItemId ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <Plus size={18} />
                        )}
                        {detailQty === 0
                          ? detailCartItemId
                            ? "Hapus dari pesanan"
                            : "Tidak jadi pilih"
                          : `${detailCartItemId ? "Simpan" : "Tambah"} ${formatRupiah(
                              Number(selectedProduct.price) * detailQty
                            )}`}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openWhatsApp(selectedProduct)}
                    className="mt-5 w-full h-12 rounded-2xl bg-green-600 text-white font-black flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={18} />
                    Pesan via WhatsApp
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isTableMode && cart.length > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 px-4 py-3 shadow-2xl">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-500">{cartItemCount} item dipilih</p>
              <p className="font-black text-gray-950">{formatRupiah(cartTotal)}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCart(true)}
              className="h-12 px-5 rounded-2xl bg-gray-950 text-white font-black flex items-center gap-2"
            >
              Review
              <ShoppingBag size={18} />
            </button>
          </div>
        </div>
      )}

      {isTableMode && showCart && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
          <div className="w-full bg-white rounded-t-3xl max-h-[92vh] flex flex-col">
            <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col min-h-0">
              <div className="px-4 py-4 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-gray-950">Review Pesanan</h2>
                  <p className="text-xs text-gray-500">Meja {tableNumber}</p>
                </div>
                <button type="button" onClick={() => setShowCart(false)} className="p-2 rounded-full bg-stone-100">
                  <X size={18} />
                </button>
              </div>

              <div className="px-4 pt-4">
                <div className="grid grid-cols-3 rounded-2xl bg-stone-100 border border-stone-200 p-1 text-[11px] font-black text-center">
                  <div className="py-2 rounded-xl text-gray-500">Pilih</div>
                  <div className="py-2 rounded-xl bg-white shadow-sm text-gray-950">Review</div>
                  <div className="py-2 rounded-xl text-gray-500">Kirim</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                {cart.map((item) => (
                  <div key={item.cartItemId} className="py-3 border-b border-stone-100 flex gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-sm text-gray-950 truncate">{item.name}</h3>
                      {item.notes && <p className="text-xs text-emerald-700 mt-0.5 truncate">{item.notes}</p>}
                      <p className="text-xs font-bold text-gray-500 mt-1">{formatRupiah(item.price)}</p>
                    </div>
                    <div className="flex items-center h-10 border border-stone-200 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.cartItemId, item.quantity - 1)}
                        className="w-9 h-10 flex items-center justify-center text-gray-600"
                      >
                        <Minus size={15} />
                      </button>
                      <span className="w-8 text-center font-black text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.cartItemId, item.quantity + 1)}
                        className="w-9 h-10 flex items-center justify-center text-gray-600"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCartItem(item.cartItemId)}
                      className="h-10 w-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}

                <div className="pt-4 space-y-3">
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Nama pelanggan"
                    className="w-full h-12 rounded-2xl bg-stone-50 border border-stone-200 px-4 text-sm outline-none focus:border-emerald-600"
                  />
                  <textarea
                    value={orderNote}
                    onChange={(event) => setOrderNote(event.target.value)}
                    placeholder="Catatan pesanan"
                    rows={3}
                    className="w-full rounded-2xl bg-stone-50 border border-stone-200 px-4 py-3 text-sm outline-none focus:border-emerald-600 resize-none"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-stone-100 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-gray-500">Total</span>
                  <span className="text-xl font-black text-gray-950">{formatRupiah(cartTotal)}</span>
                </div>
                <button
                  type="button"
                  onClick={submitTableOrder}
                  disabled={submitting || cart.length === 0}
                  className="w-full h-14 rounded-2xl bg-emerald-700 disabled:bg-gray-300 text-white font-black flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  {submitting ? "Mengirim..." : "Kirim ke Kasir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {orderSuccess && (
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center px-6">
          <div className="w-full max-w-sm text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-5">
              <ClipboardCheck size={40} />
            </div>
            <h2 className="text-2xl font-black text-gray-950">Order Terkirim</h2>
            <p className="text-sm text-gray-500 mt-2">Meja {orderSuccess.tableNumber}</p>
            <div className="mt-5 rounded-3xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs font-bold text-gray-500">Nomor Antrean</p>
              <p className="text-3xl font-black text-emerald-700 mt-1">{orderSuccess.queueLabel || "-"}</p>
              <div className="h-px bg-stone-200 my-4" />
              <p className="text-xs font-bold text-gray-500">Kode Order</p>
              <p className="font-black text-gray-950 mt-1">{orderSuccess.orderCode}</p>
              <div className="h-px bg-stone-200 my-4" />
              <p className="text-xs font-bold text-gray-500">Total</p>
              <p className="text-xl font-black text-gray-950 mt-1">{formatRupiah(orderSuccess.grandTotal)}</p>
            </div>
            <div className="mt-5 flex items-center justify-center gap-2 text-sm font-bold text-emerald-700">
              <CheckCircle2 size={18} />
              Masuk ke kasir
            </div>
            <button
              type="button"
              onClick={() => setOrderSuccess(null)}
              className="mt-7 w-full h-12 rounded-2xl bg-gray-950 text-white font-black"
            >
              Tambah Pesanan
            </button>
          </div>
        </div>
      )}

      {!isTableMode && (
        <button
          type="button"
          onClick={() => openWhatsApp(null)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-green-600 text-white rounded-full flex items-center justify-center shadow-xl z-40"
        >
          <MessageCircle size={28} />
        </button>
      )}
    </main>
  );
}
