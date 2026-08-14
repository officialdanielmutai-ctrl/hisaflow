import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateTieredPriceRuleDto } from './dto/create-tiered-price-rule.dto';

@Injectable()
export class TieredPricingService {
  constructor(private readonly prisma: PrismaService) {}

  async findByItem(itemId: string, orgId: string) {
    return this.prisma.db.tieredPriceRule.findMany({
      where: { orgId, inventoryItemId: itemId },
      orderBy: { minQuantity: 'asc' },
    });
  }

  async upsertRules(orgId: string, itemId: string, rules: CreateTieredPriceRuleDto[]) {
    return this.prisma.db.$transaction(async (tx) => {
      await tx.tieredPriceRule.deleteMany({
        where: { orgId, inventoryItemId: itemId },
      });

      if (rules.length > 0) {
        await tx.tieredPriceRule.createMany({
          data: rules.map(rule => ({
            ...rule,
            orgId,
          })),
        });
      }

      return tx.tieredPriceRule.findMany({
        where: { orgId, inventoryItemId: itemId },
        orderBy: { minQuantity: 'asc' },
      });
    });
  }

  async resolvePrice(orgId: string, itemId: string, quantity: number) {
    const rules = await this.prisma.db.tieredPriceRule.findMany({
      where: { orgId, inventoryItemId: itemId },
      orderBy: { minQuantity: 'desc' },
    });

    const matchedRule = rules.find((rule) => rule.minQuantity <= quantity);
    return matchedRule ? matchedRule.pricePerUnit : null;
  }

  async deleteRule(id: string, orgId: string) {
    return this.prisma.db.tieredPriceRule.delete({
      where: { id_orgId: { id, orgId } },
    });
  }
}
