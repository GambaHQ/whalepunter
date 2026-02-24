import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, X, Coins, CreditCard, Wallet } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="px-6 py-16 md:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Choose the plan that matches your betting style. Upgrade, downgrade, or cancel anytime.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-6 pb-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Free Tier */}
            <Card className="flex flex-col border-2 transition-all hover:border-green-600 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl">Free</CardTitle>
                <CardDescription className="mt-4">
                  <span className="text-5xl font-bold text-foreground">$0</span>
                  <span className="text-muted-foreground">/month</span>
                </CardDescription>
                <p className="mt-4 text-sm text-muted-foreground">
                  Perfect for casual punters getting started with racing analytics
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm">Basic race listings</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm">Limited dashboard (top 5 movers only)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm">Read-only leaderboard access</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">No custom alerts</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">No watchlist</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">No bet journal</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">No runner profiles</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/register">Get Started</Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Pro Tier */}
            <Card className="relative flex flex-col border-2 border-green-600 shadow-2xl transition-all hover:shadow-green-200">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-green-600 px-6 py-1.5 text-sm font-semibold text-white shadow-lg">
                Most Popular
              </div>
              <CardHeader className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
                <CardTitle className="text-2xl">Pro</CardTitle>
                <CardDescription className="mt-4">
                  <span className="text-5xl font-bold text-foreground">$19.99</span>
                  <span className="text-muted-foreground">/month</span>
                </CardDescription>
                <p className="mt-4 text-sm text-muted-foreground">
                  For serious punters who want professional-grade analytics and alerts
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">Full dashboard access with all race data</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">10 custom alert rules</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">Watchlist for up to 50 items</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">Bet journal & performance tracking</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">Detailed runner profiles by conditions</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">Submit tips & compete on leaderboard</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">Community chat access</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Unlimited alerts</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Head-to-head compare</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Smart money tracker</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" size="lg" asChild>
                  <Link href="/register">Subscribe to Pro</Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Premium Tier */}
            <Card className="flex flex-col border-2 transition-all hover:border-green-600 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl">Premium</CardTitle>
                <CardDescription className="mt-4">
                  <span className="text-5xl font-bold text-foreground">$49.99</span>
                  <span className="text-muted-foreground">/month</span>
                </CardDescription>
                <p className="mt-4 text-sm text-muted-foreground">
                  For professional punters and syndicates who need unlimited access and API
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">Everything included in Pro</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">Unlimited custom alert rules</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">Unlimited watchlist items</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">Head-to-head runner comparison tool</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">Smart money tracker with pattern detection</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">API access for custom integrations</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">Priority support</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-sm font-medium">Early access to new features</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" size="lg" asChild>
                  <Link href="/register">Subscribe to Premium</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Payment Methods */}
      <section className="border-t bg-gradient-to-br from-green-50 to-white px-6 py-16 dark:from-green-950/20 dark:to-background md:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Secure Payment Options
          </h2>
          <p className="mt-4 text-muted-foreground">
            We accept multiple payment methods for your convenience
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-8">
            <div className="flex items-center gap-3 rounded-lg border-2 bg-white px-6 py-4 dark:bg-background">
              <CreditCard className="h-8 w-8 text-green-600" />
              <div className="text-left">
                <div className="font-semibold">Credit Card</div>
                <div className="text-sm text-muted-foreground">Visa, Mastercard, Amex</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border-2 bg-white px-6 py-4 dark:bg-background">
              <Wallet className="h-8 w-8 text-blue-600" />
              <div className="text-left">
                <div className="font-semibold">PayPal</div>
                <div className="text-sm text-muted-foreground">Fast & secure</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border-2 bg-white px-6 py-4 dark:bg-background">
              <Coins className="h-8 w-8 text-orange-600" />
              <div className="text-left">
                <div className="font-semibold">Cryptocurrency</div>
                <div className="text-sm text-muted-foreground">BTC, ETH, USDT</div>
              </div>
            </div>
          </div>

          <p className="mt-10 text-sm text-muted-foreground">
            All payments are processed securely with industry-standard encryption. 
            Cancel or change your plan anytime.
          </p>
        </div>
      </section>

      {/* FAQ / Additional Info */}
      <section className="px-6 py-16 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Questions About Pricing?
          </h2>
          <p className="mt-4 text-muted-foreground">
            All plans include a 7-day money-back guarantee. No questions asked.
          </p>
          <div className="mt-8">
            <Button variant="outline" size="lg" asChild>
              <Link href="/register">Start Free Trial</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
