#!/bin/bash
# Split monolith into modules
set -e

SRC=nostr-article-capture.user.js
OUT=src

mkdir -p "$OUT"

echo "Extracting header..."
sed -n '1,24p' "$SRC" > "$OUT/header.js"

echo "Extracting config..."
{
  sed -n '33,63p' "$SRC" | sed 's/^  //'
  echo ""
  echo "// Shared mutable state (object property mutation works across ESM imports)"
  echo "export const _state = { nacFabRef: null };"
} | sed 's/^const CONFIG/export const CONFIG/' > "$OUT/config.js"

echo "Extracting crypto..."
sed -n '72,667p' "$SRC" | sed 's/^  //' | sed 's/^const Crypto/export const Crypto/' > "$OUT/crypto.js"

echo "Extracting storage..."
{
  echo "import { CONFIG } from './config.js';"
  echo "import { Utils } from './utils.js';"
  echo ""
  sed -n '673,1072p' "$SRC" | sed 's/^  //' | sed 's/^const Storage/export const Storage/'
} > "$OUT/storage.js"

echo "Extracting content-extractor..."
{
  echo "import { CONFIG } from './config.js';"
  echo ""
  sed -n '1078,1734p' "$SRC" | sed 's/^  //' | sed 's/^const ContentExtractor/export const ContentExtractor/'
} > "$OUT/content-extractor.js"

echo "Extracting utils..."
{
  echo "import { CONFIG } from './config.js';"
  echo ""
  sed -n '1740,1785p' "$SRC" | sed 's/^  //' | sed 's/^const Utils/export const Utils/'
} > "$OUT/utils.js"

echo "Extracting entity-tagger..."
{
  echo "import { Storage } from './storage.js';"
  echo "import { Utils } from './utils.js';"
  echo "import { Crypto } from './crypto.js';"
  echo "import { ClaimExtractor } from './claim-extractor.js';"
  echo "import { EntityAutoSuggest } from './entity-auto-suggest.js';"
  echo "import { ReaderView } from './reader-view.js';"
  echo ""
  sed -n '1791,2011p' "$SRC" | sed 's/^  //' | sed 's/^const EntityTagger/export const EntityTagger/'
} > "$OUT/entity-tagger.js"

echo "Extracting claim-extractor..."
{
  echo "import { CONFIG } from './config.js';"
  echo "import { Storage } from './storage.js';"
  echo "import { Utils } from './utils.js';"
  echo "import { Crypto } from './crypto.js';"
  echo "import { EntityTagger } from './entity-tagger.js';"
  echo "import { EvidenceLinker } from './evidence-linker.js';"
  echo "import { ReaderView } from './reader-view.js';"
  echo "import { RelayClient } from './relay-client.js';"
  echo ""
  sed -n '2017,2816p' "$SRC" | sed 's/^  //' | sed 's/^const ClaimExtractor/export const ClaimExtractor/'
} > "$OUT/claim-extractor.js"

echo "Extracting evidence-linker..."
{
  echo "import { Storage } from './storage.js';"
  echo "import { Utils } from './utils.js';"
  echo "import { Crypto } from './crypto.js';"
  echo "import { ClaimExtractor } from './claim-extractor.js';"
  echo "import { ReaderView } from './reader-view.js';"
  echo ""
  sed -n '2822,3047p' "$SRC" | sed 's/^  //' | sed 's/^const EvidenceLinker/export const EvidenceLinker/'
} > "$OUT/evidence-linker.js"

echo "Extracting entity-auto-suggest..."
{
  echo "import { CONFIG } from './config.js';"
  echo "import { Storage } from './storage.js';"
  echo "import { Utils } from './utils.js';"
  echo "import { EntityTagger } from './entity-tagger.js';"
  echo "import { ReaderView } from './reader-view.js';"
  echo ""
  sed -n '3053,3310p' "$SRC" | sed 's/^  //' | sed 's/^const EntityAutoSuggest/export const EntityAutoSuggest/'
} > "$OUT/entity-auto-suggest.js"

echo "Extracting relay-client..."
{
  echo "import { Crypto } from './crypto.js';"
  echo ""
  sed -n '3316,3502p' "$SRC" | sed 's/^  //' | sed 's/^const RelayClient/export const RelayClient/'
} > "$OUT/relay-client.js"

echo "Extracting event-builder..."
{
  echo "import { Storage } from './storage.js';"
  echo "import { Crypto } from './crypto.js';"
  echo "import { ContentExtractor } from './content-extractor.js';"
  echo ""
  sed -n '3508,3774p' "$SRC" | sed 's/^  //' | sed 's/^const EventBuilder/export const EventBuilder/'
} > "$OUT/event-builder.js"

echo "Extracting entity-sync..."
{
  echo "import { Storage } from './storage.js';"
  echo "import { Crypto } from './crypto.js';"
  echo "import { EventBuilder } from './event-builder.js';"
  echo "import { RelayClient } from './relay-client.js';"
  echo ""
  sed -n '3780,4000p' "$SRC" | sed 's/^  //' | sed 's/^const EntitySync/export const EntitySync/'
} > "$OUT/entity-sync.js"

echo "Extracting reader-view..."
{
  echo "import { CONFIG, _state } from './config.js';"
  echo "import { Storage } from './storage.js';"
  echo "import { Utils } from './utils.js';"
  echo "import { Crypto } from './crypto.js';"
  echo "import { ContentExtractor } from './content-extractor.js';"
  echo "import { EntityTagger } from './entity-tagger.js';"
  echo "import { ClaimExtractor } from './claim-extractor.js';"
  echo "import { EntityAutoSuggest } from './entity-auto-suggest.js';"
  echo "import { RelayClient } from './relay-client.js';"
  echo "import { EventBuilder } from './event-builder.js';"
  echo "import { EntityBrowser } from './entity-browser.js';"
  echo ""
  sed -n '4006,5407p' "$SRC" | sed 's/^  //' | sed 's/^const ReaderView/export const ReaderView/' | sed 's/_nacFabRef/_state.nacFabRef/g'
} > "$OUT/reader-view.js"

echo "Extracting entity-browser..."
{
  echo "import { Storage } from './storage.js';"
  echo "import { Utils } from './utils.js';"
  echo "import { EntitySync } from './entity-sync.js';"
  echo ""
  sed -n '5413,6000p' "$SRC" | sed 's/^  //' | sed 's/^const EntityBrowser/export const EntityBrowser/'
} > "$OUT/entity-browser.js"

echo "Extracting styles..."
sed -n '6006,8502p' "$SRC" | sed 's/^  //' | sed 's/^const STYLES/export const STYLES/' > "$OUT/styles.js"

echo "Extracting entity-migration..."
{
  echo "import { Storage } from './storage.js';"
  echo "import { Utils } from './utils.js';"
  echo "import { Crypto } from './crypto.js';"
  echo ""
  sed -n '8508,8582p' "$SRC" | sed 's/^  //' | sed 's/^const EntityMigration/export const EntityMigration/'
} > "$OUT/entity-migration.js"

echo "Extracting init..."
{
  echo "import { CONFIG, _state } from './config.js';"
  echo "import { Storage } from './storage.js';"
  echo "import { Utils } from './utils.js';"
  echo "import { ContentExtractor } from './content-extractor.js';"
  echo "import { ReaderView } from './reader-view.js';"
  echo "import { EntityMigration } from './entity-migration.js';"
  echo "import { STYLES } from './styles.js';"
  echo ""
  sed -n '8588,8715p' "$SRC" | sed 's/^  //' | sed 's/_nacFabRef/_state.nacFabRef/g'
  echo ""
  echo "export { init };"
} > "$OUT/init.js"

echo ""
echo "All modules extracted. File listing:"
ls -la "$OUT/"
echo ""
echo "Line counts:"
wc -l "$OUT"/*.js
