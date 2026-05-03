import type { ColorPalette, Label, Milestone, Project, User, ProjectGranularity } from '@functions/types/shared'
import { upsertUser } from '@/modules/scripts'
import { useUserStore } from '@/stores/useUserStore'
import { isEqual, debounce } from 'lodash'
import { computed, ref, watch } from 'vue'
import type { VForm } from 'vuetify/components'
import { useDiscardConfirm } from '../../composables/useConfirm'

export interface ProjectDetailDialogProps {
  modelValue: boolean
  project?: Project | null
}

export type ProjectDetailDialogEmits = {
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', project: Partial<Project>): void
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

  /** 過去に入力したことのあるメールアドレスを User[] 形式で返す（補完候補用） */
  const authorityHistoryUsers = computed<User[]>(() => {
    const history = userStore.currentUser?.attribute?.authorityInputHistory ?? []
    return history.map((email) => ({ email, attribute: {} }))
  })

  const isEdit = computed(() => !!props.project)
  const title = computed(() => {
    return isEdit.value ? 'プロジェクト編集' : 'プロジェクト追加'
  })

  watch(
    () => props.modelValue,
    async (isVisible) => {
      if (isVisible) {
        if (props.project) {
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
          // await nextTick() // DOMの更新を待つ
          // form.value?.validate()
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
          localColorPalettes.value = []
          localLabels.value = []
          localMilestones.value = []
          localHistoryIntervalMinutes.value = 0
          localHistoryRetentionDays.value = 7
          localGranularity.value = 'daily'
          // form.value?.resetValidation()
        }
      } else {
        // form.value?.resetValidation()
      }
    },
  )

  const hasChanges = computed(() => {
    if (!props.project) {
      // 新規追加モード: 何か入力されていれば変更とみなす
      return (
        localName.value !== '' ||
        localDescription.value !== '' ||
        localStart.value !== '' ||
        localEnd.value !== '' ||
        localPublic.value !== false ||
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
      localHistoryRetentionDays.value !== (props.project.attribute.historyRetentionDays || 7)
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
            const [year, month] = localEnd.value.split('-').map(Number)
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
        // granularity は新規作成時のみ設定（編集時は既存値を保持）
        ...(!isEdit.value ? { granularity: localGranularity.value } : {}),
      },
      authority: {
        owners: localOwners.value,
        editors: localEditors.value,
        viewers: localViewers.value,
      },
    }
    if (isEdit.value && props.project) {
      projectData.id = props.project.id
    }

    // 入力されたメールアドレスを履歴に追記して永続化
    if (userStore.currentUser) {
      const inputEmails = [
        ...localOwners.value,
        ...localEditors.value,
        ...localViewers.value,
      ]
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

    emit('save', projectData)
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
    authorityHistoryUsers,
    title,
    close,
    handleBeforeClose,
    save,
  }
}
