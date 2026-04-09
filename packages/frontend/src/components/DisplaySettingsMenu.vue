<script setup lang="ts">
defineProps<{
  showHiddenRows: boolean
  showCurrentTimeLine: boolean
  pxPerDay: number
  barHeight: number
}>()

const emit = defineEmits<{
  'update:showHiddenRows': [value: boolean]
  'update:showCurrentTimeLine': [value: boolean]
  'update:pxPerDay': [value: number]
  'update:barHeight': [value: number]
}>()
</script>

<template>
  <v-menu :close-on-content-click="false" location="bottom end">
    <template #activator="{ props: menuProps }">
      <TooltipBtn v-bind="menuProps" icon="mdi-cog" variant="text" tooltip="表示設定" />
    </template>
    <v-card min-width="280" class="pa-4">
      <div class="text-subtitle-2 mb-3">表示設定</div>
      <v-switch
        :model-value="showHiddenRows"
        label="非表示行を表示"
        color="primary"
        hide-details
        density="compact"
        class="mb-2"
        @update:model-value="emit('update:showHiddenRows', $event as boolean)"
      />
      <v-switch
        :model-value="showCurrentTimeLine"
        label="現在時刻線を表示"
        color="primary"
        hide-details
        density="compact"
        class="mb-4"
        @update:model-value="emit('update:showCurrentTimeLine', $event as boolean)"
      />
      <div class="text-caption text-medium-emphasis mb-1">表示倍率</div>
      <ZoomControls
        :model-value="pxPerDay"
        @update:model-value="emit('update:pxPerDay', $event)"
      />
      <div class="text-caption text-medium-emphasis mb-1 mt-3">バーの高さ</div>
      <v-btn-toggle
        :model-value="barHeight"
        @update:model-value="
          (v: number) => {
            if (v != null) emit('update:barHeight', v)
          }
        "
        mandatory
        density="compact"
        color="primary"
        class="w-100"
      >
        <v-btn :value="32" size="medium" class="flex-grow-1">小</v-btn>
        <v-btn :value="38" size="medium" class="flex-grow-1">中</v-btn>
        <v-btn :value="48" size="medium" class="flex-grow-1">大</v-btn>
        <v-btn :value="56" size="medium" class="flex-grow-1">特大</v-btn>
      </v-btn-toggle>
    </v-card>
  </v-menu>
</template>
