/**
 * 設定管理モジュール
 * APIキーはスプレッドシート共有時の漏洩を防ぐため PropertiesService (UserProperties) に保存し、
 * 「設定」シートからはベースURLのみを読み取る（旧バージョンのセル入力値は自動移行・消去）
 */

var CONFIG_SHEET_NAME = '設定';
var CONFIG_KEY_CELL = 'B2'; // 旧APIキー欄（現在は自動移行・マスク表示のみ）
var CONFIG_URL_CELL = 'B3'; // ベースURL
var USER_PROP_API_KEY = 'MOGUCHART_API_KEY';

/**
 * 設定値を取得する
 * @returns {Object} { apiKey, baseUrl }
 */
function getConfig_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  var userProps = PropertiesService.getUserProperties();
  var storedKey = userProps.getProperty(USER_PROP_API_KEY) || '';
  var baseUrl = 'https://moguchart.jp/api/v1';

  if (sheet) {
    var cellKey = String(sheet.getRange(CONFIG_KEY_CELL).getValue() || '').trim();
    // 旧テンプレートまたは誤入力でセルに生のAPIキーが書かれている場合、UserPropertiesへ移行してセルから消去
    if (cellKey && cellKey.indexOf('mk_') === 0) {
      userProps.setProperty(USER_PROP_API_KEY, cellKey);
      storedKey = cellKey;
      sheet
        .getRange(CONFIG_KEY_CELL)
        .setValue('（UserPropertiesに保存済み）')
        .setNote('APIキーはメニュー「🔑 APIキーを設定」から安全に設定・変更できます（セルには保存されません）');
    }

    var rawUrl = String(sheet.getRange(CONFIG_URL_CELL).getValue() || '').trim();
    if (rawUrl) {
      baseUrl = rawUrl;
    }
  }

  return {
    apiKey: String(storedKey).trim(),
    baseUrl: String(baseUrl).trim().replace(/\/$/, ''), // 末尾スラッシュ除去
  };
}

/**
 * ダイアログからAPIキーを UserProperties に安全に保存する
 */
function setApiKeyPrompt_() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt(
    '🔑 APIキー設定',
    'moguchart で発行したAPIキー（mk_xxx）を入力してください。\n' +
      '※ シート上には書き込まれず、あなた専用の UserProperties に安全に保存されます。\n' +
      '（空欄でOKを押すと保存済みキーを削除します）',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() !== ui.Button.OK) return;

  var input = result.getResponseText().trim();
  var userProps = PropertiesService.getUserProperties();

  if (!input) {
    userProps.deleteProperty(USER_PROP_API_KEY);
    ui.alert('保存済みのAPIキーを削除しました。');
    return;
  }

  if (input.indexOf('mk_') !== 0) {
    ui.alert('❌ APIキーは "mk_" で始まる形式を入力してください。');
    return;
  }

  userProps.setProperty(USER_PROP_API_KEY, input);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (sheet) {
    sheet.getRange(CONFIG_KEY_CELL).setValue('（UserPropertiesに保存済み）');
  }

  ui.alert('✅ APIキーを UserProperties に保存しました。スプレッドシートを共有しても第三者には公開されません。');
}

/**
 * 設定シートを初期化する（存在しない場合に作成）
 */
function initConfigSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);

  if (sheet) return sheet;

  sheet = ss.insertSheet(CONFIG_SHEET_NAME);

  // ヘッダー
  sheet.getRange('A1').setValue('項目').setFontWeight('bold');
  sheet.getRange('B1').setValue('値').setFontWeight('bold');

  // 設定項目
  var hasSavedKey = Boolean(PropertiesService.getUserProperties().getProperty(USER_PROP_API_KEY));
  sheet.getRange('A2').setValue('APIキー');
  sheet
    .getRange('B2')
    .setValue(hasSavedKey ? '（UserPropertiesに保存済み）' : '（メニュー「🔑 APIキーを設定」から登録）')
    .setNote('セキュリティ保護のため、APIキーはセルに直接入力せずメニュー「🔑 APIキーを設定」から登録してください');

  sheet.getRange('A3').setValue('ベースURL');
  sheet.getRange('B3').setValue('https://moguchart.jp/api/v1').setNote('通常は変更不要');

  // 列幅調整
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 400);

  // 説明テキスト
  sheet.getRange('A5').setValue('📌 使い方').setFontWeight('bold');
  sheet.getRange('A6').setValue('1. moguchart の設定画面でAPIキーを発行します');
  sheet.getRange('A7').setValue('2. メニュー「🐹 moguchart > 🔑 APIキーを設定」からキーを登録します');
  sheet.getRange('A8').setValue('3. メニュー「🐹 moguchart」からデータを取得します');

  return sheet;
}
