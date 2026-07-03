<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { VForm } from 'vuetify/components'
import inputRules from '@/modules/inputRules'
import { toDateString } from '@/modules/utils'
import { useUserDetailDialog } from './composables/useUserDetailDialog'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { user, localDisplayName, save, close, handleBeforeClose } = useUserDetailDialog(
  props,
  emit,
)

const formValid = ref(false)
const formRef = ref<VForm | null>(null)

watch(
  () => props.modelValue,
  async (val) => {
    if (val) {
      await nextTick()
      formRef.value?.validate()
    } else {
      formRef.value?.resetValidation()
    }
  },
)
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="handleBeforeClose" max-width="500px">
    <v-card v-if="user" v-draggable-dialog>
      <v-card-title class="pa-8 pb-0">ユーザー設定</v-card-title>
      <v-card-text class="pa-8">
        <v-form ref="formRef" v-model="formValid" @submit.prevent>
          <v-row>
            <v-col cols="12">
              <v-text-field
                label="メールアドレス"
                :model-value="user.email"
                readonly
                variant="solo-filled"
                density="default"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                label="最終ログイン"
                :model-value="toDateString(user.attribute.lastLoginAt, 'YYYY/MM/DD HH:mm:ss')"
                readonly
                variant="solo-filled"
                density="default"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="localDisplayName"
                label="表示名"
                autofocus
                autocomplete="off"
                variant="outlined"
                density="compact"
                hide-details="auto"
                :rules="[inputRules.required, inputRules.within(191)]"
                class="mb-3"
              />
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-8 pt-0">
        <v-spacer></v-spacer>
        <v-btn color="grey-darken-1" variant="text" @click="close"> キャンセル </v-btn>
        <v-btn color="primary" variant="flat" @click="save" :disabled="!formValid" class="ml-2"> 保存 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
