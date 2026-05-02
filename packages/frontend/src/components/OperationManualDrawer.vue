<script setup lang="ts">
import { computed, ref } from 'vue'
import { marked, Renderer } from 'marked'
import OPERATION_MANUAL from '../../../../docs/operation-manual.md?raw'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const contentRef = ref<HTMLElement | null>(null)

// カスタム renderer で h2 見出しに section-N の連番 id を付与
const renderer = new Renderer()
let sectionCounter = 0
renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
  if (depth === 2) {
    sectionCounter++
    return `<h${depth} id="section-${sectionCounter}">${text}</h${depth}>\n`
  }
  return `<h${depth}>${text}</h${depth}>\n`
}

const renderedHtml = computed(() => {
  return marked.parse(OPERATION_MANUAL, { renderer }) as string
})

// 目次のアンカーリンククリックをインターセプトしてドロワー内スクロール
function onContentClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const anchor = target.closest('a')
  if (!anchor) return

  const href = anchor.getAttribute('href')
  if (!href?.startsWith('#')) return

  event.preventDefault()

  // marked がhrefを自動的にURLエンコードするのでデコードする
  const id = decodeURIComponent(href.slice(1))

  // ドロワー内の要素を検索
  const el = contentRef.value
  if (!el) return

  // querySelectorではなくgetElementByIdに相当する方法で検索
  const headings = el.querySelectorAll('h1, h2, h3, h4, h5, h6')
  for (const heading of headings) {
    if (heading.id === id) {
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    }
  }
}

function scrollToToc() {
  const heading = contentRef.value?.querySelector('#section-1')
  if (heading) {
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <v-navigation-drawer
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    location="right"
    temporary
    width="520"
  >
    <div class="manual-header d-flex align-center justify-space-between pa-4">
      <div class="d-flex align-center">
        <v-icon icon="mdi-book-open-variant" class="mr-2" />
        <span class="text-h6">操作マニュアル</span>
      </div>
      <div>
        <TooltipBtn icon="mdi-table-of-contents" variant="text" size="small" tooltip="目次に戻る" @click="scrollToToc" />
        <TooltipBtn icon="mdi-close" variant="text" size="small" tooltip="閉じる" @click="emit('update:modelValue', false)" />
      </div>
    </div>
    <v-divider />
    <div ref="contentRef" class="manual-content pa-6" v-html="renderedHtml" @click="onContentClick" />
  </v-navigation-drawer>
</template>

<style scoped>
.manual-header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgb(var(--v-theme-surface));
}

.manual-content {
  overflow-y: auto;
}

.manual-content :deep(h1),
.manual-content :deep(h2),
.manual-content :deep(h3),
.manual-content :deep(h4) {
  scroll-margin-top: 68px;
}

.manual-content :deep(h1) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.manual-content :deep(h2) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.manual-content :deep(h3) {
  font-size: 1.05rem;
  font-weight: 600;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}

.manual-content :deep(h4) {
  font-size: 0.95rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.4rem;
}

.manual-content :deep(p) {
  margin-bottom: 0.75rem;
  line-height: 1.7;
  font-size: 0.875rem;
}

.manual-content :deep(ul),
.manual-content :deep(ol) {
  padding-left: 1.5rem;
  margin-bottom: 0.75rem;
}

.manual-content :deep(li) {
  margin-bottom: 0.3rem;
  font-size: 0.875rem;
  line-height: 1.6;
}

.manual-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  font-size: 0.8125rem;
}

.manual-content :deep(th) {
  text-align: left;
  padding: 8px 12px;
  font-weight: 600;
  background: rgba(var(--v-theme-on-surface), 0.06);
  border-bottom: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.manual-content :deep(td) {
  padding: 6px 12px;
  border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.5));
}

.manual-content :deep(code) {
  background: rgba(var(--v-theme-on-surface), 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8125rem;
  font-family: 'Roboto Mono', monospace;
}

.manual-content :deep(blockquote) {
  border-left: 3px solid rgb(var(--v-theme-primary));
  margin: 0.75rem 0;
  padding: 0.5rem 1rem;
  background: rgba(var(--v-theme-primary), 0.05);
  border-radius: 0 4px 4px 0;
}

.manual-content :deep(blockquote p) {
  margin-bottom: 0;
}

.manual-content :deep(hr) {
  border: none;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  margin: 1.5rem 0;
}

.manual-content :deep(strong) {
  font-weight: 600;
}
</style>
