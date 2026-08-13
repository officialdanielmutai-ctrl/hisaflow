import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto, UpdateVariantDto } from './dto/update-product.dto';
import { StockStatus, CatalogSource } from '../../../generated/prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.db.product.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        variants: {
          where: { isActive: true },
          include: {
            packaging: true,
          },
        },
      },
    });
  }

  private parseExpiryDate(raw: string | undefined): Date | undefined {
    if (!raw) return undefined;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  async findByBarcode(barcode: string, organizationId: string) {
    const item = await this.prisma.db.inventoryItem.findFirst({
      where: {
        organizationId,
        barcode,
        isActive: true,
      },
      include: {
        product: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Item with this barcode not found');
    }

    return item;
  }

  /**
   * Looks up a barcode this org hasn't seen before, in priority order:
   *   1. Our own cross-org catalog (fast, free, improves over time as any
   *      org creates products with barcodes - see upsertCatalogEntry).
   *   2. Open Food Facts (free, no key, food-focused, partial coverage).
   * Never throws - any miss at any stage resolves to null, so the caller
   * can always fall back to manual entry.
   */
  async lookupExternalProduct(barcode: string): Promise<{
    name: string | null;
    brand: string | null;
    category: string | null;
    unit: string | null;
    imageUrl: string | null;
    source: 'CATALOG' | 'OPEN_FOOD_FACTS' | 'UPC_ITEM_DB';
  } | null> {
    const catalogEntry = await this.prisma.db.productCatalogEntry.findUnique({
      where: { barcode },
    });

    if (catalogEntry) {
      // Fire-and-forget: another org's scan corroborates this entry.
      this.prisma.db.productCatalogEntry
        .update({
          where: { barcode },
          data: { confirmations: { increment: 1 } },
        })
        .catch((error) => console.error('Catalog confirmation bump failed:', error));

      return {
        name: catalogEntry.name,
        brand: catalogEntry.brand,
        category: catalogEntry.category,
        unit: catalogEntry.unit,
        imageUrl: catalogEntry.imageUrl,
        source: 'CATALOG',
      };
    }

    const offResult = await this.lookupOpenFoodFacts(barcode);
    if (offResult) {
      // First hit for this barcode anywhere in HisaFlow - seed the catalog
      // so the next org (or this one, on a different item) skips the
      // external call entirely.
      await this.upsertCatalogEntry(barcode, {
        name: offResult.name!,
        brand: offResult.brand,
        category: offResult.category,
        unit: null,
        imageUrl: offResult.imageUrl,
        source: CatalogSource.OPEN_FOOD_FACTS,
      }).catch((error) => console.error('Catalog seed from Open Food Facts failed:', error));

      return { ...offResult, unit: null, source: 'OPEN_FOOD_FACTS' };
    }

    const upcResult = await this.lookupUPCitemdb(barcode);
    if (!upcResult) return null;

    await this.upsertCatalogEntry(barcode, {
      name: upcResult.name!,
      brand: upcResult.brand,
      category: upcResult.category,
      unit: null,
      imageUrl: upcResult.imageUrl,
      source: CatalogSource.UPC_ITEM_DB,
    }).catch((error) => console.error('Catalog seed from UPCitemdb failed:', error));

    return { ...upcResult, unit: null, source: 'UPC_ITEM_DB' };
  }

  private async lookupOpenFoodFacts(barcode: string): Promise<{
    name: string | null;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
  } | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,categories,image_front_url`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      if (!response.ok) return null;

      const data = await response.json();
      if (data.status !== 1 || !data.product) return null;

      const product = data.product;
      const name: string | null = product.product_name || null;
      if (!name) return null;

      return {
        name,
        brand: product.brands ? product.brands.split(',')[0].trim() : null,
        category: product.categories ? product.categories.split(',')[0].trim() : null,
        imageUrl: product.image_front_url || null,
      };
    } catch (error) {
      console.error('Open Food Facts lookup failed:', error);
      return null;
    }
  }

  private async lookupUPCitemdb(barcode: string): Promise<{
    name: string | null;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
  } | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      if (!response.ok) return null;

      const data = await response.json();
      if (data.code !== 'OK' || !data.items || data.items.length === 0) return null;

      const item = data.items[0];
      const name: string | null = item.title || null;
      if (!name) return null;

      return {
        name,
        brand: item.brand || null,
        category: item.category || null,
        imageUrl: (item.images && item.images.length > 0) ? item.images[0] : null,
      };
    } catch (error) {
      console.error('UPCitemdb lookup failed:', error);
      return null;
    }
  }

  /**
   * Records or corroborates a barcode -> product mapping in the shared
   * catalog. Called both when Open Food Facts resolves a barcode (see
   * above) and whenever this org creates a product with a barcode (see
   * create() below) - the latter is how manually-entered and OCR-derived
   * details end up helping every other org on a future scan. A human
   * (MANUAL/OCR) contribution overwrites an existing entry's details,
   * since it's more trustworthy than an unconfirmed external-API guess;
   * an OPEN_FOOD_FACTS contribution never overwrites an existing entry.
   */
  async upsertCatalogEntry(
    barcode: string,
    data: {
      name: string;
      brand?: string | null;
      category?: string | null;
      unit?: string | null;
      imageUrl?: string | null;
      source: CatalogSource;
    },
  ) {
    const existing = await this.prisma.db.productCatalogEntry.findUnique({ where: { barcode } });

    if (!existing) {
      return this.prisma.db.productCatalogEntry.create({
        data: {
          barcode,
          name: data.name,
          brand: data.brand ?? null,
          category: data.category ?? null,
          unit: data.unit ?? null,
          imageUrl: data.imageUrl ?? null,
          source: data.source,
        },
      });
    }

    if (data.source === CatalogSource.OPEN_FOOD_FACTS || data.source === CatalogSource.UPC_ITEM_DB) {
      return this.prisma.db.productCatalogEntry.update({
        where: { barcode },
        data: { confirmations: { increment: 1 } },
      });
    }

    return this.prisma.db.productCatalogEntry.update({
      where: { barcode },
      data: {
        name: data.name,
        brand: data.brand ?? existing.brand,
        category: data.category ?? existing.category,
        unit: data.unit ?? existing.unit,
        source: data.source,
        confirmations: { increment: 1 },
      },
    });
  }

  async create(dto: CreateProductDto, organizationId: string) {
    let variantsData: any[] = [];
    if (dto.variants && dto.variants.length > 0) {
      variantsData = dto.variants;
    } else {
      variantsData = [{
        name: 'Default',
        unit: dto.unit || 'units',
        quantity: dto.quantity || 0,
        reorderThreshold: dto.reorderThreshold || 0,
        costPrice: dto.costPrice,
        sellingPrice: dto.sellingPrice,
      }];
    }

    const product = await this.prisma.db.product.create({
      data: {
        organizationId,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        variants: {
          create: variantsData.map((v) => ({
            organization: { connect: { id: organizationId } },
            name: v.name,
            unit: v.unit,
            measureValue: v.measureValue,
            measureUnit: v.measureUnit,
            quantity: v.quantity || 0,
            costPrice: v.costPrice,
            sellingPrice: v.sellingPrice,
            reorderThreshold: v.reorderThreshold || 0,
            status:
              (v.quantity || 0) > (v.reorderThreshold || 0)
                ? StockStatus.HEALTHY
                : (v.quantity || 0) > 0
                ? StockStatus.LOW
                : StockStatus.OUT_OF_STOCK,
            barcode: v.barcode,
            expiryDate: this.parseExpiryDate(v.expiryDate),
            batchNumber: v.batchNumber,
            packaging: {
              create:
                v.packaging?.map((p: any) => ({
                  name: p.name,
                  quantityPerUnit: p.quantityPerUnit,
                  barcode: p.barcode,
                  costPrice: p.costPrice,
                  sellingPrice: p.sellingPrice,
                })) || [],
            },
          })),
        },
      },
      include: { variants: { include: { packaging: true } } },
    });

    // Contribute barcode->product mappings to the shared catalog so other
    // orgs (or this org, on a different item) get an instant match later.
    // Fire-and-forget: never let a catalog write fail the actual create.
    for (const v of variantsData) {
      if (!v.barcode || !v.name) continue;
      this.upsertCatalogEntry(v.barcode, {
        name: v.name,
        category: dto.category ?? null,
        unit: v.unit ?? null,
        source: v.catalogSource === 'OCR' ? CatalogSource.OCR : CatalogSource.MANUAL,
      }).catch((error) => console.error('Catalog contribution failed:', error));
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto, organizationId: string) {
    const product = await this.prisma.db.product.findFirst({
      where: { id, organizationId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.db.product.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        description: (dto as any).description,
      },
      include: { variants: { include: { packaging: true } } },
    });
  }

  async updateVariant(
    variantId: string,
    dto: UpdateVariantDto,
    organizationId: string,
  ) {
    const variant = await this.prisma.db.inventoryItem.findFirst({
      where: { id: variantId, organizationId },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    const newQty = dto.quantity !== undefined ? dto.quantity : Number(variant.quantity);
    const newThreshold =
      dto.reorderThreshold !== undefined ? dto.reorderThreshold : Number(variant.reorderThreshold);
    const status: StockStatus =
      newQty > newThreshold ? StockStatus.HEALTHY : newQty > 0 ? StockStatus.LOW : StockStatus.OUT_OF_STOCK;

    return this.prisma.db.inventoryItem.update({
      where: { id: variantId },
      data: {
        name: dto.name,
        unit: dto.unit,
        measureValue: dto.measureValue,
        measureUnit: dto.measureUnit,
        quantity: dto.quantity,
        reorderThreshold: dto.reorderThreshold,
        costPrice: dto.costPrice,
        sellingPrice: dto.sellingPrice,
        barcode: dto.barcode,
        status,
        ...(dto.packaging && {
          packaging: {
            deleteMany: {},
            create: dto.packaging,
          },
        }),
      },
      include: { packaging: true },
    });
  }

  async deleteVariant(variantId: string, organizationId: string) {
    const variant = await this.prisma.db.inventoryItem.findFirst({
      where: { id: variantId, organizationId },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return this.prisma.db.inventoryItem.update({
      where: { id: variantId },
      data: { isActive: false },
    });
  }
}
