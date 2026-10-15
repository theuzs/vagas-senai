-- A maquete (bolsão com publico = false) fica fora dos resultados.
-- Resultados das noites: leitura do histórico para a tela /resultados.
-- anon não lê vagas.historico direto (e continua sem ler). Estas três funções, em
-- security definer, devolvem só agregados e a série de uma noite, nunca a tabela.
--
-- "Noite" é a data em America/Sao_Paulo, e só entram as fotos das 18:00 às 22:25
-- (54 janelas de 5 minutos). Uma janela sem foto quer dizer que os sensores não
-- mandaram dado; ela nunca conta como lotada.

-- Por noite e bolsão: em quantas janelas houve foto, em quantas o bolsão estava lotado,
-- o mínimo de vagas livres e o total de vagas.
create or replace function vagas.resumo_noites(p_dias int default 30)
returns table(noite date, bolsao_id text, janelas_com_dado int, janelas_lotado int, min_livres int, total_vagas int)
language sql
stable
security definer
set search_path = ''
as $$
  select (h.momento at time zone 'America/Sao_Paulo')::date as noite,
         h.bolsao_id,
         pg_catalog.count(*)::int as janelas_com_dado,
         (pg_catalog.count(*) filter (where h.vagas_livres = 0))::int as janelas_lotado,
         pg_catalog.min(h.vagas_livres)::int as min_livres,
         pg_catalog.max(h.total_vagas)::int as total_vagas
    from vagas.historico h
   where exists (select 1 from vagas.bolsoes b where b.id = h.bolsao_id and b.publico)
     and (h.momento at time zone 'America/Sao_Paulo')::time >= time '18:00'
     and (h.momento at time zone 'America/Sao_Paulo')::time < time '22:30'
     and (h.momento at time zone 'America/Sao_Paulo')::date > (pg_catalog.now() at time zone 'America/Sao_Paulo')::date - least(greatest(p_dias, 1), 120)
   group by 1, 2
   order by 1 desc, 2;
$$;

-- Por noite: quantas janelas tinham foto de pelo menos dois bolsões (dá para comparar),
-- em quantas um bolsão com foto estava lotado enquanto outro com foto tinha vaga, e a
-- média de vagas livres dos bolsões com vaga nessas janelas. Bolsão sem foto não entra.
create or replace function vagas.impacto(p_dias int default 30)
returns table(noite date, janelas_avaliadas int, janelas_lotado_com_vaga_em_outro int, media_livres_outros numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with fotos as (
    select (h.momento at time zone 'America/Sao_Paulo')::date as noite, h.momento, h.vagas_livres
      from vagas.historico h
     where exists (select 1 from vagas.bolsoes b where b.id = h.bolsao_id and b.publico)
       and (h.momento at time zone 'America/Sao_Paulo')::time >= time '18:00'
       and (h.momento at time zone 'America/Sao_Paulo')::time < time '22:30'
       and (h.momento at time zone 'America/Sao_Paulo')::date > (pg_catalog.now() at time zone 'America/Sao_Paulo')::date - least(greatest(p_dias, 1), 120)
  ),
  janelas as (
    select f.noite,
           f.momento,
           pg_catalog.count(*) as com_foto,
           pg_catalog.bool_or(f.vagas_livres = 0) as algum_lotado,
           pg_catalog.count(*) filter (where f.vagas_livres > 0) as com_vaga,
           coalesce(pg_catalog.sum(f.vagas_livres) filter (where f.vagas_livres > 0), 0) as livres_com_vaga
      from fotos f
     group by f.noite, f.momento
  )
  select j.noite,
         (pg_catalog.count(*) filter (where j.com_foto >= 2))::int as janelas_avaliadas,
         (pg_catalog.count(*) filter (where j.algum_lotado and j.com_vaga > 0))::int as janelas_lotado_com_vaga_em_outro,
         pg_catalog.round(
           (pg_catalog.sum(j.livres_com_vaga) filter (where j.algum_lotado and j.com_vaga > 0))::numeric
             / nullif(pg_catalog.sum(j.com_vaga) filter (where j.algum_lotado and j.com_vaga > 0), 0),
           1
         ) as media_livres_outros
    from janelas j
   group by j.noite
   order by j.noite desc;
$$;

-- As fotos de uma noite, para o gráfico e o CSV.
create or replace function vagas.serie_noite(p_noite date)
returns table(bolsao_id text, momento timestamptz, vagas_livres int, total_vagas int)
language sql
stable
security definer
set search_path = ''
as $$
  select h.bolsao_id, h.momento, h.vagas_livres::int, h.total_vagas::int
    from vagas.historico h
   where exists (select 1 from vagas.bolsoes b where b.id = h.bolsao_id and b.publico)
     and (h.momento at time zone 'America/Sao_Paulo')::date = p_noite
     and (h.momento at time zone 'America/Sao_Paulo')::time >= time '18:00'
     and (h.momento at time zone 'America/Sao_Paulo')::time < time '22:30'
   order by h.bolsao_id, h.momento;
$$;

revoke execute on function vagas.resumo_noites(int) from public;
revoke execute on function vagas.impacto(int) from public;
revoke execute on function vagas.serie_noite(date) from public;
grant execute on function vagas.resumo_noites(int) to anon, authenticated, service_role;
grant execute on function vagas.impacto(int) to anon, authenticated, service_role;
grant execute on function vagas.serie_noite(date) to anon, authenticated, service_role;
