import { complete } from './llm/client'

export interface ThreadReply {
  body: string
}

/**
 * AI enhancement (Phase A3). Gated internally at >=5 replies -- below
 * that, reading the thread directly is just as fast as a summary, same
 * ">=N is a pattern worth summarizing, below that is noise" reasoning
 * already used by buildFeedbackHint() (deepedge job-recommendations).
 * Live/on-demand, no new table -- a thread page is read far less often
 * than it'd cost to maintain a cache correctly.
 */
export async function summarizeThread(discussionTitle: string, discussionBody: string, replies: ThreadReply[]): Promise<string | null> {
  if (replies.length < 5) return null

  const system = `Summarize this Salt & Pepper discussion thread in 2-3 sentences for someone deciding whether to read the whole thing -- what was originally asked, and the gist of how the conversation went (general agreement, real disagreement, a clear best answer, still unresolved). Only use what's actually in the thread. Respond with ONLY the summary, no preamble, no markdown.`

  const prompt = [
    `Original post: ${discussionTitle}`,
    discussionBody,
    '',
    'Replies:',
    ...replies.map((r, i) => `${i + 1}. ${r.body}`),
  ].join('\n')

  const result = await complete('saltnpepper_thread_summary', system, prompt, 300)
  if (!result.ok) return null
  return result.text.trim()
}
