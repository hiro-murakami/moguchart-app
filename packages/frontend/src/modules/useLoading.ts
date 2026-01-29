import { provide, inject, ref, type InjectionKey, type Ref } from 'vue'

type LoadingContext = {
  isLoading: Ref<boolean>
  setIsLoading: (value: boolean) => void
}

const loadingKey: InjectionKey<LoadingContext> = Symbol('loading')

export const provideLoading = () => {
  const isLoading = ref(false)
  const setIsLoading = (value: boolean) => {
    isLoading.value = value
  }
  provide(loadingKey, { isLoading, setIsLoading })
  return { isLoading }
}

export const useLoading = () => {
  const context = inject(loadingKey)
  if (!context) {
    throw new Error('useLoading() is not provided.')
  }
  return context
}
