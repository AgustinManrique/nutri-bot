-- =====================================================================
-- Seed: alimentos típicos + suplementos (valores aproximados c/100 g)
-- Son referencias orientativas: corregilas con las etiquetas de lo que
-- comprás vos. El bot agrega solo los que no encuentre (fuente=estimado_ia).
-- =====================================================================

insert into alimentos (nombre, alias, categoria, kcal_100, proteina_100, carbos_100, grasas_100, porcion_nombre, porcion_g)
select nombre, alias::text[], categoria, kcal_100, proteina_100, carbos_100, grasas_100, porcion_nombre, porcion_g from (values
-- Proteínas
('Pechuga de pollo cocida',      '{pollo,pechuga}',              'alimento', 165, 31,   0,    3.6, '1 pechuga', 170),
('Milanesa de carne al horno',   '{milanesa,milanga}',           'alimento', 220, 22,   13,   9,   '1 milanesa', 130),
('Milanesa de carne frita',      '{milanesa frita}',             'alimento', 280, 20,   14,   16,  '1 milanesa', 130),
('Carne picada común cocida',    '{carne picada,picada}',        'alimento', 250, 26,   0,    15,  '1 porción', 150),
('Asado de tira cocido',         '{asado,tira de asado}',        'alimento', 300, 23,   0,    23,  '1 porción', 250),
('Huevo entero',                 '{huevo,huevos}',               'alimento', 143, 12.6, 0.7,  9.5, '1 unidad', 50),
('Atún al natural',              '{atun,lata de atun}',          'alimento', 116, 26,   0,    1,   '1 lata escurrida', 120),
('Queso cremoso',                '{queso,cremoso}',              'alimento', 300, 20,   2,    24,  '1 feta gruesa', 30),
('Yogur entero',                 '{yogur,yogurt}',               'alimento', 61,  3.5,  4.7,  3.3, '1 pote', 190),
-- Carbohidratos
('Arroz blanco cocido',          '{arroz}',                      'alimento', 130, 2.7,  28,   0.3, '1 taza', 160),
('Fideos cocidos',               '{fideos,pasta,tallarines}',    'alimento', 158, 5.8,  31,   0.9, '1 plato', 220),
('Papa hervida',                 '{papa,papas}',                 'alimento', 87,  1.9,  20,   0.1, '1 papa mediana', 170),
('Batata hervida',               '{batata}',                     'alimento', 76,  1.4,  18,   0.1, '1 batata mediana', 150),
('Avena',                        '{avena,copos de avena}',       'alimento', 389, 17,   66,   7,   '1/2 taza', 40),
('Pan francés',                  '{pan,flauta,mignon}',          'alimento', 280, 9,    56,   1.5, '1 mignon', 50),
('Lentejas cocidas',             '{lentejas}',                   'alimento', 116, 9,    20,   0.4, '1 taza', 200),
-- Comidas armadas
('Empanada de carne al horno',   '{empanada,empanadas}',         'alimento', 270, 11,   28,   13,  '1 unidad', 90),
('Pizza de muzzarella',          '{pizza,muzza}',                'alimento', 270, 11,   32,   10,  '1 porción', 120),
('Medialuna de manteca',         '{medialuna,medialunas,factura}','alimento', 410, 8,    45,   22,  '1 unidad', 40),
-- Frutas / verduras / grasas
('Banana',                       '{banana}',                     'alimento', 89,  1.1,  23,   0.3, '1 unidad', 120),
('Manzana',                      '{manzana}',                    'alimento', 52,  0.3,  14,   0.2, '1 unidad', 180),
('Tomate',                       '{tomate}',                     'alimento', 18,  0.9,  3.9,  0.2, '1 unidad', 120),
('Palta',                        '{palta,aguacate}',             'alimento', 160, 2,    8.5,  14.7,'1/2 palta', 80),
('Aceite de oliva',              '{aceite}',                     'alimento', 884, 0,    0,    100, '1 cucharada', 13),
('Dulce de leche',               '{ddl}',                        'alimento', 315, 7,    55,   7.5, '1 cucharada', 20),
('Mantequilla de maní',          '{mani,pasta de mani}',         'alimento', 588, 25,   20,   50,  '1 cucharada', 16),
-- Bebidas (c/100 ml)
('Leche entera',                 '{leche}',                      'bebida',   61,  3.2,  4.8,  3.3, '1 vaso', 250),
('Leche descremada',             '{leche descremada}',           'bebida',   35,  3.4,  5,    0.1, '1 vaso', 250),
('Coca-Cola común',              '{coca,gaseosa}',               'bebida',   42,  0,    10.6, 0,   '1 vaso', 250),
('Coca-Cola Zero',               '{coca zero,gaseosa zero}',     'bebida',   0,   0,    0,    0,   '1 vaso', 250),
('Mate sin azúcar',              '{mate,mates}',                 'bebida',   2,   0,    0.3,  0,   '1 termo', 500),
-- Suplementos
('Whey protein',                 '{whey,proteina en polvo,suero}','suplemento', 400, 78, 8,   6,   '1 scoop', 30),
('Caseína',                      '{caseina}',                    'suplemento', 370, 80,  6,   2,   '1 scoop', 30),
('Creatina monohidrato',         '{creatina}',                   'suplemento', 0,   0,   0,   0,   '1 dosis', 5),
('Ganador de peso',              '{gainer,ganador}',             'suplemento', 380, 15,  75,  3,   '1 servicio', 100),
('Barrita proteica',             '{barrita,barra proteica}',     'suplemento', 350, 30,  40,  9,   '1 barrita', 50)
) as v(nombre, alias, categoria, kcal_100, proteina_100, carbos_100, grasas_100, porcion_nombre, porcion_g)
where not exists (select 1 from alimentos where fuente = 'manual');  -- no duplica si se corre de nuevo
