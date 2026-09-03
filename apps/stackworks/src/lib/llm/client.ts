import { createServiceClient } from '@/lib/supabase/service'
import type { LLMProviderConfig, CompletionResult } from './types'
import { completeWithAnthropic } from './providers/anthropic'
import { completeWithOpenAI } from './providers/openai'
import { completeWithOllama } from './providers/ollama'

async function callProvider(config: LLMProviderConfig, system: string, prompt: string, maxTokens: number): Promise<string> {
  switch (config.provider) {
    case 'anthropic':
      return completeWithAnthropic(config, system, prompt, maxTokens)
    case 'openai':
      return completeWithOpenAI(config, system, prompt, maxTokens)
    case 'ollama':
      return completeWithOllama(config, system, prompt)
  }
}

/**
 * Resolves featureKey's flag, then tries enabled providers in priority
 * order, falling through to the next on failure. Never throws -- a
 * disabled feature, zero configured providers, or every provider failing
 * all produce a typed {ok: false} result so callers can degrade to
 * manual-review-only instead of failing the whole request.
 */
export async function complete(featureKey: string, system: string, prompt: string, maxTokens = 1024): Promise<CompletionResult> {
  const supabase = createServiceClient()

  const { data: flag } = await supabase
    .from('llm_feature_flags')
    .select('enabled, provider_id')
    .eq('feature_key', featureKey)
    .maybeSingle()

  if (!flag || !flag.enabled) {
    return { ok: false, reason: 'not_configured' }
  }

  let providers: LLMProviderConfig[] = []
  if (flag.provider_id) {
    const { data } = await supabase.from('llm_providers').select('*').eq('id', flag.provider_id).eq('enabled', true)
    providers = data || []
  } else {
    const { data } = await supabase.from('llm_providers').select('*').eq('enabled', true).order('priority', { ascending: true })
    providers = data || []
  }

  if (providers.length === 0) {
    return { ok: false, reason: 'not_configured' }
  }

  for (const config of providers) {
    try {
      const text = await callProvider(config, system, prompt, maxTokens)
      if (text.trim()) {
        return { ok: true, text, provider: `${config.provider}:${config.model}` }
      }
    } catch (error) {
      console.error(`LLM provider ${config.provider} (${config.label}) failed:`, error)
    }
  }

  return { ok: false, reason: 'all_failed' }
}
