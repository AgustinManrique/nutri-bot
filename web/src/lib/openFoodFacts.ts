// Busca un producto por código de barras en Open Food Facts (base abierta, sin API key).

export interface ProductoEscaneado {
  codigo: string;
  nombre: string;
  marca: string | null;
  imagen: string | null;
  kcal_100: number;
  proteina_100: number;
  carbos_100: number;
  grasas_100: number;
  porcion_nombre: string | null;
  porcion_g: number | null;
  esSuplemento: boolean;
  /** true si OFF no trae los macros completos */
  incompleto: boolean;
}

const n = (v: unknown) => (typeof v === 'number' ? v : Number(v)) || 0;

export async function buscarEnOpenFoodFacts(codigo: string): Promise<ProductoEscaneado | null> {
  const campos = 'product_name,product_name_es,brands,image_front_small_url,nutriments,serving_size,serving_quantity,categories_tags';
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json?fields=${campos}`);
  if (!r.ok) return null;
  const j = await r.json();
  if (j.status !== 1 || !j.product) return null;

  const p = j.product;
  const nu = p.nutriments ?? {};
  const kcal = nu['energy-kcal_100g'] ?? (nu['energy_100g'] ? nu['energy_100g'] / 4.184 : undefined);
  const cats: string[] = p.categories_tags ?? [];

  return {
    codigo,
    nombre: (p.product_name_es || p.product_name || 'Producto sin nombre').trim(),
    marca: p.brands?.split(',')[0]?.trim() || null,
    imagen: p.image_front_small_url ?? null,
    kcal_100: Math.round(n(kcal)),
    proteina_100: n(nu.proteins_100g),
    carbos_100: n(nu.carbohydrates_100g),
    grasas_100: n(nu.fat_100g),
    porcion_nombre: p.serving_size ?? null,
    porcion_g: p.serving_quantity ? n(p.serving_quantity) : null,
    esSuplemento: cats.some((c) => /protein-powder|dietary-supplement|sports-nutrition|whey|creatine/.test(c)),
    incompleto: kcal == null || nu.proteins_100g == null,
  };
}
