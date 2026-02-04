<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Project } from '@functions/types/shared'
import { selectProjects } from '@/modules/scripts'

const props = defineProps<{
  modelValue: boolean
  currentProjectId?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', projectId: string): void
  (e: 'edit', project: Project): void
  (e: 'create'): void
}>()

const projects = ref<Project[]>([])
const loading = ref(false)
const isProjectDetailDialogVisible = ref(false)

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
  emit('edit', project)
}

const createProject = (project: Project) => {
  emit('create')
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
            @click="createProject"
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
          <template #item.actions="{ item }">
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
</template>

<style scoped>
.row-pointer :deep(tbody tr) {
  cursor: pointer;
}
</style>
