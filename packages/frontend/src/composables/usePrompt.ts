import { inject, type InjectionKey } from 'vue'
import type { PromptOptions } from '@/components/common/PromptDialog.vue'

type PromptFunction = (options?: PromptOptions) => Promise<string | null>

export const promptKey: InjectionKey<PromptFunction> = Symbol('prompt')

export const usePrompt = () => {
  const prompt = inject(promptKey)
  if (!prompt) {
    throw new Error('prompt() is not provided.')
  }
  return prompt
}
