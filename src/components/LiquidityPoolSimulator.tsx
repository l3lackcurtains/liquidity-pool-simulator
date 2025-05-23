'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface PoolState {
  token1Symbol: string;
  token2Symbol: string;
  token1Reserve: number;
  token2Reserve: number;
  token1Price: number;
  token2TotalSupply: number;
}

interface TradeState {
  type: 'buy' | 'sell';
  amount: number;
}

interface LiquidityState {
  type: 'add' | 'remove';
  token1Amount: number;
  token2Amount: number;
}

interface PriceHistoryItem {
  timestamp: string;
  price: number;
  priceUSD: number;
}

interface Transaction {
  timestamp: string;
  type: 'buy' | 'sell' | 'add_liquidity' | 'remove_liquidity';
  inputAmount: number;
  inputToken: string;
  outputAmount: number;
  outputToken: string;
  price: number;
  token1Amount?: number;
  token2Amount?: number;
}

const LiquidityPoolSimulator = () => {
  const [pool, setPool] = useState<PoolState>({
    token1Symbol: 'ETH',
    token2Symbol: 'SILK',
    token1Reserve: 3.8,
    token2Reserve: 10_000_000,
    token1Price: 2700,
    token2TotalSupply: 1_000_000_000 // 1 billion default
  });

  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [batchTrades, setBatchTrades] = useState<TradeState[]>([
    { type: 'buy', amount: 0 }
  ]);
  const [liquidityOperations, setLiquidityOperations] = useState<LiquidityState[]>([
    { type: 'add', token1Amount: 0, token2Amount: 0 }
  ]);
  const [inputsLocked, setInputsLocked] = useState(false);

  // Calculate current price (token2 per token1)
  const getCurrentPrice = () => {
    return pool.token2Reserve / pool.token1Reserve;
  };

  // Calculate token2 price in USD
  const getToken2PriceUSD = () => {
    const token2PerToken1 = getCurrentPrice();
    return pool.token1Price / token2PerToken1;
  };

  // Calculate slippage percentage
  const getSlippagePercentage = () => {
    const currentPrice = getCurrentPrice();
    const marketPrice = pool.token1Price; // ETH price in USD
    const token2PriceUSD = getToken2PriceUSD();
    
    // Calculate implied ETH price from token2 perspective
    const impliedETHPrice = token2PriceUSD * currentPrice;
    const slippage = ((impliedETHPrice - marketPrice) / marketPrice) * 100;
    return slippage;
  };

  useEffect(() => {
    const price = getCurrentPrice();
    const priceUSD = getToken2PriceUSD();
    setPriceHistory(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      price: price,
      priceUSD: priceUSD
    }].slice(-20)); // Keep more history for better chart
  }, [pool.token1Reserve, pool.token2Reserve, pool.token1Price]);

  const getK = () => pool.token1Reserve * pool.token2Reserve;

  // AMM formula: (x + Δx)(y - Δy) = k
  // Δy = y - k/(x + Δx)
  const calculateOutputAmount = (inputAmount: number, inputReserve: number, outputReserve: number) => {
    if (inputAmount <= 0) return 0;
    const k = getK();
    const newInputReserve = inputReserve + inputAmount;
    const newOutputReserve = k / newInputReserve;
    return outputReserve - newOutputReserve;
  };

  const calculatePriceImpact = (inputAmount: number, inputReserve: number, outputReserve: number) => {
    if (inputAmount <= 0) return "0.00";
    
    const initialPrice = outputReserve / inputReserve;
    const outputAmount = calculateOutputAmount(inputAmount, inputReserve, outputReserve);
    const effectivePrice = outputAmount / inputAmount;
    const priceImpact = Math.abs((effectivePrice - initialPrice) / initialPrice) * 100;
    
    return priceImpact.toFixed(2);
  };

  // Validation function for token2 amounts
  const validateToken2Amount = (amount: number, operation: 'add' | 'remove' | 'sell') => {
    const availableSupply = pool.token2TotalSupply - pool.token2Reserve;
    
    if (operation === 'add' && amount > availableSupply) {
      return `Cannot add ${amount.toLocaleString()} ${pool.token2Symbol}. Only ${availableSupply.toLocaleString()} available from total supply.`;
    }
    
    if (operation === 'remove' && amount > pool.token2Reserve) {
      return `Cannot remove ${amount.toLocaleString()} ${pool.token2Symbol}. Only ${pool.token2Reserve.toLocaleString()} available in pool.`;
    }
    
    if (operation === 'sell' && amount > availableSupply) {
      return `Cannot sell ${amount.toLocaleString()} ${pool.token2Symbol}. Only ${availableSupply.toLocaleString()} available from circulating supply.`;
    }
    
    return null;
  };

  const addBatchTrade = () => {
    setBatchTrades(prev => [...prev, { type: 'buy', amount: 0 }]);
  };

  const removeBatchTrade = (index: number) => {
    setBatchTrades(prev => prev.filter((_, i) => i !== index));
  };

  const updateBatchTrade = (index: number, field: keyof TradeState, value: string | 'buy' | 'sell') => {
    setBatchTrades(prev => 
      prev.map((trade, i) => 
        i === index ? { 
          ...trade, 
          [field]: field === 'amount' ? Number(value) : value 
        } : trade
      )
    );
  };

  const addLiquidityOperation = () => {
    setLiquidityOperations(prev => [...prev, { type: 'add', token1Amount: 0, token2Amount: 0 }]);
  };

  const removeLiquidityOperation = (index: number) => {
    setLiquidityOperations(prev => prev.filter((_, i) => i !== index));
  };

  const updateLiquidityOperation = (index: number, field: keyof LiquidityState, value: string | 'add' | 'remove') => {
    setLiquidityOperations(prev => 
      prev.map((op, i) => 
        i === index ? { 
          ...op, 
          [field]: ['token1Amount', 'token2Amount'].includes(field) ? Number(value) : value 
        } : op
      )
    );
  };

  const calculateProportionalAmount = (token1Input: number, isToken1Primary: boolean) => {
    const currentRatio = pool.token2Reserve / pool.token1Reserve;
    if (isToken1Primary) {
      return token1Input * currentRatio;
    } else {
      return token1Input / currentRatio;
    }
  };

  const executeBatchTrades = () => {
    let currentPool = { ...pool };
    const results: Transaction[] = [];
    
    // Validate all trades first
    for (const batchTrade of batchTrades) {
      if (batchTrade.amount <= 0) continue;
      
      if (batchTrade.type === 'sell') {
        const validationError = validateToken2Amount(batchTrade.amount, 'sell');
        if (validationError) {
          alert(validationError);
          return [];
        }
      }
    }
    
    batchTrades.forEach(batchTrade => {
      if (batchTrade.amount <= 0) return;
      
      const k = currentPool.token1Reserve * currentPool.token2Reserve;
      let newToken1Reserve = currentPool.token1Reserve;
      let newToken2Reserve = currentPool.token2Reserve;
      let outputAmount = 0;

      if (batchTrade.type === 'buy') {
        // Buying token2 with token1 (ETH)
        newToken1Reserve += batchTrade.amount;
        newToken2Reserve = k / newToken1Reserve;
        outputAmount = currentPool.token2Reserve - newToken2Reserve;
      } else {
        // Selling token2 for token1 (ETH)
        newToken2Reserve += batchTrade.amount;
        newToken1Reserve = k / newToken2Reserve;
        outputAmount = currentPool.token1Reserve - newToken1Reserve;
      }

      const currentPrice = currentPool.token2Reserve / currentPool.token1Reserve;
      
      const newTransaction: Transaction = {
        timestamp: new Date().toLocaleTimeString(),
        type: batchTrade.type,
        inputAmount: batchTrade.amount,
        inputToken: batchTrade.type === 'buy' ? pool.token1Symbol : pool.token2Symbol,
        outputAmount: outputAmount,
        outputToken: batchTrade.type === 'buy' ? pool.token2Symbol : pool.token1Symbol,
        price: currentPrice
      };
      
      results.push(newTransaction);
      currentPool = {
        ...currentPool,
        token1Reserve: newToken1Reserve,
        token2Reserve: newToken2Reserve
      };
    });
    
    // Update pool state
    setPool(currentPool);
    
    // Add transactions to history
    setTransactions(prev => [...results, ...prev].slice(0, 10));
    
    return results;
  };

  const executeLiquidityOperations = () => {
    let currentPool = { ...pool };
    const results: Transaction[] = [];
    
    // Validate all operations first
    for (const liquidityOp of liquidityOperations) {
      if (liquidityOp.token1Amount <= 0 && liquidityOp.token2Amount <= 0) continue;
      
      if (liquidityOp.type === 'add') {
        const validationError = validateToken2Amount(liquidityOp.token2Amount, 'add');
        if (validationError) {
          alert(validationError);
          return [];
        }
      } else {
        const validationError = validateToken2Amount(liquidityOp.token2Amount, 'remove');
        if (validationError) {
          alert(validationError);
          return [];
        }
      }
    }
    
    liquidityOperations.forEach(liquidityOp => {
      if (liquidityOp.token1Amount <= 0 && liquidityOp.token2Amount <= 0) return;
      
      const currentPrice = currentPool.token2Reserve / currentPool.token1Reserve;
      
      if (liquidityOp.type === 'add') {
        // Add liquidity - both tokens are added proportionally
        const newToken1Reserve = currentPool.token1Reserve + liquidityOp.token1Amount;
        const newToken2Reserve = currentPool.token2Reserve + liquidityOp.token2Amount;
        
        const newTransaction: Transaction = {
          timestamp: new Date().toLocaleTimeString(),
          type: 'add_liquidity',
          inputAmount: liquidityOp.token1Amount,
          inputToken: pool.token1Symbol,
          outputAmount: liquidityOp.token2Amount,
          outputToken: pool.token2Symbol,
          price: currentPrice,
          token1Amount: liquidityOp.token1Amount,
          token2Amount: liquidityOp.token2Amount
        };
        
        results.push(newTransaction);
        currentPool = {
          ...currentPool,
          token1Reserve: newToken1Reserve,
          token2Reserve: newToken2Reserve
        };
        
      } else {
        // Remove liquidity - remove proportionally
        if (liquidityOp.token1Amount > currentPool.token1Reserve || 
            liquidityOp.token2Amount > currentPool.token2Reserve) {
          alert('Cannot remove more liquidity than available in pool');
          return;
        }
        
        const newToken1Reserve = currentPool.token1Reserve - liquidityOp.token1Amount;
        const newToken2Reserve = currentPool.token2Reserve - liquidityOp.token2Amount;
        
        if (newToken1Reserve <= 0 || newToken2Reserve <= 0) {
          alert('Cannot remove all liquidity from pool');
          return;
        }
        
        const newTransaction: Transaction = {
          timestamp: new Date().toLocaleTimeString(),
          type: 'remove_liquidity',
          inputAmount: liquidityOp.token1Amount,
          inputToken: pool.token1Symbol,
          outputAmount: liquidityOp.token2Amount,
          outputToken: pool.token2Symbol,
          price: currentPrice,
          token1Amount: liquidityOp.token1Amount,
          token2Amount: liquidityOp.token2Amount
        };
        
        results.push(newTransaction);
        currentPool = {
          ...currentPool,
          token1Reserve: newToken1Reserve,
          token2Reserve: newToken2Reserve
        };
      }
    });
    
    // Update pool state
    setPool(currentPool);
    
    // Add transactions to history
    setTransactions(prev => [...results, ...prev].slice(0, 20));
    
    return results;
  };

  const resetPool = () => {
    const initialToken2Reserve = 10_000_000; // Reset to original amount
    setPool(prev => ({
      ...prev,
      token1Reserve: 3.8,
      token2Reserve: initialToken2Reserve
    }));
    setPriceHistory([]);
    setTransactions([]);
    setInputsLocked(false); // Unlock inputs
  };

  const simulatePoolConfig = () => {
    // Lock inputs
    setInputsLocked(true);
    
    // Update price history with current values
    const price = getCurrentPrice();
    const priceUSD = getToken2PriceUSD();
    setPriceHistory(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      price: price,
      priceUSD: priceUSD
    }]);
  };

  const currentPrice = getCurrentPrice();
  const token2PriceUSD = getToken2PriceUSD();
  const marketCap = (pool.token2Reserve / pool.token2TotalSupply) * pool.token2TotalSupply * token2PriceUSD; // Corrected market cap calculation
  const slippagePercentage = getSlippagePercentage();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Liquidity Pool Simulator (AMM)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status Display */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-100 rounded-lg">
          <div className="space-y-2">
            <div className="font-semibold">Current Pool Price:</div>
            <div>1 {pool.token1Symbol} = {currentPrice.toFixed(2)} {pool.token2Symbol}</div>
            <div>1 {pool.token2Symbol} = ${token2PriceUSD.toFixed(6)} USD</div>
            <div className="text-sm">Market Cap: ${(marketCap / 1000000).toFixed(2)}M</div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold">Pool Reserves:</div>
            <div>{pool.token1Symbol}: {pool.token1Reserve.toFixed(4)}</div>
            <div>{pool.token2Symbol}: {pool.token2Reserve.toLocaleString()}</div>
            <div>K (Constant): {getK().toLocaleString()}</div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold">Market Reference:</div>
            <div>ETH Price: ${pool.token1Price.toFixed(2)}</div>
            <div>Slippage: {slippagePercentage.toFixed(2)}%</div>
            <div className="text-sm text-gray-600">
              Pool Liquidity: {((pool.token2Reserve / pool.token2TotalSupply) * 100).toFixed(2)}% of supply
            </div>
          </div>
        </div>

        {/* Pool Configuration and Price Chart */}
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 space-y-4">
            <h3 className="font-semibold">Pool Configuration</h3>
            <div className="space-y-2">
              <Label>Token 1 (ETH)</Label>
              <Input 
                value={pool.token1Symbol}
                disabled
                className="bg-gray-100"
              />
              <Label>Token 2 Symbol</Label>
              <Input 
                value={pool.token2Symbol}
                onChange={e => setPool(prev => ({
                  ...prev,
                  token2Symbol: e.target.value
                }))}
                disabled={inputsLocked}
              />
              <Label>Token 2 Total Supply</Label>
              <Input 
                type="number"
                value={pool.token2TotalSupply}
                onChange={e => setPool(prev => ({
                  ...prev,
                  token2TotalSupply: Number(e.target.value)
                }))}
                disabled={inputsLocked}
              />
              <Label>ETH Market Price (USD)</Label>
              <Input 
                type="number"
                value={pool.token1Price}
                onChange={e => setPool(prev => ({
                  ...prev,
                  token1Price: Number(e.target.value)
                }))}
                disabled={inputsLocked}
              />
              <Label>ETH Reserve (${(pool.token1Reserve * pool.token1Price).toLocaleString()})</Label>
              <Input 
                type="number"
                value={pool.token1Reserve}
                onChange={e => setPool(prev => ({
                  ...prev,
                  token1Reserve: Number(e.target.value)
                }))}
                disabled={inputsLocked}
              />
              <Label>{pool.token2Symbol} Reserve</Label>
              <Input 
                type="number"
                value={pool.token2Reserve}
                onChange={e => {
                  const newReserve = Number(e.target.value);
                  if (newReserve > pool.token2TotalSupply) {
                    alert(`Reserve cannot exceed total supply of ${pool.token2TotalSupply.toLocaleString()}`);
                    return;
                  }
                  setPool(prev => ({
                    ...prev,
                    token2Reserve: newReserve
                  }));
                }}
                disabled={inputsLocked}
              />
              <div className="text-sm text-gray-600">
                {((pool.token2Reserve / pool.token2TotalSupply) * 100).toFixed(2)}% of total supply in pool
                <br />
                Available: {(pool.token2TotalSupply - pool.token2Reserve).toLocaleString()} {pool.token2Symbol}
              </div>
              <div className="flex space-x-2 mt-2">
                <Button 
                  onClick={simulatePoolConfig} 
                  variant="default" 
                  className="flex-1"
                  disabled={inputsLocked}
                >
                  Simulate
                </Button>
                <Button 
                  onClick={resetPool} 
                  variant="outline" 
                  className="flex-1"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>

          <div className="col-span-3 space-y-4">
            <h3 className="font-semibold">{pool.token2Symbol} Price Chart (USD)</h3>
            <div className="w-full h-96">
              <LineChart
                width={600}
                height={380}
                data={priceHistory}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis 
                  tickFormatter={(value) => `$${value.toFixed(6)}`}
                />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toFixed(6)}`, `${pool.token2Symbol} Price`]}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="priceUSD" 
                  stroke="#8884d8" 
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </div>
            <div className="text-sm text-gray-600 text-center">
              Reference: 1 ETH = ${pool.token1Price} (Market Price)
              <br />
              Current {pool.token2Symbol} Price: ${token2PriceUSD.toFixed(6)} USD
            </div>
          </div>
        </div>

        {/* Liquidity Management */}
        <div className="space-y-4 border rounded-lg p-4">
          <h3 className="font-semibold">Liquidity Management</h3>
          
          {liquidityOperations.map((liquidityOp, index) => (
            <div key={index} className="space-y-3 border-b pb-4">
              <div className="flex space-x-2 items-end">
                <div className="flex-1">
                  <Label>Operation Type</Label>
                  <div className="flex space-x-2 mt-1">
                    <Button 
                      size="sm"
                      onClick={() => updateLiquidityOperation(index, 'type', 'add')}
                      variant={liquidityOp.type === 'add' ? 'default' : 'outline'}
                    >
                      Add Liquidity
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => updateLiquidityOperation(index, 'type', 'remove')}
                      variant={liquidityOp.type === 'remove' ? 'default' : 'outline'}
                    >
                      Remove Liquidity
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1">
                  <Label>{pool.token1Symbol} Amount (${(liquidityOp.token1Amount * pool.token1Price).toLocaleString()})</Label>
                  <Input 
                    type="number"
                    value={liquidityOp.token1Amount}
                    onChange={e => {
                      const token1Amount = Number(e.target.value);
                      updateLiquidityOperation(index, 'token1Amount', e.target.value);
                      // Auto-calculate proportional token2 amount
                      const proportionalToken2 = calculateProportionalAmount(token1Amount, true);
                      updateLiquidityOperation(index, 'token2Amount', proportionalToken2.toString());
                    }}
                    placeholder="Enter amount"
                  />
                </div>
                
                <div className="flex-1">
                  <Label>{pool.token2Symbol} Amount</Label>
                  <Input 
                    type="number"
                    value={liquidityOp.token2Amount}
                    onChange={e => {
                      const token2Amount = Number(e.target.value);
                      updateLiquidityOperation(index, 'token2Amount', e.target.value);
                      // Auto-calculate proportional token1 amount
                      const proportionalToken1 = calculateProportionalAmount(token2Amount, false);
                      updateLiquidityOperation(index, 'token1Amount', proportionalToken1.toString());
                    }}
                    placeholder="Enter amount"
                  />
                </div>
                
                <Button 
                  variant="destructive" 
                  size="icon"
                  onClick={() => removeLiquidityOperation(index)}
                  disabled={liquidityOperations.length === 1}
                >
                  ×
                </Button>
              </div>
              
              {/* Info below the row */}
              {liquidityOp.token1Amount > 0 && liquidityOp.token2Amount > 0 && (
                <div className="text-sm text-gray-500 pl-2 border-l-2 border-gray-200">
                  <div>Ratio: 1 {pool.token1Symbol} = {(liquidityOp.token2Amount / liquidityOp.token1Amount).toFixed(4)} {pool.token2Symbol}</div>
                  {liquidityOp.type === 'add' && liquidityOp.token2Amount > (pool.token2TotalSupply - pool.token2Reserve) && (
                    <div className="text-red-500">⚠️ Exceeds available supply</div>
                  )}
                </div>
              )}
            </div>
          ))}
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={addLiquidityOperation}
              className="flex-1"
            >
              Add Liquidity Operation
            </Button>
            
            <Button 
              onClick={() => {
                const results = executeLiquidityOperations();
                const validResults = results.filter(r => r.token1Amount && r.token1Amount > 0);
                if (validResults.length > 0) {
                  alert(`Executed ${validResults.length} liquidity operations successfully!`);
                }
              }}
              className="flex-1"
              disabled={liquidityOperations.every(op => (!op.token1Amount || Number(op.token1Amount) <= 0) && (!op.token2Amount || Number(op.token2Amount) <= 0))}
            >
              Execute Liquidity Operations
            </Button>
          </div>
        </div>

        {/* Trading Section */}
        <div className="space-y-4 border rounded-lg p-4">
          <h3 className="font-semibold">Trading</h3>
          
          {batchTrades.map((batchTrade, index) => (
            <div key={index} className="space-y-3 border-b pb-4">
              <div className="flex space-x-2 items-end">
                <div className="flex-1">
                  <Label>Trade Type</Label>
                  <div className="flex space-x-2 mt-1">
                    <Button 
                      size="sm"
                      onClick={() => updateBatchTrade(index, 'type', 'buy')}
                      variant={batchTrade.type === 'buy' ? 'default' : 'outline'}
                    >
                      Buy {pool.token2Symbol} (with ETH)
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => updateBatchTrade(index, 'type', 'sell')}
                      variant={batchTrade.type === 'sell' ? 'default' : 'outline'}
                    >
                      Sell {pool.token2Symbol} (for ETH)
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1">
                  <Label>
                    Amount ({batchTrade.type === 'buy' ? `ETH ($${(batchTrade.amount * pool.token1Price).toLocaleString()})` : pool.token2Symbol})
                  </Label>
                  <Input 
                    type="number"
                    value={batchTrade.amount}
                    onChange={e => updateBatchTrade(index, 'amount', e.target.value)}
                    placeholder="Enter amount"
                  />
                </div>
                
                <Button 
                  variant="destructive" 
                  size="icon"
                  onClick={() => removeBatchTrade(index)}
                  disabled={batchTrades.length === 1}
                >
                  ×
                </Button>
              </div>
              
              {/* Info below the row */}
              {batchTrade.amount > 0 && (
                <div className="text-sm text-gray-500 pl-2 border-l-2 border-gray-200">
                  <div>Expected: {calculateOutputAmount(
                    batchTrade.amount,
                    batchTrade.type === 'buy' ? pool.token1Reserve : pool.token2Reserve,
                    batchTrade.type === 'buy' ? pool.token2Reserve : pool.token1Reserve
                  ).toFixed(4)} {batchTrade.type === 'buy' ? pool.token2Symbol : 'ETH'}</div>
                  <div>Price Impact: {calculatePriceImpact(
                    batchTrade.amount,
                    batchTrade.type === 'buy' ? pool.token1Reserve : pool.token2Reserve,
                    batchTrade.type === 'buy' ? pool.token2Reserve : pool.token1Reserve
                  )}%</div>
                  <div className="text-blue-600">
                    Rate: 1 ETH = {batchTrade.type === 'buy' ? 
                      (calculateOutputAmount(batchTrade.amount, pool.token1Reserve, pool.token2Reserve) / batchTrade.amount).toFixed(2) :
                      (batchTrade.amount / calculateOutputAmount(batchTrade.amount, pool.token2Reserve, pool.token1Reserve)).toFixed(2)
                    } {pool.token2Symbol}
                  </div>
                  {batchTrade.type === 'sell' && batchTrade.amount > (pool.token2TotalSupply - pool.token2Reserve) && (
                    <div className="text-red-500">⚠️ Exceeds available circulating supply</div>
                  )}
                </div>
              )}
            </div>
          ))}
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={addBatchTrade}
              className="flex-1"
            >
              Add Trade
            </Button>
            
            <Button 
              onClick={() => {
                const results = executeBatchTrades();
                const validResults = results.filter(r => r.inputAmount > 0);
                if (validResults.length > 0) {
                  alert(`Executed ${validResults.length} trades successfully!`);
                }
              }}
              className="flex-1"
              disabled={batchTrades.every(trade => !trade.amount || Number(trade.amount) <= 0)}
            >
              Execute All Trades
            </Button>
          </div>
        </div>

        {/* Transaction History */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-4">Transaction History</h3>
          {transactions.length === 0 ? (
            <p className="text-gray-500">No transactions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Time</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Input</th>
                    <th className="text-left p-2">Output</th>
                    <th className="text-left p-2">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">{tx.timestamp}</td>
                      <td className="p-2 capitalize">
                        {tx.type === 'add_liquidity' ? 'Add LP' : 
                         tx.type === 'remove_liquidity' ? 'Remove LP' : tx.type}
                      </td>
                      <td className="p-2">
                        {tx.type.includes('liquidity') ? 
                          `${tx.token1Amount?.toFixed(4)} ${tx.inputToken} + ${tx.token2Amount?.toFixed(4)} ${tx.outputToken}` :
                          `${tx.inputAmount.toFixed(4)} ${tx.inputToken}`
                        }
                      </td>
                      <td className="p-2">
                        {tx.type.includes('liquidity') ? 
                          'Liquidity Position' :
                          `${tx.outputAmount.toFixed(4)} ${tx.outputToken}`
                        }
                      </td>
                      <td className="p-2">
                        {tx.type.includes('liquidity') ? 
                          `${tx.price.toFixed(4)}` :
                          `${(tx.outputAmount / tx.inputAmount).toFixed(4)}`
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LiquidityPoolSimulator;
