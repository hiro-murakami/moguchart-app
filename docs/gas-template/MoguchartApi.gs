/**
 * moguchart API クライアント
 * REST API との通信を担当するモジュール
 */

/**
 * APIリクエストの共通処理
 * @param {string} path - APIパス（例: '/projects'）
 * @param {Object} options - UrlFetchApp のオプション
 * @returns {Object} レスポンスデータ
 */
function apiRequest_(path, options) {
  var config = getConfig_();
  if (!config.apiKey) {
    throw new Error('APIキーが設定されていません。「設定」シートにAPIキーを入力してください。');
  }

  var url = config.baseUrl + path;
  var defaultOptions = {
    headers: { 'X-API-Key': config.apiKey },
    muteHttpExceptions: true,
  };

  // オプションをマージ
  if (options) {
    if (options.headers) {
      defaultOptions.headers = Object.assign(defaultOptions.headers, options.headers);
    }
    for (var key in options) {
      if (key !== 'headers') {
        defaultOptions[key] = options[key];
      }
    }
  }

  var response = UrlFetchApp.fetch(url, defaultOptions);
  var code = response.getResponseCode();
  var body = JSON.parse(response.getContentText());

  if (code >= 400) {
    throw new Error('API Error (' + code + '): ' + (body.message || 'Unknown error'));
  }

  if (body.status !== 'succeeded') {
    throw new Error('API Error: ' + (body.message || 'Unknown error'));
  }

  return body.data;
}

/**
 * プロジェクト一覧を取得
 * @returns {Array} プロジェクト配列
 */
function fetchProjects() {
  return apiRequest_('/projects');
}

/**
 * ガントチャートデータを取得
 * @param {string} projectId - プロジェクトID
 * @returns {Array} 行（タスク含む）配列
 */
function fetchGanttChart(projectId) {
  return apiRequest_('/projects/' + projectId + '/chart');
}

/**
 * プロジェクトのフルデータをJSON形式で取得
 * @param {string} projectId - プロジェクトID
 * @returns {Object} { version, project, rows }
 */
function fetchGanttDataJson(projectId) {
  return apiRequest_('/projects/' + projectId + '/json');
}

/**
 * タスクを作成/更新
 * @param {Array} tasks - タスク配列
 * @returns {Array} 作成されたタスクID配列
 */
function upsertTasks(tasks) {
  return apiRequest_('/tasks', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ tasks: tasks }),
  });
}

/**
 * 行を作成/更新
 * @param {Object|Array} rows - 行データ
 * @returns {number|Array} 作成された行ID
 */
function upsertRows(rows) {
  return apiRequest_('/rows', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(rows),
  });
}
