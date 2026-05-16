import { useUserStore } from '@/stores/useUserStore'
import type { TutorialKey } from '@functions/types/shared'
import { ref, computed } from 'vue'

const activeTutorials = ref<TutorialKey[]>([])

export const useTutorial = () => {
  const userStore = useUserStore()

  const isCompleted = (key: TutorialKey) => {
    return !!userStore.user?.attribute?.tutorialCompleted?.[key]
  }

  const complete = async (key: TutorialKey) => {
    await userStore.completeTutorial(key)
  }

  const registerTutorial = (key: TutorialKey) => {
    if (!activeTutorials.value.includes(key)) {
      activeTutorials.value.push(key)
    }
  }

  const unregisterTutorial = (key: TutorialKey) => {
    activeTutorials.value = activeTutorials.value.filter((k) => k !== key)
  }

  const currentActiveTutorial = computed(() => activeTutorials.value[0] || null)

  return {
    isCompleted,
    complete,
    registerTutorial,
    unregisterTutorial,
    currentActiveTutorial,
  }
}
