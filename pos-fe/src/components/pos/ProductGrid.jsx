"use client";

import React, { useState, useEffect } from 'react';
import { Package, Utensils } from 'lucide-react';

const ProductSkeleton = () => (
    <div className="bg-white rounded-xl lg:rounded-2xl p-2 lg:p-3 border border-gray-100 flex flex-col h-full animate-pulse">
        <div className="relative h-28 lg:h-36 w-full rounded-lg lg:rounded-xl bg-gray-100 mb-2 lg:mb-3"></div>
        <div className="flex-1 flex flex-col space-y-2">
            <div className="h-2 w-12 bg-gray-100 rounded"></div>
            <div className="h-4 w-full bg-gray-200 rounded"></div>
            <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
            <div className="mt-auto flex justify-between items-end pt-2">
                <div className="h-5 w-16 bg-gray-100 rounded"></div>
                <div className="h-3 w-10 bg-gray-50 rounded"></div>
            </div>
        </div>
    </div>
);

const ProductCard = ({ product, addToCart, getImageUrl }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 300);
        return () => clearTimeout(timer);
    }, []);

    if (!isLoaded) return <ProductSkeleton />;

    return (
        <div
            onClick={() => addToCart(product)}
            className={`group bg-white rounded-xl lg:rounded-2xl p-2 lg:p-3 cursor-pointer hover:shadow-xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300 border border-gray-100 flex flex-col h-full relative overflow-hidden animate-in fade-in duration-500 ${product.stock <= 0 && !product.isUnlimitedStock ? 'opacity-60 grayscale cursor-not-allowed' : ''}`}
        >
            <div className="relative h-28 lg:h-36 w-full rounded-lg lg:rounded-xl overflow-hidden mb-2 lg:mb-3 bg-gray-100">
                {product.imageUrl ? (
                    <img
                        src={getImageUrl(product.imageUrl)}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                        <Utensils size={32} />
                    </div>
                )}

                {product.stock <= 0 && !product.isUnlimitedStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-sm bg-red-500 px-2 py-1 rounded">HABIS</span>
                    </div>
                )}
                {product.isDiscountActive && (
                    <span className="absolute top-2 right-2 px-2 py-1 rounded-md bg-red-600 text-white text-[9px] font-black uppercase">
                        {product.discountLabel || 'Promo'}
                    </span>
                )}
            </div>
            <div className="flex-1 flex flex-col">
                <p className="text-[9px] lg:text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5 lg:mb-1">
                    {product.category ? product.category.name : 'Umum'}
                </p>
                <h3 className="font-bold text-gray-800 text-xs lg:text-sm leading-snug mb-1 lg:mb-2 line-clamp-2">{product.name}</h3>
                <div className="mt-auto flex justify-between items-end">
                    <div>
                        {product.isDiscountActive && (
                            <p className="text-gray-400 line-through text-[9px]">Rp {Number(product.originalPrice).toLocaleString('id-ID')}</p>
                        )}
                        <p className={`${product.isDiscountActive ? 'text-red-600' : 'text-blue-600'} font-bold text-sm lg:text-base`}>
                            Rp {Number(product.price).toLocaleString('id-ID')}
                        </p>
                    </div>
                    <span className={`text-[10px] font-medium ${product.stock < 5 && !product.isUnlimitedStock ? 'text-red-500' : 'text-gray-400'}`}>
                        Stok: {product.isUnlimitedStock ? '∞' : product.stock}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default function ProductGrid({ products, addToCart, getImageUrl }) {
    if (products.length === 0) {
        return   (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Package size={48} className="mb-2 opacity-50" />
                <p>Tidak ada produk ditemukan</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-5">
            {products.map(product => (
                <ProductCard
                    key={product.id}
                    product={product}
                    addToCart={addToCart}
                    getImageUrl={getImageUrl}
                />
            ))}
        </div>
    );
}
