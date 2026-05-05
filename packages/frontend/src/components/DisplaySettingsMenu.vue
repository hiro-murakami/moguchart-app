<script setup lang="ts">
import { computed } from 'vue'
import { useUserStore } from '@/stores/useUserStore'
import type { User } from '@functions/types/shared'
import themeDarkImg from '@/assets/theme-dark.png'
import themeLightImg from '@/assets/theme-light.png'
import themeSystemImg from '@/assets/theme-system.png'
defineProps<{
  showHiddenRows: boolean
  showCurrentTimeLine: boolean
  readonlyMode?: boolean
  canEdit?: boolean
  pxPerDay: number
  pxPerMonth: number
  pxPerHour: number
  barHeight: number
  granularity?: 'daily' | 'monthly' | 'hourly'
}>()

const emit = defineEmits<{
  'update:showHiddenRows': [value: boolean]
  'update:showCurrentTimeLine': [value: boolean]
  'update:readonlyMode': [value: boolean]
  'update:pxPerDay': [value: number]
  'update:pxPerMonth': [value: number]
  'update:pxPerHour': [value: number]
  'update:barHeight': [value: number]
}>()

const userStore = useUserStore()
const user = computed(() => userStore.user)

const themeOptions = [
  { title: 'ライト', value: 'light', image: themeLightImg },
  { title: 'ダーク', value: 'dark', image: themeDarkImg },
  { title: 'システム', value: 'system', image: themeSystemImg },
]

const currentTheme = computed({
  get: () => user.value?.attribute?.theme || 'system',
  set: async (val: 'light' | 'dark' | 'system') => {
    if (!user.value) return
    const updatedUser: User = {
      ...user.value,
      attribute: {
        ...user.value.attribute,
        theme: val,
      },
    }
    await userStore.saveUser(updatedUser)
  },
})
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
      <v-switch
        v-if="canEdit"
        :model-value="readonlyMode"
        label="読み取り専用モード"
        color="primary"
        hide-details
        density="compact"
        class="mb-4"
        @update:model-value="emit('update:readonlyMode', $event as boolean)"
      />
      <div class="text-caption text-medium-emphasis mb-1">表示倍率</div>
      <!-- 日単位模式 -->
      <ZoomControls
        v-if="granularity !== 'monthly' && granularity !== 'hourly'"
        :model-value="pxPerDay"
        :min="10"
        :max="80"
        :step="5"
        @update:model-value="emit('update:pxPerDay', $event)"
      />
      <!-- 月単位模式 -->
      <ZoomControls
        v-else-if="granularity === 'monthly'"
        :model-value="pxPerMonth"
        :min="20"
        :max="80"
        :step="5"
        @update:model-value="emit('update:pxPerMonth', $event)"
      />
      <!-- 時間単位模式 -->
      <ZoomControls
        v-else
        :model-value="pxPerHour"
        :min="40"
        :max="140"
        :step="5"
        @update:model-value="emit('update:pxPerHour', $event)"
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
        <v-btn :value="24" size="medium" class="flex-grow-1">極小</v-btn>
        <v-btn :value="38" size="medium" class="flex-grow-1">小</v-btn>
        <v-btn :value="52" size="medium" class="flex-grow-1">中</v-btn>
        <v-btn :value="66" size="medium" class="flex-grow-1">大</v-btn>
        <v-btn :value="80" size="medium" class="flex-grow-1">特大</v-btn>
      </v-btn-toggle>
      <div class="text-caption text-medium-emphasis mb-1 mt-4">テーマ</div>
      <v-radio-group v-model="currentTheme" inline hide-details class="mb-3 d-flex justify-center">
        <v-radio v-for="option in themeOptions" :key="option.value" :value="option.value">
          <template v-slot:label>
            <div class="d-flex flex-column align-center ma-1 mt-2 cursor-pointer">
              <img
                :src="option.image"
                width="64"
                :alt="option.title"
                style="border-radius: 4px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2)"
              />
              <span class="mt-2 text-caption">{{ option.title }}</span>
            </div>
          </template>
        </v-radio>
      </v-radio-group>
    </v-card>
  </v-menu>
</template>
