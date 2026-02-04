<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Project } from '@functions/types/shared'
import { selectProjects, upsertProject } from '@/modules/scripts'
import ProjectDetailDialog from './ProjectDetailDialog.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', projectId: string): void
}>()

const projects = ref<Project[]>([])
const loading = ref(false)
const saving = ref(false)
const isProjectDetailDialogVisible = ref(false)
const projectToEdit = ref<Project | null>(null)

const fetchProjects = async () => {
  loading.value = true
  try {
    projects.value = await selectProjects()
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
      fetchProjects()
    }
  },
)

const headers = [
  { title: 'プロジェクト名', key: 'name' },
  { title: 'ロール', key: 'role' },
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
  isProjectDetailDialogVisible.value = true
}

const newProject = () => {
  projectToEdit.value = null
  isProjectDetailDialogVisible.value = true
}

const saveProject = async (project: Partial<Project>) => {
  saving.value = true
  try {
    await upsertProject(project as Project)
    isProjectDetailDialogVisible.value = false
    await fetchProjects() // Refresh the list
  } catch (e) {
    console.error(e)
    // TODO: Show error snackbar
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="900px"
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
          :loading="loading"
          hover
          density="compact"
          class="row-pointer"
          @click:row="
            (_: unknown, { item }: { item: Project }) => selectProject(item)
          "
        >
          <template #item.role="{ item }">
            <RoleChip :role="item.role" />
          </template>
          <template #item.attribute.description="{ item }">
            <v-tooltip
              location="top"
              open-on-hover
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
            <v-btn
              v-if="item.role === 'owner' || item.role === 'editor'"
              icon="mdi-pencil"
              variant="text"
              size="small"
              @click.stop="editProject(item)"
            ></v-btn>
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
