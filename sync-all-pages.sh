#!/bin/bash

# Progressive sync script for all Notion pages
# Syncs 131 pages in batches of 10

URL="https://26ef3a11.aconnect-innovator.pages.dev/api/sync"
BATCH_SIZE=10
TOTAL_PAGES=131

echo "🚀 Starting progressive sync for $TOTAL_PAGES pages..."
echo "📊 Batch size: $BATCH_SIZE pages"
echo "⏱️  Estimated time: ~10 minutes"
echo ""

OFFSET=${START_OFFSET:-0}
BATCH_NUM=$(( ($OFFSET / $BATCH_SIZE) + 1 ))
TOTAL_BATCHES=$(( ($TOTAL_PAGES + $BATCH_SIZE - 1) / $BATCH_SIZE ))

while [ $OFFSET -lt $TOTAL_PAGES ]; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Batch $BATCH_NUM/$TOTAL_BATCHES (offset: $OFFSET)"
  
  RESPONSE=$(curl -s -X POST "$URL" \
    -H 'Content-Type: application/json' \
    -d "{\"limit\": $BATCH_SIZE, \"offset\": $OFFSET}" \
    --max-time 90)
  
  STATUS=$(echo $RESPONSE | jq -r '.status')
  UPSERTED=$(echo $RESPONSE | jq -r '.result.upserted // 0')
  
  if [ "$STATUS" = "ok" ]; then
    echo "✅ Success! Upserted: $UPSERTED records"
  else
    echo "❌ Error: $RESPONSE"
    exit 1
  fi
  
  OFFSET=$((OFFSET + BATCH_SIZE))
  BATCH_NUM=$((BATCH_NUM + 1))
  
  # Small delay between batches
  if [ $OFFSET -lt $TOTAL_PAGES ]; then
    echo "⏳ Waiting 2 seconds before next batch..."
    sleep 2
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Sync complete!"
echo "✨ All $TOTAL_PAGES pages have been synced"
echo "🌐 Check results at: $URL"
