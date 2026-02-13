<script setup lang="ts">
import ProjectDetailDialog from './ProjectDetailDialog.vue'
import { useProjectListDialog } from './useProjectListDialog'
import type { Project } from '@functions/types/shared'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', projectId: string): void
  (e: 'update'): void
}>()

const {
  projects,
  loading,
  saving,
  deleting,
  downloading,
  isProjectDetailDialogVisible,
  projectToEdit,
  headers,
  selectProject,
  editProject,
  newProject,
  saveProject,
  deleteProject,
  duplicateProject,
  downloadProjectJson,
  close,
} = useProjectListDialog(props, emit)
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="1000px">
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>プロジェクト一覧</span>
        <div>
          <v-btn color="primary" prepend-icon="mdi-plus" class="mr-2" @click="newProject"> 新規作成 </v-btn>
          <v-btn icon="mdi-close" variant="text" @click="close"></v-btn>
        </div>
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="headers"
          :items="projects"
          :loading="loading || deleting || downloading"
          hover
          density="compact"
          class="row-pointer"
          @click:row="(_: unknown, { item }: { item: Project }) => selectProject(item)"
        >
          <template #item.role="{ item }">
            <RoleChip :role="item.role" />
            <v-chip v-if="item.public" class="ml-2" color="secondary" size="small"> 一般公開 </v-chip>
          </template>
          <template #item.attribute.description="{ item }">
            <v-tooltip location="top" open-on-hover :open-delay="500" :disabled="!item.attribute?.description">
              <template #activator="{ props }">
                <div v-bind="props" class="text-truncate" style="max-width: 200px">
                  {{ item.attribute?.description }}
                </div>
              </template>
              <span>{{ item.attribute?.description }}</span>
            </v-tooltip>
          </template>
          <template #item.actions="{ item }: { item: Project }">
            <div class="d-flex justify-end align-center">
              <v-tooltip v-if="item.role === 'owner' || item.role === 'editor'" :open-delay="500" location="top">
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
              <v-tooltip v-if="item.role === 'owner'" :open-delay="500" location="top">
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
              <v-tooltip v-if="item.role === 'owner'" :open-delay="500" location="top">
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
              <v-tooltip v-if="item.role" :open-delay="500" location="top">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-download"
                    variant="text"
                    size="small"
                    @click.stop="downloadProjectJson(item)"
                  ></v-btn>
                </template>
                <span>ダウンロード</span>
              </v-tooltip>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-dialog>

  <ProjectDetailDialog v-model="isProjectDetailDialogVisible" :project="projectToEdit" @save="saveProject" />
</template>

<style scoped>
.row-pointer :deep(tbody tr) {
  cursor: pointer;
}
</style>
