import type { LLMProviderConfig } from '../types'

export async function completeWithOpenAI(
  config: LLMProviderConfig,
  system: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  // Honors a custom base_url so any OpenAI-compatible endpoint (e.g.
  // Gemini's https://generativelanguage.googleapis.com/v1beta/openai/) can
  // be used via provider='openai' with no new provider type needed.
  const baseUrl = (config.base_url || 'https://api.openai.com/v1').replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.api_key || ''}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
    // See anthropic.ts's identical comment -- caps how long a hung upstream
    // can block the calling request before complete() falls through to the
    // next configured provider.
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}
