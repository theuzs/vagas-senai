-- Vagas SENAI Blumenau: tudo deste projeto vive no schema "vagas".
-- Nada aqui toca o schema public nem outros objetos do banco.

create schema if not exists vagas;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

-- Um bolsão de estacionamento (bloco A, C, H...). Estado nulo = nunca recebeu dado.
create table vagas.bolsoes (
  id            text primary key check (id ~ '^[A-Z0-9]{1,8}$'),
  nome          text not null,
  ordem         smallint not null default 0,
  total_vagas   smallint check (total_vagas between 1 and 500),
  vagas_livres  smallint check (vagas_livres >= 0 and vagas_livres <= total_vagas),
  -- array de booleanos, uma posição por vaga na ordem dos sensores; true = ocupada
  vagas         jsonb check (vagas is null or jsonb_typeof(vagas) = 'array'),
  -- posições especiais, ex.: {"pcd":[0,1],"idoso":[5]} (índice a partir de 0)
  especiais     jsonb not null default '{}'::jsonb check (jsonb_typeof(especiais) = 'object'),
  atualizado_em timestamptz
);

comment on table vagas.bolsoes is 'Estado atual de cada bolsão. Campos de estado nulos significam "sem dados".';

-- Centrais autorizadas a publicar. O token em texto só existe no firmware; aqui fica o sha256.
create table vagas.centrais (
  id           text primary key,
  nome         text,
  token_hash   bytea not null unique,
  ativa        boolean not null default true,
  criada_em    timestamptz not null default now(),
  ultimo_envio timestamptz
);

-- Uma foto da ocupação por janela de 5 minutos, para mostrar o efeito do sistema.
create table vagas.historico (
  bolsao_id    text not null references vagas.bolsoes (id) on delete cascade,
  momento      timestamptz not null,
  vagas_livres smallint not null,
  total_vagas  smallint not null,
  primary key (bolsao_id, momento)
);

-- Seed: os três bolsões do problema, sem estado. A página mostra SEM DADOS até chegar o primeiro envio.
insert into vagas.bolsoes (id, nome, ordem) values
  ('A', 'Bloco A', 1),
  ('C', 'Bloco C', 2),
  ('H', 'Bloco H', 3);

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

-- Hora do servidor. A página usa para medir a idade dos dados sem confiar no relógio do celular.
create or replace function vagas.agora()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select pg_catalog.now();
$$;

-- Única porta de escrita. A ponte chama com o token da central e o estado dos bolsões:
--   {"A": "0110100", "H": "000101"}   (0 = livre, 1 = ocupada, um caractere por vaga)
-- Bolsão que não vier no objeto não é tocado: assim um nó parado envelhece e vira SEM DADOS.
create or replace function vagas.publicar(p_token text, p_bolsoes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_central_id  text;
  v_id          text;
  v_valor       jsonb;
  v_estados     text;
  v_total       int;
  v_livres      int;
  v_vagas       jsonb;
  v_momento     timestamptz;
  v_atualizados text[] := '{}';
begin
  if p_token is null or pg_catalog.length(p_token) < 32 then
    raise exception 'token recusado' using errcode = '28000';
  end if;

  select c.id into v_central_id
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

  update vagas.centrais set ultimo_envio = pg_catalog.now() where id = v_central_id;

  return pg_catalog.jsonb_build_object('atualizados', pg_catalog.to_jsonb(v_atualizados));
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

alter table vagas.bolsoes   enable row level security;
alter table vagas.centrais  enable row level security;
alter table vagas.historico enable row level security;

grant usage on schema vagas to anon, authenticated, service_role;

-- Leitura pública dos bolsões. Nenhuma política de escrita: só a função publicar grava.
grant select on vagas.bolsoes to anon, authenticated;
create policy leitura_publica on vagas.bolsoes
  for select to anon, authenticated using (true);

-- centrais e historico: nenhum grant e nenhuma política para anon/authenticated.
-- service_role (só no painel ou em scripts do administrador) enxerga tudo.
grant select, insert, update, delete on all tables in schema vagas to service_role;

revoke execute on all functions in schema vagas from public;
grant execute on function vagas.publicar(text, jsonb) to anon, authenticated, service_role;
grant execute on function vagas.agora() to anon, authenticated, service_role;

-- Realtime: a página assina mudanças em bolsoes.
alter publication supabase_realtime add table vagas.bolsoes;
