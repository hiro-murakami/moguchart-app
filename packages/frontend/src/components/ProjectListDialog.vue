<script setup lang="ts">
import ProjectDetailDialog from './ProjectDetailDialog.vue'
import type { Project } from '@functions/types/shared'
import { useProjectListDialog } from './composables/useProjectListDialog'
import { toDateString } from '@/modules/utils'
import { ref } from 'vue'
import TutorialOverlay from '@/components/common/TutorialOverlay.vue'

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
  restoring,
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
  restoreProjectFromFile,
  close,
} = useProjectListDialog(props, emit)

const fileInput = ref<HTMLInputElement | null>(null)

const handleRestoreClick = () => {
  fileInput.value?.click()
}

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    if (file) {
      restoreProjectFromFile(file)
    }
  }
  target.value = ''
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="1100px">
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center pt-6 px-6 pb-4">
        <span>プロジェクト一覧</span>
        <div>
          <input ref="fileInput" type="file" accept=".json" style="display: none" @change="handleFileChange" />
          <v-btn
            color="secondary"
            prepend-icon="mdi-upload"
            class="mr-2"
            :loading="restoring"
            @click="handleRestoreClick"
          >
            バックアップから復元
          </v-btn>
          <v-btn color="primary" prepend-icon="mdi-plus" class="mr-2" @click="newProject"> 新規作成 </v-btn>
          <v-btn icon="mdi-close" variant="text" @click="close"></v-btn>
        </div>
      </v-card-title>
      <v-card-text class="px-6 pb-6 pt-0">
        <v-data-table
          :headers="headers"
          :items="projects"
          :loading="loading || deleting || downloading || restoring"
          hover
          density="compact"
          class="row-pointer"
          @click:row="(_: unknown, { item }: { item: Project }) => selectProject(item)"
        >
          <template #item.project="{ item }">
            <div class="py-2">
              <div class="font-weight-bold">{{ item.name }}</div>
              <div class="d-flex flex-wrap align-center mt-1">
                <RoleChip :role="item.role" class="mr-1" />
                <v-chip v-if="item.public" color="secondary" size="small"> 一般公開 </v-chip>
              </div>
            </div>
          </template>
          <template #item.attribute.description="{ item }">
            <div style="white-space: pre-wrap; min-width: 200px; max-width: 400px" class="py-1">
              {{ item.attribute?.description }}
            </div>
          </template>
          <template #item.period="{ item }">
            <div class="d-flex flex-column text-caption text-no-wrap py-1">
              <span>{{ toDateString(item.start, 'YYYY/MM/DD') }} <span class="text-grey">〜</span></span>
              <span>{{ toDateString(item.end, 'YYYY/MM/DD') }}</span>
            </div>
          </template>
          <template #item.actions="{ item }: { item: Project }">
            <div class="d-flex justify-end align-center">
              <TooltipBtn
                tooltip="編集"
                location="top"
                :tooltip-disabled="!(item.role === 'owner' || item.role === 'editor')"
                icon="mdi-pencil"
                variant="text"
                size="small"
                :style="{ visibility: item.role === 'owner' || item.role === 'editor' ? 'visible' : 'hidden' }"
                @click.stop="editProject(item)"
              />
              <TutorialOverlay
                :condition="
                  modelValue &&
                  !loading &&
                  projects.length === 1 &&
                  item.id === projects[0]?.id &&
                  item.name === 'サンプルプロジェクト'
                "
                tutorial-key="duplicateBtn"
                message="複製ボタンでサンプルプロジェクトのコピーを作成すると、編集できます"
                placement="bottom"
              >
                <template #activator="{ props: overlayProps }">
                  <TooltipBtn
                    v-bind="overlayProps"
                    tooltip="複製"
                    location="top"
                    :tooltip-disabled="!item.role"
                    icon="mdi-content-copy"
                    variant="text"
                    size="small"
                    :id="`duplicate-btn-${item.id}`"
                    :style="{ visibility: item.role ? 'visible' : 'hidden' }"
                    @click.stop="duplicateProject(item)"
                  />
                </template>
              </TutorialOverlay>
              <TooltipBtn
                tooltip="削除"
                location="top"
                :tooltip-disabled="item.role !== 'owner'"
                icon="mdi-delete"
                variant="text"
                size="small"
                :style="{ visibility: item.role === 'owner' ? 'visible' : 'hidden' }"
                @click.stop="deleteProject(item)"
              />
              <TooltipBtn
                tooltip="ダウンロード"
                location="top"
                :tooltip-disabled="!item.role"
                icon="mdi-download"
                variant="text"
                size="small"
                :style="{ visibility: item.role ? 'visible' : 'hidden' }"
                @click.stop="downloadProjectJson(item)"
              />
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
