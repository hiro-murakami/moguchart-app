<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import * as moguchart from '@mogura/moguchart'
import type { ColorPalette } from '@functions/types/shared'

const props = defineProps<{
  palettes: ColorPalette[]
  buttonLabel?: string
  textSample?: string
}>()

const emit = defineEmits<{
  (e: 'select', value: ColorPalette): void
}>()

const menu = ref(false)
const searchQuery = ref('')

watch(menu, (val) => {
  if (!val) {
    searchQuery.value = ''
  }
})

const filteredPalettes = computed(() => {
  if (!searchQuery.value) return props.palettes
  const q = searchQuery.value.toLowerCase()
  return props.palettes.filter((p) => (p.name || '').toLowerCase().includes(q))
})

const onSelect = (palette: ColorPalette) => {
  emit('select', palette)
  menu.value = false
}
</script>

<template>
  <v-menu v-model="menu" :close-on-content-click="false">
    <template v-slot:activator="{ props: menuProps }">
      <v-btn color="primary" variant="text" v-bind="menuProps" prepend-icon="mdi-palette">
        {{ buttonLabel || 'カラーパレットから設定' }}
      </v-btn>
    </template>

    <v-card min-width="240px" max-height="500px" class="d-flex flex-column">
      <div class="pa-2 pb-0">
        <v-text-field
          v-model="searchQuery"
          label="パレットを検索"
          density="compact"
          variant="outlined"
          hide-details
          prepend-inner-icon="mdi-magnify"
          clearable
          autofocus
          autocomplete="off"
        />
      </div>
      <v-list density="compact" class="overflow-y-auto flex-grow-1">
        <template v-if="filteredPalettes.length === 0">
          <v-list-item>
            <v-list-item-title class="text-caption text-grey text-center my-2">
              {{ palettes.length === 0 ? 'パレットが登録されていません' : '見つかりませんでした' }}
            </v-list-item-title>
          </v-list-item>
        </template>
        <template v-else>
          <v-list-item v-for="(palette, index) in filteredPalettes" :key="index" @click="onSelect(palette)" link>
            <div
              class="d-flex align-center justify-center rounded px-2"
              :style="`
                  width: 100%;
                  height: 32px;
                  border: 1px solid rgba(var(--v-border-color), 0.38);
                  background-color: ${palette.backgroundColor || '#ffffff'};
                  color: ${palette.color || '#000000'};
                  ${
                    palette.pattern
                      ? moguchart.getPatternStyle({
                          type: palette.pattern.type as moguchart.BarPattern,
                          color: palette.pattern.color,
                        })
                      : ''
                  }
                `"
            >
              <span class="text-truncate" style="max-width: 100%">
                {{ palette.name || textSample || 'テキストサンプル' }}
              </span>
            </div>
          </v-list-item>
        </template>
      </v-list>
    </v-card>
  </v-menu>
</template>
