import type { Project } from '@functions/types/shared'
import { debounce } from 'lodash'
import { computed, nextTick, ref, watch } from 'vue'
import type { VForm } from 'vuetify/components'

export interface ProjectDuplicateDialogProps {
  modelValue: boolean
  project?: Project | null
  saving?: boolean
}

export type ProjectDuplicateDialogEmits = {
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', project: Partial<Project>, options: { clearProgress: boolean }): void
}

export function useProjectDuplicateDialog(props: ProjectDuplicateDialogProps, emit: ProjectDuplicateDialogEmits) {
  const form = ref<VForm | null>(null)
  const formValid = ref(false)
  const localName = ref('')
  const localStart = ref('')
  const localEnd = ref('')
  const localClearProgress = ref(true)

  /** 元プロジェクト期間（日数） */
  const originalDurationDays = ref(0)

  /** 元プロジェクトの説明文（表示用） */
  const description = computed(() => props.project?.attribute?.description || '')

  watch(
    () => props.modelValue,
    (isVisible) => {
      if (isVisible && props.project) {
        localName.value = `${props.project.name}のコピー`
        localStart.value = props.project.start
        localEnd.value = props.project.end
        localClearProgress.value = true

        // 元のプロジェクト期間（日数）を記憶
        const s = new Date(props.project.start + 'T00:00:00Z')
        const e = new Date(props.project.end + 'T00:00:00Z')
        originalDurationDays.value = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
      }
    },
  )

  /** 開始日の変更に応じて終了日を自動スライド */
  watch(localStart, (newStart) => {
    if (!newStart) return
    const s = new Date(newStart + 'T00:00:00Z')
    s.setUTCDate(s.getUTCDate() + originalDurationDays.value)
    localEnd.value = s.toISOString().slice(0, 10)
    // 終了日更新後にフォームを再バリデーション（dateBefore/dateAfterルールの不整合を解消）
    nextTick(() => form.value?.validate())
  })

  const close = () => emit('update:modelValue', false)

  const _save = async () => {
    const { valid } = (await form.value?.validate()) ?? { valid: false }
    if (!valid) return

    const projectData: Partial<Project> = {
      name: localName.value,
      start: localStart.value,
      end: localEnd.value,
      public: false,
      attribute: {
        ...props.project?.attribute,
      },
      authority: props.project?.authority ? { ...props.project.authority } : undefined,
    }

    emit('save', projectData, { clearProgress: localClearProgress.value })
  }

  /** 連打防止: 最初のクリックのみ即実行、300ms以内の再クリックは無視 */
  const save = debounce(_save, 300, { leading: true, trailing: false })

  return {
    form,
    formValid,
    localName,
    localStart,
    localEnd,
    localClearProgress,
    description,
    close,
    save,
  }
}
