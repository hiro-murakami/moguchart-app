<script setup lang="ts">
import { computed } from 'vue'
import inputRules from '@/modules/inputRules'
import type { User } from '@functions/types/shared'

const props = defineProps<{
  modelValue: string[]
  label: string
  helpText: string
  /** 入力補完の候補となるユーザー一覧（省略可） */
  users?: User[]
}>()

defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

/** v-combobox に渡す補完候補アイテム */
const suggestionItems = computed(() =>
  (props.users ?? []).map((u) => ({
    title: u.displayName ? `${u.displayName} (${u.email})` : u.email,
    value: u.email,
  })),
)
</script>

<template>
  <v-col cols="12" class="d-flex align-center">
    <v-combobox
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
      :label="label"
      :items="suggestionItems"
      item-title="title"
      item-value="value"
      multiple
      chips
      deletable-chips
      closable-chips
      density="compact"
      variant="outlined"
      hide-details
      class="mb-3"
      :rules="[inputRules.areMailAddresses]"
      autocomplete="off"
    />
    <HelpText :text="helpText" />
  </v-col>
</template>
