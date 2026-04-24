import React from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import GlobalPaywall from "@/components/GlobalPaywall";

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <GlobalPaywall /> {/* 🔥 GLOBAL PAYWALL */}
    </>
  );
}