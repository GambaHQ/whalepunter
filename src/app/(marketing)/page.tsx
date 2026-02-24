import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  DollarSign, 
  Bell, 
  Search, 
  BarChart3, 
  Trophy,
  CheckCircle2,
  ArrowRight
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-green-600 via-green-700 to-green-800 px-6 py-24 text-white sm:py-32 md:px-8">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="relative mx-auto max-w-7xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Track Whale Money in Racing
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-green-100 sm:text-xl">
            Real-time Betfair analytics that identify big money moves before the race starts. 
            Follow the smart money and gain an edge in horse racing.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild className="bg-white text-green-700 hover:bg-green-50">
              <Link href="/register">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-white text-white hover:bg-white/10">
              <Link href="/pricing">
                View Pricing
              </Link>
            </Button>
          </div>

          {/* Stats Bar */}
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-lg bg-white/10 p-6 backdrop-blur-sm">
              <div className="text-3xl font-bold">10,000+</div>
              <div className="mt-1 text-sm text-green-100">Races Tracked</div>
            </div>
            <div className="rounded-lg bg-white/10 p-6 backdrop-blur-sm">
              <div className="text-3xl font-bold">500+</div>
              <div className="mt-1 text-sm text-green-100">Whale Alerts Daily</div>
            </div>
            <div className="rounded-lg bg-white/10 p-6 backdrop-blur-sm">
              <div className="text-3xl font-bold">Real-time</div>
              <div className="mt-1 text-sm text-green-100">Odds Updates</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Powerful Racing Analytics
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Everything you need to track smart money and make informed betting decisions
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <Card className="border-2 transition-all hover:border-green-600 hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-600 text-white">
                  <DollarSign className="h-6 w-6" />
                </div>
                <CardTitle>Whale Bet Detection</CardTitle>
                <CardDescription>
                  Automatically track large bets over $500 at odds greater than $4. 
                  See when big money is backing runners before the crowd notices.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 2 */}
            <Card className="border-2 transition-all hover:border-green-600 hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-600 text-white">
                  <Bell className="h-6 w-6" />
                </div>
                <CardTitle>Live Odds Alerts</CardTitle>
                <CardDescription>
                  Get instant notifications when odds make significant moves. 
                  Never miss a major market shift or betting opportunity again.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 3 */}
            <Card className="border-2 transition-all hover:border-green-600 hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-600 text-white">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <CardTitle>Smart Money Tracking</CardTitle>
                <CardDescription>
                  Identify sharp and professional money patterns. 
                  Distinguish informed betting from public money movements.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 4 */}
            <Card className="border-2 transition-all hover:border-green-600 hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-600 text-white">
                  <Search className="h-6 w-6" />
                </div>
                <CardTitle>Runner Profiles</CardTitle>
                <CardDescription>
                  Detailed performance analytics by weather conditions, distance, track, and barrier position. 
                  Make data-driven selections.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 5 */}
            <Card className="border-2 transition-all hover:border-green-600 hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-600 text-white">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <CardTitle>Race Heatmap</CardTitle>
                <CardDescription>
                  Visualize money flow across every runner in the race. 
                  Spot where the smart money is concentrating instantly.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 6 */}
            <Card className="border-2 transition-all hover:border-green-600 hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-600 text-white">
                  <Trophy className="h-6 w-6" />
                </div>
                <CardTitle>Tipping Leaderboard</CardTitle>
                <CardDescription>
                  Compete with other punters and track your tipping accuracy. 
                  Follow top performers and learn from the best.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Preview Section */}
      <section className="bg-gradient-to-br from-green-50 to-white px-6 py-24 dark:from-green-950/20 dark:to-background md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Choose the plan that fits your betting style
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {/* Free Tier */}
            <Card className="flex flex-col border-2">
              <CardHeader>
                <CardTitle className="text-2xl">Free</CardTitle>
                <CardDescription className="mt-4">
                  <span className="text-4xl font-bold text-foreground">$0</span>
                  <span className="text-muted-foreground">/month</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Basic race listings
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Top 5 movers dashboard
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Read-only leaderboard
                  </li>
                </ul>
                <Button variant="outline" className="mt-8 w-full" asChild>
                  <Link href="/register">Get Started</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Pro Tier */}
            <Card className="relative flex flex-col border-2 border-green-600 shadow-lg">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-green-600 px-4 py-1 text-sm font-semibold text-white">
                Popular
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">Pro</CardTitle>
                <CardDescription className="mt-4">
                  <span className="text-4xl font-bold text-foreground">$19.99</span>
                  <span className="text-muted-foreground">/month</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Full dashboard access
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    10 custom alert rules
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Watchlist (50 items)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Bet journal & tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Runner profiles
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Tipping & leaderboard
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Community chat
                  </li>
                </ul>
                <Button className="mt-8 w-full" asChild>
                  <Link href="/pricing">Subscribe</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Premium Tier */}
            <Card className="flex flex-col border-2">
              <CardHeader>
                <CardTitle className="text-2xl">Premium</CardTitle>
                <CardDescription className="mt-4">
                  <span className="text-4xl font-bold text-foreground">$49.99</span>
                  <span className="text-muted-foreground">/month</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Everything in Pro
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Unlimited alerts
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Unlimited watchlist
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Head-to-head compare
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Smart money tracker
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    API access
                  </li>
                </ul>
                <Button variant="outline" className="mt-8 w-full" asChild>
                  <Link href="/pricing">Subscribe</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/pricing"
              className="text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-2"
            >
              View detailed pricing comparison
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background px-6 py-12 md:px-8">
        <div className="mx-auto max-w-7xl text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} WhalePunter. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
