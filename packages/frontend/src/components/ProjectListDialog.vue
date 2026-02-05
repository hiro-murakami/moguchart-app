<script setup lang="ts">
import {
  deleteProject as deleteProjectScript,
  duplicateProject as duplicateProjectScript,
  selectProjects,
  upsertProject,
} from '@/modules/scripts'
import { useConfirm } from '@/modules/useConfirm'
import { useSnackbar } from '@/modules/useSnackbar'
import type { Project } from '@functions/types/shared'
import { ref, watch } from 'vue'
import ProjectDetailDialog from './ProjectDetailDialog.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', projectId: string): void
  (e: 'update'): void
}>()

const projects = ref<Project[]>([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const isProjectDetailDialogVisible = ref(false)
const projectToEdit = ref<Project | null>(null)
const originalId = ref<string>()
const confirm = useConfirm()
const snackbar = useSnackbar()

const fetchProjects = async (isFirst: boolean = false) => {
  loading.value = true
  try {
    projects.value = await selectProjects()
    if (!isFirst) {
      emit('update')
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      fetchProjects(true)
    }
  },
)

const headers = [
  { title: 'プロジェクト名', key: 'name' },
  { title: '', key: 'role' },
  { title: '説明', key: 'attribute.description' },
  { title: '開始日', key: 'start' },
  { title: '終了日', key: 'end' },
  { title: '操作', key: 'actions', sortable: false },
]

const close = () => {
  emit('update:modelValue', false)
}

const selectProject = (project: Project) => {
  emit('select', project.id)
  close()
}

const editProject = (project: Project) => {
  projectToEdit.value = project
  originalId.value = undefined
  isProjectDetailDialogVisible.value = true
}

const newProject = () => {
  projectToEdit.value = null
  originalId.value = undefined
  isProjectDetailDialogVisible.value = true
}

const saveProject = async (project: Partial<Project>) => {
  saving.value = true
  try {
    if (originalId.value) {
      await duplicateProjectScript({
        originalProjectId: originalId.value,
        newProjectData: project as Project,
      })
    } else {
      await upsertProject(project as Project)
    }
    isProjectDetailDialogVisible.value = false
    await fetchProjects() // Refresh the list
  } catch (e) {
    console.error(e)
    // TODO: Show error snackbar
  } finally {
    saving.value = false
  }
}

const deleteProject = async (project: Project) => {
  if (!project) return

  if (
    !(await confirm({
      title: '⚠️ プロジェクトの削除',
      message: `プロジェクト "<strong>${project.name}</strong>" を削除してもよろしいですか？<br><span class="text-error font-weight-bold">※この操作は取り消すことができません。</span>`,
      confirmText: '削除',
      confirmColor: 'error',
    }))
  )
    return

  deleting.value = true
  try {
    await deleteProjectScript(project.id)
    snackbar({
      message: 'プロジェクトを削除しました。',
      color: 'success',
    })

    await fetchProjects() // Refresh the list
  } catch (e) {
    console.error(e)
    snackbar({
      message: 'プロジェクトの削除に失敗しました。',
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}

const duplicateProject = (project: Project) => {
  projectToEdit.value = {
    ...project,
    id: '', // Remove id to create a new project
    name: `${project.name}のコピー`,
  }
  originalId.value = project.id
  isProjectDetailDialogVisible.value = true
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="1000px"
  >
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>プロジェクト一覧</span>
        <div>
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            class="mr-2"
            @click="newProject"
          >
            新規作成
          </v-btn>
          <v-btn icon="mdi-close" variant="text" @click="close"></v-btn>
        </div>
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="headers"
          :items="projects"
          :loading="loading || deleting"
          hover
          density="compact"
          class="row-pointer"
          @click:row="
            (_: unknown, { item }: { item: Project }) => selectProject(item)
          "
        >
          <template #item.role="{ item }">
            <RoleChip :role="item.role" />
            <v-chip
              v-if="item.public"
              class="ml-2"
              color="secondary"
              size="small"
            >
              一般公開
            </v-chip>
          </template>
          <template #item.attribute.description="{ item }">
            <v-tooltip
              location="top"
              open-on-hover
              :open-delay="500"
              :disabled="!item.attribute?.description"
            >
              <template #activator="{ props }">
                <div
                  v-bind="props"
                  class="text-truncate"
                  style="max-width: 200px"
                >
                  {{ item.attribute?.description }}
                </div>
              </template>
              <span>{{ item.attribute?.description }}</span>
            </v-tooltip>
          </template>
          <template #item.actions="{ item }: { item: Project }">
            <v-tooltip
              v-if="item.role === 'owner' || item.role === 'editor'"
              :open-delay="500"
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-pencil"
                  variant="text"
                  size="small"
                  @click.stop="editProject(item)"
                ></v-btn>
              </template>
              <span>編集</span>
            </v-tooltip>
            <v-tooltip
              v-if="item.role === 'owner'"
              :open-delay="500"
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-content-copy"
                  variant="text"
                  size="small"
                  @click.stop="duplicateProject(item)"
                ></v-btn>
              </template>
              <span>複製</span>
            </v-tooltip>
            <v-tooltip
              v-if="item.role === 'owner'"
              :open-delay="500"
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  @click.stop="deleteProject(item)"
                ></v-btn>
              </template>
              <span>削除</span>
            </v-tooltip>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-dialog>

  <ProjectDetailDialog
    v-model="isProjectDetailDialogVisible"
    :project="projectToEdit"
    @save="saveProject"
  />
</template>

<style scoped>
.row-pointer :deep(tbody tr) {
  cursor: pointer;
}
</style>
