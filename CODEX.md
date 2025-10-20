# CODEX.md — ドキュメントの読み方と命令書
このプロジェクトは「自社(発注)×農家N(受注)」専用の受発注システムです。

## 目的
- 「注文→出荷完了」までを最小構成で安定運用
- 価格は商品×農家の単価1本、受注時にスナップショット

## 参照順
1. 00_project/concept_requirements.md
2. 01_tech/architecture.md → database_design.md → api_design.md
3. 02_domain/order_lifecycle.md → ship_to_master.md → inventory_rules.md
4. 03_ops/setup.md → cicd.md

## ルール
- 新規コードや設計は、まず **api_design.md** と **database_design.md** に整合させる
- 仕様の疑義は **order_lifecycle.md** をソース・オブ・トゥルースとする
- 更新時は関連MDの該当セクションも必ず修正（片落ち禁止）
