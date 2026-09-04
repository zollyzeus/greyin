'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

/**
 * Still a plain <textarea name="content"> under the hood, so the
 * surrounding server-rendered <form method="POST"> submits it exactly like
 * before — this just adds a live-rendered preview alongside it. Markdown
 * itself already rendered safely on the public post page (react-markdown
 * doesn't use dangerouslySetInnerHTML); this only adds a preview of that
 * same rendering while writing, plus code syntax highlighting.
 */
export function MarkdownEditor({ defaultValue }: { defaultValue?: string }) {
  const [content, setContent] = useState(defaultValue || '')
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Content (Markdown supported)
        </label>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {showPreview ? 'Back to editing' : 'Preview'}
        </button>
      </div>

      {showPreview ? (
        <div className="prose max-w-none border border-gray-300 rounded-lg p-4 min-h-[300px] bg-white dark:border-gray-700 dark:bg-gray-900">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {content || '*Nothing to preview yet.*'}
          </ReactMarkdown>
        </div>
      ) : (
        <textarea
          id="content"
          name="content"
          rows={12}
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm dark:border-gray-700"
        />
      )}
    </div>
  )
}
