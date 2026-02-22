import themeDarkImg from '@/assets/theme-dark.png'
import themeLightImg from '@/assets/theme-light.png'
import themeSystemImg from '@/assets/theme-system.png'
import { useDiscardConfirm } from '@/composables/useConfirm'
import { useUserStore } from '@/stores/useUserStore'
import type { User } from '@functions/types/shared'
import { computed, ref, watch } from 'vue'

export function useUserDetailDialog(props: { modelValue: boolean }, emit: any) {
  const userStore = useUserStore()
  const user = computed(() => userStore.user)

  const localDisplayName = ref('')
  const localTheme = ref<'light' | 'dark' | 'system'>('system')

  const themeOptions = [
    { title: 'ライト', value: 'light', image: themeLightImg },
    { title: 'ダーク', value: 'dark', image: themeDarkImg },
    { title: 'システム', value: 'system', image: themeSystemImg },
  ]

  const { confirmAndClose } = useDiscardConfirm()

  watch(
    () => props.modelValue,
    (val) => {
      if (val && user.value) {
        localDisplayName.value = user.value.displayName || ''
        localTheme.value = user.value.attribute.theme || 'system'
      }
    },
  )

  const hasChanges = computed(() => {
    if (!user.value) return false
    return (
      localDisplayName.value !== (user.value.displayName || '') ||
      localTheme.value !== (user.value.attribute.theme || 'system')
    )
  })

  const save = async () => {
    if (!user.value) return
    const updatedUser: User = {
      ...user.value,
      displayName: localDisplayName.value,
      attribute: {
        ...user.value.attribute,
        theme: localTheme.value,
      },
    }
    await userStore.saveUser(updatedUser)
    emit('update:modelValue', false)
  }

  const closeDialog = () => emit('update:modelValue', false)

  const close = () => confirmAndClose(hasChanges, closeDialog)

  const handleBeforeClose = (value: boolean) => {
    if (!value) {
      close()
    }
  }

  return {
    user,
    localDisplayName,
    localTheme,
    themeOptions,
    save,
    close,
    handleBeforeClose,
  }
}
