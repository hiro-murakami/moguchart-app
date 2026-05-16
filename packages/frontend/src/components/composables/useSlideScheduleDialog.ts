import type { Project } from '@functions/types/shared'
import { debounce } from 'lodash'
import { computed, nextTick, ref, watch } from 'vue'
import type { VForm } from 'vuetify/components'
import dayjs from 'dayjs'

export interface SlideScheduleDialogProps {
  modelValue: boolean
  project?: Project | null
}

export type SlideScheduleDialogEmits = {
  (e: 'update:modelValue', value: boolean): void
  (e: 'slide', options: { newStart: string; clearProgress: boolean }): void
}

export function useSlideScheduleDialog(props: SlideScheduleDialogProps, emit: SlideScheduleDialogEmits) {
  const form = ref<VForm | null>(null)
  const formValid = ref(false)
  const localStart = ref('')
  const localEnd = ref('')
  const localClearProgress = ref(false)

  /** 元プロジェクト期間（ミリ秒） */
  const originalDurationMs = ref(0)
  const projectGranularity = ref('daily')

  /** 開始日に変更があるかどうか */
  const hasStartChanged = computed(() => {
    if (!props.project) return false
    const granularity = props.project.attribute?.granularity || 'daily'
    const isHourly = granularity === 'hourly'
    const isMonthly = granularity === 'monthly'
    const formatLength = isHourly ? 16 : isMonthly ? 7 : 10
    const originalStart = props.project.start.slice(0, formatLength)
    return localStart.value !== originalStart
  })

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

        localStart.value = startStr
        localEnd.value = endStr
        localClearProgress.value = false
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

    // 終了日更新後にフォームを再バリデーション
    nextTick(() => form.value?.validate())
  })

  const close = () => emit('update:modelValue', false)

  const _slide = async () => {
    const { valid } = (await form.value?.validate()) ?? { valid: false }
    if (!valid) return

    emit('slide', {
      newStart: localStart.value,
      clearProgress: localClearProgress.value,
    })
  }

  /** 連打防止 */
  const slide = debounce(_slide, 300, { leading: true, trailing: false })

  return {
    form,
    formValid,
    localStart,
    localEnd,
    localClearProgress,
    hasStartChanged,
    close,
    slide,
  }
}
