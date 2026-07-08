'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Activity, Eye, EyeOff, Lock, User } from 'lucide-react'
import { toast } from 'sonner'

export function LoginScreen() {
  const { login } = useAuth()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !pin) {
      toast.error('Please enter name/email and PIN')
      return
    }
    setLoading(true)
    const res = await login(name, pin)
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error || 'Login failed')
    } else {
      toast.success('Welcome back!')
      if (res.mustChangePin) {
        toast.info('Please change your PIN from Settings')
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-gradient shadow-lg mb-4">
            <Activity className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
            Care ERP
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Billing · Accounting · Banking · Commission · Staff
          </p>
        </div>

        <Card className="shadow-xl border-emerald-100">
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>Enter your username/email and PIN to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Username or Email</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="admin@careerp.local"
                    className="pl-9"
                    autoComplete="username"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="pin"
                    type={show ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••••"
                    className="pl-9 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-brand-gradient hover:opacity-90 text-white shadow-md"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-900">
              <p className="font-semibold mb-1">Default Super-Admin (first run):</p>
              <p>Email: <code className="bg-white px-1 rounded">admin@careerp.local</code></p>
              <p>PIN: <code className="bg-white px-1 rounded">admin123</code></p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Deployable on Synology NAS · Docker · SQLite · Next.js 16
        </p>
      </div>
    </div>
  )
}
