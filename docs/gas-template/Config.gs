/**
 * 設定管理モジュール
 * 「設定」シートからAPIキーとベースURLを読み取る
 */

var CONFIG_SHEET_NAME = '設定';
var CONFIG_KEY_CELL = 'B2'; // APIキー
var CONFIG_URL_CELL = 'B3'; // ベースURL

/**
 * 設定値を取得する
 * @returns {Object} { apiKey, baseUrl }
 */
function getConfig_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);

  if (!sheet) {
    throw new Error('「設定」シートが見つかりません。');
  }

  var apiKey = sheet.getRange(CONFIG_KEY_CELL).getValue();
  var baseUrl = sheet.getRange(CONFIG_URL_CELL).getValue();

  // デフォルトURL
  if (!baseUrl) {
    baseUrl = 'https://moguchart.jp/api/v1';
  }

  return {
    apiKey: String(apiKey).trim(),
    baseUrl: String(baseUrl).trim().replace(/\/$/, ''), // 末尾スラッシュ除去
  };
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
  sheet.getRange('A2').setValue('APIキー');
  sheet.getRange('B2').setValue('').setNote('moguchart で発行したAPIキー（mk_xxx）を入力');

  sheet.getRange('A3').setValue('ベースURL');
  sheet.getRange('B3').setValue('https://moguchart.jp/api/v1').setNote('通常は変更不要');

  // 列幅調整
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 400);

  // 説明テキスト
  sheet.getRange('A5').setValue('📌 使い方').setFontWeight('bold');
  sheet.getRange('A6').setValue('1. moguchart の設定画面でAPIキーを発行します');
  sheet.getRange('A7').setValue('2. 上の「APIキー」欄にキーを貼り付けます');
  sheet.getRange('A8').setValue('3. メニュー「moguchart」からデータを取得します');

  return sheet;
}
