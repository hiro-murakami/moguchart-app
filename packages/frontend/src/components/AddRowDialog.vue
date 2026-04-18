<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const emit = defineEmits<{
  (e: 'add', count: number): void
}>()

const isVisible = ref(false)

const rowCount = ref(1)

// メニューが開くたびに行数をリセット
watch(isVisible, (val) => {
  if (val) rowCount.value = 1
})

const rowCountRules = [(v: number) => (v >= 1 && v <= 10) || '1〜10の範囲で入力してください']

const isValid = computed(() => rowCount.value >= 1 && rowCount.value <= 10)

const handleAdd = () => {
  if (!isValid.value) return
  emit('add', rowCount.value)
  isVisible.value = false
}

const handleKeyEnter = () => {
  if (isValid.value) handleAdd()
}
</script>

<template>
  <v-menu v-model="isVisible" location="top start" :offset="8" :close-on-content-click="false">
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps" />
    </template>

    <v-card min-width="200">
      <v-card-text class="pa-4">
        <v-text-field
          v-model.number="rowCount"
          type="number"
          label="追加する行数"
          density="compact"
          hide-details="auto"
          variant="outlined"
          min="1"
          max="10"
          :rules="rowCountRules"
          autofocus
          autocomplete="off"
          @keydown.enter="handleKeyEnter"
        />
      </v-card-text>
      <v-card-actions class="pa-4 pt-0">
        <v-spacer />
        <v-btn color="grey-darken-1" variant="text" @click="isVisible = false">キャンセル</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!isValid" class="ml-2" @click="handleAdd"> 追加 </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>
