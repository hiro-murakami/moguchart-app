import { defineStore } from 'pinia'
import type { Project, Role, ColorPalette, Label } from '@functions/types/shared'
import { selectProjects } from '@/modules/scripts'

// 共通カラーパレット (16色固定)
const DEFAULT_COLOR_PALETTES: ColorPalette[] = [
  { color: '#ffffff', backgroundColor: '#000000' }, // Black
  { color: '#ffffff', backgroundColor: '#ef5350' }, // Red 400
  { color: '#ffffff', backgroundColor: '#ec407a' }, // Pink 400
  { color: '#ffffff', backgroundColor: '#ab47bc' }, // Purple 400
  { color: '#ffffff', backgroundColor: '#7e57c2' }, // Deep Purple 400
  { color: '#ffffff', backgroundColor: '#5c6bc0' }, // Indigo 400
  { color: '#ffffff', backgroundColor: '#42a5f5' }, // Blue 400
  { color: '#000000', backgroundColor: '#29b6f6' }, // Light Blue 400
  { color: '#000000', backgroundColor: '#26c6da' }, // Cyan 400
  { color: '#ffffff', backgroundColor: '#26a69a' }, // Teal 400
  { color: '#000000', backgroundColor: '#66bb6a' }, // Green 400
  { color: '#000000', backgroundColor: '#9ccc65' }, // Light Green 400
  { color: '#000000', backgroundColor: '#d4e157' }, // Lime 400
  { color: '#000000', backgroundColor: '#ffee58' }, // Yellow 400
  { color: '#000000', backgroundColor: '#ffa726' }, // Orange 400
  { color: '#ffffff', backgroundColor: '#8d6e63' }, // Brown 400
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

    clear() {
      this.projects = []
      this.currentProjectId = ''
    },
  },
})
