import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import { InventoryService } from '../../inventory/inventory.service';
import { TableOrdersService } from '../../table-orders/table-orders.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionTypeDto } from '../../transactions/dto/create-transaction.dto';
import type { AssistantToolProvider, ToolDefinition } from '../tool.types';
import {
  asLimit,
  asOptionalNonNegative,
  asOptionalString,
  asPositiveNumber,
  asRecord,
  asString,
} from './tool-args';

const RESTAURANT = ['RESTAURANT'];
const STAFF_ROLES = [AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF];
const MANAGER_ROLES = [AppRole.OWNER, AppRole.MANAGER];

interface RecipeLine {
  quantityUsed: unknown;
  ingredient: { id: string; name: string; unit: string; quantity: unknown };
}

interface DeductionPlan {
  /** Flat before/after rows keyed by ingredient/item name. */
  diff: Record<string, { before: number; after: number }>;
  lines: number;
}

function kes(amount: number): string {
  return `KES ${new Intl.NumberFormat('en-KE').format(amount)}`;
}

/**
 * RESTAURANT tool set (overhaul Duty 2, Phase E — remaining verticals).
 *
 * Table orders are the primary flow; closing an order deducts composite recipe
 * ingredients or plain-item stock. Same contract as the other verticals:
 * `read` tools run immediately, `write` tools only build proposals, and the
 * executor commits through `TableOrdersService` / `TransactionsService` /
 * `InventoryService` — the same services the manual UI uses.
 */
@Injectable()
export class RestaurantAssistantToolsService implements AssistantToolProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tableOrders: TableOrdersService,
    private readonly inventory: InventoryService,
    private readonly transactions: TransactionsService,
  ) {}

  all(): ToolDefinition[] {
    return [
      // reads
      this.getOpenTables(),
      this.listMenuItems(),
      this.getMenuItemRecipe(),
      // writes
      this.createTableOrder(),
      this.addOrderItem(),
      this.closeTableOrder(),
      this.recordRecipeConsumption(),
      this.updateMenuPrice(),
    ];
  }

  // ── scoped lookups ──────────────────────────────────────────────────────
  private async findItem(organizationId: string, id: string) {
    const item = await this.prisma.db.inventoryItem.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        unit: true,
        quantity: true,
        sellingPrice: true,
        isComposite: true,
        recipeLines: { include: { ingredient: true } },
      },
    });
    if (!item) {
      throw new BadRequestException(
        'No matching item in this organization.',
      );
    }
    return item;
  }

  private async findOrder(organizationId: string, id: string) {
    const order = await this.prisma.db.tableOrder.findFirst({
      where: { id, organizationId },
      include: {
        items: {
          include: {
            item: { include: { recipeLines: { include: { ingredient: true } } } },
          },
        },
      },
    });
    if (!order) {
      throw new BadRequestException(
        'No matching table order in this organization.',
      );
    }
    return order;
  }

  /**
   * Works out what stock an order or dish would deduct, refusing when any
   * ingredient/item is short. Composite items deduct their recipe ingredients;
   * plain items deduct their own stock.
   */
  private planDeductions(
    lines: Array<{ quantity: unknown; item: {
      name: string;
      unit: string;
      quantity: unknown;
      isComposite: boolean;
      recipeLines: RecipeLine[];
    } }>,
  ): DeductionPlan {
    const diff: Record<string, { before: number; after: number }> = {};
    let count = 0;
    for (const line of lines) {
      const qty = Number(line.quantity);
      if (line.item.isComposite) {
        for (const recipeLine of line.item.recipeLines) {
          const deduct = Number(recipeLine.quantityUsed) * qty;
          const before = Number(recipeLine.ingredient.quantity);
          if (before < deduct) {
            throw new BadRequestException(
              `Insufficient stock for ${recipeLine.ingredient.name} (need ${deduct} ${recipeLine.ingredient.unit}, have ${before}).`,
            );
          }
          diff[`${recipeLine.ingredient.name} (${recipeLine.ingredient.unit})`] = {
            before,
            after: Math.round((before - deduct) * 1000) / 1000,
          };
          count++;
        }
      } else {
        const before = Number(line.item.quantity);
        if (before < qty) {
          throw new BadRequestException(
            `Insufficient stock for ${line.item.name} (need ${qty}, have ${before}).`,
          );
        }
        diff[`${line.item.name} (${line.item.unit})`] = {
          before,
          after: Math.round((before - qty) * 1000) / 1000,
        };
        count++;
      }
    }
    return { diff, lines: count };
  }

  // ── read: open tables ───────────────────────────────────────────────────
  private getOpenTables(): ToolDefinition {
    return {
      name: 'get_open_tables',
      description:
        'List the restaurant\u2019s open table orders with their items and totals. Read-only. Use this to resolve an order ID before adding items or closing it.',
      kind: 'read',
      riskLevel: 'low',
      verticals: RESTAURANT,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      execute: async (_raw, ctx) => {
        const orders = await this.prisma.db.tableOrder.findMany({
          where: { organizationId: ctx.organizationId, status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: { item: { select: { id: true, name: true, unit: true } } },
            },
          },
        });
        return orders.map((order) => {
          const items = order.items.map((line) => ({
            itemId: line.itemId,
            name: line.item?.name ?? 'Unknown',
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
          }));
          return {
            id: order.id,
            tableLabel: order.tableLabel,
            notes: order.notes,
            openedAt: order.createdAt,
            total:
              Math.round(
                items.reduce(
                  (sum, line) => sum + line.unitPrice * line.quantity,
                  0,
                ) * 100,
              ) / 100,
            items,
          };
        });
      },
    };
  }

  // ── read: menu items ────────────────────────────────────────────────────
  private listMenuItems(): ToolDefinition {
    return {
      name: 'list_menu_items',
      description:
        'List active menu/inventory items with their price and whether they are composite dishes. Read-only. Use this to resolve an item ID and price for a table order.',
      kind: 'read',
      riskLevel: 'low',
      verticals: RESTAURANT,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional name filter.' },
          limit: { type: 'number' },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const query = asOptionalString(args.query, 'query', 100);
        const limit = asLimit(args.limit, 20);
        const items = await this.prisma.db.inventoryItem.findMany({
          where: {
            organizationId: ctx.organizationId,
            isActive: true,
            ...(query
              ? { name: { contains: query, mode: 'insensitive' } }
              : {}),
          },
          orderBy: { name: 'asc' },
          take: limit,
          select: {
            id: true,
            name: true,
            unit: true,
            quantity: true,
            sellingPrice: true,
            isComposite: true,
          },
        });
        return items.map((item) => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          quantity: Number(item.quantity),
          sellingPrice:
            item.sellingPrice == null ? null : Number(item.sellingPrice),
          isComposite: item.isComposite,
        }));
      },
    };
  }

  // ── read: recipe ────────────────────────────────────────────────────────
  private getMenuItemRecipe(): ToolDefinition {
    return {
      name: 'get_menu_item_recipe',
      description:
        'Show the recipe (ingredients and amounts) of a composite dish. Read-only. Use this before recording recipe consumption.',
      kind: 'read',
      riskLevel: 'low',
      verticals: RESTAURANT,
      parameters: {
        type: 'object',
        properties: { itemId: { type: 'string' } },
        required: ['itemId'],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const item = (await this.findItem(
          ctx.organizationId,
          asString(args.itemId, 'itemId', 100),
        )) as {
          id: string;
          name: string;
          isComposite: boolean;
          recipeLines?: RecipeLine[];
        };
        return {
          itemId: item.id,
          item: item.name,
          isComposite: item.isComposite,
          ingredients: (item.recipeLines ?? []).map((line) => ({
            ingredientId: line.ingredient.id,
            name: line.ingredient.name,
            unit: line.ingredient.unit,
            quantityUsed: Number(line.quantityUsed),
          })),
        };
      },
    };
  }

  // ── write: create a table order ─────────────────────────────────────────
  private createTableOrder(): ToolDefinition {
    return {
      name: 'create_table_order',
      description:
        'Open a table order with optional items. Requires approval. Use list_menu_items for item IDs and prices; a missing unit price falls back to the item\u2019s selling price.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: RESTAURANT,
      parameters: {
        type: 'object',
        properties: {
          tableLabel: { type: 'string' },
          notes: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                itemId: { type: 'string' },
                quantity: { type: 'number' },
                unitPrice: { type: 'number' },
                notes: { type: 'string' },
              },
              required: ['itemId', 'quantity'],
            },
          },
        },
        required: ['tableLabel'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const tableLabel = asString(args.tableLabel, 'tableLabel', 60);
        const items = await this.normaliseOrderItems(args.items, ctx.organizationId);
        const total = items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0,
        );
        return {
          args: {
            tableLabel,
            notes: asOptionalString(args.notes, 'notes', 300),
            items,
          },
          summary: `Open table ${tableLabel} with ${items.length} item${
            items.length === 1 ? '' : 's'
          } (${kes(total)})`,
          diff: { before: null, after: { tableLabel, items } },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.tableOrders.create(
          {
            tableLabel: asString(args.tableLabel, 'tableLabel', 60),
            notes: asOptionalString(args.notes, 'notes', 300),
            items: (await this.normaliseOrderItems(
              args.items,
              ctx.organizationId,
            )).map((item) => ({
              itemId: item.itemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              notes: item.notes,
            })),
          },
          ctx.organizationId,
        );
      },
    };
  }

  private async normaliseOrderItems(
    value: unknown,
    organizationId: string,
  ): Promise<
    Array<{
      itemId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      notes?: string;
    }>
  > {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      throw new BadRequestException('"items" must be an array.');
    }
    const items: Array<{
      itemId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      notes?: string;
    }> = [];
    for (const entry of value) {
      const line = asRecord(entry);
      const item = await this.findItem(
        organizationId,
        asString(line.itemId, 'itemId', 100),
      );
      const quantity = asPositiveNumber(line.quantity, 'quantity');
      const explicitPrice = asOptionalNonNegative(line.unitPrice, 'unitPrice');
      const unitPrice =
        explicitPrice ?? Number(item.sellingPrice ?? 0);
      items.push({
        itemId: item.id,
        name: item.name,
        quantity,
        unitPrice,
        notes: asOptionalString(line.notes, 'notes', 200),
      });
    }
    return items;
  }

  // ── write: add an item to a table ───────────────────────────────────────
  private addOrderItem(): ToolDefinition {
    return {
      name: 'add_order_item',
      description:
        'Add an item to an open table order. Requires approval. Use get_open_tables for the order ID and list_menu_items for the item.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: RESTAURANT,
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          itemId: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['orderId', 'itemId', 'quantity'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const order = await this.findOrder(
          ctx.organizationId,
          asString(args.orderId, 'orderId', 100),
        );
        if (order.status !== 'OPEN') {
          throw new BadRequestException('Can only add items to OPEN orders.');
        }
        const item = await this.findItem(
          ctx.organizationId,
          asString(args.itemId, 'itemId', 100),
        );
        const quantity = asPositiveNumber(args.quantity, 'quantity');
        const unitPrice =
          asOptionalNonNegative(args.unitPrice, 'unitPrice') ??
          Number(item.sellingPrice ?? 0);
        const notes = asOptionalString(args.notes, 'notes', 200);
        const normalised = { itemId: item.id, quantity, unitPrice, notes };
        return {
          args: { orderId: order.id, ...normalised },
          summary: `Add ${quantity} ${item.name} to table ${order.tableLabel} (${kes(
            quantity * unitPrice,
          )})`,
          diff: { before: null, after: { table: order.tableLabel, ...normalised } },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        const item = await this.findItem(
          ctx.organizationId,
          asString(args.itemId, 'itemId', 100),
        );
        return this.tableOrders.addItem(
          asString(args.orderId, 'orderId', 100),
          {
            itemId: item.id,
            quantity: asPositiveNumber(args.quantity, 'quantity'),
            unitPrice:
              asOptionalNonNegative(args.unitPrice, 'unitPrice') ??
              Number(item.sellingPrice ?? 0),
            notes: asOptionalString(args.notes, 'notes', 200),
          },
          ctx.organizationId,
        );
      },
    };
  }

  // ── write: close a table order ──────────────────────────────────────────
  private closeTableOrder(): ToolDefinition {
    return {
      name: 'close_table_order',
      description:
        'Close an open table order and deduct stock (recipe ingredients for composite dishes, item stock otherwise). Requires approval. Refuses when stock is short.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: RESTAURANT,
      parameters: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
        required: ['orderId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const order = await this.findOrder(
          ctx.organizationId,
          asString(args.orderId, 'orderId', 100),
        );
        if (order.status !== 'OPEN') {
          throw new BadRequestException('Order is not OPEN.');
        }
        const plan = this.planDeductions(
          order.items.map((line) => ({
            quantity: line.quantity,
            item: line.item,
          })),
        );
        return {
          args: { orderId: order.id },
          summary: `Close table ${order.tableLabel} \u2014 ${plan.lines} stock line${
            plan.lines === 1 ? '' : 's'
          } deducted`,
          diff: plan.diff,
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.tableOrders.closeOrder(
          asString(args.orderId, 'orderId', 100),
          ctx.organizationId,
        );
      },
    };
  }

  // ── write: recipe consumption (walk-up dish sale) ───────────────────────
  private recordRecipeConsumption(): ToolDefinition {
    return {
      name: 'record_recipe_consumption',
      description:
        'Sell a composite dish and deduct its recipe ingredients (for takeaway/walk-up, not a table). Requires approval. Use get_menu_item_recipe to see the ingredients.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: RESTAURANT,
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          quantity: { type: 'number' },
          note: { type: 'string' },
        },
        required: ['itemId', 'quantity'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const item = (await this.findItem(
          ctx.organizationId,
          asString(args.itemId, 'itemId', 100),
        )) as {
          id: string;
          name: string;
          isComposite: boolean;
          recipeLines?: RecipeLine[];
        };
        if (!item.isComposite) {
          throw new BadRequestException(
            'This is not a composite dish; record a plain sale with record_sale.',
          );
        }
        const quantity = asPositiveNumber(args.quantity, 'quantity');
        const plan = this.planDeductions([
          {
            quantity,
            item: {
              name: item.name,
              unit: 'plate',
              quantity: 0,
              isComposite: true,
              recipeLines: item.recipeLines ?? [],
            },
          },
        ]);
        return {
          args: {
            itemId: item.id,
            quantity,
            note: asOptionalString(args.note, 'note', 300),
          },
          summary: `Sell ${quantity} x ${item.name} \u2014 ${plan.lines} ingredient${
            plan.lines === 1 ? '' : 's'
          } deducted`,
          diff: plan.diff,
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.transactions.create(
          {
            itemId: asString(args.itemId, 'itemId', 100),
            type: TransactionTypeDto.SALE,
            quantity: asPositiveNumber(args.quantity, 'quantity'),
            note: asOptionalString(args.note, 'note', 300),
          },
          ctx.organizationId,
          {
            actorId: ctx.userId,
            actorName: 'Assistant (user-approved)',
            actorRole: ctx.role,
          },
        );
      },
    };
  }

  // ── write: menu price ───────────────────────────────────────────────────
  private updateMenuPrice(): ToolDefinition {
    return {
      name: 'update_menu_price',
      description:
        'Change an item\u2019s menu selling price. Requires approval. Use list_menu_items for the item ID.',
      kind: 'write',
      riskLevel: 'medium',
      roles: MANAGER_ROLES,
      verticals: RESTAURANT,
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          sellingPrice: { type: 'number' },
        },
        required: ['itemId', 'sellingPrice'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const item = await this.findItem(
          ctx.organizationId,
          asString(args.itemId, 'itemId', 100),
        );
        const sellingPrice = asOptionalNonNegative(
          args.sellingPrice,
          'sellingPrice',
        );
        if (sellingPrice === undefined) {
          throw new BadRequestException('"sellingPrice" is required.');
        }
        return {
          args: { itemId: item.id, sellingPrice },
          summary: `Set the price of ${item.name} to ${kes(sellingPrice)}`,
          diff: {
            sellingPrice: {
              before: item.sellingPrice == null ? 0 : Number(item.sellingPrice),
              after: sellingPrice,
            },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        const sellingPrice = asOptionalNonNegative(
          args.sellingPrice,
          'sellingPrice',
        );
        if (sellingPrice === undefined) {
          throw new BadRequestException('"sellingPrice" is required.');
        }
        return this.inventory.updateVariant(
          asString(args.itemId, 'itemId', 100),
          { sellingPrice },
          ctx.organizationId,
        );
      },
    };
  }
}
