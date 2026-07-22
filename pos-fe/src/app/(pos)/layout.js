"use client";

import AuthGuard from '@/components/AuthGuard';

export default function PosLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
