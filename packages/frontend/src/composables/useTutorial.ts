import { inject, type InjectionKey } from 'vue'
import { useUserStore } from '@/stores/useUserStore'
import type { TutorialKey } from '@functions/types/shared'

export interface TutorialOptions {
  target: string | HTMLElement
  title?: string
  message: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

type TutorialFunction = (options: TutorialOptions) => Promise<void>

export const tutorialKey: InjectionKey<TutorialFunction> = Symbol('tutorial')

export const useTutorial = () => {
  const tutorial = inject(tutorialKey)
  if (!tutorial) {
    throw new Error('tutorial() is not provided.')
  }

  const userStore = useUserStore()

  const isCompleted = (key: TutorialKey) => {
    return !!userStore.user?.attribute?.tutorialCompleted?.[key]
  }

  const complete = async (key: TutorialKey) => {
    await userStore.completeTutorial(key)
  }

  return {
    show: tutorial,
    isCompleted,
    complete,
  }
}
