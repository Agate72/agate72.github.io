# Agate72 website

Public introduction site for Agate72 and EarthSimulator.

Published at https://agate72.github.io/ using GitHub Pages from the main branch root.

Edit `index.html` and `style.css`. No build tools or dependencies are required.

## HP更新PRの作成前チェック

サイト自体は静的HTML/CSSです。次のNode.js依存はテスト専用です。

```sh
npm ci
npx playwright install chromium
npm test
```

- PC 1440px、スマホ390px・320pxのChromium表示、横はみ出し、内部リンク、Tab/フォーカス、主要タップ対象、公開表記を検査します。
- `test-results/` にスクリーンショットとJSONを保存します。`HP_BASELINE_DIR`に更新前サイトのフォルダを指定すると比較用画像も保存します。
- 外部リンクはHEADの到達結果を記録します。障害・拒否は未確認とし、自動合格とは分けます。JAR内容やメールの送受信は検証しません。
- 同じ検査をHPリポジトリのPR作成・更新時にGitHub Actionsで再実行します。ActionsのArtifactsから画像・結果を取得できます。
- **自動合格は目視・実機・権利確認・公開承認の代わりではありません。** 画像比較、リンクの未確認、公開許可はPRテンプレートで確認します。
- PR作成前にローカル検査とプレビュー確認を行い、PR上では再検査します。merge・公開は別途承認後です。
- GitHubのrequired status check設定は別管理です。このworkflowを追加するだけでmergeを強制的に止める設定にはなりません。

The EarthSimulator source repository remains private. The approved demo JAR is distributed through this website repository's Releases. Source code and an OSS license are in preparation.
