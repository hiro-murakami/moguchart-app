import { useDiscardConfirm } from '@/composables/useConfirm'
import { useUserStore } from '@/stores/useUserStore'
import type { User } from '@functions/types/shared'
import { computed, ref, watch } from 'vue'

export function useUserDetailDialog(props: { modelValue: boolean }, emit: any) {
  const userStore = useUserStore()
  const user = computed(() => userStore.user)

  const localDisplayName = ref('')


  const { confirmAndClose } = useDiscardConfirm()

  watch(
    () => props.modelValue,
    (val) => {
      if (val && user.value) {
        localDisplayName.value = user.value.displayName || ''
      }
    },
  )

  const hasChanges = computed(() => {
    if (!user.value) return false
    return localDisplayName.value !== (user.value.displayName || '')
  })

  const save = async () => {
    if (!user.value) return
    const updatedUser: User = {
      ...user.value,
      displayName: localDisplayName.value,
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
    save,
    close,
    handleBeforeClose,
  }
}
