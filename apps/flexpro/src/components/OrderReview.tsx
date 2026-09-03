'use client'

import { useState, useEffect } from 'react'
import { Star, Loader2 } from 'lucide-react'

interface Review {
  id: string
  order_id: string
  rating: number
  review_text: string | null
  response: string | null
  response_at: string | null
  created_at: string
  reviewer: {
    full_name: string
    avatar_url: string | null
  }
}

interface OrderReviewProps {
  orderId: string
  isBuyer: boolean
  isSeller: boolean
  orderStatus: string
}

export default function OrderReview({ orderId, isBuyer, isSeller, orderStatus }: OrderReviewProps) {
  const [review, setReview] = useState<Review | null>(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [showResponseForm, setShowResponseForm] = useState(false)

  // Fetch existing review
  useEffect(() => {
    fetchReview()
  }, [orderId])

  const fetchReview = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}/review`)
      if (response.ok) {
        const data = await response.json()
        setReview(data.review)
        if (data.review) {
          setRating(data.review.rating)
          setReviewText(data.review.review_text || '')
        }
      }
    } catch (error) {
      console.error('Failed to fetch review:', error)
    } finally {
      setLoading(false)
    }
  }

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (rating === 0) {
      alert('Please select a rating')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, reviewText }),
      })

      if (response.ok) {
        const data = await response.json()
        setReview(data.review)
        setShowReviewForm(false)
        alert('Review submitted successfully!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to submit review')
      }
    } catch (error) {
      console.error('Failed to submit review:', error)
      alert('Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  const submitResponse = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!response.trim()) {
      alert('Please enter a response')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      })

      if (res.ok) {
        const data = await res.json()
        setReview(data.review)
        setShowResponseForm(false)
        setResponse('')
        alert('Response submitted successfully!')
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to submit response')
      }
    } catch (error) {
      console.error('Failed to submit response:', error)
      alert('Failed to submit response')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  // Only show review section for completed orders
  if (orderStatus !== 'completed') {
    return null
  }

  // Display existing review
  if (review && !showReviewForm) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0">
              {review.reviewer.avatar_url ? (
                <img
                  src={review.reviewer.avatar_url}
                  alt={review.reviewer.full_name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">
                  {review.reviewer.full_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">{review.reviewer.full_name}</span>
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= review.rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              {review.review_text && (
                <p className="text-gray-700 text-sm mb-2">{review.review_text}</p>
              )}
              <span className="text-xs text-gray-500">
                {new Date(review.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Seller Response */}
          {review.response && (
            <div className="ml-13 mt-4 pl-4 border-l-2 border-indigo-200">
              <p className="text-sm font-semibold text-indigo-600 mb-1">Seller Response:</p>
              <p className="text-sm text-gray-700">{review.response}</p>
              {review.response_at && (
                <span className="text-xs text-gray-500">
                  {new Date(review.response_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          {/* Response Button for Seller */}
          {isSeller && !review.response && (
            <button
              onClick={() => setShowResponseForm(!showResponseForm)}
              className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Respond to Review
            </button>
          )}

          {/* Edit Button for Buyer */}
          {isBuyer && (
            <button
              onClick={() => setShowReviewForm(true)}
              className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Edit Review
            </button>
          )}
        </div>

        {/* Response Form */}
        {showResponseForm && (
          <form onSubmit={submitResponse} className="bg-white border-2 border-indigo-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Response
            </label>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Thank the customer and address their feedback..."
              required
            />
            <div className="flex gap-2 mt-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Response'}
              </button>
              <button
                type="button"
                onClick={() => setShowResponseForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    )
  }

  // Show review form for buyers
  if (isBuyer) {
    return (
      <form onSubmit={submitReview} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rate Your Experience *
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none"
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    star <= (hoverRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-sm text-gray-600">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Review (Optional)
          </label>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Share your experience with this service..."
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting || rating === 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : review ? 'Update Review' : 'Submit Review'}
          </button>
          {review && (
            <button
              type="button"
              onClick={() => {
                setShowReviewForm(false)
                setRating(review.rating)
                setReviewText(review.review_text || '')
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    )
  }

  // Seller view - waiting for buyer to leave review
  if (isSeller) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Waiting for buyer to leave a review...</p>
      </div>
    )
  }

  return null
}
