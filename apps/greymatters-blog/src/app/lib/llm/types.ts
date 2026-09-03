export interface LLMProviderConfig {
  id: string
  provider: 'anthropic' | 'openai' | 'ollama'
  label: string
  api_key: string | null
  base_url: string | null
  model: string
  enabled: boolean
  priority: number
}

export interface CompletionSuccess {
  ok: true
  text: string
  provider: string
}

export interface CompletionFailure {
  ok: false
  reason: 'not_configured' | 'all_failed'
}

export type CompletionResult = CompletionSuccess | CompletionFailure
