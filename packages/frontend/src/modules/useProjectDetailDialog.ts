import type { Project } from '@functions/types/shared'
import { computed, nextTick, ref, watch } from 'vue'
import type { VForm } from 'vuetify/components'

export interface ProjectDetailDialogProps {
  modelValue: boolean
  project?: Project | null
}

export type ProjectDetailDialogEmits = {
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', project: Partial<Project>): void
}

export function useProjectDetailDialog(
  props: ProjectDetailDialogProps,
  emit: ProjectDetailDialogEmits,
) {
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

  const isEdit = computed(() => !!props.project)
  const title = computed(() =>
    isEdit.value ? 'プロジェクト編集' : 'プロジェクト追加',
  )

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
          await nextTick() // DOMの更新を待つ
          form.value?.validate()
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
          form.value?.resetValidation()
        }
      } else {
        form.value?.resetValidation()
      }
    },
  )

  const close = () => {
    emit('update:modelValue', false)
  }

  const save = async () => {
    if (!formValid.value) return

    const projectData: Partial<Project> = {
      name: localName.value,
      start: localStart.value,
      end: localEnd.value,
      public: localPublic.value,
      attribute: {
        description: localDescription.value,
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
    title,
    close,
    save,
  }
}
