import type { LLMProviderConfig } from '../types'

export async function completeWithOpenAI(
  config: LLMProviderConfig,
  system: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
