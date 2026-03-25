import type { ColorPalette, Label, Milestone, Project, User } from '@functions/types/shared'
// import { selectUsers } from '@/modules/scripts'
import { isEqual } from 'lodash'
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
  const allUsers = ref<User[]>([])

  // onMounted(async () => {
  //   allUsers.value = await selectUsers()
  // })

  const isEdit = computed(() => !!props.project)
  const title = computed(() => (isEdit.value ? 'プロジェクト編集' : 'プロジェクト追加'))

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
      localHistoryRetentionDays.value !== (props.project.attribute.historyRetentionDays || 0)
    )
  })

  const closeDialog = () => emit('update:modelValue', false)

  const close = () => confirmAndClose(hasChanges, closeDialog)

  const handleBeforeClose = (value: boolean) => {
    if (!value) {
      close()
    }
  }

  const save = async () => {
    const { valid } = (await form.value?.validate()) ?? { valid: false }
    if (!valid) return

    const projectData: Partial<Project> = {
      name: localName.value,
      start: localStart.value,
      end: localEnd.value,
      public: localPublic.value,
      attribute: {
        ...props.project?.attribute,
        description: localDescription.value,
        colorPalettes: localColorPalettes.value,
        labels: localLabels.value,
        milestones: localMilestones.value.length > 0 ? localMilestones.value : undefined,
        historyIntervalMinutes: localHistoryIntervalMinutes.value || undefined,
        historyRetentionDays: localHistoryRetentionDays.value || undefined,
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
    emit('save', projectData)
  }

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
    allUsers,
    title,
    close,
    handleBeforeClose,
    save,
  }
}
