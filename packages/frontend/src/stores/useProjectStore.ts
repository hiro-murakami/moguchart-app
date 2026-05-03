import { defineStore } from 'pinia'
import type { Project, Role, ColorPalette, Label } from '@functions/types/shared'
import { selectProjects, upsertProject } from '@/modules/scripts'

// 共通カラーパレット (16色固定)
const DEFAULT_COLOR_PALETTES: ColorPalette[] = [
  { name: 'Black', color: '#ffffff', backgroundColor: '#000000' }, // Black
  { name: 'Red', color: '#ffffff', backgroundColor: '#ef5350' }, // Red 400
  { name: 'Pink', color: '#ffffff', backgroundColor: '#ec407a' }, // Pink 400
  { name: 'Purple', color: '#ffffff', backgroundColor: '#ab47bc' }, // Purple 400
  { name: 'Deep Purple', color: '#ffffff', backgroundColor: '#7e57c2' }, // Deep Purple 400
  { name: 'Indigo', color: '#ffffff', backgroundColor: '#5c6bc0' }, // Indigo 400
  { name: 'Blue', color: '#ffffff', backgroundColor: '#42a5f5' }, // Blue 400
  { name: 'Light Blue', color: '#000000', backgroundColor: '#29b6f6' }, // Light Blue 400
  { name: 'Cyan', color: '#000000', backgroundColor: '#26c6da' }, // Cyan 400
  { name: 'Teal', color: '#ffffff', backgroundColor: '#26a69a' }, // Teal 400
  { name: 'Green', color: '#000000', backgroundColor: '#66bb6a' }, // Green 400
  { name: 'Light Green', color: '#000000', backgroundColor: '#9ccc65' }, // Light Green 400
  { name: 'Lime', color: '#000000', backgroundColor: '#d4e157' }, // Lime 400
  { name: 'Yellow', color: '#000000', backgroundColor: '#ffee58' }, // Yellow 400
  { name: 'Orange', color: '#000000', backgroundColor: '#ffa726' }, // Orange 400
  { name: 'Brown', color: '#ffffff', backgroundColor: '#8d6e63' }, // Brown 400
]

export const useProjectStore = defineStore('project', {
  state: () => ({
    projects: [] as Project[],
    currentProjectId: '' as string,
  }),

  getters: {
    currentProject(state): Project | undefined {
      return state.projects.find((p) => p.id === state.currentProjectId)
    },
    currentRole(): Role {
      return this.currentProject?.role ?? 'viewer'
    },
    colorPalettes(): ColorPalette[] {
      const projectPalettes = this.currentProject?.attribute.colorPalettes ?? []
      return [...DEFAULT_COLOR_PALETTES, ...projectPalettes]
    },
    labels(): Label[] {
      return this.currentProject?.attribute.labels ?? []
    },
  },

  actions: {
    async fetchProjects() {
      this.projects = await selectProjects()
      return this.projects
    },

    setProjectId(id: string) {
      this.currentProjectId = id
    },

    async updateProject(project: Project) {
      // サーバー更新
      // TODO: 型定義の不整合を修正するまでは一時的にanyで回避
      const id = await upsertProject(project as any)
      // ストア内のプロジェクト情報も更新
      const index = this.projects.findIndex((p) => p.id === project.id)
      if (index !== -1) {
        this.projects[index] = { ...this.projects[index], ...project }
      }
      // 最新情報を再取得して整合性を保つ
      await this.fetchProjects()
      return id
    },

    clear() {
      this.projects = []
      this.currentProjectId = ''
    },
  },
})
