<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { Project } from '@functions/types/shared'
import inputRules from '@/modules/inputRules'
import type { VForm } from 'vuetify/components'

const props = defineProps<{
  modelValue: boolean
  project?: Project | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', project: Partial<Project>): void
}>()

const isEdit = computed(() => !!props.project)
const title = computed(() =>
  isEdit.value ? 'プロジェクト編集' : 'プロジェクト追加',
)

const form = ref<VForm | null>(null)
const formValid = ref(false)
const localName = ref('')
const localStart = ref('')
const localEnd = ref('')
const localPublic = ref(false)
const localOwners = ref<string[]>([])
const localEditors = ref<string[]>([])
const localViewers = ref<string[]>([])

watch(
  () => props.modelValue,
  async (isVisible) => {
    if (isVisible) {
      if (props.project) {
        // 編集モード
        localName.value = props.project.name
        localStart.value = props.project.start
        localEnd.value = props.project.end
        localPublic.value = props.project.public
        if (props.project.authority) {
          const { owners, editors, viewers } = props.project.authority
          localOwners.value = owners || []
          localEditors.value = editors || []
          localViewers.value = viewers || []
        }
        await nextTick() // DOMの更新を待つ
        form.value?.validate()
      } else {
        // 新規追加モード
        localName.value = ''
        localStart.value = ''
        localEnd.value = ''
        localPublic.value = false
        localOwners.value = []
        localEditors.value = []
        localViewers.value = []
        form.value?.resetValidation()
      }
    } else {
      form.value?.resetValidation()
    }
  },
)

const close = () => {
  emit('update:modelValue', false)
}

const save = async () => {
  if (!formValid.value) return

  const projectData: Partial<Project> = {
    name: localName.value,
    start: localStart.value,
    end: localEnd.value,
    public: localPublic.value,
    authority: {
      owners: localOwners.value,
      editors: localEditors.value,
      viewers: localViewers.value,
    },
  }
  if (isEdit.value && props.project) {
    projectData.id = props.project.id
  }
  emit('save', projectData)
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
        <v-form ref="form" v-model="formValid">
          <v-text-field
            v-model="localName"
            label="プロジェクト名"
            :rules="[inputRules.required, inputRules.within(191)]"
            autofocus
          />
          <v-row>
            <v-col>
              <v-text-field
                v-model="localStart"
                label="開始日"
                type="date"
                :rules="[inputRules.required]"
              />
            </v-col>
            <v-col>
              <v-text-field
                v-model="localEnd"
                label="終了日"
                type="date"
                :rules="[inputRules.required]"
              />
            </v-col>
          </v-row>
          <v-checkbox v-model="localPublic" label="一般公開" />
          <div class="text-subtitle mt-4">権限</div>
          <v-combobox
            v-model="localOwners"
            label="オーナー"
            multiple
            chips
            deletable-chips
            closable-chips
            :rules="[inputRules.areMailAddresses]"
          />
          <v-combobox
            v-model="localEditors"
            label="編集者"
            multiple
            chips
            deletable-chips
            closable-chips
            :rules="[inputRules.areMailAddresses]"
          />
          <v-combobox
            v-model="localViewers"
            label="閲覧者"
            multiple
            chips
            deletable-chips
            closable-chips
            :rules="[inputRules.areMailAddresses]"
          />
        </v-form>
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
