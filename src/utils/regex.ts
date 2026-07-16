export const WAREHOUSE_CODE_REGEX = /^[A-Z][0-9]-[A-Z][0-9]{2}-[0-9]{3}-[0-9]{2}-[A-Z]$/;

export const validateWarehouseCode = (code: string): boolean => {
  return WAREHOUSE_CODE_REGEX.test(code.trim().toUpperCase());
};
