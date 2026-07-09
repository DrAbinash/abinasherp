import { db } from '@/lib/db'

// ============================================================
// AUTO-DEDUCT INVENTORY ON BILLING
// When a bill is created/paid, check InventoryConsumptionRule for each testId,
// deduct stock based on the tests in the order. Log a stock-out transaction
// with reference to the bill.
// ============================================================

export async function autoDeductInventoryForBill(
  billId: string,
  billNumber: string,
  orderTests: Array<{ testId: string; testName: string }>,
  performedByName: string,
): Promise<{ deducted: Array<{ itemName: string; quantity: number; alert?: boolean }>; errors: string[] }> {
  const deducted: Array<{ itemName: string; quantity: number; alert?: boolean }> = []
  const errors: string[] = []

  for (const ot of orderTests) {
    // Find consumption rules for this test
    const rules = await db.inventoryConsumptionRule.findMany({
      where: { testId: ot.testId },
      include: { item: true },
    })

    for (const rule of rules) {
      const item = rule.item
      if (!item || !item.isActive) continue

      const before = item.currentStock
      // Don't deduct if stock is already 0 (don't go negative — log as error instead)
      if (before < rule.quantity) {
        errors.push(`${item.name}: insufficient stock (${before} ${item.unit} available, ${rule.quantity} needed for ${ot.testName})`)
        continue
      }

      const after = before - rule.quantity

      try {
        await db.$transaction([
          db.inventoryItem.update({
            where: { id: item.id },
            data: {
              currentStock: after,
              lastUpdatedByName: performedByName,
            },
          }),
          db.inventoryTransaction.create({
            data: {
              itemId: item.id,
              type: 'out',
              quantity: -rule.quantity,
              stockBefore: before,
              stockAfter: after,
              reason: `Auto-deducted for ${ot.testName} (Bill ${billNumber})`,
              reference: billNumber,
              performedBy: performedByName,
            },
          }),
        ])

        const entry: { itemName: string; quantity: number; alert?: boolean } = {
          itemName: item.name,
          quantity: rule.quantity,
        }
        // Low-stock alert
        if (after <= item.minStock) {
          entry.alert = true
        }
        deducted.push(entry)
      } catch (e: any) {
        errors.push(`${item.name}: ${e.message}`)
      }
    }
  }

  return { deducted, errors }
}
