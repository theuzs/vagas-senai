-- UX-58: diagnóstico das placas e vagas especiais definidas na placa.
-- UX-59: bolsão de maquete fora da página pública e token limitado a bolsões.
-- UX-61: aviso da manutenção, mostrado só junto do SEM DADOS.
-- Tudo no schema vagas.

alter table vagas.centrais add column diag jsonb;
alter table vagas.centrais add column diag_em timestamptz;
-- Lista de bolsões em que o token pode publicar. Nulo = todos.
alter table vagas.centrais add column bolsoes text[];

alter table vagas.bolsoes add column publico boolean not null default true;
alter table vagas.bolsoes add column aviso text check (aviso is null or char_length(aviso) between 1 and 80);

comment on column vagas.bolsoes.publico is 'false = bolsão de maquete; só aparece com ?maquete=1';
comment on column vagas.bolsoes.aviso is 'Aviso da manutenção, mostrado só quando o bolsão está em SEM DADOS';

insert into vagas.bolsoes (id, nome, ordem, publico) values ('M', 'Bloco M (maquete)', 9, false)
on conflict (id) do nothing;

-- Tokens já cadastrados ficam presos ao seu bolsão (no banco de produção; aqui pode não haver nenhum).
update vagas.centrais set bolsoes = '{A}' where id = 'bolsao-a' and bolsoes is null;
update vagas.centrais set bolsoes = '{C}' where id = 'bolsao-c' and bolsoes is null;
update vagas.centrais set bolsoes = '{H}' where id = 'bolsao-h' and bolsoes is null;

drop function vagas.publicar(text, jsonb);

-- Única porta de escrita, agora com diagnóstico da placa e vagas especiais opcionais:
--   publicar(token, {"A": "0110100"}, {"rssi": -67, ...}, {"A": {"pcd": [0, 1]}})
-- p_diag: gravado em centrais.diag só quando é um objeto de até 2048 bytes; senão é ignorado.
-- p_especiais: chaves pcd, idoso, gestante e moto, posições de 0 a total - 1 sem repetição;
--   valor inválido falha com 22023 sem gravar nada; nulo não mexe; {"A": {}} zera.
create or replace function vagas.publicar(p_token text, p_bolsoes jsonb, p_diag jsonb default null, p_especiais jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_central_id  text;
  v_permitidos  text[];
  v_id          text;
  v_valor       jsonb;
  v_estados     text;
  v_total       int;
  v_livres      int;
  v_vagas       jsonb;
  v_momento     timestamptz;
  v_atualizados text[] := '{}';
  v_tipo        text;
  v_posicoes    jsonb;
  v_posicao     jsonb;
  v_vistas      int[];
  v_total_bolsao int;
begin
  if p_token is null or pg_catalog.length(p_token) < 32 then
    raise exception 'token recusado' using errcode = '28000';
  end if;

  select c.id, c.bolsoes into v_central_id, v_permitidos
    from vagas.centrais c
   where c.ativa
     and c.token_hash = pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8'));

  if v_central_id is null then
    raise exception 'token recusado' using errcode = '28000';
  end if;

  if p_bolsoes is null or pg_catalog.jsonb_typeof(p_bolsoes) <> 'object' then
    raise exception 'bolsoes precisa ser um objeto {"A": "0101"}' using errcode = '22023';
  end if;

  v_momento := pg_catalog.date_bin('5 minutes', pg_catalog.now(), timestamptz '2000-01-01 00:00:00+00');

  for v_id, v_valor in select key, value from pg_catalog.jsonb_each(p_bolsoes) loop
    if v_permitidos is not null and not (v_id = any (v_permitidos)) then
      raise exception 'token recusado' using errcode = '28000';
    end if;
    if pg_catalog.jsonb_typeof(v_valor) <> 'string' then
      raise exception 'bolsão %: o estado precisa ser um texto de 0 e 1', v_id using errcode = '22023';
    end if;
    v_estados := v_valor #>> '{}';
    -- (o regex do Postgres não aceita {1,500}; o limite de 500 vem do length)
    if v_estados !~ '^[01]+$' or pg_catalog.length(v_estados) > 500 then
      raise exception 'bolsão %: estado inválido (só 0 e 1, de 1 a 500 vagas)', v_id using errcode = '22023';
    end if;
    if not exists (select 1 from vagas.bolsoes b where b.id = v_id) then
      raise exception 'bolsão % não existe', v_id using errcode = '22023';
    end if;

    v_total  := pg_catalog.length(v_estados);
    v_livres := v_total - pg_catalog.length(pg_catalog.replace(v_estados, '0', ''));
    select pg_catalog.jsonb_agg((t.ch = '1') order by t.n)
      into v_vagas
      from pg_catalog.string_to_table(v_estados, null) with ordinality as t(ch, n);

    update vagas.bolsoes
       set vagas = v_vagas,
           total_vagas = v_total,
           vagas_livres = v_livres,
           atualizado_em = pg_catalog.now()
     where id = v_id;

    insert into vagas.historico (bolsao_id, momento, vagas_livres, total_vagas)
         values (v_id, v_momento, v_livres, v_total)
    on conflict do nothing;

    v_atualizados := v_atualizados || v_id;
  end loop;

  -- Vagas especiais definidas na placa (decisão: a placa manda; um update por SQL é sobrescrito).
  if p_especiais is not null then
    if pg_catalog.jsonb_typeof(p_especiais) <> 'object' then
      raise exception 'especiais precisa ser um objeto {"A": {"pcd": [0, 1]}}' using errcode = '22023';
    end if;
    for v_id, v_valor in select key, value from pg_catalog.jsonb_each(p_especiais) loop
      if v_permitidos is not null and not (v_id = any (v_permitidos)) then
        raise exception 'token recusado' using errcode = '28000';
      end if;
      if pg_catalog.jsonb_typeof(v_valor) <> 'object' then
        raise exception 'bolsão %: especiais precisa ser um objeto', v_id using errcode = '22023';
      end if;
      select b.total_vagas into v_total_bolsao from vagas.bolsoes b where b.id = v_id;
      if not found then
        raise exception 'bolsão % não existe', v_id using errcode = '22023';
      end if;
      v_vistas := '{}';
      for v_tipo, v_posicoes in select key, value from pg_catalog.jsonb_each(v_valor) loop
        if v_tipo not in ('pcd', 'idoso', 'gestante', 'moto') then
          raise exception 'bolsão %: tipo de vaga especial desconhecido (%)', v_id, v_tipo using errcode = '22023';
        end if;
        if pg_catalog.jsonb_typeof(v_posicoes) <> 'array' then
          raise exception 'bolsão %: % precisa ser uma lista de posições', v_id, v_tipo using errcode = '22023';
        end if;
        for v_posicao in select value from pg_catalog.jsonb_array_elements(v_posicoes) loop
          if pg_catalog.jsonb_typeof(v_posicao) <> 'number'
             or (v_posicao #>> '{}') !~ '^[0-9]+$'
             or (v_posicao #>> '{}')::int >= coalesce(v_total_bolsao, 0) then
            raise exception 'bolsão %: posição % fora da grade', v_id, v_posicao using errcode = '22023';
          end if;
          if (v_posicao #>> '{}')::int = any (v_vistas) then
            raise exception 'bolsão %: posição % repetida', v_id, v_posicao using errcode = '22023';
          end if;
          v_vistas := v_vistas || (v_posicao #>> '{}')::int;
        end loop;
      end loop;
      update vagas.bolsoes set especiais = v_valor where id = v_id;
    end loop;
  end if;

  if p_diag is not null and pg_catalog.jsonb_typeof(p_diag) = 'object' and pg_catalog.octet_length(p_diag::text) <= 2048 then
    update vagas.centrais set ultimo_envio = pg_catalog.now(), diag = p_diag, diag_em = pg_catalog.now() where id = v_central_id;
  else
    update vagas.centrais set ultimo_envio = pg_catalog.now() where id = v_central_id;
  end if;

  return pg_catalog.jsonb_build_object('atualizados', pg_catalog.to_jsonb(v_atualizados));
end;
$$;

revoke execute on function vagas.publicar(text, jsonb, jsonb, jsonb) from public;
grant execute on function vagas.publicar(text, jsonb, jsonb, jsonb) to anon, authenticated, service_role;

-- Saúde das placas para a tela /placas: só centrais ativas, nunca o hash do token.
create or replace function vagas.placas()
returns table (id text, nome text, ultimo_envio timestamptz, diag jsonb, diag_em timestamptz, bolsoes text[])
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.nome, c.ultimo_envio, c.diag, c.diag_em, c.bolsoes
    from vagas.centrais c
   where c.ativa
   order by c.id;
$$;

revoke execute on function vagas.placas() from public;
grant execute on function vagas.placas() to anon, authenticated, service_role;
