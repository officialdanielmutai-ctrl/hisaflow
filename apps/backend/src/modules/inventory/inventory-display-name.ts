export function inventoryDisplayName(item: {
  name?: string | null;
  product?: { name?: string | null } | null;
}): string {
  const variantName = item.name?.trim() || 'Unknown item';
  const productName = item.product?.name?.trim();
  if (!productName) {
    return variantName.toLowerCase() === 'default'
      ? 'Unlabelled inventory item'
      : variantName;
  }
  if (
    variantName.toLowerCase() === 'default' ||
    variantName.toLowerCase() === productName.toLowerCase()
  ) {
    return productName;
  }
  return `${productName} (${variantName})`;
}
