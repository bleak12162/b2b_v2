# 在庫ルール
- new→processing で引当（不足なら422で失敗）
- processing→canceled で戻し（deallocate）
- ship では台帳に ship を記録（在庫は確定時に控除済み）
