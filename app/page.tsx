import Hero from './components/Hero'
import Products from './components/Products'
import FireSimulator from './components/FireSimulator'
import Models from './components/Models'
import Cta from './components/Cta'
import Footer from './components/Footer'

export default function Home() {
  return (
    <main>
      <Hero />
      <Products />
      <FireSimulator />
      <Models />
      <Cta />
      <Footer />
    </main>
  )
}
