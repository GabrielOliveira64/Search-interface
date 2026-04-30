# Portal — Página Inicial Personalizada

## Instalação

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou superior)
2. Abra o terminal na pasta do projeto
3. Instale as dependências:

```
npm install
```

## Como usar

```
npm start
```

O app abre na bandeja do sistema e inicia o servidor automaticamente.
Acesse o portal em: **http://localhost:3000**

## Painel de controle

- **Duplo clique** no ícone da bandeja → abre o painel
- **Clique direito** → menu rápido (abrir portal, parar/iniciar, sair)
- No painel você pode:
  - Iniciar / parar o servidor
  - Alterar a porta
  - Ativar inicialização automática com o Windows
  - Ver o log do servidor em tempo real

## Iniciar com o Windows

No painel de controle, ative o toggle **"Iniciar automaticamente"**.
Isso registra o app no Agendador de Tarefas do Windows (sem precisar de administrador).

## Estrutura de arquivos

```
portal/
├── main.js       ← processo principal Electron (servidor + tray + janela)
├── preload.js    ← bridge segura entre Electron e painel
├── panel.html    ← interface do painel de controle
├── index.html    ← portal (página inicial)
├── app.js        ← lógica do portal
├── style.css     ← estilos do portal
├── db.json       ← configurações (criado automaticamente)
└── package.json
```

## Definir como página inicial do browser

- **Chrome/Edge:** Configurações → Na inicialização → Abrir uma página específica → `http://localhost:3000`
- **Firefox:** Configurações → Início → URL da página inicial → `http://localhost:3000`
