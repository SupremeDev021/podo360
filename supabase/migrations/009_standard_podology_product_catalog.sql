-- Catálogo inicial por empresa. A comparação normalizada evita duplicar itens já cadastrados.
insert into public.stock_products (company_id, name, category, internal_code, unit, active)
select
  companies.id,
  catalog.name,
  catalog.category,
  'CAT-' || lpad(catalog.position::text, 3, '0'),
  'un',
  true
from public.companies
cross join (
  values
    (1, 'Materiais de Curativos e Coberturas', 'Gaze Hidrófila Estéril (13 ou 11 fios)'),
    (2, 'Materiais de Curativos e Coberturas', 'Algodão Hidrófilo (Rolo ou Quadrado)'),
    (3, 'Materiais de Curativos e Coberturas', 'Fita Microporosa (Micropore)'),
    (4, 'Materiais de Curativos e Coberturas', 'Atadura de Crepom (Largas e Estreitas)'),
    (5, 'Materiais de Curativos e Coberturas', 'Hidrogel com Alginato de Cálcio / Amorfo'),
    (6, 'Materiais de Curativos e Coberturas', 'Alginato de Cálcio (Placa ou Mecha)'),
    (7, 'Materiais de Curativos e Coberturas', 'Cobertura Antimicrobiana com Prata (Dressing)'),
    (8, 'Materiais de Curativos e Coberturas', 'Órteses Ungueais (Fio Acrílico / Fibra de Memória Molecular)'),
    (9, 'Materiais de Consumo e Procedimentos', 'Lâmina de Bisturi nº 15 / 15C'),
    (10, 'Materiais de Consumo e Procedimentos', 'Lâmina de Bisturi nº 20 / 22 / 24'),
    (11, 'Materiais de Consumo e Procedimentos', 'Brocas de Tungstênio / Diamantadas (PM)'),
    (12, 'Materiais de Consumo e Procedimentos', 'Lixas Descartáveis / Mandril'),
    (13, 'Materiais de Consumo e Procedimentos', 'Fita Crepe Hospitalar / Fita Autofixável'),
    (14, 'Materiais de Consumo e Procedimentos', 'Equipamentos de Proteção Individual (EPIs)'),
    (15, 'Materiais de Consumo e Procedimentos', 'Antissépticos (Clorexidina Degermante e Alcoólica 2%)'),
    (16, 'Materiais de Consumo e Procedimentos', 'Emolientes Ungueais / Soluções Tensoativas'),
    (17, 'Instrumentais (Permanentes)', 'Alicate de Corte Frontal (Corte de Unhas)'),
    (18, 'Instrumentais (Permanentes)', 'Alicate de Cutícula / Ponta Fina'),
    (19, 'Instrumentais (Permanentes)', 'Cinzeis Podológicos (Nº 206, 214, etc.)'),
    (20, 'Instrumentais (Permanentes)', 'Goivas Podológicas (Nº 204, etc.)'),
    (21, 'Instrumentais (Permanentes)', 'Pinça Podológica (Anatômica / Splinter)'),
    (22, 'Instrumentais (Permanentes)', 'Cabo de Bisturi nº 3 / nº 4'),
    (23, 'Instrumentais (Permanentes)', 'Espátulas Podológicas (Nº 222, etc.)'),
    (24, 'Instrumentais (Permanentes)', 'Nucleadores Podológicos'),
    (25, 'Produtos e Materiais para Esterilização', 'Detergente Enzimático (mínimo 4 enzimas)'),
    (26, 'Produtos e Materiais para Esterilização', 'Lavadora Ultrassônica (Cuba Ultrassônica)'),
    (27, 'Produtos e Materiais para Esterilização', 'Envelopes de Grau Cirúrgico (Vários tamanhos)'),
    (28, 'Produtos e Materiais para Esterilização', 'Indicadores Químicos (Classe 4, 5 ou 6)'),
    (29, 'Produtos e Materiais para Esterilização', 'Indicadores Biológicos (Geobacillus stearothermophilus)'),
    (30, 'Equipamentos e Controle de Biossegurança', 'Autoclave Hospitalar / Consultório (Classe B ou S)'),
    (31, 'Equipamentos e Controle de Biossegurança', 'Seladora Térmica'),
    (32, 'Equipamentos e Controle de Biossegurança', 'Incubadora para Teste Biológico')
) as catalog(position, category, name)
where not exists (
  select 1
  from public.stock_products existing
  where existing.company_id = companies.id
    and lower(trim(existing.name)) = lower(trim(catalog.name))
);
