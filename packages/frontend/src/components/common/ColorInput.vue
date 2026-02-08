<script setup lang="ts">
import { ref } from 'vue'

export interface Props {
  label: string
  minWidth?: string | number
}

defineProps<Props>()
const model = defineModel<string>({
  required: true,
})

const visible = ref(false)
const tempColor = ref(model.value)

const onChangeVisible = () => {
  if (visible.value) {
    tempColor.value = model.value
  }
}

const onCancel = () => {
  tempColor.value = model.value
  visible.value = false
}
const onApply = () => {
  model.value = tempColor.value
  visible.value = false
}
</script>

<template>
  <v-menu v-model="visible" :close-on-content-click="false" @update:model-value="onChangeVisible">
    <template v-slot:activator="{ props }">
      <v-btn
        color="xismartSubColor"
        variant="outlined"
        append-icon="mdi-menu-down"
        class="text-button font-weight-bold"
        v-bind="props"
        :min-width="minWidth"
      >
        <div
          class="mr-2"
          :style="{
            backgroundColor: model || '#FFFFFF',
            width: '20px',
            height: '20px',
            border: '1px solid #ccc',
          }"
        ></div>
        {{ label }}
      </v-btn>
    </template>

    <v-card>
      <v-card-text class="pb-0">
        <v-color-picker v-model="tempColor" elevation="0" show-swatches />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="onCancel">キャンセル</v-btn>
        <v-btn color="primary" @click="onApply">OK</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>
