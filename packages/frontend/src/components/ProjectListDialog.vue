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
  filteredProjects,
  loading,
  saving,
  deleting,
  downloading,
  restoring,
  archiving,
  showArchived,
  searchQuery,
  highlightText,
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
  archiveProject,
  unarchiveProject,
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
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="1300px"
    min-height="700px"
  >
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center pt-6 px-6 pb-4">
        <span>プロジェクト一覧</span>
        <v-btn icon="mdi-close" variant="text" @click="close"></v-btn>
      </v-card-title>
      <v-card-text class="px-6 pb-6 pt-0">
        <div class="d-flex">
          <!-- 縦タブ -->
          <v-tabs
            v-model="showArchived"
            direction="vertical"
            density="compact"
            color="primary"
            class="project-tabs flex-shrink-0 mr-4"
          >
            <v-tab :value="false" class="text-body-2" prepend-icon="mdi-folder-open"> メイン </v-tab>
            <v-tab :value="true" class="text-body-2" prepend-icon="mdi-archive"> アーカイブ済 </v-tab>
          </v-tabs>

          <!-- テーブル -->
          <div class="flex-grow-1 overflow-hidden">
            <div class="d-flex align-center my-2" style="gap: 16px">
              <v-text-field
                v-model="searchQuery"
                prepend-inner-icon="mdi-magnify"
                label="プロジェクト名・説明で検索"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                class="flex-grow-1"
                autocomplete="off"
              />
              <input ref="fileInput" type="file" accept=".json,.zip" style="display: none" @change="handleFileChange" />
              <v-btn
                color="secondary"
                prepend-icon="mdi-upload"
                class="text-body-medium flex-shrink-0"
                :loading="restoring"
                @click="handleRestoreClick"
              >
                バックアップから復元
              </v-btn>
              <v-btn color="primary" prepend-icon="mdi-plus" class="text-body-medium flex-shrink-0" @click="newProject">
                新規作成
              </v-btn>
            </div>
            <v-data-table
              :headers="headers"
              :items="filteredProjects"
              :loading="loading || deleting || downloading || restoring || archiving"
              hover
              density="compact"
              class="row-pointer"
              @click:row="(_: unknown, { item }: { item: Project }) => selectProject(item)"
            >
              <template #item.project="{ item }">
                <div class="py-2">
                  <div class="font-weight-bold">
                    <span v-html="highlightText(item.name)"></span>
                    <v-icon
                      v-if="item.attribute?.archived"
                      icon="mdi-archive"
                      size="small"
                      color="warning"
                      class="ml-1"
                    />
                  </div>
                  <div class="d-flex flex-wrap align-center mt-1">
                    <RoleChip :role="item.role" class="mr-1" />
                    <v-chip v-if="item.public" color="secondary" size="small"> 一般公開 </v-chip>
                  </div>
                </div>
              </template>
              <template #item.attribute.description="{ item }">
                <div style="white-space: pre-wrap; min-width: 200px; max-width: 400px" class="py-1" v-html="highlightText(item.attribute?.description)">
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
                  <!-- アーカイブ済み表示時：復元ボタン -->
                  <template v-if="showArchived">
                    <TooltipBtn
                      tooltip="アーカイブから復元"
                      location="top"
                      :tooltip-disabled="item.role !== 'owner'"
                      icon="mdi-archive-arrow-up"
                      variant="text"
                      size="small"
                      color="success"
                      :style="{ visibility: item.role === 'owner' ? 'visible' : 'hidden' }"
                      @click.stop="unarchiveProject(item)"
                    />
                    <TooltipBtn
                      tooltip="削除"
                      location="top"
                      :tooltip-disabled="item.role !== 'owner'"
                      icon="mdi-delete"
                      variant="text"
                      size="small"
                      color="error"
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
                  </template>

                  <!-- 通常表示時：既存のアクション + アーカイブボタン -->
                  <template v-else>
                    <TooltipBtn
                      tooltip="編集"
                      location="top"
                      :tooltip-disabled="!(item.role === 'owner')"
                      icon="mdi-pencil"
                      variant="text"
                      size="small"
                      :style="{ visibility: item.role === 'owner' ? 'visible' : 'hidden' }"
                      @click.stop="editProject(item)"
                    />
                    <TutorialOverlay
                      :condition="
                        modelValue &&
                        !loading &&
                        filteredProjects.length === 1 &&
                        item.id === filteredProjects[0]?.id &&
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
                      tooltip="アーカイブ"
                      location="top"
                      :tooltip-disabled="item.role !== 'owner'"
                      icon="mdi-archive-arrow-down"
                      variant="text"
                      size="small"
                      color="warning"
                      :style="{ visibility: item.role === 'owner' ? 'visible' : 'hidden' }"
                      @click.stop="archiveProject(item)"
                    />
                    <TooltipBtn
                      tooltip="削除"
                      location="top"
                      :tooltip-disabled="item.role !== 'owner'"
                      icon="mdi-delete"
                      variant="text"
                      size="small"
                      color="error"
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
                  </template>
                </div>
              </template>
            </v-data-table>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>

  <ProjectDetailDialog
    v-model="isProjectDetailDialogVisible"
    :project="projectToEdit"
    :saving="saving"
    @save="saveProject"
  />
</template>

<style scoped>
.row-pointer :deep(tbody tr) {
  cursor: pointer;
}

.project-tabs {
  min-width: 140px;
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.project-tabs :deep(.v-tab) {
  justify-content: flex-start;
  text-transform: none;
  letter-spacing: normal;
}

:deep(.search-highlight) {
  background-color: rgba(var(--v-theme-warning), 0.35);
  color: inherit;
  padding: 0 1px;
  border-radius: 2px;
}
</style>
