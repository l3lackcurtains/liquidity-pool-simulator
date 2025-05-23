'use client'

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const LiquidityPoolSimulator = () => {
  const [pool, setPool] = useState({
    token1Symbol: 'USDC',
    token2Symbol: '',
    token1Amount: 1000000,
    token2Amount: 1000000,
    token1Reserve: 1000000,
    token2Reserve: 1000000
  });

  const [trade, setTrade] = useState({
    type: 'buy',
    amount: 0
  });

  const [priceHistory, setPriceHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Calculate current prices
  const getCurrentPrices = () => {
    const token2PerToken1 = pool.token1Reserve / pool.token2Reserve;
    const token1PerToken2 = pool.token2Reserve / pool.token1Reserve;
    return {
      token2PerToken1: token2PerToken1,
      token1PerToken2: token1PerToken2
    };
  };

  useEffect(() => {
    const prices = getCurrentPrices();
    setPriceHistory(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      price: prices.token2PerToken1
    }].slice(-10));
  }, [pool.token1Reserve, pool.token2Reserve]);

  const getK = () => pool.token1Reserve * pool.token2Reserve;

  const calculatePriceImpact = (inputAmount, inputReserve, outputReserve) => {
    const k = getK();
    const newOutputAmount = outputReserve - (k / (inputReserve + parseFloat(inputAmount)));
    const priceImpact = (newOutputAmount / outputReserve) * 100;
    return priceImpact.toFixed(2);
  };

  const calculateOutputAmount = (inputAmount, inputReserve, outputReserve) => {
    const k = getK();
    const newInputReserve = inputReserve + parseFloat(inputAmount);
    const newOutputReserve = k / newInputReserve;
    return outputReserve - newOutputReserve;
  };

  const simulateTrade = () => {
    const k = getK();
    let newToken1Reserve = pool.token1Reserve;
    let newToken2Reserve = pool.token2Reserve;
    let outputAmount = 0;

    if (trade.type === 'buy') {
      newToken1Reserve += Number(trade.amount);
      newToken2Reserve = k / newToken1Reserve;
      outputAmount = pool.token2Reserve - newToken2Reserve;
    } else {
      newToken2Reserve += Number(trade.amount);
      newToken1Reserve = k / newToken2Reserve;
      outputAmount = pool.token1Reserve - newToken1Reserve;
    }

    // Record the transaction with current price
    const currentPrices = getCurrentPrices();
    const newTransaction = {
      timestamp: new Date().toLocaleTimeString(),
      type: trade.type,
      inputAmount: Number(trade.amount),
      inputToken: trade.type === 'buy' ? 'USDC' : pool.token2Symbol,
      outputAmount: outputAmount,
      outputToken: trade.type === 'buy' ? pool.token2Symbol : 'USDC',
      price: trade.type === 'buy' ? currentPrices.token2PerToken1 : currentPrices.token1PerToken2
    };

    setTransactions(prev => [newTransaction, ...prev].slice(0, 10)); // Keep last 10 transactions

    setPool(prev => ({
      ...prev,
      token1Reserve: newToken1Reserve,
      token2Reserve: newToken2Reserve
    }));

    return outputAmount;
  };

  const prices = getCurrentPrices();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Liquidity Pool Simulator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Prices Display */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-100 rounded-lg">
          <div className="space-y-2">
            <div className="font-semibold">Current Prices:</div>
            <div>1 {pool.token1Symbol} = {prices.token1PerToken2.toFixed(6)} {pool.token2Symbol || 'Token'}</div>
            <div>1 {pool.token2Symbol || 'Token'} = {prices.token2PerToken1.toFixed(6)} {pool.token1Symbol}</div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold">Expected Output:</div>
            {trade.amount > 0 && (
              <div>
                {trade.type === 'buy' ? (
                  <div>
                    {trade.amount} {pool.token1Symbol} →{' '}
                    {calculateOutputAmount(
                      trade.amount,
                      pool.token1Reserve,
                      pool.token2Reserve
                    ).toFixed(6)}{' '}
                    {pool.token2Symbol || 'Token'}
                  </div>
                ) : (
                  <div>
                    {trade.amount} {pool.token2Symbol || 'Token'} →{' '}
                    {calculateOutputAmount(
                      trade.amount,
                      pool.token2Reserve,
                      pool.token1Reserve
                    ).toFixed(6)}{' '}
                    {pool.token1Symbol}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Transaction History */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-4">Transaction History</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Input</th>
                  <th className="text-left p-2">Output</th>
                  <th className="text-left p-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{tx.timestamp}</td>
                    <td className="p-2 capitalize">{tx.type}</td>
                    <td className="p-2">
                      {tx.inputAmount.toFixed(6)} {tx.inputToken}
                    </td>
                    <td className="p-2">
                      {tx.outputAmount.toFixed(6)} {tx.outputToken}
                    </td>
                    <td className="p-2">
                      1 {tx.type === 'buy' ? 'USDC' : tx.outputToken} = {tx.price.toFixed(6)} {tx.type === 'buy' ? tx.outputToken : 'USDC'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Price Chart */}
        <div className="w-full h-64">
          <LineChart
            width={700}
            height={200}
            data={priceHistory}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="price" stroke="#8884d8" />
          </LineChart>
        </div>

        {/* Pool Configuration */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Token 1 (Fixed: USDC)</Label>
            <Input 
              value={pool.token1Symbol} 
              disabled 
            />
            <Label>Initial USDC Amount</Label>
            <Input 
              type="number"
              value={pool.token1Amount}
              onChange={e => setPool(prev => ({
                ...prev,
                token1Amount: Number(e.target.value),
                token1Reserve: Number(e.target.value)
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Token 2 Symbol</Label>
            <Input 
              value={pool.token2Symbol}
              onChange={e => setPool(prev => ({
                ...prev,
                token2Symbol: e.target.value
              }))}
              placeholder="Enter token symbol"
            />
            <Label>Initial Token Amount</Label>
            <Input 
              type="number"
              value={pool.token2Amount}
              onChange={e => setPool(prev => ({
                ...prev,
                token2Amount: Number(e.target.value),
                token2Reserve: Number(e.target.value)
              }))}
            />
          </div>
        </div>

        {/* Trade Simulation */}
        <div className="space-y-4">
          <div className="flex space-x-4">
            <Button 
              onClick={() => setTrade(prev => ({...prev, type: 'buy'}))}
              variant={trade.type === 'buy' ? 'default' : 'outline'}
            >
              Buy {pool.token2Symbol || 'Token'}
            </Button>
            <Button 
              onClick={() => setTrade(prev => ({...prev, type: 'sell'}))}
              variant={trade.type === 'sell' ? 'default' : 'outline'}
            >
              Sell {pool.token2Symbol || 'Token'}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Trade Amount ({trade.type === 'buy' ? 'USDC' : pool.token2Symbol || 'Token'})</Label>
            <Input 
              type="number"
              value={trade.amount}
              onChange={e => setTrade(prev => ({...prev, amount: e.target.value}))}
              placeholder="Enter amount to trade"
            />
          </div>

          <Button 
            onClick={() => {
              const output = simulateTrade();
              alert(`Trade executed!\nOutput: ${output.toFixed(6)} ${trade.type === 'buy' ? pool.token2Symbol || 'Token' : 'USDC'}`);
            }}
            className="w-full"
          >
            Simulate Trade
          </Button>
        </div>

        {/* Pool Statistics */}
        <div className="space-y-2 border rounded-lg p-4">
          <h3 className="font-semibold">Pool Statistics</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>USDC Reserve: {pool.token1Reserve.toFixed(2)}</div>
            <div>{pool.token2Symbol || 'Token'} Reserve: {pool.token2Reserve.toFixed(2)}</div>
            <div>Constant Product (k): {getK().toFixed(2)}</div>
            <div>Price Impact: {calculatePriceImpact(
              Number(trade.amount),
              trade.type === 'buy' ? pool.token1Reserve : pool.token2Reserve,
              trade.type === 'buy' ? pool.token2Reserve : pool.token1Reserve
            )}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LiquidityPoolSimulator;