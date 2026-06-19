/**
 * スプレッドシートへのデータ書き込みモジュール
 */

var PROJECTS_SHEET_NAME = 'プロジェクト一覧';
var TASKS_SHEET_NAME = 'タスク一覧';

// ========== プロジェクト一覧 ==========

/**
 * プロジェクト一覧をシートに書き込む
 */
function writeProjectsToSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  try {
    ui.alert('取得中...', 'プロジェクト一覧を取得しています。', ui.ButtonSet.OK);
  } catch (e) {
    // UIが使えない環境（トリガー実行等）は無視
  }

  var projects = fetchProjects();

  // シート取得 or 作成
  var sheet = ss.getSheetByName(PROJECTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PROJECTS_SHEET_NAME);
  }

  // クリア
  sheet.clear();

  // ヘッダー
  var headers = [
    'プロジェクトID',
    'プロジェクト名',
    '開始日',
    '終了日',
    '公開',
    'ロール',
    '表示粒度',
    'コメント数',
    '説明',
  ];
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');

  if (projects.length === 0) {
    sheet.getRange(2, 1).setValue('プロジェクトが見つかりません');
    return;
  }

  // データ行
  var rows = projects.map(function (p) {
    var attr = p.attribute || {};
    return [
      p.id,
      p.name,
      formatDate_(p.start),
      formatDate_(p.end),
      p.public ? '○' : '',
      p.role || '',
      attr.granularity || 'daily',
      p.commentCount || 0,
      attr.description || '',
    ];
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  // 列幅調整
  sheet.setColumnWidth(1, 300); // ID
  sheet.setColumnWidth(2, 250); // 名前
  sheet.setColumnWidth(3, 120); // 開始日
  sheet.setColumnWidth(4, 120); // 終了日
  sheet.setColumnWidth(9, 300); // 説明

  // フィルタ設定
  var dataRange = sheet.getRange(1, 1, rows.length + 1, headers.length);
  if (sheet.getFilter()) sheet.getFilter().remove();
  dataRange.createFilter();

  sheet.activate();
  SpreadsheetApp.flush();
}

// ========== タスク一覧 ==========

/**
 * 選択中のプロジェクトのタスク一覧をシートに書き込む
 */
function writeTasksToSheet() {
  var projectId = getSelectedProjectId_();
  if (!projectId) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var chartData = fetchGanttChart(projectId);

  // シート取得 or 作成
  var sheet = ss.getSheetByName(TASKS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TASKS_SHEET_NAME);
  }

  // クリア
  sheet.clear();

  // ヘッダー
  var headers = [
    '行ID',
    '行名',
    'タスクID',
    'タスク名',
    '開始日',
    '終了日',
    '日数',
    '進捗率(%)',
    'ラベル',
    '色',
    'ロック',
    '依存タスク',
    '説明',
  ];
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#34a853');
  headerRange.setFontColor('#ffffff');

  // データ行を構築
  var rows = [];
  chartData.forEach(function (row) {
    if (!row.tasks || row.tasks.length === 0) {
      // タスクのない行も表示
      rows.push([
        row.id,
        row.name,
        '',
        '（タスクなし）',
        '', '', '', '', '', '', '', '', '',
      ]);
      return;
    }

    row.tasks.forEach(function (task) {
      var attr = task.attribute || {};
      var days = calcDays_(task.start, task.end);
      var labels = (attr.labels || []).map(function (l) { return l.name; }).join(', ');
      var color = attr.colorPalette ? attr.colorPalette.backgroundColor : '';
      var deps = (attr.dependencies || []).join(', ');

      rows.push([
        row.id,
        row.name,
        task.id,
        task.name,
        formatDate_(task.start),
        formatDate_(task.end),
        days,
        attr.progress != null ? attr.progress : '',
        labels,
        color,
        attr.lock ? '🔒' : '',
        deps,
        attr.description || '',
      ]);
    });
  });

  if (rows.length === 0) {
    sheet.getRange(2, 1).setValue('タスクが見つかりません');
    sheet.activate();
    return;
  }

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  // 色セルに背景色を適用
  var COLOR_COL = 10; // 「色」列（J列）
  for (var i = 0; i < rows.length; i++) {
    var colorValue = rows[i][COLOR_COL - 1];
    if (colorValue && colorValue.match(/^#[0-9a-fA-F]{6}$/)) {
      sheet.getRange(i + 2, COLOR_COL).setBackground(colorValue);
    }
  }

  // 進捗率にデータバーを模した条件付き書式
  applyProgressBars_(sheet, rows.length);

  // 列幅調整
  sheet.setColumnWidth(1, 60);   // 行ID
  sheet.setColumnWidth(2, 180);  // 行名
  sheet.setColumnWidth(3, 80);   // タスクID
  sheet.setColumnWidth(4, 250);  // タスク名
  sheet.setColumnWidth(5, 120);  // 開始日
  sheet.setColumnWidth(6, 120);  // 終了日
  sheet.setColumnWidth(7, 60);   // 日数
  sheet.setColumnWidth(8, 80);   // 進捗率
  sheet.setColumnWidth(13, 300); // 説明

  // フィルタ設定
  var dataRange = sheet.getRange(1, 1, rows.length + 1, headers.length);
  if (sheet.getFilter()) sheet.getFilter().remove();
  dataRange.createFilter();

  // プロジェクトIDをメモとして記録
  sheet.getRange('A1').setNote('projectId: ' + projectId);

  sheet.activate();
  SpreadsheetApp.flush();
}

// ========== ヘルパー関数 ==========

/**
 * 選択中のプロジェクトIDを取得する
 * プロジェクト一覧シートで行を選択している場合はそのIDを使用
 * @returns {string|null} プロジェクトID
 */
function getSelectedProjectId_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var activeSheet = ss.getActiveSheet();

  // プロジェクト一覧シートで行が選択されている場合
  if (activeSheet.getName() === PROJECTS_SHEET_NAME) {
    var row = activeSheet.getActiveCell().getRow();
    if (row >= 2) {
      var projectId = activeSheet.getRange(row, 1).getValue();
      if (projectId) return String(projectId);
    }
  }

  // ダイアログでプロジェクトIDを入力させる
  var result = ui.prompt(
    'プロジェクトID',
    'タスクを取得するプロジェクトのIDを入力してください。\n' +
    '（プロジェクト一覧シートで行を選択してから実行すると自動入力されます）',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() !== ui.Button.OK) return null;

  var id = result.getResponseText().trim();
  if (!id) {
    ui.alert('プロジェクトIDが入力されていません。');
    return null;
  }

  return id;
}

/**
 * 日付文字列をフォーマット
 * @param {string} dateStr - ISO日付文字列
 * @returns {string} YYYY/MM/DD 形式
 */
function formatDate_(dateStr) {
  if (!dateStr) return '';
  // "YYYY-MM-DDTHH:mm:ss" → "YYYY/MM/DD"
  return dateStr.substring(0, 10).replace(/-/g, '/');
}

/**
 * 2つの日付間の日数を計算
 * @param {string} start - 開始日
 * @param {string} end - 終了日
 * @returns {number} 日数
 */
function calcDays_(start, end) {
  if (!start || !end) return '';
  var s = new Date(start);
  var e = new Date(end);
  var diff = (e - s) / (1000 * 60 * 60 * 24);
  return Math.max(1, Math.round(diff));
}

/**
 * 進捗率列に条件付き書式（色分け）を適用
 * @param {Sheet} sheet - 対象シート
 * @param {number} dataRows - データ行数
 */
function applyProgressBars_(sheet, dataRows) {
  var PROGRESS_COL = 8; // H列
  var range = sheet.getRange(2, PROGRESS_COL, dataRows, 1);

  // 既存の条件付き書式をクリア
  var rules = sheet.getConditionalFormatRules();

  // 進捗率に応じた色分け
  var newRules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberEqualTo(100)
      .setBackground('#c8e6c9') // 緑（完了）
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThanOrEqualTo(50)
      .setBackground('#fff9c4') // 黄（進行中）
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setBackground('#ffecb3') // 薄黄（着手済み）
      .setRanges([range])
      .build(),
  ];

  sheet.setConditionalFormatRules(rules.concat(newRules));
}
