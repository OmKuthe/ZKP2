// zkattend-mobile/app/utils/convertBigInts.ts

/**
 * Convert string representations of BigInts back to BigInt
 */
export function convertStringsToBigInts(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  // Check if it's a string that looks like a BigInt
  if (typeof obj === 'string' && /^[0-9]+$/.test(obj) && obj.length > 15) {
    try {
      return BigInt(obj);
    } catch {
      return obj;
    }
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertStringsToBigInts);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = convertStringsToBigInts(obj[key]);
    }
    return result;
  }
  
  return obj;
}

/**
 * Convert BigInts to strings for serialization
 */
export function convertBigIntsToStrings(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(convertBigIntsToStrings);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = convertBigIntsToStrings(obj[key]);
    }
    return result;
  }
  return obj;
}