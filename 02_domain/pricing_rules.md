# 価格ロジック v2（最小）
- 単価は「商品×農家」で1本。特価期間があれば優先。
- 受注時に unit_price を OrderItem へスナップショット。以後不変。
- 合計は OrderItem 合算。割引は orders.discount_amount のみ。
