<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '@/firebase'

const props = defineProps<{
  modelValue: boolean
  currentImageUrls: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', imageUrls: string[]): void
}>()

const isVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// 画像リスト（作業用コピー）
const imageUrls = ref<string[]>([])
const uploading = ref(false)
const uploadProgress = ref(0)
const errorMessage = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const pendingDeletions = ref<string[]>([])
const newlyUploaded = ref<string[]>([])

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      imageUrls.value = [...props.currentImageUrls]
      pendingDeletions.value = []
      newlyUploaded.value = []
      errorMessage.value = ''
    }
  },
  { immediate: true },
)

const generateUUID = (): string => {
  return crypto.randomUUID()
}

const getExtension = (file: File): string => {
  const name = file.name
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.substring(idx) : '.png'
}

const handleFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  errorMessage.value = ''

  // サイズチェック
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      errorMessage.value = `「${file.name}」のファイルサイズが5MBを超えています`
      input.value = ''
      return
    }
  }

  uploading.value = true
  uploadProgress.value = 0

  try {
    const totalFiles = files.length
    let completedFiles = 0

    for (const file of files) {
      const uuid = generateUUID()
      const ext = getExtension(file)
      const path = `images/${uuid}${ext}`
      const fileRef = storageRef(storage, path)

      await new Promise<void>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(fileRef, file)
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const fileProgress = snapshot.bytesTransferred / snapshot.totalBytes
            uploadProgress.value = Math.round(((completedFiles + fileProgress) / totalFiles) * 100)
          },
          (error) => reject(error),
          async () => {
            try {
              const downloadURL = await getDownloadURL(fileRef)
              imageUrls.value.push(downloadURL)
              newlyUploaded.value.push(downloadURL)
              completedFiles++
              resolve()
            } catch (err) {
              reject(err)
            }
          },
        )
      })
    }
  } catch (err) {
    console.error('画像アップロードエラー:', err)
    errorMessage.value = '画像のアップロードに失敗しました'
  } finally {
    uploading.value = false
    uploadProgress.value = 0
    input.value = ''
  }
}

const removeImage = (index: number) => {
  const url = imageUrls.value[index]
  if (!url) return

  // 削除予定リストに追加（保存時にまとめて削除）
  pendingDeletions.value.push(url)
  imageUrls.value.splice(index, 1)
}

const deleteFromStorage = async (url: string) => {
  try {
    const pathMatch = url.match(/\/o\/(.+?)\?/)
    if (pathMatch?.[1]) {
      const decodedPath = decodeURIComponent(pathMatch[1])
      const fileRef = storageRef(storage, decodedPath)
      await deleteObject(fileRef)
    }
  } catch (err) {
    console.warn('Storage削除エラー（無視して続行）:', err)
  }
}

const handleSave = async () => {
  // 削除予定の画像を Storage から一括削除
  await Promise.all(pendingDeletions.value.map(deleteFromStorage))
  pendingDeletions.value = []
  newlyUploaded.value = []

  emit('save', [...imageUrls.value])
  isVisible.value = false
}

const handleCancel = async () => {
  // 新規アップロードした画像を Storage から削除（元に戻す）
  await Promise.all(newlyUploaded.value.map(deleteFromStorage))
  newlyUploaded.value = []
  pendingDeletions.value = []
  isVisible.value = false
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}
</script>

<template>
  <v-dialog v-model="isVisible" max-width="600" persistent @keydown.esc="handleCancel">
    <v-card v-draggable-dialog>
      <v-card-title class="d-flex align-center pa-8 pb-0">
        <v-icon class="mr-2">mdi-image-multiple</v-icon>
        画像管理
      </v-card-title>

      <v-card-text class="pa-8">
        <!-- エラーメッセージ -->
        <v-alert v-if="errorMessage" type="error" density="compact" class="mb-3" closable @click:close="errorMessage = ''">
          {{ errorMessage }}
        </v-alert>

        <!-- アップロード中のプログレス -->
        <v-progress-linear v-if="uploading" :model-value="uploadProgress" color="primary" class="mb-3" rounded height="6" />

        <!-- 画像リスト -->
        <div v-if="imageUrls.length > 0" class="image-grid mb-3">
          <div v-for="(url, index) in imageUrls" :key="url" class="image-item">
            <img :src="url" class="image-thumb" />
            <v-btn
              icon="mdi-close-circle"
              size="x-small"
              color="error"
              variant="flat"
              class="delete-btn"
              :disabled="uploading"
              @click="removeImage(index)"
            />
          </div>
        </div>

        <!-- 画像がない場合 -->
        <div v-else class="empty-state text-center py-6">
          <v-icon size="48" color="grey-lighten-1">mdi-image-off-outline</v-icon>
          <p class="text-grey mt-2">画像はまだ登録されていません</p>
        </div>

        <!-- ファイル選択（非表示） -->
        <input ref="fileInputRef" type="file" accept="image/*" multiple hidden @change="handleFileSelect" />

        <!-- 追加ボタン -->
        <v-btn block variant="outlined" color="primary" prepend-icon="mdi-plus" :disabled="uploading" @click="triggerFileInput">
          画像を追加
        </v-btn>
      </v-card-text>

      <v-card-actions class="pa-8 pt-0">
        <v-spacer />
        <v-btn variant="text" :disabled="uploading" @click="handleCancel">キャンセル</v-btn>
        <v-btn color="primary" variant="flat" :disabled="uploading" @click="handleSave">保存</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}

.image-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.image-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.delete-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.image-item:hover .delete-btn {
  opacity: 1;
}
</style>
