import type { Actividad, Objetivo, Sexo } from '../../../lib/nutricion';
import type { ProductoEscaneado } from './openFoodFacts';

export type Momento = 'desayuno' | 'almuerzo' | 'merienda' | 'cena' | 'snack' | 'pre_entreno' | 'post_entreno';

export interface Comida {
  id: number;
  momento: Momento | null;
  descripcion: string | null;
  gramos: number | null;
  kcal: number;
  proteina: number;
  carbos: number;
  grasas: number;
  creado: string;
}

export interface Entreno {
  id: number;
  tipo: string;
  descripcion: string | null;
  duracion_min: number | null;
  intensidad: 'baja' | 'media' | 'alta' | null;
  kcal_estimadas: number | null;
}

export interface Perfil {
  chat_id: number;
  nombre: string | null;
  sexo: Sexo | null;
  edad: number | null;
  peso_kg: number | null;
  altura_cm: number | null;
  actividad: Actividad | null;
  objetivo: Objetivo | null;
  kcal_meta: number | null;
  proteina_meta: number | null;
  carbos_meta: number | null;
  grasas_meta: number | null;
}

export interface Dia {
  fecha: string;
  comidas: Comida[];
  entrenos: Entreno[];
}

export interface DiaResumen {
  fecha: string;
  registrado: boolean;
  kcal: number;
  proteina: number;
  carbos: number;
  grasas: number;
  entrenos: number;
}

export interface ItemDespensa {
  id: number;
  nombre: string;
  cantidad: string | null;
  tipo: 'alimento' | 'suplemento';
  alimento: {
    porcion_nombre: string | null;
    porcion_g: number | null;
    kcal_100: number;
    proteina_100: number;
    carbos_100: number;
    grasas_100: number;
  } | null;
}

export type Tabla = 'comidas' | 'entrenamientos' | 'despensa' | 'usuarios';

export interface Api {
  modo: 'demo' | 'real';
  perfil(): Promise<Perfil | null>;
  guardarPerfil(cambios: Partial<Perfil>): Promise<Perfil>;
  dia(fecha: string): Promise<Dia>;
  semana(hasta: string): Promise<DiaResumen[]>;
  borrarComida(id: number): Promise<void>;
  borrarEntreno(id: number): Promise<void>;
  despensa(): Promise<ItemDespensa[]>;
  agregarDespensa(item: { nombre: string; cantidad?: string; tipo: 'alimento' | 'suplemento' }): Promise<void>;
  quitarDespensa(id: number): Promise<void>;
  /** Busca un código de barras: primero en tu base, después en Open Food Facts */
  productoPorCodigo(codigo: string): Promise<ProductoEscaneado | null>;
  agregarProducto(p: ProductoEscaneado, opciones: { cantidad?: string; tipo: 'alimento' | 'suplemento' }): Promise<void>;
  /** Avisa cuando algo cambia (ej: cargaste una comida por Telegram). Devuelve unsubscribe. */
  escuchar(cb: (tabla: Tabla) => void): () => void;
}
