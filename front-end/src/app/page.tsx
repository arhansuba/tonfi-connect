import React from "react";
import Bridge from "@/pages/Bridge";
import Swap from "@/pages/Swap";
import BridgeForm from "@/components/BridgeForm";
import  {SwapForm} from "@/components/SwapForm";
import PriceChart from "@/components/PriceChart";

export default function Home() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Welcome to TONFi Connect</h1>
      <p className="mb-8">
        TONFi Connect is your gateway to seamless liquidity aggregation and cross-chain bridging on the TON ecosystem. Explore our features below.
      </p>

      {/* Swap Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Swap</h2>
        <SwapForm />
        <PriceChart tokenPair={{ from: 'TON', to: 'USDT' }} /> 
      </div>

      {/* Bridge Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Bridge</h2>
        <BridgeForm />
      </div>

      {/* Advanced Sections */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Advanced Features</h2>
        <p className="mb-8">
          Explore intelligent routing, secure cross-chain transfers, and AI-powered features designed to optimize your trading experience.
        </p>
        <Bridge />
        <Swap />
      </div>
    </div>
  );
}
