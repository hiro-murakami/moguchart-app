import { inject, type InjectionKey } from 'vue'

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
  return tutorial
}
