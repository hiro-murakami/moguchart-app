// Composables
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/views/GanttChartView.vue'),
  },
  {
    path: '/:projectId/snapshot/:snapshotName',
    component: () => import('@/views/GanttChartView.vue'),
  },
  {
    path: '/:id/compare/:snapshotName',
    redirect: (to) => ({
      path: `/${to.params.id}`,
      query: { ...to.query, compare: to.params.snapshotName },
    }),
  },
  {
    path: '/:id',
    component: () => import('@/views/GanttChartView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
