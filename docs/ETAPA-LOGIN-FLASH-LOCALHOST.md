# Etapa seguinte: login antigo hardcoded em 127.0.0.1

## Bloqueio observado em 13/11/2026

Ao executar `/game-client` com Ruffle, o `Launcher.swf` exibe sua tela original, mas tenta conectar em:

```
https://127.0.0.1:8000/rest-auth/login/
```

O navegador impede essa chamada devido à política de segurança (CSP) e ao fato de `127.0.0.1` representar **o computador do jogador**, não um servidor público. Desativar a CSP ou permitir conexões à rede local seria inseguro e não criaria um backend de jogo.

## Alterações desta fase

- Configurado `urlRewriteRules` do Ruffle exclusivamente para as versões `https` e `http` do endereço legado `127.0.0.1:8000/rest-auth/login/`. A substituição aponta para `/game-client/compat/rest-auth/login/` dentro do próprio site HTTPS.
- A rota de compatibilidade é explicitamente **sem autenticação**: responde **HTTP 503** com código `GAME_AUTH_BACKEND_UNAVAILABLE`, sem registrar, validar ou armazenar credenciais ou tocar nas tabelas de contas. Ela é instalada antes de qualquer parser de dados ou CSRF porque não tem efeitos colaterais.
- A interface avisa **NÃO digitar senhas na janela Flash**; o login do portal continua separado e funcionando.
- A rota `/game-client/status` sinaliza que a tradução da URL local está ativa, mas o servidor original ainda não está ligado.
- Testes Node cobrem URL exata, resposta 503 sem vazamento de senha e JavaScript renderizado.
- Ferramenta `tools/migration/Inspect-Launcher-ABC.py` analisa estaticamente o ABC de `Launcher.swf`, `Loading.swf` e `DDT_Loading.swf` para levantar endpoints sem executar o Flash. O relatório sanitizado é produzido pela GitHub Action `DDTank Flash launcher API audit (offline)`.

## Tradução da interface Flash

A rotina `Translate-Flash-Language-PTBR.py` agora preserva marcadores `{0}`, HTML, atalhos de formato e escapes do texto original. Há teste de pré-voo usando todas as entradas de `language.txt`, para evitar corrupção. O resultado continua sendo **tradução por máquina, sujeita a revisão**, e não cobre textos desenhados diretamente dentro de `Launcher.swf`.

## Critérios para chegar à autenticação real

1. Descobrir o formato correto de requisição/resposta do Launcher e a sequência de recursos exigidos após login.
2. Implementar uma ponte de **login de jogo** que autentique a **sessão já existente do portal** e emita um token limitado/curto, sem aceitar senhas dentro do Flash. Não expor cookie de administrador no ActionScript.
3. Iniciar/portar o servidor original `Center.Server` / `Game.Server` / `Fighting.Server`, com as dependências SQL Server e endpoints necessários. O servidor C# `net472` não está rodando no serviço Linux/Node do Render atual.
4. Somente após uma sessão real do jogo funcionar, validar sala original, personagens, combate, inventário e GM conectados a ela.
5. Revisar localização do SWF e de recursos do cliente, mantendo identificadores técnicos exigidos pelo Flash.

**Até lá:** é esperado que o endereço antigo não cause mais bloqueio de CSP, mas o jogo não avançará além do login com a resposta 503 de diagnóstico. Não anuncie “login resolvido” ou “DDTank completo”.

## Como verificar

Após o Render publicar o novo commit como Live:
- Acesse `https://ddtank-web.onrender.com/game-client`; abra o Launcher, sem digitar credenciais.
- Verifique no Console se a requisição mudou de `https://127.0.0.1:8000/rest-auth/login/` para `https://ddtank-web.onrender.com/game-client/compat/rest-auth/login/`.
- Confirme que a resposta é 503 documentada (não 403 CSP nem acesso à rede local).
- Em paralelo, `/dashboard`, `/admin`, `/character`, `/inventory` e `/lobby` devem continuar funcionando.
- Consulte os resultados de **Actions > DDTank Flash launcher API audit (offline)** para decidir a próxima etapa do contrato de autenticação.

## Nova descoberta — SWF original descompactado

O `Launcher.swf` está no formato `ZWS` (LZMA) e contém **1.817 strings ABC** na análise estática, além de chamadas a **três endpoints HTTP locais**:

| API original no cliente | Finalidade aparente | Estado no portal |
| --- | --- | --- |
| `/rest-auth/login/` | Autenticação da conta do jogo | Somente diagnóstico HTTP 503 |
| `/user/api/server-list/` | Descoberta de servidores/canais | Somente diagnóstico HTTP 503 |
| `/user/api/login2/getlinkflash/` | Obtenção do link Flash após login | Somente diagnóstico HTTP 503 |

Em todos os casos o cliente original aponta para `127.0.0.1:8000`; o Ruffle passa a reescrever os URLs **exatos** (HTTP/HTTPS) para o domínio público, mas nenhuma das três funções é falsamente considerada pronta. Não são proxies abertos e não armazenam senhas. A sequência e o formato JSON dos serviços antigos ainda precisam ser reconstruídos e testados antes do login integrado funcionar.

O relatório do scanner mostra os nomes das APIs, **não** divulga strings arbitrárias adjacentes, chaves antigas ou credenciais encontradas no bytecode. Arquivos `ui/vietnam` continuam com essa nomenclatura física para atender os caminhos exigidos pelo cliente; o conteúdo textual será PT-BR quando validado.
