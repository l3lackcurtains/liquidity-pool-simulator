import LiquidityPoolSimulator from '@/components/LiquidityPoolSimulator'
import { ThemeProvider } from '@/components/theme-provider'

export default function Home() {
  return (
     <ThemeProvider>
    <main className="container max-w-5xl w-full mx-auto my-8">
     
      <LiquidityPoolSimulator />
      
    </main>
    </ThemeProvider>
  )
}