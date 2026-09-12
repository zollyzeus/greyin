import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/server'
import { BookOpen, Calendar, User, Clock, ArrowLeft, Tag, Share2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { TipButton } from '@/app/components/TipButton'
import { PostLikeButton } from '@/app/components/PostLikeButton'
import { CopyLinkButton } from '@/app/components/CopyLinkButton'
import { FollowButton } from '@/app/components/FollowButton'
import { absoluteUrl } from '@/app/lib/site-url'
import { ThemeToggle } from '@/components/ThemeToggle'

interface PostDetailPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ reported?: string; report_error?: string }>
}

export default async function PostDetailPage({ params, searchParams }: PostDetailPageProps) {
  const resolvedParams = await params
  const { reported, report_error } = await searchParams
  const supabase = await createClient()
  
  const { data: post } = await supabase
    .from('posts')
    .select(`
      *,
      categories (
        id,
        name,
        slug
      )
    `)
    .eq('slug', resolvedParams.slug)
    .eq('status', 'published')
    .single()

  if (!post) {
    notFound()
  }

  // posts.author_id references auth.users, not public.profiles, so
  // PostgREST can't resolve a `profiles:author_id(...)` embed (no direct FK
  // between the two tables) — fetch the author's profile separately instead.
  const { data: author } = post.author_id
    ? await supabase.from('profiles').select('id, full_name, avatar_url').eq('id', post.author_id).maybeSingle()
    : { data: null }
  ;(post as any).profiles = author

  // Fetch related posts
  const { data: relatedPosts } = await supabase
    .from('posts')
    .select('id, title, slug, excerpt, cover_image_url, created_at')
    .eq('status', 'published')
    .eq('category_id', post.category_id)
    .neq('id', post.id)
    .limit(3)

  // AI-rated quality (048_ai_quality_scores.sql) -- also feeds this
  // author's greymatters_score in greyin_scores, not just this display.
  const { data: qualityScore } = await supabase
    .from('ai_quality_scores')
    .select('score, notes')
    .eq('post_id', post.id)
    .eq('content_type', 'greymatters_post')
    .maybeSingle()

  // Fetch comments
  const { data: comments } = await supabase
    .from('comments')
    .select(`
      *,
      profiles (
        full_name,
        avatar_url
      )
    `)
    .eq('post_id', post.id)
    .order('created_at', { ascending: true })

  // Increment view count
  await supabase
    .from('posts')
    .update({ views_count: (post.views_count || 0) + 1 })
    .eq('id', post.id)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: readerProfile } = user
    ? await supabase.from('profiles').select('phone').eq('id', user.id).single()
    : { data: null }

  const { data: myFollow } = user && post.author_id
    ? await supabase.from('user_follows').select('followed_id').eq('follower_id', user.id).eq('followed_id', post.author_id).maybeSingle()
    : { data: null }

  const { data: myLike } = user
    ? await supabase.from('post_likes').select('post_id').eq('post_id', post.id).eq('user_id', user.id).maybeSingle()
    : { data: null }

  const readingTime = Math.ceil((post.content?.length || 0) / 1000) // Rough estimate: 1000 chars = 1 min

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <BookOpen className="h-8 w-8 text-sky-600 dark:text-sky-400" />
              <span className="ml-2 text-2xl font-bold">GreyMatters</span>
            </a>
            <nav className="flex gap-6">
              <Link href="/" className="text-gray-700 hover:text-blue-600 dark:text-gray-300">Home</Link>
              <Link href="/categories" className="text-gray-700 hover:text-blue-600 dark:text-gray-300">Categories</Link>
              <Link href="/about" className="text-gray-700 hover:text-blue-600 dark:text-gray-300">About</Link>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Cover Image */}
      {post.cover_image_url && (
        <div className="w-full h-96 bg-gray-200">
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <Link href="/" className="flex items-center text-gray-600 hover:text-blue-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to blog
        </Link>

        <article className="bg-white rounded-lg shadow-md p-8 md:p-12 dark:bg-gray-900">
          {/* Category Badge */}
          {post.categories && (
            <Link
              href={`/categories/${post.categories.slug}`}
              className="inline-block px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4 hover:bg-blue-200 dark:bg-blue-950/40 dark:text-blue-400"
            >
              {post.categories.name}
            </Link>
          )}

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 dark:text-gray-50">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 mb-8 pb-8 border-b dark:text-gray-400">
            <div className="flex items-center gap-2">
              {post.profiles?.avatar_url ? (
                <img src={post.profiles.avatar_url} alt={post.profiles.full_name} className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-50">{post.profiles?.full_name || 'Anonymous'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {readingTime} min read
            </div>
            <div className="flex items-center gap-1">
              <span>{post.views_count || 0} views</span>
            </div>
            <PostLikeButton
              slug={post.slug}
              initiallyLiked={!!myLike}
              initialCount={post.like_count || 0}
              loggedIn={!!user}
            />
            {qualityScore && (
              <div className="flex items-center gap-1 text-blue-700 font-medium dark:text-blue-400" title={qualityScore.notes || undefined}>
                <span>AI quality: {qualityScore.score}/100</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="prose prose-lg max-w-none mb-12">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {post.content || ''}
            </ReactMarkdown>
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8 pb-8 border-b">
              <Tag className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              {post.tags.map((tag: string) => (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* Share -- real hrefs, no client JS needed for these two; Copy
              Link is the one that needs the clipboard API, pulled into
              its own small client component below. */}
          {(() => {
            const postUrl = absoluteUrl(`/posts/${post.slug}`).toString()
            return (
              <div className="flex items-center gap-4 mb-12 flex-wrap">
                <Share2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Share this article:</span>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                >
                  LinkedIn
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(post.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm font-semibold"
                >
                  Twitter
                </a>
                <CopyLinkButton url={postUrl} />
              </div>
            )
          })()}

          {/* Author Bio */}
          {post.profiles && (
            <div className="bg-gray-50 rounded-lg p-6 mb-12 dark:bg-gray-950">
              <div className="flex gap-4">
                {post.profiles.avatar_url ? (
                  <img src={post.profiles.avatar_url} alt={post.profiles.full_name} className="w-16 h-16 rounded-full" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">{post.profiles.full_name}</h3>
                  <p className="text-gray-600 text-sm mb-3 dark:text-gray-400">
                    Writer at GreyMatters, sharing insights on technology, career, and innovation.
                  </p>
                  <TipButton
                    postId={post.id}
                    authorName={post.profiles.full_name || 'this author'}
                    tipperEmail={user?.email}
                    tipperPhone={readerProfile?.phone}
                  />
                  {user && post.author_id && user.id !== post.author_id && (
                    <FollowButton
                      targetUserId={post.author_id}
                      isFollowing={!!myFollow}
                      next={`/posts/${post.slug}`}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </article>

        {/* Related Posts */}
        {relatedPosts && relatedPosts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 dark:text-gray-50">Related Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((related: any) => (
                <Link
                  key={related.id}
                  href={`/posts/${related.slug}`}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition dark:bg-gray-900"
                >
                  {related.cover_image_url && (
                    <img src={related.cover_image_url} alt={related.title} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 dark:text-gray-50">{related.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2 dark:text-gray-400">{related.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div id="comments" className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 dark:text-gray-50">
            Comments ({comments?.length || 0})
          </h2>

          {reported && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
              Report submitted -- this comment is hidden pending review, and an admin will take a look.
            </div>
          )}
          {report_error && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-400">
              {report_error}
            </div>
          )}

          {/* Comment Form */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
            {user ? (
              <form action={`/api/posts/${post.slug}/comments`} method="POST">
                <textarea
                  name="content"
                  required
                  className="w-full border border-gray-300 rounded-lg p-4 mb-4 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  rows={4}
                  placeholder="Share your thoughts..."
                ></textarea>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold">
                  Post Comment
                </button>
              </form>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">
                <Link href={`/login?next=/posts/${post.slug}`} className="text-blue-600 hover:text-blue-700 font-semibold dark:text-blue-400 dark:hover:text-blue-300">
                  Sign in
                </Link>{' '}
                to join the discussion.
              </p>
            )}
          </div>

          {/* Comments List */}
          <div className="space-y-4">
            {comments && comments.length > 0 ? (
              comments.map((comment: any) => (
                <div key={comment.id} className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
                  <div className="flex gap-4">
                    {comment.profiles?.avatar_url ? (
                      <img src={comment.profiles.avatar_url} alt={comment.profiles.full_name} className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900 dark:text-gray-50">{comment.profiles?.full_name || 'Anonymous'}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{comment.content}</p>
                      {user && user.id !== comment.user_id && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-400 hover:text-red-600 cursor-pointer select-none dark:text-gray-500 dark:hover:text-red-400">
                            Report
                          </summary>
                          <form action="/api/reports/submit" method="POST" className="mt-2 flex flex-col gap-2 max-w-sm">
                            <input type="hidden" name="content_type" value="greymatters_comment" />
                            <input type="hidden" name="content_id" value={comment.id} />
                            <input type="hidden" name="return_to" value={`/posts/${post.slug}`} />
                            <textarea
                              name="reason"
                              required
                              rows={2}
                              placeholder="Why are you reporting this comment?"
                              className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                            />
                            <button type="submit" className="self-start bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70">
                              Submit report
                            </button>
                          </form>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center dark:bg-gray-900">
                <p className="text-gray-600 dark:text-gray-400">No comments yet. Be the first to share your thoughts!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
