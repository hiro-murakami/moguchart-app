import { computed, ref } from 'vue'

/**
 * Undo/Redo操作を表すアクション
 */
export interface UndoRedoAction {
  /** 操作の説明（デバッグ/ログ用） */
  description: string
  /** 操作を元に戻す */
  undo: () => Promise<void>
  /** 操作をやり直す */
  redo: () => Promise<void>
}

const MAX_HISTORY = 50

/**
 * Undo/Redo履歴管理用composable
 * コマンドパターンで各操作の逆操作を管理する
 */
export const useUndoRedo = () => {
  const undoStack = ref<UndoRedoAction[]>([])
  const redoStack = ref<UndoRedoAction[]>([])
  const isUndoRedoing = ref(false)

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  /**
   * 新しいアクションを履歴に追加する
   * Undo/Redo実行中は記録しない（再帰防止）
   */
  const pushAction = (action: UndoRedoAction) => {
    if (isUndoRedoing.value) return

    undoStack.value.push(action)
    // 最大履歴数を超えた場合は古いものから削除
    if (undoStack.value.length > MAX_HISTORY) {
      undoStack.value.splice(0, undoStack.value.length - MAX_HISTORY)
    }
    // 新しい操作を行ったらRedoスタックをクリア
    redoStack.value = []
  }

  /**
   * 直前の操作を元に戻す
   */
  const undo = async () => {
    const action = undoStack.value.pop()
    if (!action) return

    isUndoRedoing.value = true
    try {
      await action.undo()
      redoStack.value.push(action)
    } catch (err) {
      console.error('[UndoRedo] Undo failed:', err)
      // 失敗した場合はスタックに戻す
      undoStack.value.push(action)
    } finally {
      isUndoRedoing.value = false
    }
  }

  /**
   * 直前にUndoした操作をやり直す
   */
  const redo = async () => {
    const action = redoStack.value.pop()
    if (!action) return

    isUndoRedoing.value = true
    try {
      await action.redo()
      undoStack.value.push(action)
    } catch (err) {
      console.error('[UndoRedo] Redo failed:', err)
      // 失敗した場合はスタックに戻す
      redoStack.value.push(action)
    } finally {
      isUndoRedoing.value = false
    }
  }

  /**
   * 履歴をすべてクリアする
   */
  const clearHistory = () => {
    undoStack.value = []
    redoStack.value = []
  }

  return {
    canUndo,
    canRedo,
    isUndoRedoing,
    pushAction,
    undo,
    redo,
    clearHistory,
  }
}
