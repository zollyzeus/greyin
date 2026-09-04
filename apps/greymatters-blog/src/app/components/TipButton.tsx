'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'

declare global {
  interface Window {
    Razorpay: any
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export function TipButton({
  postId,
  authorName,
  tipperEmail,
  tipperPhone,
}: {
  postId: string
  authorName: string
  tipperEmail?: string
  tipperPhone?: string
}) {
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState(100)
  const [done, setDone] = useState(false)

  const handleTip = async () => {
    setLoading(true)
    const loaded = await loadRazorpayScript()
    if (!loaded) {
      alert('Could not load the payment widget. Please try again.')
      setLoading(false)
      return
    }

    const createRes = await fetch('/api/tips/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, amount }),
    })
    const data = await createRes.json()
    if (!createRes.ok) {
      alert(data.error || 'Could not start payment')
      setLoading(false)
      return
    }

    const razorpay = new window.Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      order_id: data.razorpayOrderId,
      name: 'GreyMatters',
      description: `Tip for ${authorName}`,
      handler: async (response: any) => {
        const verifyRes = await fetch('/api/tips/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipId: data.tipId,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
          }),
        })
        if (verifyRes.ok) {
          setDone(true)
        } else {
          alert('Payment verification failed')
        }
      },
      prefill: {
        email: tipperEmail || '',
        contact: tipperPhone || '',
      },
      theme: { color: '#2563eb' },
    })
    razorpay.on('payment.failed', () => setLoading(false))
    razorpay.open()
    setLoading(false)
  }

  if (done) {
    return <p className="text-sm text-green-700 font-medium dark:text-green-400">Thank you for supporting {authorName}! 💙</p>
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 dark:border-gray-700"
      >
        <option value={50}>₹50</option>
        <option value={100}>₹100</option>
        <option value={250}>₹250</option>
        <option value={500}>₹500</option>
      </select>
      <button
        onClick={handleTip}
        disabled={loading}
        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
      >
        <Heart className="w-4 h-4" />
        {loading ? 'Loading...' : `Tip ${authorName}`}
      </button>
    </div>
  )
}
