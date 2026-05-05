import type { Project } from '@functions/types/shared'
import { debounce } from 'lodash'
import { computed, nextTick, ref, watch } from 'vue'
import type { VForm } from 'vuetify/components'
import dayjs from 'dayjs'

/** ステッパーのステップ数 */
const TOTAL_STEPS = 3

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

  /** --- ステッパー制御 --- */
  const currentStep = ref(1)

  /** 現在のステップのバリデーションが通るかどうか */
  const canProceed = computed(() => {
    switch (currentStep.value) {
      case 1:
        return !!localName.value && localName.value.length <= 191
      case 2:
        return !!localStart.value && !!localEnd.value && localStart.value <= localEnd.value
      case 3:
        return true
      default:
        return false
    }
  })

  const isFirstStep = computed(() => currentStep.value === 1)
  const isLastStep = computed(() => currentStep.value === TOTAL_STEPS)

  const nextStep = () => {
    if (canProceed.value && currentStep.value < TOTAL_STEPS) {
      currentStep.value++
    }
  }

  const prevStep = () => {
    if (currentStep.value > 1) {
      currentStep.value--
    }
  }

  /** 元プロジェクト期間（ミリ秒） */
  const originalDurationMs = ref(0)
  const projectGranularity = ref('daily')

  /** 元プロジェクトの説明文（表示用） */
  const description = computed(() => props.project?.attribute?.description || '')

  watch(
    () => props.modelValue,
    (isVisible) => {
      if (isVisible && props.project) {
        const startRaw = props.project.start
        const endRaw = props.project.end
        
        const granularity = props.project.attribute?.granularity || 'daily'
        projectGranularity.value = granularity

        const isHourly = granularity === 'hourly'
        const isMonthly = granularity === 'monthly'

        const formatLength = isHourly ? 16 : isMonthly ? 7 : 10
        const startStr = startRaw.slice(0, formatLength)
        const endStr = endRaw.slice(0, formatLength)

        // 元のプロジェクト期間（ミリ秒）を記憶
        const s = dayjs(startRaw)
        const e = dayjs(endRaw)
        originalDurationMs.value = e.diff(s, 'millisecond')

        localName.value = `${props.project.name}のコピー`
        localStart.value = startStr
        localEnd.value = endStr
        localClearProgress.value = true
        currentStep.value = 1
      }
    },
  )

  /** 開始日の変更に応じて終了日を自動スライド */
  watch(localStart, (newStart) => {
    if (!newStart) return
    const s = dayjs(newStart)
    if (!s.isValid()) return
    
    const isHourly = projectGranularity.value === 'hourly'
    const isMonthly = projectGranularity.value === 'monthly'
    
    const e = s.add(originalDurationMs.value, 'millisecond')
    
    localEnd.value = e.format(isHourly ? 'YYYY-MM-DDTHH:mm' : isMonthly ? 'YYYY-MM' : 'YYYY-MM-DD')
    
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
    // ステッパー
    currentStep,
    canProceed,
    isFirstStep,
    isLastStep,
    nextStep,
    prevStep,
  }
}
