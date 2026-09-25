import dayjs from 'dayjs'
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
 * ガントチャートデータのCSVエクスポート機能を提供するcomposable
 */
export const useExportData = () => {
  const snackbar = useSnackbar()

  /**
   * moguchartの内部行データをフラットなエクスポート行に変換する
   */
  const buildExportRows = (rows: any[], includeHidden: boolean = true): ExportRow[] => {
    const exportRows: ExportRow[] = []

    // フィルタが適用されているか（いずれかのタスクがフィルタアウトされているか）
    const isFiltered = rows.some((row) => row.tasks?.some((task: any) => task._isFilteredOut))

    for (const row of rows) {
      // 非表示行をスキップするか
      if (!includeHidden && row.visible === false) continue

      const rowName = row.name || ''
      const validTasks = (row.tasks || []).filter((task: any) => !task._isFilteredOut)

      if (validTasks.length === 0) {
        // フィルタ適用中の場合は、タスクが無い（あるいは全てフィルタアウトされた）行は出力しない
        if (isFiltered) continue

        // 子行を持つ親行の場合、配下タスクからサマリーを自動集計して出力
        const childRows = rows.filter((r) => {
          const pid =
            ((r as any).attribute as RowAttribute | undefined)?.parentId ??
            (r.parentId != null ? String(r.parentId) : null)
          return pid === String(row.id)
        })
        const allChildTasks = childRows.flatMap((r) => (r.tasks || []).filter((t: any) => !t._isFilteredOut))
        if (allChildTasks.length > 0) {
          let minStart: number | null = null
          let maxEnd: number | null = null
          for (const t of allChildTasks) {
            const s = t.start instanceof Date ? t.start.getTime() : new Date(t.start).getTime()
            const e = t.end instanceof Date ? t.end.getTime() : new Date(t.end).getTime()
            if (!Number.isNaN(s) && (minStart === null || s < minStart)) minStart = s
            if (!Number.isNaN(e) && (maxEnd === null || e > maxEnd)) maxEnd = e
          }
          if (minStart !== null && maxEnd !== null) {
            const startStr = dayjs(minStart).format('YYYY-MM-DD')
            const endStr = dayjs(maxEnd).format('YYYY-MM-DD')
            const days = dayjs(endStr).diff(dayjs(startStr), 'day') + 1
            exportRows.push({
              行名: rowName,
              タスク名: `[サマリー] ${rowName}`,
              開始日: startStr,
              終了日: endStr,
              日数: days,
              ラベル: '',
              説明: '配下タスクの自動集計サマリー',
            })
            continue
          }
        }

        // フィルタ未適用の場合は、タスクが無い行も含める
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

      for (const task of validTasks) {
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
   * CSVフィールドの値をエスケープする (RFC 4180 準拠)
   */
  const escapeCsvField = (field: string | number | null | undefined): string => {
    if (field === null || field === undefined) return ''
    const str = String(field)
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  /**
   * エクスポート用行データをCSV文字列に変換する
   */
  const convertToCsv = (data: ExportRow[]): string => {
    const headers: (keyof ExportRow)[] = ['行名', 'タスク名', '開始日', '終了日', '日数', 'ラベル', '説明']
    const headerLine = headers.map(escapeCsvField).join(',')
    const dataLines = data.map((row) =>
      headers.map((key) => escapeCsvField(row[key])).join(',')
    )
    return [headerLine, ...dataLines].join('\r\n')
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

      const csv = convertToCsv(data)

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

  return {
    exportAsCsv,
  }
}
