<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Project } from '@functions/types/shared'
import { toDateString } from '@/modules/utils'

const props = defineProps<{
  modelValue: boolean
  project?: Project | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (
    e: 'save',
    project: Omit<Project, 'attribute'> | Omit<Project, 'id' | 'attribute'>,
  ): void
}>()

const isEdit = computed(() => !!props.project)
const title = computed(() =>
  isEdit.value ? 'プロジェクト編集' : 'プロジェクト追加',
)

const localName = ref('')
const localStart = ref('')
const localEnd = ref('')

watch(
  () => props.modelValue,
  (isVisible) => {
    if (isVisible) {
      if (props.project) {
        localName.value = props.project.name
        localStart.value = toDateString(props.project.start, 'YYYY-MM-DD')
        localEnd.value = toDateString(props.project.end, 'YYYY-MM-DD')
      } else {
        localName.value = ''
        localStart.value = ''
        localEnd.value = ''
      }
    }
  },
)

const close = () => {
  emit('update:modelValue', false)
}

const save = () => {
  if (localName.value && localStart.value && localEnd.value) {
    if (isEdit.value && props.project) {
      emit('save', {
        id: props.project.id,
        name: localName.value,
        start: localStart.value,
        end: localEnd.value,
      })
    } else {
      emit('save', {
        name: localName.value,
        start: localStart.value,
        end: localEnd.value,
      })
    }
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
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>
        <v-text-field v-model="localName" label="プロジェクト名" autofocus />
        <v-text-field v-model="localStart" label="開始日" type="date" />
        <v-text-field v-model="localEnd" label="終了日" type="date" />
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
