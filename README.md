# Liquidity Pool Simulator

An interactive web application that simulates Automated Market Maker (AMM) liquidity pools, allowing users to experiment with trading and liquidity provision in a risk-free environment.

[![Watch demo video](https://img.shields.io/badge/Watch-Demo_Video-blue)](https://raw.githubusercontent.com/l3lackcurtains/liquidity-pool-simulator/refs/heads/main/resources/demo.mp4)

## Overview

This simulator demonstrates how AMM liquidity pools work using the constant product formula (x * y = k). It allows users to:

- Execute buy and sell trades to see price impact and slippage
- Add and remove liquidity to understand LP mechanics
- View real-time price charts and transaction history
- Simulate batch operations to see compound effects

## Features

### Trading Simulation
- Buy and sell tokens with real-time price updates
- Visualize price impact and slippage for different trade sizes
- Execute batch trades to simulate market activity

### Liquidity Management
- Add and remove liquidity with paired assets
- See how liquidity affects price stability and slippage
- Understand impermanent loss through simulation

### Analytics
- Real-time price charts showing trade impact
- Detailed transaction history
- Market metrics including TVL, market cap, and price

## Technical Implementation

Built with:
- Next.js 15 with App Router
- React 19
- Tailwind CSS for styling
- Recharts for data visualization
- TypeScript for type safety

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Educational Purpose

This simulator is designed for educational purposes to help users understand:
- How AMM pricing works (constant product formula)
- The relationship between liquidity depth and price impact
- The mechanics of liquidity provision and removal
- How trading affects token prices in a pool

## Learn More

To learn more about AMMs and DeFi concepts:
- [Uniswap V2 Whitepaper](https://uniswap.org/whitepaper.pdf)
- [Balancer Whitepaper](https://balancer.fi/whitepaper.pdf)
- [Impermanent Loss Explained](https://academy.binance.com/en/articles/impermanent-loss-explained)
