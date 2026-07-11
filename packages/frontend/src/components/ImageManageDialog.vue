<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase'
import { deleteImagesFromStorage } from '@/modules/storageUtils'

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
const compressing = ref(false)
const uploadProgress = ref(0)
const errorMessage = ref('')
const infoMessage = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_IMAGE_DIMENSION = 1920 // リサイズ時の最大幅/高さ
const pendingDeletions = ref<string[]>([])
const newlyUploaded = ref<string[]>([])
const pasteZoneRef = ref<HTMLDivElement | null>(null)

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      imageUrls.value = [...props.currentImageUrls]
      pendingDeletions.value = []
      newlyUploaded.value = []
      errorMessage.value = ''
      infoMessage.value = ''
      // ダイアログ描画後にペーストゾーンへフォーカス
      nextTick(() => {
        pasteZoneRef.value?.focus()
      })
    }
  },
  { immediate: true },
)

const generateUUID = (): string => {
  return crypto.randomUUID()
}

/**
 * 画像ファイルを Canvas でリサイズ・圧縮して Blob を返す。
 * 最大 MAX_IMAGE_DIMENSION px に収め、JPEG 品質を段階的に下げて
 * MAX_FILE_SIZE 以下になるまで調整する。
 */
const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // 最大サイズに収まるようリサイズ
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context の取得に失敗しました'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      // 品質を段階的に下げて MAX_FILE_SIZE 以下にする
      const qualities = [0.85, 0.7, 0.5, 0.3]
      const tryCompress = (index: number) => {
        const quality = qualities[index] ?? 0.3
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('画像の圧縮に失敗しました'))
              return
            }
            if (blob.size <= MAX_FILE_SIZE || index >= qualities.length - 1) {
              resolve(blob)
            } else {
              tryCompress(index + 1)
            }
          },
          'image/jpeg',
          quality,
        )
      }
      tryCompress(0)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像の読み込みに失敗しました'))
    }

    img.src = url
  })
}

/**
 * ファイルサイズが大きい場合は圧縮し、そうでなければそのまま返す。
 * 戻り値は [アップロード用データ, 拡張子, 圧縮したかどうか]
 */
const prepareFile = async (file: File): Promise<[Blob | File, string, boolean]> => {
  if (file.size <= MAX_FILE_SIZE) {
    const name = file.name
    const idx = name.lastIndexOf('.')
    const ext = idx >= 0 ? name.substring(idx) : '.png'
    return [file, ext, false]
  }

  // サイズオーバー → 圧縮
  const compressed = await compressImage(file)
  return [compressed, '.jpg', true]
}

/**
 * File[] を受け取り、圧縮→アップロードを実行する共通関数。
 * handleFileSelect / handlePaste の両方から利用する。
 */
const uploadFiles = async (files: File[]) => {
  if (files.length === 0) return

  errorMessage.value = ''
  infoMessage.value = ''

  // 圧縮が必要なファイルがあるかチェック
  const needsCompression = files.some((f) => f.size > MAX_FILE_SIZE)
  if (needsCompression) {
    compressing.value = true
    infoMessage.value = '画像サイズが大きいため、自動で圧縮しています…'
  }

  uploading.value = true
  uploadProgress.value = 0

  try {
    const totalFiles = files.length
    let completedFiles = 0
    let compressedCount = 0

    for (const file of files) {
      // ファイルの準備（必要に応じて圧縮）
      const [data, ext, wasCompressed] = await prepareFile(file)
      if (wasCompressed) compressedCount++

      compressing.value = false

      const uuid = generateUUID()
      const path = `images/${uuid}${ext}`
      const fileRef = storageRef(storage, path)

      await new Promise<void>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(fileRef, data)
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

    if (compressedCount > 0) {
      infoMessage.value = `${compressedCount}件の画像を自動圧縮してアップロードしました`
    }
  } catch (err) {
    console.error('画像アップロードエラー:', err)
    errorMessage.value = '画像のアップロードに失敗しました'
  } finally {
    uploading.value = false
    compressing.value = false
    uploadProgress.value = 0
  }
}

const handleFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  await uploadFiles(Array.from(files))
  input.value = ''
}

/**
 * クリップボードから貼り付けられた画像を処理する。
 * スクリーンショットや他アプリからのコピー画像に対応。
 * function 宣言にすることで巻き上げ(hoisting)され、watch({ immediate: true }) から安全に参照できる。
 */
async function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return

  const imageFiles: File[] = []
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) imageFiles.push(file)
    }
  }

  if (imageFiles.length === 0) return

  // テキストのペーストを妨げないよう、画像がある場合のみ preventDefault
  event.preventDefault()
  await uploadFiles(imageFiles)
}

const removeImage = (index: number) => {
  const url = imageUrls.value[index]
  if (!url) return

  // 削除予定リストに追加（保存時にまとめて削除）
  pendingDeletions.value.push(url)
  imageUrls.value.splice(index, 1)
}

const handleSave = async () => {
  // 削除予定の画像を Storage から一括削除
  await deleteImagesFromStorage(pendingDeletions.value)
  pendingDeletions.value = []
  newlyUploaded.value = []

  emit('save', [...imageUrls.value])
  isVisible.value = false
}

const handleCancel = async () => {
  // 新規アップロードした画像を Storage から削除（元に戻す）
  await deleteImagesFromStorage(newlyUploaded.value)
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
    <v-card v-draggable-dialog @click="pasteZoneRef?.focus()">
      <v-card-title class="d-flex align-center pa-8 pb-0">
        <v-icon class="mr-2">mdi-image-multiple</v-icon>
        画像管理
      </v-card-title>

      <v-card-text class="pa-8">
        <!-- ペーストを受け取るための不可視の編集可能要素 -->
        <div
          ref="pasteZoneRef"
          contenteditable="true"
          class="paste-zone"
          @paste.prevent="handlePaste"
        />
        <!-- エラーメッセージ -->
        <v-alert v-if="errorMessage" type="error" density="compact" class="mb-3" closable @click:close="errorMessage = ''">
          {{ errorMessage }}
        </v-alert>

        <!-- 情報メッセージ（圧縮通知） -->
        <v-alert v-if="infoMessage" type="info" density="compact" class="mb-3" closable @click:close="infoMessage = ''">
          {{ infoMessage }}
        </v-alert>

        <!-- 圧縮中のインジケーター -->
        <div v-if="compressing" class="d-flex align-center mb-3">
          <v-progress-circular indeterminate size="20" width="2" color="primary" class="mr-2" />
          <span class="text-body-2 text-medium-emphasis">画像を圧縮中…</span>
        </div>

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

        <!-- クリップボード貼り付けのヒント -->
        <p class="text-caption text-medium-emphasis text-center mt-2">
          <v-icon size="14" class="mr-1">mdi-clipboard-outline</v-icon>
          Ctrl+V（⌘+V）でクリップボードから画像を貼り付けできます
        </p>
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

.paste-zone {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
}

.paste-zone:focus {
  pointer-events: auto;
}
</style>
