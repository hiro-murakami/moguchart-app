import type { ColorPalette, Label, Milestone, Project, User, ProjectGranularity } from '@functions/types/shared'
import { upsertUser } from '@/modules/scripts'
import { useUserStore } from '@/stores/useUserStore'
import { DEFAULT_COLOR_PALETTES } from '@functions/types/shared'
import { isEqual, debounce } from 'lodash'
import { computed, ref, watch, nextTick } from 'vue'
import type { VForm } from 'vuetify/components'
import { useDiscardConfirm } from '../../composables/useConfirm'
import dayjs from 'dayjs'


export interface ProjectDetailDialogProps {
  modelValue: boolean
  project?: Project | null
  initialGranularity?: ProjectGranularity
  isDuplicate?: boolean
}

export type ProjectDetailDialogEmits = {
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', project: Partial<Project>, options?: { clearProgress?: boolean }): void
}

export function useProjectDetailDialog(props: ProjectDetailDialogProps, emit: ProjectDetailDialogEmits) {
  const { confirmAndClose } = useDiscardConfirm()
  const userStore = useUserStore()
  const form = ref<VForm | null>(null)
  const formValid = ref(false)
  const localName = ref('')
  const localDescription = ref('')
  const localStart = ref('')
  const localEnd = ref('')
  const localPublic = ref(false)
  const localOwners = ref<string[]>([])
  const localEditors = ref<string[]>([])
  const localViewers = ref<string[]>([])
  const localColorPalettes = ref<ColorPalette[]>([])
  const localLabels = ref<Label[]>([])
  const localMilestones = ref<Milestone[]>([])
  const localHistoryIntervalMinutes = ref<number>(0)
  const localHistoryRetentionDays = ref<number>(0)
  const localGranularity = ref<ProjectGranularity>('daily')
  const localSnapDurationMinutes = ref<number>(60)
  const localDisableRowReorder = ref(false)
  const localDisableCrossRowMove = ref(false)
  const localEnableProgress = ref(true)

  /** 複製モード時の元プロジェクト期間と単位 */
  const originalDuration = ref(0)
  const durationUnit = ref<'month' | 'day' | 'millisecond'>('day')

  /** 複製モード時: 進捗率をクリアするかどうか */
  const localClearProgress = ref(true)

  /** 過去に入力したことのあるメールアドレスを User[] 形式で返す（補完候補用） */
  const authorityHistoryUsers = computed<User[]>(() => {
    const history = userStore.currentUser?.attribute?.authorityInputHistory ?? []
    return history.map((email) => ({ email, attribute: {} }))
  })

  const isEdit = computed(() => !!props.project)
  const title = computed(() => {
    if (props.isDuplicate) return 'プロジェクト複製'
    return isEdit.value ? 'プロジェクト詳細' : 'プロジェクト追加'
  })

  watch(
    () => props.modelValue,
    async (isVisible) => {
      if (isVisible) {
        if (props.project) {
          if (props.isDuplicate) {
            // 複製モード
            localName.value = `${props.project.name}のコピー`
            localDescription.value = props.project.attribute.description || ''
            localStart.value = props.project.start
            localEnd.value = props.project.end
            localPublic.value = false
            if (props.project.authority) {
              const { owners, editors, viewers } = props.project.authority
              localOwners.value = owners || []
              localEditors.value = editors || []
              localViewers.value = viewers || []
            } else {
              localOwners.value = []
              localEditors.value = []
              localViewers.value = []
            }
            localColorPalettes.value = props.project.attribute.colorPalettes
              ? props.project.attribute.colorPalettes.map((p) => ({ ...p }))
              : []
            localLabels.value = props.project.attribute.labels
              ? props.project.attribute.labels.map((l) => ({ ...l }))
              : []
            localMilestones.value = props.project.attribute.milestones
              ? props.project.attribute.milestones.map((m) => ({ ...m }))
              : []
            localHistoryIntervalMinutes.value = props.project.attribute.historyIntervalMinutes || 0
            localHistoryRetentionDays.value = props.project.attribute.historyRetentionDays || 7
            localGranularity.value = props.project.attribute.granularity || 'daily'
            localSnapDurationMinutes.value =
              props.project.attribute.snapDurationMinutes || (localGranularity.value === 'hourly' ? 60 : 1440)
            localDisableRowReorder.value = !!props.project.attribute.disableRowReorder
            localDisableCrossRowMove.value = !!props.project.attribute.disableCrossRowMove
            localEnableProgress.value = props.project.attribute.enableProgress !== false
            localClearProgress.value = true

            // 元のプロジェクト期間を記憶
            const granularity = props.project.attribute.granularity || 'daily'
            const s = dayjs(props.project.start)
            const e = dayjs(props.project.end)
            if (granularity === 'monthly') {
              durationUnit.value = 'month'
              originalDuration.value = e.diff(s, 'month')
            } else if (granularity === 'hourly') {
              durationUnit.value = 'millisecond'
              originalDuration.value = e.diff(s, 'millisecond')
            } else {
              durationUnit.value = 'day'
              originalDuration.value = e.diff(s, 'day')
            }
          } else {
            // 編集モード
            localName.value = props.project.name
            localDescription.value = props.project.attribute.description || ''
            localStart.value = props.project.start
            localEnd.value = props.project.end
            localPublic.value = props.project.public
            if (props.project.authority) {
              const { owners, editors, viewers } = props.project.authority
              localOwners.value = owners || []
              localEditors.value = editors || []
              localViewers.value = viewers || []
            } else {
              localOwners.value = []
              localEditors.value = []
              localViewers.value = []
            }
            localColorPalettes.value = props.project.attribute.colorPalettes
              ? props.project.attribute.colorPalettes.map((p) => ({ ...p }))
              : []
            localLabels.value = props.project.attribute.labels
              ? props.project.attribute.labels.map((l) => ({ ...l }))
              : []
            localMilestones.value = props.project.attribute.milestones
              ? props.project.attribute.milestones.map((m) => ({ ...m }))
              : []
            localHistoryIntervalMinutes.value = props.project.attribute.historyIntervalMinutes || 0
            localHistoryRetentionDays.value = props.project.attribute.historyRetentionDays || 7
            localGranularity.value = props.project.attribute.granularity || 'daily'
            localSnapDurationMinutes.value =
              props.project.attribute.snapDurationMinutes || (localGranularity.value === 'hourly' ? 60 : 1440)
            localDisableRowReorder.value = !!props.project.attribute.disableRowReorder
            localDisableCrossRowMove.value = !!props.project.attribute.disableCrossRowMove
            localEnableProgress.value = props.project.attribute.enableProgress !== false
          }
        } else {
          // 新規追加モード
          localName.value = ''
          localDescription.value = ''
          localStart.value = ''
          localEnd.value = ''
          localPublic.value = false
          localOwners.value = []
          localEditors.value = []
          localViewers.value = []
          localColorPalettes.value = DEFAULT_COLOR_PALETTES.map((p) => ({ ...p }))
          localLabels.value = []
          localMilestones.value = []
          localHistoryIntervalMinutes.value = 0
          localHistoryRetentionDays.value = 7
          localGranularity.value = props.initialGranularity || 'daily'
          localSnapDurationMinutes.value = localGranularity.value === 'hourly' ? 60 : 1440
          localDisableRowReorder.value = false
          localDisableCrossRowMove.value = false
          localEnableProgress.value = true
        }
      }
    },
  )

  /** 複製モード: 開始日の変更に応じて終了日を自動スライド */
  watch(localStart, (newStart) => {
    if (!props.isDuplicate || !newStart) return
    const s = dayjs(newStart)
    const newEnd = s.add(originalDuration.value, durationUnit.value)

    const granularity = localGranularity.value || props.project?.attribute?.granularity || 'daily'
    if (granularity === 'monthly') {
      localEnd.value = newEnd.format('YYYY-MM')
    } else if (granularity === 'hourly') {
      localEnd.value = newEnd.format('YYYY-MM-DDTHH:mm')
    } else {
      localEnd.value = newEnd.format('YYYY-MM-DD')
    }
    // 終了日更新後にフォームを再バリデーション（dateBefore/dateAfterルールの不整合を解消）
    nextTick(() => form.value?.validate())
  })

  const hasChanges = computed(() => {
    if (!props.project) {
      // 新規追加モード: 何か入力されていれば変更とみなす
      return (
        localName.value !== '' ||
        localDescription.value !== '' ||
        localStart.value !== '' ||
        localEnd.value !== '' ||
        localPublic.value !== false ||
        localDisableRowReorder.value !== false ||
        localDisableCrossRowMove.value !== false ||
        localOwners.value.length > 0 ||
        localEditors.value.length > 0 ||
        localViewers.value.length > 0 ||
        localColorPalettes.value.length > 0 ||
        localLabels.value.length > 0 ||
        localMilestones.value.length > 0
      )
    }
    // 編集モード: 元の値と比較
    const originalColorPalettes = props.project.attribute.colorPalettes || []
    const originalLabels = props.project.attribute.labels || []
    const originalMilestones = props.project.attribute.milestones || []
    return (
      localName.value !== props.project.name ||
      localDescription.value !== (props.project.attribute.description || '') ||
      localStart.value !== props.project.start ||
      localEnd.value !== props.project.end ||
      localPublic.value !== props.project.public ||
      !isEqual(localOwners.value, props.project.authority?.owners || []) ||
      !isEqual(localEditors.value, props.project.authority?.editors || []) ||
      !isEqual(localViewers.value, props.project.authority?.viewers || []) ||
      !isEqual(localColorPalettes.value, originalColorPalettes) ||
      !isEqual(localLabels.value, originalLabels) ||
      !isEqual(localMilestones.value, originalMilestones) ||
      localHistoryIntervalMinutes.value !== (props.project.attribute.historyIntervalMinutes || 0) ||
      localHistoryRetentionDays.value !== (props.project.attribute.historyRetentionDays || 7) ||
      localDisableRowReorder.value !== !!props.project.attribute.disableRowReorder ||
      localDisableCrossRowMove.value !== !!props.project.attribute.disableCrossRowMove ||
      localEnableProgress.value !== (props.project.attribute.enableProgress !== false) ||
      (localGranularity.value === 'hourly' || localGranularity.value === 'daily'
        ? localSnapDurationMinutes.value !==
          (props.project.attribute.snapDurationMinutes ||
            (props.project.attribute.granularity === 'hourly' ? 60 : 1440))
        : false)
    )
  })

  const closeDialog = () => emit('update:modelValue', false)

  const close = () => confirmAndClose(hasChanges, closeDialog)

  const handleBeforeClose = (value: boolean) => {
    if (!value) {
      close()
    }
  }

  const _save = async () => {
    const { valid } = (await form.value?.validate()) ?? { valid: false }
    if (!valid) return

    // 月単位の場合、終了日をその月の末日に変換する
    const granularity = localGranularity.value || props.project?.attribute?.granularity || 'daily'
    const endValue =
      granularity === 'monthly' && localEnd.value
        ? (() => {
            const [year = 0, month = 1] = localEnd.value.split('-').map(Number)
            const lastDay = new Date(year, month, 0).getDate()
            return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
          })()
        : localEnd.value

    const projectData: Partial<Project> = {
      name: localName.value,
      start: localStart.value,
      end: endValue,
      public: localPublic.value,
      attribute: {
        ...props.project?.attribute,
        description: localDescription.value,
        colorPalettes: localColorPalettes.value,
        labels: localLabels.value,
        milestones: localMilestones.value.length > 0 ? localMilestones.value : undefined,
        historyIntervalMinutes: localHistoryIntervalMinutes.value || undefined,
        historyRetentionDays: localHistoryRetentionDays.value || undefined,
        disableRowReorder: localDisableRowReorder.value ? true : undefined,
        disableCrossRowMove: localDisableCrossRowMove.value ? true : undefined,
        enableProgress: localEnableProgress.value ? undefined : false,
        // granularity は新規作成時のみ設定（編集時は既存値を保持）
        ...(!isEdit.value ? { granularity: localGranularity.value } : {}),
        // snapDurationMinutes は hourly および daily モード時のみ保存
        ...(granularity === 'hourly' || granularity === 'daily'
          ? { snapDurationMinutes: localSnapDurationMinutes.value }
          : {}),
      },
      authority: {
        owners: localOwners.value,
        editors: localEditors.value,
        viewers: localViewers.value,
      },
    }
    if (isEdit.value && props.project && !props.isDuplicate) {
      projectData.id = props.project.id
    }

    // 入力されたメールアドレスを履歴に追記して永続化
    if (userStore.currentUser) {
      const inputEmails = [...localOwners.value, ...localEditors.value, ...localViewers.value]
      if (inputEmails.length > 0) {
        const existingHistory = userStore.currentUser.attribute?.authorityInputHistory ?? []
        const merged = Array.from(new Set([...existingHistory, ...inputEmails]))
        const updatedUser = {
          ...userStore.currentUser,
          attribute: {
            ...userStore.currentUser.attribute,
            authorityInputHistory: merged,
          },
        }
        await upsertUser(updatedUser)
        userStore.user = updatedUser
      }
    }

    emit('save', projectData, props.isDuplicate ? { clearProgress: localClearProgress.value } : undefined)
  }

  /** 連打防止: 最初のクリックのみ即実行、300ms以内の再クリックは無視 */
  const save = debounce(_save, 300, { leading: true, trailing: false })

  return {
    form,
    formValid,
    localName,
    localDescription,
    localStart,
    localEnd,
    localPublic,
    localOwners,
    localEditors,
    localViewers,
    localColorPalettes,
    localLabels,
    localHistoryIntervalMinutes,
    localMilestones,
    localHistoryRetentionDays,
    localGranularity,
    localSnapDurationMinutes,
    localDisableRowReorder,
    localDisableCrossRowMove,
    localEnableProgress,
    authorityHistoryUsers,
    title,
    localClearProgress,
    close,
    handleBeforeClose,
    save,
  }
}
