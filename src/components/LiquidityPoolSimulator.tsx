"use client"
import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from "recharts"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ArrowUpRight, ArrowDownRight, Plus, Minus, RefreshCw, Play, Trash2 } from "lucide-react"
import { useTheme } from "@/components/theme-provider"

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="outline"
      size="sm"
      className="bg-white/10 text-white border-white/20 hover:bg-white/20"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-sun"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.93 4.93l1.41 1.41" />
          <path d="M17.66 17.66l1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M6.34 17.66l-1.41 1.41" />
          <path d="M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-moon"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </Button>
  )
}

interface PoolState {
  token1Symbol: string
  token2Symbol: string
  token1Reserve: number
  token2Reserve: number
  token1Price: number
  token2Price: number
  token2TotalSupply: number
}

interface TradeState {
  type: "buy" | "sell"
  amount: number
}

interface LiquidityState {
  type: "add" | "remove"
  token1Amount: number
  token2Amount: number
}

interface PriceHistoryItem {
  timestamp: string
  price: number
  priceUSD: number
}

interface Transaction {
  timestamp: string
  type: "buy" | "sell" | "add_liquidity" | "remove_liquidity"
  inputAmount: number
  inputToken: string
  outputAmount: number
  outputToken: string
  price: number
  token1Amount?: number
  token2Amount?: number
}

const LiquidityPoolSimulator = () => {
  const [pool, setPool] = useState<PoolState>({
    token1Symbol: "ETH",
    token2Symbol: "SILK",
    token1Reserve: 3.8,
    token2Reserve: 10_000_000,
    token1Price: 2700,
    token2Price: 0,
    token2TotalSupply: 1_000_000_000, // 1 billion default
  })

  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [batchTrades, setBatchTrades] = useState<TradeState[]>([{ type: "buy", amount: 0 }])
  const [liquidityOperations, setLiquidityOperations] = useState<LiquidityState[]>([
    { type: "add", token1Amount: 0, token2Amount: 0 },
  ])
  const [inputsLocked, setInputsLocked] = useState(false)

  // Calculate current price (token2 per token1)
  const getCurrentPrice = () => {
    return pool.token2Reserve / pool.token1Reserve
  }

  // Calculate token2 price in USD
  const getToken2PriceUSD = () => {
    const token2PerToken1 = getCurrentPrice()
    return pool.token1Price / token2PerToken1
  }

  // Calculate slippage percentage
  const getSlippagePercentage = () => {
    const currentPrice = getCurrentPrice()
    const marketPrice = pool.token1Price // ETH price in USD
    const token2PriceUSD = getToken2PriceUSD()

    // Calculate implied ETH price from token2 perspective
    const impliedETHPrice = token2PriceUSD * currentPrice
    const slippage = ((impliedETHPrice - marketPrice) / marketPrice) * 100
    return slippage
  }

  useEffect(() => {
    const price = getCurrentPrice()
    const priceUSD = getToken2PriceUSD()
    setPriceHistory((prev) =>
      [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          price: price,
          priceUSD: priceUSD,
        },
      ].slice(-20),
    ) // Keep more history for better chart
  }, [pool.token1Reserve, pool.token2Reserve, pool.token1Price])

  const getK = () => pool.token1Reserve * pool.token2Reserve

  // AMM formula: (x + Δx)(y - Δy) = k
  // Δy = y - k/(x + Δx)
  const calculateOutputAmount = (inputAmount: number, inputReserve: number, outputReserve: number) => {
    if (inputAmount <= 0) return 0
    const k = getK()
    const newInputReserve = inputReserve + inputAmount
    const newOutputReserve = k / newInputReserve
    return outputReserve - newOutputReserve
  }

  const calculatePriceImpact = (inputAmount: number, inputReserve: number, outputReserve: number) => {
    if (inputAmount <= 0) return "0.00"

    const initialPrice = outputReserve / inputReserve
    const outputAmount = calculateOutputAmount(inputAmount, inputReserve, outputReserve)
    const effectivePrice = outputAmount / inputAmount
    const priceImpact = Math.abs((effectivePrice - initialPrice) / initialPrice) * 100

    return priceImpact.toFixed(2)
  }

  // Validation function for token2 amounts
  const validateToken2Amount = (amount: number, operation: "add" | "remove" | "sell") => {
    const availableSupply = pool.token2TotalSupply - pool.token2Reserve

    if (operation === "add" && amount > availableSupply) {
      return `Cannot add ${amount.toLocaleString()} ${pool.token2Symbol}. Only ${availableSupply.toLocaleString()} available from total supply.`
    }

    if (operation === "remove" && amount > pool.token2Reserve) {
      return `Cannot remove ${amount.toLocaleString()} ${pool.token2Symbol}. Only ${pool.token2Reserve.toLocaleString()} available in pool.`
    }

    if (operation === "sell" && amount > availableSupply) {
      return `Cannot sell ${amount.toLocaleString()} ${pool.token2Symbol}. Only ${availableSupply.toLocaleString()} available from circulating supply.`
    }

    return null
  }

  const addBatchTrade = () => {
    setBatchTrades((prev) => [...prev, { type: "buy", amount: 0 }])
  }

  const removeBatchTrade = (index: number) => {
    setBatchTrades((prev) => prev.filter((_, i) => i !== index))
  }

  const updateBatchTrade = (index: number, field: keyof TradeState, value: string | "buy" | "sell") => {
    setBatchTrades((prev) =>
      prev.map((trade, i) =>
        i === index
          ? {
              ...trade,
              [field]: field === "amount" ? Number(value) : value,
            }
          : trade,
      ),
    )
  }

  const addLiquidityOperation = () => {
    setLiquidityOperations((prev) => [...prev, { type: "add", token1Amount: 0, token2Amount: 0 }])
  }

  const removeLiquidityOperation = (index: number) => {
    setLiquidityOperations((prev) => prev.filter((_, i) => i !== index))
  }

  const updateLiquidityOperation = (index: number, field: keyof LiquidityState, value: string | "add" | "remove") => {
    setLiquidityOperations((prev) =>
      prev.map((op, i) =>
        i === index
          ? {
              ...op,
              [field]: ["token1Amount", "token2Amount"].includes(field) ? Number(value) : value,
            }
          : op,
      ),
    )
  }

  const calculateProportionalAmount = (token1Input: number, isToken1Primary: boolean) => {
    const currentRatio = pool.token2Reserve / pool.token1Reserve
    if (isToken1Primary) {
      return token1Input * currentRatio
    } else {
      return token1Input / currentRatio
    }
  }

  const executeBatchTrades = () => {
    let currentPool = { ...pool }
    const results: Transaction[] = []

    // Validate all trades first
    for (const batchTrade of batchTrades) {
      if (batchTrade.amount <= 0) continue

      if (batchTrade.type === "sell") {
        const validationError = validateToken2Amount(batchTrade.amount, "sell")
        if (validationError) {
          alert(validationError)
          return []
        }
      }
    }

    batchTrades.forEach((batchTrade) => {
      if (batchTrade.amount <= 0) return

      const k = currentPool.token1Reserve * currentPool.token2Reserve
      let newToken1Reserve = currentPool.token1Reserve
      let newToken2Reserve = currentPool.token2Reserve
      let outputAmount = 0

      if (batchTrade.type === "buy") {
        // Buying token2 with token1 (ETH)
        newToken1Reserve += batchTrade.amount
        newToken2Reserve = k / newToken1Reserve
        outputAmount = currentPool.token2Reserve - newToken2Reserve
      } else {
        // Selling token2 for token1 (ETH)
        newToken2Reserve += batchTrade.amount
        newToken1Reserve = k / newToken2Reserve
        outputAmount = currentPool.token1Reserve - newToken1Reserve
      }

      const currentPrice = currentPool.token2Reserve / currentPool.token1Reserve

      const newTransaction: Transaction = {
        timestamp: new Date().toLocaleTimeString(),
        type: batchTrade.type,
        inputAmount: batchTrade.amount,
        inputToken: batchTrade.type === "buy" ? pool.token1Symbol : pool.token2Symbol,
        outputAmount: outputAmount,
        outputToken: batchTrade.type === "buy" ? pool.token2Symbol : pool.token1Symbol,
        price: currentPrice,
      }

      results.push(newTransaction)
      currentPool = {
        ...currentPool,
        token1Reserve: newToken1Reserve,
        token2Reserve: newToken2Reserve,
      }
    })

    // Update pool state
    setPool(currentPool)

    // Add transactions to history
    setTransactions((prev) => [...results, ...prev].slice(0, 10))

    return results
  }

  const executeLiquidityOperations = () => {
    let currentPool = { ...pool }
    const results: Transaction[] = []

    // Validate all operations first
    for (const liquidityOp of liquidityOperations) {
      if (liquidityOp.token1Amount <= 0 && liquidityOp.token2Amount <= 0) continue

      if (liquidityOp.type === "add") {
        const validationError = validateToken2Amount(liquidityOp.token2Amount, "add")
        if (validationError) {
          alert(validationError)
          return []
        }
      } else {
        const validationError = validateToken2Amount(liquidityOp.token2Amount, "remove")
        if (validationError) {
          alert(validationError)
          return []
        }
      }
    }

    liquidityOperations.forEach((liquidityOp) => {
      if (liquidityOp.token1Amount <= 0 && liquidityOp.token2Amount <= 0) return

      const currentPrice = currentPool.token2Reserve / currentPool.token1Reserve

      if (liquidityOp.type === "add") {
        // Add liquidity - both tokens are added proportionally
        const newToken1Reserve = currentPool.token1Reserve + liquidityOp.token1Amount
        const newToken2Reserve = currentPool.token2Reserve + liquidityOp.token2Amount

        const newTransaction: Transaction = {
          timestamp: new Date().toLocaleTimeString(),
          type: "add_liquidity",
          inputAmount: liquidityOp.token1Amount,
          inputToken: pool.token1Symbol,
          outputAmount: liquidityOp.token2Amount,
          outputToken: pool.token2Symbol,
          price: currentPrice,
          token1Amount: liquidityOp.token1Amount,
          token2Amount: liquidityOp.token2Amount,
        }

        results.push(newTransaction)
        currentPool = {
          ...currentPool,
          token1Reserve: newToken1Reserve,
          token2Reserve: newToken2Reserve,
        }
      } else {
        // Remove liquidity - remove proportionally
        if (
          liquidityOp.token1Amount > currentPool.token1Reserve ||
          liquidityOp.token2Amount > currentPool.token2Reserve
        ) {
          alert("Cannot remove more liquidity than available in pool")
          return
        }

        const newToken1Reserve = currentPool.token1Reserve - liquidityOp.token1Amount
        const newToken2Reserve = currentPool.token2Reserve - liquidityOp.token2Amount

        if (newToken1Reserve <= 0 || newToken2Reserve <= 0) {
          alert("Cannot remove all liquidity from pool")
          return
        }

        const newTransaction: Transaction = {
          timestamp: new Date().toLocaleTimeString(),
          type: "remove_liquidity",
          inputAmount: liquidityOp.token1Amount,
          inputToken: pool.token1Symbol,
          outputAmount: liquidityOp.token2Amount,
          outputToken: pool.token2Symbol,
          price: currentPrice,
          token1Amount: liquidityOp.token1Amount,
          token2Amount: liquidityOp.token2Amount,
        }

        results.push(newTransaction)
        currentPool = {
          ...currentPool,
          token1Reserve: newToken1Reserve,
          token2Reserve: newToken2Reserve,
        }
      }
    })

    // Update pool state
    setPool(currentPool)

    // Add transactions to history
    setTransactions((prev) => [...results, ...prev].slice(0, 20))

    return results
  }

  const resetPool = () => {
    const initialToken2Reserve = 10_000_000 // Reset to original amount
    setPool((prev) => ({
      ...prev,
      token1Reserve: 3.8,
      token2Reserve: initialToken2Reserve,
    }))
    setPriceHistory([])
    setTransactions([])
    setInputsLocked(false) // Unlock inputs
  }

  const simulatePoolConfig = () => {
    // Lock inputs
    setInputsLocked(true)

    // Update price history with current values
    const price = getCurrentPrice()
    const priceUSD = getToken2PriceUSD()
    setPriceHistory((prev) => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString(),
        price: price,
        priceUSD: priceUSD,
      },
    ])
  }

  const currentPrice = getCurrentPrice()
  const token2PriceUSD = getToken2PriceUSD()
  const marketCap = (pool.token2Reserve / pool.token2TotalSupply) * pool.token2TotalSupply * token2PriceUSD // Corrected market cap calculation
  const slippagePercentage = getSlippagePercentage()
  const priceChange =
    priceHistory.length >= 2
      ? ((priceHistory[priceHistory.length - 1].priceUSD - priceHistory[0].priceUSD) / priceHistory[0].priceUSD) * 100
      : 0

  const { theme: currentTheme } = useTheme()
  const darkMode = currentTheme === "dark"

  return (
    <div className="w-full max-w-7xl mx-auto">
      <Card className="w-full border-0 shadow-lg overflow-hidden bg-white dark:bg-gray-900 rounded-xl">
        <CardHeader className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white p-4 rounded-t-xl">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl font-bold">Liquidity Pool Simulator</CardTitle>
              <p className="text-teal-100 text-sm mt-0.5">Automated Market Maker (AMM) Simulation</p>
            </div>
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                onClick={resetPool}
              >
                <RefreshCw className="mr-1 h-4 w-4" /> Reset
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Current Status Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
            {/* Current Price Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="px-4 py-2">
                <h3 className="font-medium text-gray-800 dark:text-gray-200">Current Price</h3>
              </div>
              <div className="p-3">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    ${token2PriceUSD.toFixed(6)}
                  </span>
                  <Badge
                    className={`ml-2 ${
                      priceChange >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                    } rounded-md font-medium`}
                  >
                    {priceChange >= 0 ? (
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 mr-1" />
                    )}
                    {Math.abs(priceChange).toFixed(2)}%
                  </Badge>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-500 dark:text-gray-400">Exchange Rate</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      1 {pool.token1Symbol} = {currentPrice.toFixed(2)} {pool.token2Symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-500 dark:text-gray-400">Market Cap</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      ${(marketCap / 1000000).toFixed(2)}M
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-gray-500 dark:text-gray-400">USD Value</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      1 {pool.token2Symbol} = ${token2PriceUSD.toFixed(6)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pool Reserves Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="px-4 py-2">
                <h3 className="font-medium text-gray-800 dark:text-gray-200">Pool Reserves</h3>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-500 dark:text-gray-400">{pool.token1Symbol}</span>
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">Base</span>
                    </div>
                    <div className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                      {pool.token1Reserve.toFixed(4)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Value: ${(pool.token1Reserve * pool.token1Price).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-500 dark:text-gray-400">{pool.token2Symbol}</span>
                      <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">Token</span>
                    </div>
                    <div className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                      {(pool.token2Reserve / 1000000).toFixed(2)}M
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Value: ${((pool.token2Reserve * token2PriceUSD) / 1000000).toFixed(2)}M
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">Constant K</span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      {(getK() / 1000000).toFixed(2)}M
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Market Reference Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="px-4 py-2">
                <h3 className="text-gray-800 dark:text-gray-200 font-medium">Market Reference</h3>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400 mb-1">ETH Price</div>
                    <div className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                      ${pool.token1Price.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Market Rate</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Slippage</div>
                    <div
                      className={`text-xl font-semibold ${
                        Math.abs(slippagePercentage) > 5 ? "text-amber-600" : "text-emerald-600"
                      }`}
                    >
                      {slippagePercentage.toFixed(2)}%
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {Math.abs(slippagePercentage) > 5 ? "High" : "Low"} Impact
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">Pool Liquidity</span>
                    <div className="flex items-center">
                      <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mr-2">
                        <div
                          className="h-full bg-teal-500 rounded-full"
                          style={{ width: `${Math.min((pool.token2Reserve / pool.token2TotalSupply) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {((pool.token2Reserve / pool.token2TotalSupply) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Price Chart */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-700">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 flex justify-between items-center border-b border-gray-200 dark:border-gray-600">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    {pool.token2Symbol} Price Chart
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Real-time price tracking in USD</p>
                </div>
                <div className="flex space-x-2">
                  <Badge className="bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-0 px-3 py-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></div>
                    Live
                  </Badge>
                  <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-0 px-3 py-1">
                    {priceHistory.length} data points
                  </Badge>
                </div>
              </div>

              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Price</div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                      ${token2PriceUSD.toFixed(6)}
                    </div>
                    <div className={`text-sm font-medium ${priceChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {priceChange >= 0 ? "+" : ""}
                      {priceChange.toFixed(2)}% change
                    </div>
                  </div>
                  <div className="text-right bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Reference Rate</div>
                    <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      1 ETH = ${pool.token1Price}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Market price</div>
                  </div>
                </div>

                <div className="w-full h-80 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceHistory} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#e5e7eb"} vertical={false} />
                      <XAxis
                        dataKey="timestamp"
                        stroke={darkMode ? "#9ca3af" : "#6b7280"}
                        fontSize={12}
                        tickLine={false}
                        axisLine={{ stroke: darkMode ? "#4b5563" : "#d1d5db" }}
                      />
                      <YAxis
                        tickFormatter={(value) => `$${value.toFixed(6)}`}
                        stroke={darkMode ? "#9ca3af" : "#6b7280"}
                        fontSize={12}
                        tickLine={false}
                        axisLine={{ stroke: darkMode ? "#4b5563" : "#d1d5db" }}
                        domain={["dataMin", "dataMax"]}
                      />
                      <Tooltip
                        formatter={(value: number) => [`$${value.toFixed(6)}`, `${pool.token2Symbol} Price`]}
                        labelFormatter={(label) => `Time: ${label}`}
                        contentStyle={{
                          backgroundColor: darkMode ? "#374151" : "white",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
                          border: `1px solid ${darkMode ? "#4b5563" : "#e5e7eb"}`,
                          padding: "12px 16px",
                          color: darkMode ? "#f3f4f6" : "#1f2937",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="priceUSD"
                        stroke="#10b981"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorPrice)"
                      />
                      <Line
                        type="monotone"
                        dataKey="priceUSD"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: darkMode ? "#374151" : "white" }}
                        activeDot={{
                          r: 7,
                          fill: "#059669",
                          strokeWidth: 0,
                          shadow: "0 0 10px rgba(16, 185, 129, 0.5)",
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-red-700 dark:text-red-300">Minimum Price</div>
                        <div className="text-lg font-bold text-red-800 dark:text-red-200">
                          $
                          {priceHistory.length > 0
                            ? Math.min(...priceHistory.map((item) => item.priceUSD)).toFixed(6)
                            : "0.000000"}
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-red-200 dark:bg-red-800 rounded-full flex items-center justify-center">
                        <ArrowDownRight className="w-5 h-5 text-red-600 dark:text-red-300" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Maximum Price</div>
                        <div className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                          $
                          {priceHistory.length > 0
                            ? Math.max(...priceHistory.map((item) => item.priceUSD)).toFixed(6)
                            : "0.000000"}
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-emerald-200 dark:bg-emerald-800 rounded-full flex items-center justify-center">
                        <ArrowUpRight className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Average Price</div>
                        <div className="text-lg font-bold text-blue-800 dark:text-blue-200">
                          $
                          {priceHistory.length > 0
                            ? (
                                priceHistory.reduce((sum, item) => sum + item.priceUSD, 0) / priceHistory.length
                              ).toFixed(6)
                            : "0.000000"}
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-blue-600 dark:bg-blue-300 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs for Pool Configuration, Trading, and Liquidity */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-700">
            <Tabs defaultValue="config" className="w-full">
              <TabsList className="grid grid-cols-3 mb-6">
                <TabsTrigger value="config">Pool Configuration</TabsTrigger>
                <TabsTrigger value="trading">Trading</TabsTrigger>
                <TabsTrigger value="liquidity">Liquidity Management</TabsTrigger>
              </TabsList>

              {/* Pool Configuration Tab */}
              <TabsContent value="config" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-700 dark:text-gray-200">Token 1</Label>
                        <Input
                          value={pool.token1Symbol}
                          disabled
                          className="bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-700 dark:text-gray-200">Token 2 Symbol</Label>
                        <Input
                          value={pool.token2Symbol}
                          onChange={(e) => setPool((prev) => ({ ...prev, token2Symbol: e.target.value }))}
                          disabled={inputsLocked}
                          className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-gray-700 dark:text-gray-200">Token 2 Total Supply</Label>
                      <Input
                        type="number"
                        value={pool.token2TotalSupply}
                        onChange={(e) => setPool((prev) => ({ ...prev, token2TotalSupply: Number(e.target.value) }))}
                        disabled={inputsLocked}
                        className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total token supply in circulation</p>
                    </div>

                    <div>
                      <Label className="text-gray-700 dark:text-gray-200">ETH Market Price (USD)</Label>
                      <Input
                        type="number"
                        value={pool.token1Price}
                        onChange={(e) => setPool((prev) => ({ ...prev, token1Price: Number(e.target.value) }))}
                        disabled={inputsLocked}
                        className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Current market price of ETH in USD
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-700 dark:text-gray-200">
                        ETH Reserve (${(pool.token1Reserve * pool.token1Price).toLocaleString()})
                      </Label>
                      <Input
                        type="number"
                        value={pool.token1Reserve}
                        onChange={(e) => setPool((prev) => ({ ...prev, token1Reserve: Number(e.target.value) }))}
                        disabled={inputsLocked}
                        className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Amount of ETH locked in the pool</p>
                    </div>

                    <div>
                      <Label className="text-gray-700 dark:text-gray-200">{pool.token2Symbol} Reserve</Label>
                      <Input
                        type="number"
                        value={pool.token2Reserve}
                        onChange={(e) => {
                          const newReserve = Number(e.target.value)
                          if (newReserve > pool.token2TotalSupply) {
                            alert(`Reserve cannot exceed total supply of ${pool.token2TotalSupply.toLocaleString()}`)
                            return
                          }
                          setPool((prev) => ({ ...prev, token2Reserve: newReserve }))
                        }}
                        disabled={inputsLocked}
                        className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                      <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <span>
                          {((pool.token2Reserve / pool.token2TotalSupply) * 100).toFixed(2)}% of total supply in pool
                        </span>
                        <span>Available: {(pool.token2TotalSupply - pool.token2Reserve).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={simulatePoolConfig}
                  className="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white py-6 text-lg font-medium"
                  disabled={inputsLocked}
                >
                  <Play className="mr-2 h-5 w-5" /> Simulate with Current Configuration
                </Button>
              </TabsContent>

              {/* Trading Tab */}
              <TabsContent value="trading" className="mt-0">
                <div className="space-y-6">
                  {batchTrades.map((batchTrade, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Trade #{index + 1}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBatchTrade(index)}
                          disabled={batchTrades.length === 1}
                          className="text-gray-500 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-gray-700 dark:text-gray-200">Trade Type</Label>
                          <div className="flex mt-1 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                            <Button
                              className={`flex-1 rounded-none ${
                                batchTrade.type === "buy"
                                  ? "bg-teal-600 hover:bg-teal-700 text-white"
                                  : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                              }`}
                              onClick={() => updateBatchTrade(index, "type", "buy")}
                            >
                              <ArrowUpRight className="mr-1 h-4 w-4" /> Buy {pool.token2Symbol}
                            </Button>
                            <Button
                              className={`flex-1 rounded-none ${
                                batchTrade.type === "sell"
                                  ? "bg-teal-600 hover:bg-teal-700 text-white"
                                  : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                              }`}
                              onClick={() => updateBatchTrade(index, "type", "sell")}
                            >
                              <ArrowDownRight className="mr-1 h-4 w-4" /> Sell {pool.token2Symbol}
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Label className="text-gray-700 dark:text-gray-200">
                            Amount (
                            {batchTrade.type === "buy"
                              ? `ETH ($${(batchTrade.amount * pool.token1Price).toLocaleString()})`
                              : pool.token2Symbol}
                            )
                          </Label>
                          <Input
                            type="number"
                            value={batchTrade.amount}
                            onChange={(e) => updateBatchTrade(index, "amount", e.target.value)}
                            placeholder="Enter amount"
                            className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </div>

                      {batchTrade.amount > 0 && (
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Expected Output</div>
                              <div className="font-medium text-gray-800 dark:text-gray-200">
                                {calculateOutputAmount(
                                  batchTrade.amount,
                                  batchTrade.type === "buy" ? pool.token1Reserve : pool.token2Reserve,
                                  batchTrade.type === "buy" ? pool.token2Reserve : pool.token1Reserve,
                                ).toFixed(4)}{" "}
                                {batchTrade.type === "buy" ? pool.token2Symbol : "ETH"}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Price Impact</div>
                              <div className="font-medium text-gray-800 dark:text-gray-200">
                                {calculatePriceImpact(
                                  batchTrade.amount,
                                  batchTrade.type === "buy" ? pool.token1Reserve : pool.token2Reserve,
                                  batchTrade.type === "buy" ? pool.token2Reserve : pool.token1Reserve,
                                )}
                                %
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Effective Rate</div>
                            <div className="font-medium text-teal-700 dark:text-teal-300">
                              1 ETH ={" "}
                              {batchTrade.type === "buy"
                                ? (
                                    calculateOutputAmount(batchTrade.amount, pool.token1Reserve, pool.token2Reserve) /
                                    batchTrade.amount
                                  ).toFixed(2)
                                : (
                                    batchTrade.amount /
                                    calculateOutputAmount(batchTrade.amount, pool.token2Reserve, pool.token1Reserve)
                                  ).toFixed(2)}{" "}
                              {pool.token2Symbol}
                            </div>
                          </div>

                          {batchTrade.type === "sell" &&
                            batchTrade.amount > pool.token2TotalSupply - pool.token2Reserve && (
                              <div className="mt-2 text-red-500 flex items-center">
                                <span className="text-red-500 mr-1">⚠️</span> Exceeds available circulating supply
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="flex space-x-4">
                    <Button
                      variant="outline"
                      onClick={addBatchTrade}
                      className="flex-1 border-teal-200 text-teal-700 dark:text-teal-300 hover:bg-teal-50"
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add Trade
                    </Button>

                    <Button
                      onClick={() => {
                        const results = executeBatchTrades()
                        const validResults = results.filter((r) => r.inputAmount > 0)
                        if (validResults.length > 0) {
                          alert(`Executed ${validResults.length} trades successfully!`)
                        }
                      }}
                      className="flex-1 bg-teal-600 hover:bg-teal-700"
                      disabled={batchTrades.every((trade) => !trade.amount || Number(trade.amount) <= 0)}
                    >
                      Execute All Trades
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Liquidity Management Tab */}
              <TabsContent value="liquidity" className="mt-0">
                <div className="space-y-6">
                  {liquidityOperations.map((liquidityOp, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          Liquidity Operation #{index + 1}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLiquidityOperation(index)}
                          disabled={liquidityOperations.length === 1}
                          className="text-gray-500 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-gray-700 dark:text-gray-200">Operation Type</Label>
                          <div className="flex mt-1 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                            <Button
                              className={`flex-1 rounded-none ${
                                liquidityOp.type === "add"
                                  ? "bg-teal-600 hover:bg-teal-700 text-white"
                                  : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                              }`}
                              onClick={() => updateLiquidityOperation(index, "type", "add")}
                            >
                              <Plus className="mr-1 h-4 w-4" /> Add
                            </Button>
                            <Button
                              className={`flex-1 rounded-none ${
                                liquidityOp.type === "remove"
                                  ? "bg-teal-600 hover:bg-teal-700 text-white"
                                  : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                              }`}
                              onClick={() => updateLiquidityOperation(index, "type", "remove")}
                            >
                              <Minus className="mr-1 h-4 w-4" /> Remove
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Label className="text-gray-700 dark:text-gray-200">
                            {pool.token1Symbol} Amount ($
                            {(liquidityOp.token1Amount * pool.token1Price).toLocaleString()})
                          </Label>
                          <Input
                            type="number"
                            value={liquidityOp.token1Amount}
                            onChange={(e) => {
                              const token1Amount = Number(e.target.value)
                              updateLiquidityOperation(index, "token1Amount", e.target.value)
                              // Auto-calculate proportional token2 amount
                              const proportionalToken2 = calculateProportionalAmount(token1Amount, true)
                              updateLiquidityOperation(index, "token2Amount", proportionalToken2.toString())
                            }}
                            placeholder="Enter amount"
                            className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>

                        <div>
                          <Label className="text-gray-700 dark:text-gray-200">{pool.token2Symbol} Amount</Label>
                          <Input
                            type="number"
                            value={liquidityOp.token2Amount}
                            onChange={(e) => {
                              const token2Amount = Number(e.target.value)
                              updateLiquidityOperation(index, "token2Amount", e.target.value)
                              // Auto-calculate proportional token1 amount
                              const proportionalToken1 = calculateProportionalAmount(token2Amount, false)
                              updateLiquidityOperation(index, "token1Amount", proportionalToken1.toString())
                            }}
                            placeholder="Enter amount"
                            className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </div>

                      {liquidityOp.token1Amount > 0 && liquidityOp.token2Amount > 0 && (
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Ratio</div>
                              <div className="font-medium text-gray-800 dark:text-gray-200">
                                1 {pool.token1Symbol} ={" "}
                                {(liquidityOp.token2Amount / liquidityOp.token1Amount).toFixed(4)} {pool.token2Symbol}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Current Pool Ratio</div>
                              <div className="font-medium text-gray-800 dark:text-gray-200">
                                1 {pool.token1Symbol} = {(pool.token2Reserve / pool.token1Reserve).toFixed(4)}{" "}
                                {pool.token2Symbol}
                              </div>
                            </div>
                          </div>

                          {liquidityOp.type === "add" &&
                            liquidityOp.token2Amount > pool.token2TotalSupply - pool.token2Reserve && (
                              <div className="mt-2 text-red-500 flex items-center">
                                <span className="text-red-500 mr-1">⚠️</span> Exceeds available supply
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="flex space-x-4">
                    <Button
                      variant="outline"
                      onClick={addLiquidityOperation}
                      className="flex-1 border-teal-200 text-teal-700 dark:text-teal-300 hover:bg-teal-50"
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add Liquidity Operation
                    </Button>

                    <Button
                      onClick={() => {
                        const results = executeLiquidityOperations()
                        const validResults = results.filter((r) => r.token1Amount && r.token1Amount > 0)
                        if (validResults.length > 0) {
                          alert(`Executed ${validResults.length} liquidity operations successfully!`)
                        }
                      }}
                      className="flex-1 bg-teal-600 hover:bg-teal-700"
                      disabled={liquidityOperations.every(
                        (op) =>
                          (!op.token1Amount || Number(op.token1Amount) <= 0) &&
                          (!op.token2Amount || Number(op.token2Amount) <= 0),
                      )}
                    >
                      Execute Liquidity Operations
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Transaction History */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-700">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="px-6 py-4 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Transaction History</h3>
                <Badge className="bg-white/20 text-white border-0">{transactions.length} transactions</Badge>
              </div>

              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 bg-gray-50 dark:bg-gray-800">
                  <div className="bg-white dark:bg-gray-700 p-4 rounded-full mb-4 shadow-sm">
                    <RefreshCw className="h-8 w-8 text-gray-400 dark:text-gray-300" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                    No transactions yet. Execute trades or liquidity operations to see your transaction history here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                        <th className="text-left p-3 text-gray-600 dark:text-gray-300 font-medium text-sm">Time</th>
                        <th className="text-left p-3 text-gray-600 dark:text-gray-300 font-medium text-sm">Type</th>
                        <th className="text-left p-3 text-gray-600 dark:text-gray-300 font-medium text-sm">Input</th>
                        <th className="text-left p-3 text-gray-600 dark:text-gray-300 font-medium text-sm">Output</th>
                        <th className="text-left p-3 text-gray-600 dark:text-gray-300 font-medium text-sm">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {transactions.map((tx, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <td className="p-4 text-gray-700 dark:text-gray-300">{tx.timestamp}</td>
                          <td className="p-4">
                            <Badge
                              className={`
                              ${
                                tx.type === "buy"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : tx.type === "sell"
                                    ? "bg-amber-100 text-amber-800"
                                    : tx.type === "add_liquidity"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-red-100 text-red-800"
                              }
                              rounded-md font-medium px-3 py-1
                            `}
                            >
                              {tx.type === "buy" && <ArrowUpRight className="h-3 w-3 mr-1 inline" />}
                              {tx.type === "sell" && <ArrowDownRight className="h-3 w-3 mr-1 inline" />}
                              {tx.type === "add_liquidity" && <Plus className="h-3 w-3 mr-1 inline" />}
                              {tx.type === "remove_liquidity" && <Minus className="h-3 w-3 mr-1 inline" />}
                              {tx.type === "add_liquidity"
                                ? "Add LP"
                                : tx.type === "remove_liquidity"
                                  ? "Remove LP"
                                  : tx.type === "buy"
                                    ? "Buy"
                                    : "Sell"}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center">
                              {tx.type.includes("liquidity") ? (
                                <div>
                                  <div className="font-medium text-gray-800 dark:text-gray-200">
                                    {tx.token1Amount?.toFixed(4)} {tx.inputToken}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    + {tx.token2Amount?.toFixed(4)} {tx.outputToken}
                                  </div>
                                </div>
                              ) : (
                                <div className="font-medium text-gray-800 dark:text-gray-200">
                                  {tx.inputAmount.toFixed(4)} {tx.inputToken}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            {tx.type.includes("liquidity") ? (
                              <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-md inline-block">
                                Liquidity Position
                              </div>
                            ) : (
                              <div className="font-medium text-gray-800 dark:text-gray-200">
                                {tx.outputAmount.toFixed(4)} {tx.outputToken}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-teal-700 dark:text-teal-300">
                              {tx.type.includes("liquidity")
                                ? `${tx.price.toFixed(4)}`
                                : `${(tx.outputAmount / tx.inputAmount).toFixed(4)}`}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {tx.type.includes("liquidity") ? "Pool ratio" : "Exchange rate"}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default LiquidityPoolSimulator
