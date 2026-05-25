import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import type { GanttRow, GanttTask, TaskAttribute, RowAttribute, Project } from '@functions/types/shared'
import { useSnackbar } from '@/composables/useSnackbar'

/** エクスポート対象のフラットなタスク行データ */
interface ExportRow {
  行名: string
  タスク名: string
  開始日: string
  終了日: string
  日数: number
  ラベル: string
  説明: string
}

/**
 * ガントチャートデータのCSV/Excelエクスポート機能を提供するcomposable
 */
export const useExportData = () => {
  const snackbar = useSnackbar()

  /**
   * moguchartの内部行データをフラットなエクスポート行に変換する
   */
  const buildExportRows = (rows: any[], includeHidden: boolean = true): ExportRow[] => {
    const exportRows: ExportRow[] = []

    for (const row of rows) {
      // 非表示行をスキップするか
      if (!includeHidden && row.visible === false) continue

      const rowName = row.name || ''

      if (!row.tasks || row.tasks.length === 0) {
        // タスクが無い行も含める
        exportRows.push({
          行名: rowName,
          タスク名: '',
          開始日: '',
          終了日: '',
          日数: 0,
          ラベル: '',
          説明: '',
        })
        continue
      }

      for (const task of row.tasks) {
        const attribute = task.attribute as TaskAttribute | undefined
        const labels = attribute?.labels?.map((l: any) => l.name).join(', ') || ''
        const description = attribute?.description || task.description || ''

        // 日付はYYYY-MM-DD形式に正規化
        const startStr = task.start instanceof Date
          ? dayjs(task.start).format('YYYY-MM-DD')
          : typeof task.start === 'string'
            ? dayjs(task.start).format('YYYY-MM-DD')
            : ''
        const endStr = task.end instanceof Date
          ? dayjs(task.end).format('YYYY-MM-DD')
          : typeof task.end === 'string'
            ? dayjs(task.end).format('YYYY-MM-DD')
            : ''

        // 日数を計算
        const days = startStr && endStr
          ? dayjs(endStr).diff(dayjs(startStr), 'day') + 1
          : 0

        exportRows.push({
          行名: rowName,
          タスク名: task.name || '',
          開始日: startStr,
          終了日: endStr,
          日数: days,
          ラベル: labels,
          説明: description,
        })
      }
    }

    return exportRows
  }

  /**
   * ファイルをダウンロードするヘルパー
   */
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * CSVとしてエクスポート
   */
  const exportAsCsv = (rows: any[], projectName: string) => {
    try {
      const data = buildExportRows(rows)
      if (data.length === 0) {
        snackbar({ message: 'エクスポートするデータがありません。', color: 'warning' })
        return
      }

      const ws = XLSX.utils.json_to_sheet(data)
      const csv = XLSX.utils.sheet_to_csv(ws)

      // BOM付きUTF-8でCSVを出力（Excelでの文字化け防止）
      const bom = '\ufeff'
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
      const filename = `${projectName}_${dayjs().format('YYYYMMDD_HHmmss')}.csv`
      downloadBlob(blob, filename)

      snackbar({ message: 'CSVファイルをエクスポートしました。', color: 'success' })
    } catch (e) {
      console.error('CSV export failed:', e)
      snackbar({ message: 'CSVのエクスポートに失敗しました。', color: 'error' })
    }
  }

  /**
   * Excelシート名として安全な文字列に変換する
   * Excelのシート名には : \ / ? * [ ] を使用できない
   */
  const sanitizeSheetName = (name: string): string => {
    // 禁止文字を除去
    const sanitized = name.replace(/[:\\/?*[\]]/g, '').trim()
    // 空文字になった場合はデフォルト名
    if (!sanitized) return 'Sheet1'
    // 31文字制限
    return sanitized.substring(0, 31)
  }

  /**
   * Excelとしてエクスポート
   */
  const exportAsExcel = (rows: any[], projectName: string) => {
    try {
      const data = buildExportRows(rows)
      if (data.length === 0) {
        snackbar({ message: 'エクスポートするデータがありません。', color: 'warning' })
        return
      }

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(data)

      // カラム幅の自動調整
      const colWidths = [
        { wch: 20 }, // 行名
        { wch: 30 }, // タスク名
        { wch: 12 }, // 開始日
        { wch: 12 }, // 終了日
        { wch: 6 },  // 日数
        { wch: 20 }, // ラベル
        { wch: 40 }, // 説明
      ]
      ws['!cols'] = colWidths

      const sheetName = sanitizeSheetName(projectName)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      // ArrayBuffer を Uint8Array に変換して確実に Blob が作れるようにする
      const blob = new Blob([new Uint8Array(wbout)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const filename = `${projectName}_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
      downloadBlob(blob, filename)

      snackbar({ message: 'Excelファイルをエクスポートしました。', color: 'success' })
    } catch (e) {
      console.error('Excel export failed:', e)
      snackbar({ message: 'Excelのエクスポートに失敗しました。', color: 'error' })
    }
  }

  return {
    exportAsCsv,
    exportAsExcel,
  }
}
