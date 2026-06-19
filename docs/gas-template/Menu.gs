/**
 * カスタムメニューとエントリポイント
 */

/**
 * スプレッドシートを開いたときにカスタムメニューを追加
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🐹 moguchart')
    .addItem('📋 プロジェクト一覧を取得', 'menuFetchProjects')
    .addItem('📊 タスク一覧を取得', 'menuFetchTasks')
    .addSeparator()
    .addItem('🔄 全データを更新', 'menuRefreshAll')
    .addSeparator()
    .addItem('⚙️ 初期設定', 'menuSetup')
    .addToUi();
}

/**
 * メニュー: プロジェクト一覧を取得
 */
function menuFetchProjects() {
  try {
    writeProjectsToSheet();
    SpreadsheetApp.getUi().alert('✅ プロジェクト一覧を取得しました。');
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ エラー: ' + e.message);
  }
}

/**
 * メニュー: タスク一覧を取得
 */
function menuFetchTasks() {
  try {
    writeTasksToSheet();
    SpreadsheetApp.getUi().alert('✅ タスク一覧を取得しました。');
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ エラー: ' + e.message);
  }
}

/**
 * メニュー: 全データを更新
 */
function menuRefreshAll() {
  try {
    writeProjectsToSheet();

    // タスク一覧シートにプロジェクトIDが記録されていれば再取得
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var taskSheet = ss.getSheetByName(TASKS_SHEET_NAME);
    if (taskSheet) {
      var note = taskSheet.getRange('A1').getNote();
      var match = note.match(/projectId:\s*(.+)/);
      if (match) {
        var projectId = match[1].trim();
        var chartData = fetchGanttChart(projectId);
        // writeTasksToSheet 内のロジックを直接実行するため、
        // ここでは taskSheet のプロジェクトIDを使って再取得
        taskSheet.clear();
        // シートを再構築
        writeTasksForProject_(projectId);
      }
    }

    SpreadsheetApp.getUi().alert('✅ 全データを更新しました。');
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ エラー: ' + e.message);
  }
}

/**
 * 指定プロジェクトのタスクをシートに書き込む（内部用）
 * @param {string} projectId
 */
function writeTasksForProject_(projectId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var chartData = fetchGanttChart(projectId);
  var sheet = ss.getSheetByName(TASKS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TASKS_SHEET_NAME);
  }
  sheet.clear();

  var headers = [
    '行ID', '行名', 'タスクID', 'タスク名',
    '開始日', '終了日', '日数', '進捗率(%)',
    'ラベル', '色', 'ロック', '依存タスク', '説明',
  ];
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#34a853');
  headerRange.setFontColor('#ffffff');

  var rows = [];
  chartData.forEach(function (row) {
    if (!row.tasks || row.tasks.length === 0) {
      rows.push([row.id, row.name, '', '（タスクなし）', '', '', '', '', '', '', '', '', '']);
      return;
    }
    row.tasks.forEach(function (task) {
      var attr = task.attribute || {};
      rows.push([
        row.id, row.name, task.id, task.name,
        formatDate_(task.start), formatDate_(task.end),
        calcDays_(task.start, task.end),
        attr.progress != null ? attr.progress : '',
        (attr.labels || []).map(function (l) { return l.name; }).join(', '),
        attr.colorPalette ? attr.colorPalette.backgroundColor : '',
        attr.lock ? '🔒' : '',
        (attr.dependencies || []).join(', '),
        attr.description || '',
      ]);
    });
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    applyProgressBars_(sheet, rows.length);
  }

  sheet.getRange('A1').setNote('projectId: ' + projectId);
  SpreadsheetApp.flush();
}

/**
 * メニュー: 初期設定
 */
function menuSetup() {
  initConfigSheet_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheetByName(CONFIG_SHEET_NAME).activate();
  SpreadsheetApp.getUi().alert(
    '⚙️ 初期設定',
    '「設定」シートが開きました。\n\n' +
    '1. moguchart でAPIキーを発行してください\n' +
    '2. B2セルにAPIキーを貼り付けてください\n' +
    '3. メニュー「moguchart > プロジェクト一覧を取得」で動作確認してください',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
