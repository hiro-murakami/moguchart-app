<script setup lang="ts">
import { computed } from 'vue'
import { VColorInput } from 'vuetify/labs/VColorInput'
import * as moguchart from '@mogura/moguchart'
import type { ColorPalette } from '@functions/types/shared'

const props = defineProps<{
  modelValue: ColorPalette
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ColorPalette): void
  (e: 'delete'): void
}>()

const color = computed({
  get: () => props.modelValue.color,
  set: (val) => emit('update:modelValue', { ...props.modelValue, color: val }),
})

const backgroundColor = computed({
  get: () => props.modelValue.backgroundColor,
  set: (val) => emit('update:modelValue', { ...props.modelValue, backgroundColor: val }),
})

const pattern = computed({
  get: () => props.modelValue.pattern,
  set: (val) => emit('update:modelValue', { ...props.modelValue, pattern: val }),
})

const patternType = computed({
  get: () => props.modelValue.pattern?.type,
  set: (val) => {
    if (props.modelValue.pattern) {
      emit('update:modelValue', {
        ...props.modelValue,
        pattern: { ...props.modelValue.pattern, type: val as string },
      })
    }
  },
})

const patternColor = computed({
  get: () => props.modelValue.pattern?.color,
  set: (val) => {
    if (props.modelValue.pattern) {
      emit('update:modelValue', {
        ...props.modelValue,
        pattern: { ...props.modelValue.pattern, color: val as string },
      })
    }
  },
})

const addPattern = () => {
  emit('update:modelValue', {
    ...props.modelValue,
    pattern: { type: 'dots', color: '#ffffff' },
  })
}

const removePattern = () => {
  // Create a new object without pattern property
  const { pattern: _, ...rest } = props.modelValue
  emit('update:modelValue', rest)
}
</script>

<template>
  <v-card variant="outlined" class="pa-2">
    <v-row dense align="center">
      <v-col cols="auto">
        <v-btn icon="mdi-delete" variant="text" color="error" size="small" @click="emit('delete')" />
      </v-col>
      <v-col>
        <v-row dense>
          <v-col cols="12" sm="4">
            <v-color-input
              v-model="color"
              label="文字色"
              hide-details
              density="compact"
              mode="hexa"
              :modes="['hexa']"
              prepend-icon=""
              color-pip
              show-swatches
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-color-input
              v-model="backgroundColor"
              label="背景色"
              hide-details
              density="compact"
              mode="hexa"
              :modes="['hexa']"
              prepend-icon=""
              color-pip
              show-swatches
            />
          </v-col>
          <v-col cols="12" sm="8" v-if="!pattern">
            <v-btn variant="text" size="small" @click="addPattern"> パターン追加 </v-btn>
          </v-col>
          <template v-else>
            <v-col cols="12" sm="3">
              <v-select
                v-model="patternType"
                :items="moguchart.ALL_BAR_PATTERNS"
                item-title="type"
                item-value="type"
                label="タイプ"
                hide-details
                density="compact"
              >
                <template #selection="{ item }">
                  <div class="d-flex align-center">
                    <div
                      :style="`width: 80px; height: 16px; border: 1px solid #ccc; flex-shrink: 0; background-repeat: repeat; background-color: ${backgroundColor || '#ffffff'}; ${moguchart.getPatternStyle({ type: item.raw, color: patternColor || '#000000' })}`"
                    ></div>
                  </div>
                </template>
                <template #item="{ props, item }">
                  <v-list-item v-bind="props" title="">
                    <template #prepend>
                      <div
                        class="mr-2"
                        :style="`width: 40px; height: 16px; border: 1px solid #ccc; flex-shrink: 0; background-repeat: repeat; background-color: ${backgroundColor || '#ffffff'}; ${moguchart.getPatternStyle({ type: item.raw, color: patternColor || '#000000' })}`"
                      ></div>
                    </template>
                  </v-list-item>
                </template>
              </v-select>
            </v-col>
            <v-col cols="12" sm="4">
              <v-color-input
                v-model="patternColor"
                label="パターンカラー"
                hide-details
                density="compact"
                mode="hexa"
                :modes="['hexa']"
                prepend-icon=""
                color-pip
                show-swatches
              />
            </v-col>
            <v-col cols="auto">
              <v-btn icon="mdi-close" variant="text" size="medium" density="compact" @click="removePattern" />
            </v-col>
          </template>
        </v-row>
      </v-col>
    </v-row>
  </v-card>
</template>
