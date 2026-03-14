import AdmZip from 'adm-zip'
import type { DownloadProjectZip } from '../types/shared.js'
import getGanttDataJson from './getGanttDataJson.js'

const downloadProjectZip: DownloadProjectZip = async (projectId, email) => {
  if (!projectId) {
    throw new Error('Project ID is required')
  }

  // ガントチャート情報の取得（権限チェック含む）
  const ganttData = await getGanttDataJson(projectId, email)

  const projectName = ganttData.project?.name || 'project'

  // JSON文字列化
  const jsonString = JSON.stringify(ganttData, null, 2)

  // Zip圧縮 (メモリ上で作成)
  const zip = new AdmZip()
  const safeProjectName = projectName
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  const fileName = `${safeProjectName}.json`
  zip.addFile(fileName, Buffer.from(jsonString, 'utf8'))
  const zipBuffer = zip.toBuffer()

  // Base64で返す
  return zipBuffer.toString('base64')
}

export default downloadProjectZip
