import { useUserStore } from '@/stores/useUserStore'
import type { TutorialKey } from '@functions/types/shared'

export const useTutorial = () => {
  const userStore = useUserStore()

  const isCompleted = (key: TutorialKey) => {
    return !!userStore.user?.attribute?.tutorialCompleted?.[key]
  }

  const complete = async (key: TutorialKey) => {
    await userStore.completeTutorial(key)
  }

  return {
    isCompleted,
    complete,
  }
}
