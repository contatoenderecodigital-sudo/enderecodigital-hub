-- ============================================================================
-- seed-food-demo.sql — loja de demonstração para testar o AppFood ponta a ponta.
-- Roda DEPOIS de migration_0003_food.sql.
--
-- Usa o primeiro negócio ativo do banco. Para escolher outro, troque a linha
-- do SELECT em `neg` pelo id que você quiser.
--
-- Ao final imprime as URLs de teste (mesa, cozinha e impressora).
-- ============================================================================
DO $$
DECLARE
  neg   UUID;
  loja  UUID;
  cozinha UUID; bar UUID;
  cat_entrada UUID; cat_prato UUID; cat_bebida UUID;
  p UUID; g UUID;
BEGIN
  SELECT id INTO neg FROM negocios WHERE ativo = true ORDER BY criado_em LIMIT 1;
  IF neg IS NULL THEN RAISE EXCEPTION 'Nenhum negócio cadastrado'; END IF;

  -- liga o módulo para este cliente
  UPDATE negocios SET mod_food = true WHERE id = neg;

  -- loja
  INSERT INTO food_lojas (negocio_id, slug, nome, tipo, cidade, uf, cor_destaque,
                          taxa_servico_pct, taxa_servico_automatica, pagar_no_app, whatsapp)
  VALUES (neg, 'demo-boteco', 'Boteco Demonstração', 'bar', 'Xanxerê', 'SC', '#b45309',
          10, true, false, '5549999999999')
  ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO loja;

  -- áreas de produção
  INSERT INTO food_areas (negocio_id, loja_id, nome, ordem) VALUES (neg, loja, 'Cozinha', 0)
    RETURNING id INTO cozinha;
  INSERT INTO food_areas (negocio_id, loja_id, nome, ordem) VALUES (neg, loja, 'Bar', 1)
    RETURNING id INTO bar;

  -- cardápio
  INSERT INTO food_categorias (negocio_id, loja_id, nome, ordem) VALUES (neg, loja, 'Para começar', 0)
    RETURNING id INTO cat_entrada;
  INSERT INTO food_categorias (negocio_id, loja_id, nome, ordem) VALUES (neg, loja, 'Pratos', 1)
    RETURNING id INTO cat_prato;
  INSERT INTO food_categorias (negocio_id, loja_id, nome, ordem) VALUES (neg, loja, 'Bebidas', 2)
    RETURNING id INTO cat_bebida;

  INSERT INTO food_produtos (negocio_id, loja_id, categoria_id, area_id, nome, descricao, preco, ordem)
  VALUES (neg, loja, cat_entrada, cozinha, 'Porção de polenta', 'Polenta frita com queijo ralado', 38.00, 0),
         (neg, loja, cat_entrada, cozinha, 'Bolinho de costela', '8 unidades', 46.00, 1);

  INSERT INTO food_produtos (negocio_id, loja_id, categoria_id, area_id, nome, descricao, preco, ordem)
  VALUES (neg, loja, cat_prato, cozinha, 'Costela no bafo', 'Acompanha mandioca e vinagrete', 89.00, 0)
  RETURNING id INTO p;

  INSERT INTO food_grupos_opcao (negocio_id, produto_id, nome, minimo, maximo, obrigatorio, ordem)
  VALUES (neg, p, 'Acompanhamento', 1, 1, true, 0) RETURNING id INTO g;
  INSERT INTO food_opcoes (negocio_id, grupo_id, nome, preco_extra, ordem)
  VALUES (neg, g, 'Mandioca frita', 0, 0), (neg, g, 'Arroz carreteiro', 6.00, 1);

  INSERT INTO food_produtos (negocio_id, loja_id, categoria_id, area_id, nome, preco, tem_variacao, ordem)
  VALUES (neg, loja, cat_bebida, bar, 'Chope pilsen', 0, true, 0) RETURNING id INTO p;
  INSERT INTO food_variacoes (negocio_id, produto_id, nome, preco, ordem)
  VALUES (neg, p, '300ml', 12.00, 0), (neg, p, '500ml', 18.00, 1);

  INSERT INTO food_produtos (negocio_id, loja_id, categoria_id, area_id, nome, preco, ordem)
  VALUES (neg, loja, cat_bebida, bar, 'Refrigerante lata', 8.00, 1);

  -- mesas 1 a 10 (tokens aleatórios)
  INSERT INTO food_mesas (negocio_id, loja_id, numero, token, ordem)
  SELECT neg, loja, i::text, translate(encode(gen_random_bytes(9),'base64'),'+/=','-_'), i
    FROM generate_series(1, 10) AS i
  ON CONFLICT (loja_id, numero) DO NOTHING;

  -- tablet da cozinha e impressora de teste
  INSERT INTO food_dispositivos (negocio_id, loja_id, nome, tipo, area_id, token)
  VALUES (neg, loja, 'Tablet da cozinha', 'kds', cozinha, translate(encode(gen_random_bytes(9),'base64'),'+/=','-_')),
         (neg, loja, 'Tablet do bar', 'kds', bar, translate(encode(gen_random_bytes(9),'base64'),'+/=','-_'));

  INSERT INTO food_impressoras (negocio_id, loja_id, area_id, nome, tipo, chave, colunas)
  VALUES (neg, loja, cozinha, 'Impressora da cozinha', 'cloudprnt', translate(encode(gen_random_bytes(12),'base64'),'+/=','-_'), 48);

  RAISE NOTICE 'Loja demo criada para o negócio %', neg;
END $$;

-- URLs para testar (copie e abra):
SELECT 'MESA ' || m.numero AS o_que, '/c/' || l.slug || '/m/' || m.token AS url
  FROM food_mesas m JOIN food_lojas l ON l.id = m.loja_id
 WHERE l.slug = 'demo-boteco'
UNION ALL
SELECT 'COZINHA ' || d.nome, '/k/' || d.token
  FROM food_dispositivos d JOIN food_lojas l ON l.id = d.loja_id
 WHERE l.slug = 'demo-boteco'
UNION ALL
SELECT 'IMPRESSORA ' || i.nome, '/api/food/print/' || i.chave
  FROM food_impressoras i JOIN food_lojas l ON l.id = i.loja_id
 WHERE l.slug = 'demo-boteco'
ORDER BY 1;
