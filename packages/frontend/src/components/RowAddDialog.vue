<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', name: string): void
}>()

const localName = ref('')

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      localName.value = ''
    }
  },
)

const close = () => {
  emit('update:modelValue', false)
}

const save = () => {
  if (localName.value) {
    emit('save', localName.value)
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="400px"
  >
    <v-card>
      <v-card-title>行追加</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="localName"
          label="行の名前"
          autofocus
        ></v-text-field>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="close">
          キャンセル
        </v-btn>
        <v-btn color="blue-darken-1" variant="text" @click="save"> OK </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
