'use client'

import { useState, useEffect } from 'react'
import { Star, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

interface Review {
  id: string
  rating: number
  review_text: string | null
  response: string | null
  response_at: string | null
  created_at: string
  reviewer: {
    full_name: string
    avatar_url: string | null
  }
  order: {
    package_type: string
  }
}

interface GigReviewsProps {
  gigId: string
}

export default function GigReviews({ gigId }: GigReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchReviews()
  }, [gigId, page])

  const fetchReviews = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/gigs/${gigId}/reviews?page=${page}&limit=5`)
      if (response.ok) {
        const data = await response.json()
        setReviews(data.reviews || [])
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg dark:bg-gray-950">
        <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400">No reviews yet. Be the first to review this service!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Customer Reviews ({total})</h3>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="bg-white border border-gray-200 rounded-lg p-6 dark:bg-gray-900 dark:border-gray-800">
            <div className="flex items-start gap-4">
              {/* Reviewer Avatar */}
              <div className="flex-shrink-0">
                {review.reviewer.avatar_url ? (
                  <img
                    src={review.reviewer.avatar_url}
                    alt={review.reviewer.full_name}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-lg">
                    {review.reviewer.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Review Content */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-50">{review.reviewer.full_name}</p>
                    <div className="flex items-center gap-2 mt-1">
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
                      <span className="text-sm text-gray-500 capitalize dark:text-gray-400">
                        · {review.order.package_type} package
                      </span>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>

                {review.review_text && (
                  <p className="text-gray-700 mt-3 leading-relaxed dark:text-gray-300">{review.review_text}</p>
                )}

                {/* Seller Response */}
                {review.response && (
                  <div className="mt-4 ml-4 pl-4 border-l-2 border-indigo-200 bg-indigo-50 p-4 rounded-r-lg dark:border-indigo-900 dark:bg-indigo-950/40">
                    <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-2">Seller Response:</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{review.response}</p>
                    {review.response_at && (
                      <span className="text-xs text-gray-500 mt-2 block dark:text-gray-400">
                        {new Date(review.response_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1 || loading}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages || loading}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
