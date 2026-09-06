import { defineStore } from 'pinia'
import type { Project, Role, ColorPalette, Label } from '@functions/types/shared'
import { DEFAULT_COLOR_PALETTES } from '@functions/types/shared'
import { selectProjects, upsertProject } from '@/modules/scripts'

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
      return this.currentProject?.attribute.colorPalettes ?? DEFAULT_COLOR_PALETTES
    },
    labels(): Label[] {
      return this.currentProject?.attribute.labels ?? []
    },
  },

  actions: {
    async fetchProjects() {
      this.projects = await selectProjects()
      if (this.currentProjectId && !this.projects.some((p) => p.id === this.currentProjectId)) {
        this.currentProjectId = ''
      }
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

    /**
     * 公開プロジェクトを直接ストアに設定する。
     * 未ログイン時に公開API経由で取得したプロジェクトを表示するために使用。
     */
    setPublicProject(project: Project) {
      // すでに同じIDのプロジェクトがなければ追加
      const index = this.projects.findIndex((p) => p.id === project.id)
      if (index !== -1) {
        this.projects[index] = project
      } else {
        this.projects.push(project)
      }
      this.currentProjectId = project.id
    },
  },
})
