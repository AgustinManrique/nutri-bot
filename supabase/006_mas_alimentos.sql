-- Más alimentos comunes (valores aproximados c/100 g). No duplica si ya existen.
insert into alimentos (nombre, alias, categoria, kcal_100, proteina_100, carbos_100, grasas_100, porcion_nombre, porcion_g)
select v.nombre, v.alias::text[], v.categoria, v.kcal_100, v.proteina_100, v.carbos_100, v.grasas_100, v.porcion_nombre, v.porcion_g from (values
('Pata muslo de pollo al horno (sin piel)','{patamuslo,pata muslo,muslo de pollo}','alimento',190,25,0,10,'1 pata muslo',180),
('Pata muslo de pollo al horno (con piel)','{patamuslo con piel}','alimento',230,23,0,15,'1 pata muslo',180),
('Lechuga','{lechuga,ensalada verde}','alimento',15,1.4,2.9,0.2,'1 plato',80),
('Repollo','{repollo,col}','alimento',25,1.3,5.8,0.1,'1 taza',90),
('Zanahoria','{zanahoria}','alimento',41,0.9,10,0.2,'1 unidad',80),
('Cebolla','{cebolla}','alimento',40,1.1,9.3,0.1,'1/2 unidad',60),
('Zapallo / calabaza cocido','{zapallo,calabaza,anco}','alimento',35,1,8,0.1,'1 porción',150),
('Brócoli cocido','{brocoli}','alimento',35,2.4,7,0.4,'1 taza',150),
('Zapallito cocido','{zapallito,zucchini}','alimento',17,1.2,3.1,0.3,'1 unidad',150),
('Helado de crema (dulce de leche/chocolate)','{helado,helado de crema}','alimento',220,4,26,11,'1/4 kg',250),
('Yogur bebible proteico','{yogur proteico,yogurisimo proteina,ser pro}','alimento',75,5,8,1.2,'1 botella',200),
('Bife de carne vacuna cocido','{bife,churrasco,carne}','alimento',220,28,0,12,'1 bife',180),
('Pollo a la plancha','{pollo plancha}','alimento',165,31,0,3.6,'1 porción',150),
('Tostada de pan lactal','{tostada,pan lactal}','alimento',265,9,49,3.5,'1 rebanada',25),
('Galletitas de agua','{galletitas,criollitas}','alimento',430,10,70,12,'3 unidades',25),
('Café con leche','{cafe con leche}','bebida',40,2,3.5,1.8,'1 taza',250),
('Naranja','{naranja}','alimento',47,0.9,12,0.1,'1 unidad',150),
('Ñoquis','{noquis,ñoquis}','alimento',150,3.5,32,0.5,'1 plato',250),
('Ravioles de verdura/ricota','{ravioles,sorrentinos}','alimento',200,8,30,5,'1 plato',250),
('Salchicha (pancho)','{pancho,salchicha}','alimento',290,11,3,26,'1 unidad',50)
) as v(nombre, alias, categoria, kcal_100, proteina_100, carbos_100, grasas_100, porcion_nombre, porcion_g)
where not exists (select 1 from alimentos a where a.nombre = v.nombre);
