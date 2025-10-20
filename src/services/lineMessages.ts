import { format } from 'date-fns';
import { OrderWithRelations } from './order.js';

function orderSummary(order: OrderWithRelations): string {
  const date = format(order.orderedAt, 'yyyy-MM-dd HH:mm');
  return `注文番号: ${order.orderCode}\n受注日: ${date}`;
}

export function buildOrderCreatedMessage(order: OrderWithRelations): string {
  return [`[新規受注]`, orderSummary(order)].join('\n');
}

export function buildOrderConfirmedMessage(order: OrderWithRelations): string {
  const confirmedAt = order.confirmedAt ? format(order.confirmedAt, 'yyyy-MM-dd HH:mm') : '-';
  return [`[受注確定]`, orderSummary(order), `確定時刻: ${confirmedAt}`].join('\n');
}

export function buildOrderShippedMessage(order: OrderWithRelations): string {
  const shippedAt = order.shippedAt ? format(order.shippedAt, 'yyyy-MM-dd HH:mm') : '-';
  return [
    `[出荷済み]`,
    orderSummary(order),
    `出荷時刻: ${shippedAt}`,
    order.trackingNumber ? `伝票番号: ${order.trackingNumber}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildOrderCompletedMessage(order: OrderWithRelations): string {
  const completedAt = order.completedAt ? format(order.completedAt, 'yyyy-MM-dd HH:mm') : '-';
  return [`[完了]`, orderSummary(order), `完了時刻: ${completedAt}`].join('\n');
}
