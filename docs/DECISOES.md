# Decisões

## Para confirmar (tomadas em 07/10/2026)

1. **Supabase compartilhado com o WebSiteFoods.** Tudo deste projeto fica no schema `vagas`, separado das tabelas do Vitta's. As migrations daqui não usam o `supabase db push`, porque o histórico de migrations do Supabase é do WebSiteFoods. Elas rodam por um script próprio (`npm run db:aplicar`) ou coladas no SQL Editor.
2. **Escrita só pela função `vagas.publicar` com token da central.** Uma política de escrita para `anon` ficou de fora porque a chave `anon` está dentro da página e qualquer um poderia gravar número falso. Uma Edge Function também ficou de fora: ela teria a mesma segurança, mas daria mais trabalho para publicar e demoraria na primeira chamada. A função fica dentro da migration e o banco guarda só o hash do token.
3. **Duas placas na central.** A central atual continua só com ESP-NOW e passa os dados por fio para um ESP32 novo, a ponte, que cuida do Wi-Fi. Assim o canal do Wi-Fi do campus não atrapalha os nós e uma queda de internet não trava a recepção. A versão com uma placa só fica documentada como alternativa.
4. **O total de vagas vem do nó.** O banco aceita de 1 a 500 vagas por bolsão e atualiza o total sozinho pelo tamanho da lista que chega. Não é preciso cadastrar quantas vagas cada bolsão tem.
5. **Bolsões são linhas da tabela.** A, C e H vêm cadastrados. Para incluir outro bolsão, basta inserir uma linha, sem mexer em código.
6. **Tempos.** A ponte publica a cada 10 s. Um bolsão só vai na publicação se o nó dele mandou dado nos últimos 5 s. A página mostra SEM DADOS quando o dado tem mais de 30 s.
7. **Hora do servidor.** A página calcula a idade do dado com a hora do Supabase, para um celular com relógio errado não esconder nem inventar vaga.
8. **Histórico guardado desde o primeiro dia.** O banco grava uma foto da ocupação a cada 5 minutos, sem tela por enquanto. Esse dado serve para mostrar à banca do prêmio quantas vagas sobravam à noite.
9. **Vagas de PCD e idoso.** Ficam marcadas no banco pela posição do sensor, e a página mostra separado ("PCD: 1 livre").
10. **Página.** Usa Next.js como o WebSiteFoods, sem código de servidor e só com a chave pública. Com `?demo=1` no endereço ela mostra dados simulados, com uma faixa avisando. Isso serve para apresentar o projeto sem o hardware ligado.
11. **Endereço.** `vagas.rubysistemas.com.br`, num projeto novo na mesma conta da Vercel.
12. **Wi-Fi.** O firmware da ponte aceita rede só com senha e rede com usuário e senha. Isso se escolhe no `config.h`.
13. **Painel LCD na guarita.** Um display de 20x4 ligado na ponte, opcional, com os números de cada bolsão. Funciona mesmo sem internet.
14. **Visual.** Tema escuro, porque o uso é à noite. Verde para livre, amarelo para poucas vagas, vermelho para lotado e SEM DADOS com listras e ícone de alerta. Na tela aparece o nome "Vagas SENAI Blumenau", sem o logo do SENAI.
15. **Repositório.** `theuzs/vagas-senai`, privado.

## Perguntas em aberto

Para o João:
- Onde a central vai ficar? Na guarita seria o ideal, porque tem tomada e o vigia veria o LCD.
- Pode mandar o código (`.ino`) da central e de um nó? Com ele dá para encaixar o trecho que manda os dados para a ponte e conferir se uma placa só daria conta.
- Quais vagas de cada bolsão são de PCD ou idoso (pela ordem dos sensores)?
- O Wi-Fi do campus pede só senha, usuário e senha, ou uma página de login no navegador? No último caso, a TI precisa liberar a ponte pelo MAC.
- O sinal do nó do H chega até onde a central vai ficar? Pelo mapa são uns 100 m com prédios no meio.

Para o Matheus:
- Reservar o subdomínio `vagas` no WebSiteFoods, para ninguém criar uma loja com esse nome? É opcional.

## Decididas durante a noite

(o agente da noite acrescenta aqui)
