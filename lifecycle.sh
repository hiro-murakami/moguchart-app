# 1. lifecycle.json を作成
cat > /tmp/lifecycle.json << 'EOF'
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": {
        "daysSinceCustomTime": 0,
        "matchesPrefix": ["snapshots/"]
      }
    }
  ]
}
EOF

# 2. ライフサイクルルールを設定
gsutil lifecycle set /tmp/lifecycle.json gs://firestore-sample-c7300.appspot.com
