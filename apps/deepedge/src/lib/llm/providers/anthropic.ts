import type { LLMProviderConfig } from '../types'

export async function completeWithAnthropic(
  config: LLMProviderConfig,
  system: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.api_key || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      system,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
    // A hung upstream (rare, but possible on any HTTP call) would otherwise
    // hang the calling request indefinitely -- complete()'s own try/catch
    // already treats a thrown error the same as a non-2xx response (falls
    // through to the next provider), so aborting here is all that's needed.
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || ''
}
