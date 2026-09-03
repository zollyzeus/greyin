import type { LLMProviderConfig } from '../types'

/** Self-hosted, no API key -- just a reachable base_url + model name. */
export async function completeWithOllama(config: LLMProviderConfig, system: string, prompt: string): Promise<string> {
  const baseUrl = (config.base_url || 'http://localhost:11434').replace(/\/$/, '')

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt: `${system}\n\n${prompt}`,
      stream: false,
    }),
    // Self-hosted generation is typically slower than a commercial API, and
    // this is the provider most likely to be genuinely unreachable (a local
    // model host that's down) -- a longer cap than anthropic.ts/openai.ts's
    // 20s, but still bounded so a hung request doesn't hang forever.
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  return data.response || ''
}
