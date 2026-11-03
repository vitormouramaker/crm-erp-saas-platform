import type { ManualArticle, ManualModule } from "../types/manual";

export const MANUAL_MODULES: ManualModule[] = [
  {
    id: "primeiros-passos",
    title: "Primeiros passos",
    description: "Acesso, menu, permissões e visão geral do sistema.",
    order: 1,
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Indicadores gerais do negócio.",
    order: 2,
    requiredPermissions: ["dashboard.view"],
  },
  {
    id: "atendimentos",
    title: "Atendimentos",
    description: "Chat, cliente, IA, mídias e finalização de conversas.",
    order: 3,
    requiredPermissions: ["chat.view"],
  },
  {
    id: "contatos",
    title: "Contatos",
    description: "Clientes, histórico, importação e listas de transmissão.",
    order: 4,
    requiredPermissions: ["contacts.view"],
  },
  {
    id: "estoque",
    title: "Estoque",
    description: "Produtos, fornecedores, pedidos, etiquetas e movimentações.",
    order: 5,
    requiredPermissions: ["stock.view"],
  },
  {
    id: "comercial",
    title: "Comercial / Funil",
    description: "Pipeline, oportunidades, relatórios e configurações comerciais.",
    order: 6,
    requiredPermissions: ["commercial.view"],
  },
  {
    id: "configuracoes",
    title: "Configurações",
    description: "Mensagens rápidas, tags, filiais, categorias, IA e NPS.",
    order: 7,
    requiredPermissions: ["settings.view"],
  },
  {
    id: "integracoes-meta",
    title: "Integrações Meta",
    description: "WhatsApp Cloud API, templates, anúncios e Instagram.",
    order: 8,
    requiredPermissions: ["settings.api_meta"],
  },
  {
    id: "usuarios",
    title: "Usuários e permissões",
    description: "Gestão de equipe, limites e permissões por perfil.",
    order: 9,
    requiredPermissions: ["users.manage"],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    description: "Contas, lançamentos, categorias, alertas, comissões e assinaturas.",
    order: 10,
    requiredPermissions: ["financial.manage"],
  },
  {
    id: "assinatura",
    title: "Assinatura e suporte",
    description: "Planos, pagamentos, add-ons, suporte e sugestões.",
    order: 11,
    requiredPermissions: ["financial.manage"],
  },
  {
    id: "rh",
    title: "RH / Ponto",
    description: "Registro de ponto, justificativas, relatórios e gestão de RH.",
    order: 12,
    requiredPermissions: ["rh.point.register"],
  },
  {
    id: "transacoes-pdv",
    title: "Transações PDV",
    description: "Consulta e filtragem de transações do ponto de venda.",
    order: 13,
    requiredPermissions: ["sales.view"],
  },
  {
    id: "nps",
    title: "NPS",
    description: "Pesquisa pública de satisfação e gestão das perguntas.",
    order: 14,
  },
];

const now = "2026-04-28T00:00:00.000Z";

function article(
  id: string,
  moduleId: string,
  title: string,
  summary: string,
  steps: string[],
  options: Partial<ManualArticle> = {},
): ManualArticle {
  return {
    id,
    moduleId,
    title,
    slug: options.slug || id,
    summary,
    content:
      options.content ||
      "Use este artigo para orientar o usuário sobre o objetivo da funcionalidade, os campos principais e o resultado esperado ao concluir o fluxo.",
    steps,
    keywords: options.keywords || title.toLowerCase().split(/\s+/),
    relatedRoute: options.relatedRoute,
    requiredPermissions: options.requiredPermissions,
    minPlanId: options.minPlanId,
    featured: Boolean(options.featured),
    order: options.order || 1,
    status: options.status || "published",
    updatedAt: options.updatedAt || now,
  };
}

export const MANUAL_ARTICLES: ManualArticle[] = [
  // ─── PRIMEIROS PASSOS ────────────────────────────────────────────────────────
  article(
    "visao-geral-menu",
    "primeiros-passos",
    "Visão geral do sistema e menu lateral",
    "Entenda como navegar pelos módulos disponíveis para o seu perfil.",
    [
      "Após o login, observe a barra lateral esquerda — ela lista todos os módulos liberados para o seu perfil. Ícones sem nome aparecem com tooltip ao passar o cursor.",
      "Clique em qualquer ícone para abrir o módulo correspondente. A área selecionada ficará destacada no menu.",
      "Se você esperava ver um módulo mas ele não aparece (ex.: Financeiro, RH, Comercial), isso indica que sua conta não tem permissão para aquela seção. Fale com o administrador do sistema.",
      "O administrador acessa Gestão de Equipe, seleciona seu usuário e habilita as permissões necessárias. Após salvar, atualize a página para que o menu reflita as novas permissões.",
      "Módulos como Dashboard, Atendimentos, Contatos, Estoque, Funil, Financeiro, RH e PDV são acessíveis conforme o plano contratado e as permissões individuais configuradas.",
    ],
    {
      featured: true,
      order: 1,
      keywords: ["menu", "inicio", "permissoes", "navegacao", "lateral", "modulos"],
      content:
        "O menu lateral é o ponto central de navegação do sistema. Cada ícone representa um módulo funcional — Atendimentos, Contatos, Estoque, Funil, Financeiro, RH, entre outros — e somente as seções liberadas para o seu perfil são exibidas. Isso significa que diferentes colaboradores verão conjuntos de opções distintos dependendo do cargo e das permissões atribuídas pelo administrador.\n\nO sistema foi desenhado para que nenhuma funcionalidade apareça desnecessariamente: vendedores veem Funil e Atendimentos; operadores de estoque veem Produtos e Fornecedores; gestores financeiros acessam Financeiro e Relatórios. Essa segmentação evita erros acidentais e mantém o foco de cada perfil.\n\nSe você precisar de acesso a um módulo que não está visível, não é possível forçar a exibição pelo próprio usuário — a liberação deve ser feita pelo administrador na área de Gestão de Equipe. Após a alteração, basta recarregar a página.",
    },
  ),

  article(
    "login-recuperacao-senha",
    "primeiros-passos",
    "Login e recuperação de senha",
    "Como entrar no sistema e solicitar uma nova senha caso esqueça o acesso.",
    [
      "Acesse a tela inicial do sistema pelo navegador. O endereço é fornecido pela sua empresa ou está no e-mail de boas-vindas.",
      "Informe o e-mail cadastrado no campo superior e a senha no campo inferior. Certifique-se de que o Caps Lock está desativado.",
      "Se estiver em um dispositivo de uso pessoal e seguro, marque a opção 'Lembrar dados' para não precisar digitar as credenciais a cada acesso.",
      "Clique em Entrar. Se as credenciais estiverem corretas, você será redirecionado para a tela principal do sistema.",
      "Caso não lembre a senha, clique em 'Esqueci minha senha' ou 'Recuperar senha'. Informe o e-mail cadastrado e clique em enviar.",
      "Você receberá um e-mail com um link de redefinição. O link expira em 30 minutos — se não encontrar na caixa de entrada, verifique a pasta de spam.",
      "Abra o link, defina uma nova senha (mínimo 8 caracteres, com letras e números), confirme e clique em Salvar. Em seguida, faça login normalmente com a nova senha.",
    ],
    {
      featured: true,
      order: 2,
      content:
        "O login é a porta de entrada do sistema. Cada colaborador possui credenciais individuais (e-mail e senha), e não é recomendado compartilhar o acesso entre pessoas, pois o sistema registra ações por usuário — o que é importante para auditoria e rastreamento de alterações.\n\nA opção 'Lembrar dados' mantém a sessão ativa no dispositivo, o que agiliza o acesso diário, mas deve ser evitada em computadores compartilhados ou públicos para preservar a segurança da conta.\n\nO fluxo de recuperação de senha é totalmente autônomo: o próprio usuário pode redefinir a senha sem precisar acionar o administrador, desde que tenha acesso ao e-mail cadastrado. Se o e-mail estiver incorreto ou inacessível, o administrador precisa atualizar os dados do usuário em Gestão de Equipe.",
    },
  ),

  article(
    "finalizar-cadastro",
    "primeiros-passos",
    "Finalizar cadastro da empresa",
    "Como concluir o cadastro recebido por convite ou token de ativação.",
    [
      "Abra o link de finalização de cadastro recebido por e-mail. Esse link é único e está vinculado ao token gerado no momento do convite.",
      "Revise os dados pré-preenchidos da empresa: razão social, nome fantasia e e-mail do responsável. Corrija qualquer informação incorreta antes de avançar.",
      "Preencha o CNPJ da empresa (ou CPF, se for pessoa física). O sistema valida o número automaticamente.",
      "Informe o endereço completo: CEP, logradouro, número, complemento, bairro, cidade e estado. O CEP pode preencher os demais campos automaticamente.",
      "Crie a senha de acesso do responsável. Use no mínimo 8 caracteres mesclando letras maiúsculas, minúsculas e números.",
      "Confirme a senha e clique em Finalizar cadastro. Você será redirecionado para a tela de login para o primeiro acesso.",
    ],
    {
      order: 3,
      content:
        "O cadastro de empresa é o primeiro passo para ativar o sistema. Ele é realizado uma única vez, pelo responsável que recebeu o convite, e define as informações institucionais que aparecem em documentos, relatórios e configurações do sistema.\n\nO link de finalização tem validade limitada. Se expirar antes de ser utilizado, o administrador da plataforma ou o suporte precisará reenviar um novo convite. Não é possível reutilizar o mesmo link após a expiração.\n\nApós finalizar o cadastro, o sistema estará pronto para uso. O responsável poderá então criar os demais usuários da equipe, configurar permissões e começar a operar os módulos contratados.",
    },
  ),

  // ─── DASHBOARD ───────────────────────────────────────────────────────────────
  article(
    "dashboard-indicadores",
    "dashboard",
    "Ler e interpretar os indicadores do Dashboard",
    "Saiba o que cada card, gráfico e ranking representa e como usá-los para tomar decisões.",
    [
      "Acesse o módulo Dashboard pelo menu lateral. A tela carrega automaticamente os dados do período padrão (geralmente o mês atual).",
      "Observe os cards de KPI no topo: eles mostram os principais números de forma resumida, como total de atendimentos, vendas, receita e estoque crítico. Passe o cursor sobre cada card para ver o tooltip com a definição exata.",
      "Analise os gráficos de linha ou barra que mostram a evolução dos indicadores ao longo do tempo. Picos e quedas indicam variações relevantes que merecem investigação.",
      "Consulte os rankings (ex.: melhores atendentes, produtos mais vendidos) para identificar destaques e gargalos dentro da equipe ou do portfólio.",
      "Use os filtros de período disponíveis (dia, semana, mês, trimestre ou intervalo personalizado) para comparar diferentes janelas de tempo.",
      "Ao identificar um número fora do esperado, clique no card ou na legenda correspondente — em alguns indicadores isso abre o módulo relacionado diretamente no filtro adequado para investigação.",
      "Revise o Dashboard no início de cada dia ou semana como rotina de acompanhamento do negócio. Não espere o final do mês para identificar tendências.",
    ],
    {
      relatedRoute: "/dashboard",
      requiredPermissions: ["dashboard.view"],
      featured: true,
      content:
        "O Dashboard é a central de inteligência do sistema. Ele consolida dados de todos os módulos ativos — atendimentos, vendas, estoque, financeiro — e os apresenta em um único painel visual, eliminando a necessidade de abrir cada área separadamente para ter uma visão geral do negócio.\n\nOs indicadores exibidos variam conforme as permissões do usuário: um atendente verá métricas de chat, enquanto um gerente financeiro verá receitas, despesas e inadimplência. Isso garante que cada perfil enxergue exatamente o que é relevante para a sua função.\n\nUsar o Dashboard de forma consistente permite identificar tendências antes que se tornem problemas: queda no volume de atendimentos, aumento de estoque parado, redução de receita. A leitura regular transforma dados em decisões mais rápidas e embasadas.",
      keywords: ["dashboard", "indicadores", "kpi", "grafico", "ranking", "metricas", "resultado"],
    },
  ),

  // ─── ATENDIMENTOS ────────────────────────────────────────────────────────────
  article(
    "chat-iniciar-atendimento",
    "atendimentos",
    "Iniciar e assumir um atendimento",
    "Como pegar uma conversa em espera e começar a atender o cliente.",
    [
      "Acesse o módulo Atendimentos pelo menu lateral. A tela principal exibe as filas de conversas organizadas por status: Aguardando, Em atendimento e Finalizados.",
      "Clique na aba 'Aguardando' para ver todas as conversas que ainda não foram assumidas por nenhum atendente. Elas ficam ordenadas por tempo de espera — as mais antigas aparecem primeiro.",
      "Identifique a conversa desejada pela foto de perfil, nome do contato, canal de origem (WhatsApp, Instagram etc.) e o trecho da última mensagem exibida.",
      "Clique sobre a conversa para abri-la no painel direito. O histórico completo de mensagens anteriores com aquele contato será carregado.",
      "Clique no botão 'Iniciar atendimento' ou 'Assumir' para vincular a conversa ao seu usuário. A partir desse momento, a conversa sai da fila de aguardando e aparece em 'Em atendimento'.",
      "Antes de responder, leia o histórico e verifique o painel do cliente à direita — ele exibe nome, telefone, tags, notas e últimas interações registradas no sistema.",
      "Comece a atender respondendo a mensagem mais recente do cliente. Use mensagens rápidas (/) para agilizar respostas padronizadas.",
    ],
    {
      relatedRoute: "/chat",
      requiredPermissions: ["chat.view"],
      featured: true,
      order: 1,
      content:
        "A fila de atendimentos é onde chegam todas as conversas iniciadas pelos clientes via WhatsApp, Instagram ou outros canais integrados. Cada mensagem recebida cria ou retoma uma conversa, e ela permanece na fila de 'Aguardando' até que um atendente a assuma.\n\nAssimir a conversa é um passo importante: garante que apenas um atendente responda ao mesmo cliente ao mesmo tempo, evitando mensagens duplicadas ou conflitantes. Assim que você clica em 'Iniciar atendimento', o sistema registra seu nome como responsável e os demais atendentes veem a conversa como 'Em andamento'.\n\nO tempo de espera é visível na fila, o que permite priorizar clientes que aguardam há mais tempo. Em operações com alto volume, é boa prática combinar com a equipe critérios de priorização — como clientes VIP ou tipo de solicitação — antes de assumir aleatoriamente.",
      keywords: ["chat", "atendimento", "iniciar", "assumir", "fila", "aguardando", "conversa"],
    },
  ),

  article(
    "chat-enviar-mensagens-midias",
    "atendimentos",
    "Enviar mensagens, áudio e mídias",
    "Como responder clientes com texto, áudio gravado, imagens, vídeos e documentos.",
    [
      "Abra uma conversa ativa (status 'Em atendimento'). O campo de texto fica na parte inferior da tela.",
      "Para enviar texto simples, clique no campo, digite a mensagem e pressione Enter ou clique no botão de envio.",
      "Para enviar uma imagem, vídeo ou documento, clique no ícone de clipe (anexo) ao lado do campo de texto. Selecione o arquivo no seu computador. Arquivos de imagem e vídeo mostram uma prévia antes do envio.",
      "Para gravar um áudio, clique e segure o ícone de microfone. Fale claramente e solte para enviar automaticamente. Se quiser cancelar a gravação, arraste o ícone para a lixeira antes de soltar.",
      "Para enviar uma foto tirada na hora (se disponível na versão web com câmera), clique no ícone de câmera, tire a foto e confirme.",
      "Antes de enviar qualquer mídia, revise o conteúdo na prévia. Não é possível desfazer o envio de uma mensagem após ela chegar ao cliente.",
      "Para mensagens longas ou com formatação especial, utilize mensagens rápidas cadastradas em Configurações para garantir consistência no tom e nas informações.",
    ],
    {
      relatedRoute: "/chat",
      requiredPermissions: ["chat.view"],
      order: 2,
      content:
        "O envio de mídias enriquece o atendimento e resolve dúvidas que um texto simples não conseguiria — imagens de produtos, vídeos instrucionais, PDFs de boleto ou catálogo, áudios explicativos. Cada tipo de mídia tem um uso ideal dependendo do contexto da conversa.\n\nO áudio é especialmente útil quando a explicação é longa ou técnica: falar é mais rápido que digitar e transmite tom, o que reduz mal-entendidos. No entanto, em ambientes barulhentos ou quando a privacidade do cliente é prioridade, prefira texto ou documento.\n\nLembre-se de que arquivos enviados ficam registrados no histórico da conversa e são visíveis para outros atendentes que eventualmente assumirem aquele contato no futuro. Evite enviar arquivos internos, planilhas de custo ou qualquer documento que não deva ser compartilhado com o cliente.",
      keywords: ["mensagem", "audio", "midia", "imagem", "video", "documento", "enviar", "arquivo"],
    },
  ),

  article(
    "chat-mensagens-rapidas",
    "atendimentos",
    "Usar mensagens rápidas no atendimento",
    "Como inserir respostas prontas e padronizadas durante uma conversa usando atalhos.",
    [
      "Abra uma conversa ativa e clique no campo de texto na parte inferior.",
      "Digite a barra / (barra normal, não backslash). Um menu flutuante abrirá listando todas as mensagens rápidas cadastradas no sistema.",
      "Role a lista ou continue digitando o nome ou parte do texto da mensagem para filtrar os resultados em tempo real.",
      "Clique na mensagem desejada ou use as teclas de seta para navegar e pressione Enter para selecioná-la. O texto completo será inserido automaticamente no campo.",
      "Antes de enviar, revise o texto inserido. Algumas mensagens rápidas possuem variáveis (ex.: {nome_cliente}) que devem ser substituídas manualmente pelo dado correto antes do envio.",
      "Se a mensagem rápida ideal não existir, você pode digitá-la normalmente agora e solicitar ao administrador para cadastrá-la em Configurações > Mensagens Rápidas para uso futuro.",
      "Mensagens rápidas não alteram o tom pessoal do atendimento — após inserir o texto, você pode editá-lo livremente antes de enviar.",
    ],
    {
      relatedRoute: "/chat",
      requiredPermissions: ["chat.view"],
      order: 3,
      keywords: ["atalho", "comando", "resposta", "rapida", "mensagem", "padrao", "barra"],
      content:
        "Mensagens rápidas são respostas pré-cadastradas que economizam tempo e garantem consistência no atendimento. Em vez de digitar do zero perguntas frequentes como horário de funcionamento, política de troca ou instruções de pagamento, o atendente insere a resposta correta em segundos.\n\nAlém de agilidade, mensagens rápidas reduzem erros de digitação e garantem que a informação transmitida ao cliente seja sempre a mesma — independentemente de qual atendente está em turno. Isso é especialmente valioso quando há equipes grandes ou rodízio frequente de colaboradores.\n\nO cadastro e a manutenção das mensagens rápidas é responsabilidade do administrador (em Configurações > Mensagens Rápidas). Se você perceber que determinada resposta está desatualizada ou que falta uma mensagem importante para o dia a dia, comunique ao responsável para que o conteúdo seja atualizado.",
    },
  ),

  article(
    "chat-finalizar-analisar",
    "atendimentos",
    "Finalizar e analisar um atendimento",
    "Como encerrar uma conversa resolvida e usar a análise por IA para revisar qualidade.",
    [
      "Com a conversa aberta e o problema do cliente resolvido, localize o botão de finalização — geralmente no topo direito da conversa ou no menu de ações.",
      "Clique em 'Finalizar atendimento'. O sistema pode solicitar informações adicionais como motivo de encerramento, tag do atendimento ou avaliação interna.",
      "Preencha os campos solicitados e confirme. A conversa sai de 'Em atendimento' e vai para a aba 'Finalizados', onde fica registrada no histórico.",
      "Para usar a análise por IA, acesse o histórico do atendimento já finalizado e localize o botão de análise (ícone de IA ou 'Analisar com IA').",
      "A IA processa o conteúdo da conversa e gera um resumo estruturado com: ponto principal da solicitação, qualidade da resposta, oportunidades de melhoria e possíveis próximos passos.",
      "Leia os pontos sugeridos pela IA como insumo para feedback individual ou reuniões de equipe. Não trate os resultados como avaliação definitiva — use-os como ponto de partida para reflexão.",
      "Gestores podem acessar atendimentos finalizados de toda a equipe para revisão de qualidade. O histórico fica disponível por tempo indeterminado.",
    ],
    {
      relatedRoute: "/chat",
      requiredPermissions: ["chat.view"],
      order: 4,
      content:
        "Finalizar o atendimento corretamente é tão importante quanto iniciá-lo. Uma conversa não finalizada continua aparecendo como 'Em andamento', o que distorce métricas, sobrecarrega a fila aparente e pode gerar confusão caso o cliente retorne com uma nova dúvida.\n\nO recurso de análise por IA foi desenvolvido para apoiar a gestão de qualidade sem precisar ler manualmente cada conversa. A IA identifica padrões na linguagem — cortesia, clareza, resolução efetiva — e sinaliza pontos de atenção que podem passar despercebidos em análises manuais rápidas.\n\nUse a análise principalmente em atendimentos onde houve reclamação, demora excessiva ou escalonamento. Com o tempo, os padrões identificados pela IA ajudam a construir um playbook de boas práticas específico para a sua operação.",
      keywords: ["finalizar", "encerrar", "atendimento", "ia", "analise", "qualidade", "historico"],
    },
  ),

  article(
    "chat-cliente-tags-crm",
    "atendimentos",
    "Usar o painel do cliente, tags e transferir para o funil",
    "Como consultar histórico, registrar notas, aplicar tags e encaminhar para o pipeline comercial.",
    [
      "Abra uma conversa ativa. No lado direito da tela, o painel do cliente exibe os dados cadastrais: nome, telefone, e-mail, canal de origem e data do primeiro contato.",
      "Role o painel para ver as abas disponíveis: Histórico (todas as conversas anteriores), Notas (anotações internas visíveis apenas para a equipe), Tags (classificações do contato) e Funil (oportunidades vinculadas).",
      "Para adicionar uma nota interna, clique na aba Notas e escreva a observação. Notas são úteis para registrar combinados verbais, preferências do cliente ou avisos para outros atendentes.",
      "Para aplicar uma tag, clique na aba Tags e selecione as classificações pertinentes (ex.: 'VIP', 'Reclamação', 'Potencial de venda'). Tags facilitam a segmentação na área de Contatos e nas listas de transmissão.",
      "Para transferir o atendimento para o funil, clique na opção de 'Enviar para funil' ou 'Nova oportunidade'. Selecione o pipeline, a etapa inicial e o responsável comercial.",
      "Preencha os dados da oportunidade: produto de interesse, valor estimado e temperatura (frio, morno, quente). Confirme para criar o card no funil automaticamente.",
      "O atendimento e a oportunidade ficam vinculados, permitindo que o time comercial acompanhe o histórico completo da conversa ao tratar a oportunidade no funil.",
    ],
    {
      relatedRoute: "/chat",
      requiredPermissions: ["chat.view"],
      order: 5,
      content:
        "O painel do cliente é o elo entre o atendimento e o relacionamento de longo prazo. Enquanto a conversa resolve o problema imediato, o painel registra o contexto — preferências, histórico, notas — que transforma um atendimento pontual em um relacionamento contínuo.\n\nTags são especialmente poderosas para operações que fazem marketing ativo: ao classificar clientes durante o atendimento, você cria segmentos que podem ser usados depois em listas de transmissão para campanhas direcionadas. Um cliente tagueado como 'Interessado em plano premium' pode receber uma mensagem específica dias depois.\n\nA integração com o funil permite que o mesmo lead abordado pelo atendimento seja acompanhado comercialmente sem duplicação de dados. O time de vendas recebe a oportunidade já com o histórico da conversa, eliminando a necessidade de o cliente repetir informações.",
      keywords: ["painel", "cliente", "tags", "notas", "crm", "historico", "transferir", "oportunidade"],
    },
  ),

  // ─── CONTATOS ────────────────────────────────────────────────────────────────
  article(
    "contatos-cadastrar-editar",
    "contatos",
    "Cadastrar, editar e excluir contatos",
    "Como manter a base de clientes atualizada com dados de contato, endereço e informações adicionais.",
    [
      "Acesse o módulo Contatos pelo menu lateral. A tela principal exibe a lista de todos os contatos cadastrados com busca e filtros.",
      "Para cadastrar um novo contato, clique no botão '+ Novo contato' no canto superior direito.",
      "Preencha os campos obrigatórios: nome completo e telefone (com DDD). O e-mail é opcional mas recomendado para comunicações formais.",
      "Adicione informações complementares quando disponíveis: endereço, data de nascimento, empresa, CPF/CNPJ e observações gerais.",
      "Aplique tags ao contato para classificá-lo desde o cadastro (ex.: 'Cliente', 'Fornecedor', 'Lead'). Isso facilita segmentações futuras.",
      "Clique em Salvar. O contato aparecerá na lista e poderá ser encontrado pela busca por nome, telefone ou e-mail.",
      "Para editar, localize o contato e clique sobre ele ou no botão de edição. Faça as alterações necessárias e salve novamente.",
      "Para excluir, acesse o contato, localize a opção de exclusão e confirme. Atenção: a exclusão remove o histórico de atendimentos vinculado. Prefira manter o cadastro e apenas mudar o status quando possível.",
    ],
    {
      relatedRoute: "/contatos",
      requiredPermissions: ["contacts.view"],
      featured: true,
      order: 1,
      content:
        "A base de contatos é o ativo mais valioso da operação de atendimento e marketing. Um cadastro completo e organizado permite personalizar mensagens, segmentar campanhas com precisão e recuperar rapidamente o histórico de qualquer cliente durante um atendimento.\n\nEvite duplicar contatos — o sistema pode alertar quando o telefone ou e-mail já está cadastrado. Duplicatas geram confusão no histórico e comprometem a qualidade das listas de transmissão. Se detectar uma duplicata, mantenha o cadastro mais completo e exclua o vazio.\n\nManter o cadastro atualizado é uma responsabilidade compartilhada: cada atendente que identifica uma informação nova durante a conversa deve registrá-la no painel do cliente. Pequenos hábitos de atualização constante evitam grandes esforços de limpeza de base no futuro.",
      keywords: ["contato", "cliente", "cadastrar", "editar", "excluir", "base", "telefone"],
    },
  ),

  article(
    "contatos-importar",
    "contatos",
    "Importar contatos por planilha",
    "Como carregar uma base de clientes via arquivo CSV, XLS ou XLSX com validação automática.",
    [
      "Acesse Contatos e clique na opção de importação (ícone de upload ou menu de ações).",
      "Baixe o modelo de planilha disponível na tela — ele mostra os cabeçalhos esperados: nome, telefone, e-mail, tags, etc. Preencha seus dados seguindo exatamente esse modelo.",
      "Telefones devem estar no formato internacional (ex.: 5511999999999) ou com DDD. Remova caracteres especiais como parênteses e traços da coluna de telefone.",
      "Salve a planilha no formato CSV (UTF-8) ou XLSX e clique em 'Selecionar arquivo' para fazer o upload.",
      "O sistema exibirá uma prévia com as primeiras linhas e indicará erros por linha: telefone inválido, campo obrigatório ausente, contato duplicado etc.",
      "Corrija os erros na planilha, faça novo upload ou ignore as linhas com erro e prossiga com as válidas — o sistema importa apenas os registros sem problema.",
      "Confirme a importação. O sistema processará o arquivo em segundo plano e exibirá o resultado (x contatos importados, y ignorados por duplicata, z com erro).",
      "Após a importação, filtre os novos contatos por data de criação para verificar se os dados estão corretos.",
    ],
    {
      relatedRoute: "/contatos",
      requiredPermissions: ["contacts.view"],
      order: 2,
      content:
        "A importação por planilha é o caminho mais eficiente para carregar uma base existente — seja de um sistema anterior, de um funil externo ou de uma planilha que a equipe mantinha manualmente. Em vez de cadastrar contato por contato, você sobe centenas ou milhares de registros de uma vez.\n\nA qualidade da importação depende diretamente da qualidade da planilha de origem. Dados mal formatados (telefones incompletos, caracteres especiais, campos invertidos) geram erros que precisam ser corrigidos antes de uma nova tentativa. Recomenda-se sempre revisar e higienizar a planilha antes do upload, especialmente se ela veio de uma exportação de outro sistema.\n\nContatos importados ficam disponíveis imediatamente para uso em listas de transmissão e atendimentos. Se você importou um grupo segmentado (ex.: clientes de uma campanha específica), aplique uma tag durante a importação para identificar essa origem facilmente no futuro.",
      keywords: ["importar", "planilha", "csv", "xlsx", "upload", "base", "contatos", "em-massa"],
    },
  ),

  article(
    "contatos-listas-transmissao",
    "contatos",
    "Criar e gerenciar listas de transmissão",
    "Como montar listas manuais ou segmentadas por tags, UTMs e filtros para envio em massa.",
    [
      "Acesse Contatos e clique na aba 'Listas de Transmissão'. Clique em '+ Nova lista'.",
      "Defina um nome descritivo para a lista (ex.: 'Clientes VIP Maio 2026') e uma descrição opcional que explique o critério de formação.",
      "Escolha o tipo de lista: Manual (você seleciona os contatos um a um) ou Dinâmica/Segmentada (o sistema inclui automaticamente contatos que atendem aos critérios definidos).",
      "Para listas dinâmicas, configure os filtros: tags que o contato deve ter, lógica AND (todas as tags) ou OR (qualquer uma), UTMs de origem e outros atributos disponíveis.",
      "Clique em 'Sincronizar lista' para calcular quais contatos atendem aos critérios. O sistema exibirá a contagem e permitirá visualizar quem será incluído antes de confirmar.",
      "Para listas manuais, use a busca para localizar contatos específicos e adicione-os à lista clicando no botão de inclusão.",
      "Com a lista pronta, ela pode ser usada como destinatário em disparos via WhatsApp Cloud API ou campanhas de templates. Acesse o módulo de Integrações Meta para configurar o disparo.",
      "Revise e atualize listas antes de cada uso — contatos inativados ou com telefone inválido devem ser removidos para melhorar a taxa de entrega.",
    ],
    {
      relatedRoute: "/contatos",
      requiredPermissions: ["contacts.view"],
      order: 3,
      content:
        "Listas de transmissão são a base das campanhas de comunicação em massa. Diferentemente de um grupo no WhatsApp, a transmissão envia mensagens individualmente para cada destinatário — o cliente recebe como se fosse uma mensagem direta, sem ver os outros destinatários.\n\nListas dinâmicas são especialmente poderosas porque se atualizam automaticamente com base nos critérios definidos: toda vez que um novo contato recebe a tag 'Aniversariante do Mês', por exemplo, ele entra automaticamente na lista correspondente sem intervenção manual.\n\nA efetividade de uma campanha depende da qualidade da lista. Uma lista bem segmentada — contatos que realmente têm interesse no conteúdo enviado — gera mais engajamento e menos bloqueios. Evite enviar para bases genéricas e não segmentadas, pois isso aumenta o risco de o número ser reportado como spam pela Meta.",
      keywords: ["lista", "transmissao", "disparo", "segmentacao", "tag", "utm", "campanha", "whatsapp"],
    },
  ),

  // ─── ESTOQUE ─────────────────────────────────────────────────────────────────
  article(
    "estoque-cadastrar-produto",
    "estoque",
    "Cadastrar ou editar produto",
    "Como criar produtos com SKU, fornecedor, categoria, estoque mínimo, custo e preço de venda.",
    [
      "Acesse o módulo Estoque pelo menu lateral e clique em '+ Novo produto'.",
      "Preencha o nome do produto de forma clara e padronizada — o nome aparece em relatórios, etiquetas e no PDV.",
      "Informe o código ou SKU. Se o produto possui código de barras, cadastre-o aqui para uso nas etiquetas e leituras de terminal.",
      "Selecione o fornecedor principal e a categoria do produto. Se não existirem, acesse Configurações para criar antes de continuar.",
      "Defina o estoque atual por filial: para cada unidade cadastrada, informe a quantidade disponível no momento.",
      "Informe o estoque mínimo — quando o estoque cair abaixo desse número, o sistema gerará um alerta de reposição.",
      "Preencha o preço de custo e o preço de venda. A margem de lucro será calculada automaticamente pelo sistema.",
      "Adicione fotos do produto se desejar (útil para identificação rápida no PDV e na etiqueta).",
      "Clique em Salvar. O produto estará disponível para movimentações, pedidos, transferências e vendas no PDV.",
    ],
    {
      relatedRoute: "/estoque",
      requiredPermissions: ["stock.products.manage"],
      featured: true,
      order: 1,
      content:
        "O cadastro de produtos é a fundação do controle de estoque. Cada produto bem cadastrado — com código, fornecedor, categoria, preço e estoque mínimo — permite que o sistema automatize tarefas como alertas de reposição, cálculo de margem e controle de movimentação.\n\nA padronização dos nomes é especialmente importante: produtos com nomes inconsistentes (ex.: 'Camisa P', 'Camiseta P', 'Camisa Polo P') dificultam buscas, relatórios e auditoria. Defina uma convenção de nomenclatura antes de iniciar os cadastros em massa.\n\nO estoque mínimo é uma configuração estratégica: defina-o com base no lead time do fornecedor e no volume de vendas médio. Um mínimo muito alto gera alertas constantes e desnecessários; muito baixo faz você perder vendas por falta de produto antes de conseguir repor.",
      keywords: ["produto", "cadastrar", "sku", "codigo", "fornecedor", "categoria", "estoque", "preco"],
    },
  ),

  article(
    "estoque-transferir",
    "estoque",
    "Transferir estoque entre filiais",
    "Como mover quantidades de um produto de uma unidade para outra com rastreamento completo.",
    [
      "Acesse Estoque e localize o produto que será transferido usando a busca ou filtros por categoria.",
      "Clique sobre o produto para abrir os detalhes. Verifique o saldo atual em cada filial antes de prosseguir.",
      "Clique no botão de transferência (ícone de setas ou menu de ações do produto).",
      "Selecione a filial de origem (de onde o produto sairá) e confirme que há saldo suficiente para a quantidade desejada.",
      "Selecione a filial de destino (para onde o produto irá).",
      "Informe a quantidade a transferir. O sistema valida automaticamente se a origem tem estoque suficiente.",
      "Adicione uma observação opcional (ex.: 'Reposição para campanha de fim de semana') para rastreabilidade.",
      "Confirme a transferência. O sistema atualiza instantaneamente o saldo de ambas as filiais e registra a movimentação no histórico.",
      "Acesse o histórico de movimentações para confirmar que a transferência foi registrada corretamente.",
    ],
    {
      relatedRoute: "/estoque",
      requiredPermissions: ["stock.view"],
      order: 2,
      content:
        "A transferência entre filiais é a operação usada para equilibrar o estoque quando há excesso em uma unidade e escassez em outra, ou para abastecer filiais menores a partir do estoque central.\n\nToda transferência fica registrada no histórico de movimentações com data, quantidade, origem, destino e o usuário que executou a operação. Esse rastreamento é fundamental para auditorias e para identificar onde o estoque está concentrado em determinados momentos.\n\nRecomenda-se confirmar fisicamente a chegada do produto na filial de destino antes de considerar o processo encerrado. O sistema registra a movimentação no momento da confirmação, mas divergências podem ocorrer durante o transporte físico — mantenha o hábito de comparar o registro com a contagem real ao receber.",
      keywords: ["transferir", "filial", "movimentacao", "estoque", "origem", "destino"],
    },
  ),

  article(
    "estoque-ofertas-etiquetas",
    "estoque",
    "Criar oferta de produto e imprimir etiquetas",
    "Como configurar uma promoção com preço e período e gerar etiquetas com código de barras.",
    [
      "Localize o produto no Estoque e clique sobre ele para abrir os detalhes.",
      "Para criar uma oferta, clique em 'Nova oferta' ou no ícone de promoção. Informe o preço promocional e o período de vigência (data de início e data de fim).",
      "O sistema calculará automaticamente o percentual de desconto em relação ao preço de venda padrão. Revise o valor antes de salvar.",
      "Salve a oferta. O produto passará a exibir o preço promocional durante o período configurado, inclusive no PDV.",
      "Para gerar etiquetas, localize o produto e clique em 'Imprimir etiqueta' ou na aba de etiquetas.",
      "Escolha o modelo de etiqueta (tamanho e layout). Os modelos pré-cadastrados definem o que aparece: nome, código de barras, preço, preço promocional, filial etc.",
      "Informe a quantidade de etiquetas a imprimir e confirme. O sistema gerará um PDF pronto para impressão nas dimensões corretas do modelo escolhido.",
      "Ao imprimir, use papel de etiqueta compatível com o modelo configurado. Verifique o scanner após a impressão para garantir que o código de barras está legível.",
    ],
    {
      relatedRoute: "/estoque",
      requiredPermissions: ["stock.view"],
      order: 3,
      content:
        "Ofertas e etiquetas são funcionalidades que impactam diretamente a experiência no ponto de venda. Preços promocionais configurados no sistema são aplicados automaticamente no PDV no período definido, eliminando a necessidade de ajustes manuais no caixa e reduzindo erros de precificação.\n\nEtiquetas com código de barras aceleram o processo de checkout e reduzem filas: o operador apenas passa o produto no leitor sem precisar buscar o preço manualmente. Além disso, etiquetas atualizadas com o preço correto evitam conflitos com clientes que encontram preços divergentes entre a prateleira e o caixa.\n\nPlaneje a impressão de etiquetas com antecedência ao iniciar uma campanha: etiquetas impressas e aplicadas antes da abertura da loja garantem que todos os produtos mostrem o preço correto desde o início da promoção.",
      keywords: ["oferta", "promocao", "etiqueta", "codigo de barras", "desconto", "preco", "impressao"],
    },
  ),

  article(
    "estoque-fornecedores-pedidos",
    "estoque",
    "Gerenciar fornecedores e pedidos de compra",
    "Como cadastrar fornecedores, criar pedidos de compra e dar entrada na mercadoria para atualizar o estoque.",
    [
      "Acesse Estoque e abra a aba 'Fornecedores'. Clique em '+ Novo fornecedor'.",
      "Preencha os dados do fornecedor: razão social, CNPJ, telefone, e-mail e prazo de entrega médio em dias. Salve o cadastro.",
      "Para criar um pedido de compra, acesse a aba 'Pedidos de Compra' e clique em '+ Novo pedido'.",
      "Selecione o fornecedor, a filial de destino e a data prevista de entrega.",
      "Adicione os produtos do pedido: pesquise pelo nome ou código, informe a quantidade e o preço de custo negociado. Adicione quantas linhas forem necessárias.",
      "Revise o total do pedido e salve. O status inicial será 'Aguardando recebimento'.",
      "Quando a mercadoria chegar fisicamente, acesse o pedido e clique em 'Receber pedido' ou 'Dar entrada'.",
      "Confira item por item as quantidades recebidas. Se algum produto chegou com quantidade diferente do pedido, ajuste antes de confirmar.",
      "Confirme o recebimento. O sistema atualizará automaticamente o estoque da filial com as quantidades recebidas e registrará a movimentação.",
    ],
    {
      relatedRoute: "/estoque",
      requiredPermissions: ["stock.orders.view"],
      order: 4,
      content:
        "O ciclo de compra — do pedido ao recebimento — é o principal mecanismo de entrada de estoque no sistema. Registrar os pedidos antes de receber a mercadoria cria uma ordem de compra rastreável: você sabe o que foi pedido, quando e para qual filial, e pode acompanhar o status até a confirmação da entrada.\n\nA etapa de recebimento é crítica: é ela que efetivamente aumenta o saldo de estoque no sistema. Não confirme o recebimento sem conferir fisicamente as quantidades — divergências entre o pedido e a nota fiscal do fornecedor devem ser registradas e comunicadas antes de confirmar a entrada.\n\nFornecedores bem cadastrados, com prazo de entrega informado, permitem que o sistema calcule o momento ideal de reposição. Ao cruzar o lead time do fornecedor com o estoque mínimo configurado no produto, você consegue antecipar pedidos antes que o estoque chegue a zero.",
      keywords: ["fornecedor", "pedido", "compra", "entrada", "recebimento", "estoque", "nota"],
    },
  ),

  // ─── COMERCIAL / Funil ─────────────────────────────────────────────────────────
  article(
    "crm-pipeline",
    "comercial",
    "Navegar e usar o pipeline comercial (Kanban)",
    "Como acompanhar todas as oportunidades em aberto no quadro visual de etapas do funil.",
    [
      "Acesse o módulo Comercial pelo menu lateral. A tela principal exibe o pipeline no formato Kanban — colunas representam as etapas do processo de vendas.",
      "Cada card no pipeline é uma oportunidade: contém nome do cliente, produto de interesse, valor estimado, temperatura e responsável.",
      "Use os filtros no topo para refinar a visualização: por responsável (ver apenas suas oportunidades ou as de um vendedor específico), por tag, por período de criação ou por busca textual.",
      "Para mover uma oportunidade de etapa, arraste o card da coluna atual para a coluna de destino. O sistema registra a mudança com data e hora automaticamente.",
      "Clique em um card para abrir os detalhes completos: dados do cliente, histórico de interações, notas internas, arquivos anexados e próxima ação programada.",
      "Dentro do card, registre uma nova interação clicando em '+ Interação': informe o tipo (ligação, visita, WhatsApp), o conteúdo da conversa e a próxima ação programada.",
      "Use a visão de lista (se disponível) para exportar ou visualizar muitas oportunidades de forma tabular com ordenação por coluna.",
    ],
    {
      relatedRoute: "/comercial",
      requiredPermissions: ["commercial.view"],
      featured: true,
      order: 1,
      content:
        "O pipeline Kanban é a representação visual do processo comercial da empresa. Cada coluna representa uma etapa do funil — desde o primeiro contato até o fechamento — e cada card é uma oportunidade sendo trabalhada pelo time de vendas.\n\nA visualização Kanban permite identificar rapidamente onde as oportunidades estão concentradas e onde o funil está represado. Uma coluna com muitos cards e sem movimento por vários dias é um sinal de que algo precisa de atenção: falta de seguimento, precificação inadequada ou qualificação insuficiente do lead.\n\nO Funil é mais eficaz quando atualizado em tempo real. Vendedores que registram interações e avançam cards no momento em que elas acontecem dão à gestão visibilidade precisa do funil — ao contrário de atualizações em lote realizadas apenas antes de reuniões, que distorcem a realidade do pipeline.",
      keywords: ["crm", "pipeline", "kanban", "oportunidade", "funil", "venda", "comercial"],
    },
  ),

  article(
    "crm-novo-atendimento",
    "comercial",
    "Criar ou editar uma oportunidade no funil",
    "Como cadastrar um novo atendimento comercial com cliente, produto, valor, temperatura e responsável.",
    [
      "No módulo Comercial, clique em '+ Novo atendimento' ou '+ Nova oportunidade'.",
      "No campo de cliente, pesquise pelo nome ou telefone. Se o cliente já estiver cadastrado em Contatos, selecione-o. Caso contrário, preencha os dados básicos para criar o contato simultaneamente.",
      "Selecione o funil (pipeline) ao qual essa oportunidade pertence — cada empresa pode ter múltiplos pipelines para diferentes linhas de produto ou equipes.",
      "Escolha a etapa inicial: onde no funil essa oportunidade começa? Se o cliente já demonstrou interesse ativo, inicie em uma etapa mais avançada.",
      "Informe o produto ou serviço de interesse, o valor estimado da negociação e a temperatura da oportunidade: Fria (interesse inicial), Morna (em andamento) ou Quente (próxima de fechar).",
      "Defina o responsável pela oportunidade — o vendedor que irá conduzi-la. Em times com especialização, escolha quem tem mais contexto com aquele cliente ou produto.",
      "Adicione uma nota inicial com o contexto da primeira conversa, o que o cliente mencionou e qual foi a próxima ação combinada.",
      "Salve. O card aparecerá na coluna da etapa escolhida no Kanban do funil correspondente.",
    ],
    {
      relatedRoute: "/comercial",
      requiredPermissions: ["commercial.pipeline"],
      order: 2,
      content:
        "Criar uma oportunidade é o ato de formalizar um interesse comercial no sistema. Enquanto um contato é apenas um cadastro de cliente, uma oportunidade representa uma intenção de compra sendo trabalhada — com valor, etapa, responsável e histórico próprios.\n\nA temperatura é um campo qualitativo que ajuda a priorizar esforços: oportunidades quentes precisam de atenção imediata e seguimento agressivo, enquanto as frias podem esperar por uma abordagem menos urgente. Mantenha a temperatura atualizada a cada nova interação.\n\nOportunidades sem responsável definido ou sem a próxima ação registrada tendem a ser esquecidas. Ao criar uma oportunidade, sempre defina o responsável e registre qual é o próximo passo — isso garante que o processo avance e não fique parado por falta de clareza.",
      keywords: ["oportunidade", "crm", "criar", "cadastrar", "temperatura", "responsavel", "pipeline"],
    },
  ),

  article(
    "crm-finalizar-interacao",
    "comercial",
    "Finalizar venda, registrar perda e histórico de interações",
    "Como concluir oportunidades com sucesso ou perda e manter o histórico comercial completo.",
    [
      "Abra o card da oportunidade no pipeline clicando sobre ele.",
      "Para registrar uma interação, clique em '+ Interação' ou '+ Atividade'. Selecione o tipo: Ligação, Reunião, E-mail, WhatsApp, Visita ou outro.",
      "Descreva o que foi conversado, o resultado e o que ficou combinado para o próximo passo. Quanto mais detalhado, melhor para o histórico.",
      "Defina a data e o tipo da próxima ação programada. Isso cria um lembrete visível no card e nos relatórios de pipeline.",
      "Quando a venda for fechada, clique em 'Concluir venda' ou 'Marcar como ganho'. Informe o valor final realizado, a forma de pagamento e a data do fechamento.",
      "Quando uma oportunidade não evoluir para venda, clique em 'Registrar perda' ou 'Marcar como perdido'. Informe o motivo de perda (preço, concorrente, sem orçamento, cliente desistiu etc.).",
      "O motivo de perda é um dado valioso para melhoria contínua: ao analisar perdas recorrentes por preço ou por concorrente específico, a gestão pode ajustar estratégia, precificação ou argumentação de vendas.",
      "Oportunidades finalizadas (ganhas ou perdidas) saem do pipeline ativo e vão para o histórico, mas permanecem acessíveis via relatórios.",
    ],
    {
      relatedRoute: "/comercial",
      requiredPermissions: ["commercial.pipeline"],
      order: 3,
      content:
        "O histórico de interações é a memória comercial da empresa. Ele registra cada ponto de contato com o cliente — quando foi abordado, o que foi discutido, por quem e com qual resultado. Sem esse registro, cada novo vendedor que assumir a conta precisará reaprender o contexto do zero.\n\nFinalizar oportunidades corretamente — seja como venda ou perda — é fundamental para a precisão dos relatórios. Oportunidades que ficam abertas indefinidamente sem movimentação distorcem a taxa de conversão, o volume do funil e as previsões de receita.\n\nOs motivos de perda são os dados mais subaproveitados do funil. Analisados em conjunto, eles revelam padrões claros: se 40% das perdas são por preço, talvez o posicionamento precise de ajuste. Se 30% são para um concorrente específico, a equipe precisa de argumentos para esse confronto direto. Incentive os vendedores a preencher os motivos com honestidade.",
      keywords: ["finalizar", "venda", "perda", "interacao", "historico", "ganho", "perdido", "motivo"],
    },
  ),

  article(
    "crm-relatorios-configuracoes",
    "comercial",
    "Dashboard comercial, relatórios e configurações do funil",
    "Como acompanhar KPIs de vendas, exportar relatórios e configurar pipelines, etapas e produtos.",
    [
      "No módulo Comercial, acesse a aba 'Dashboard' para ver os KPIs do período: volume de oportunidades criadas, ganhas, perdidas, valor em aberto e taxa de conversão.",
      "Use os filtros de período e responsável para comparar o desempenho por vendedor, equipe ou intervalo de tempo.",
      "Acesse 'Relatórios' para visualizar a tabela detalhada de todas as oportunidades com status, valor, responsável e data. Use os filtros avançados para isolar os dados necessários.",
      "Exporte o relatório em CSV para análise em planilha externa quando necessário.",
      "Para configurar o funil, acesse a aba 'Configurações' dentro do módulo Comercial.",
      "Em Configurações, crie novos funis (pipelines) para separar equipes ou linhas de produto. Cada funil tem suas próprias etapas.",
      "Crie as etapas de cada pipeline com nome e ordem. Exemplos: Prospecção → Qualificação → Proposta → Negociação → Fechamento.",
      "Cadastre os produtos comerciais usados nas oportunidades — isso permite filtrar e agrupar resultados por produto nos relatórios.",
      "Defina restrições de acesso ao pipeline quando necessário: um vendedor pode ver apenas suas próprias oportunidades, enquanto o gerente vê todas.",
    ],
    {
      relatedRoute: "/comercial",
      requiredPermissions: ["commercial.view"],
      order: 4,
      content:
        "O Dashboard comercial transforma os dados do funil em inteligência de negócio. Taxa de conversão, tempo médio em cada etapa, valor médio de fechamento e ranking de vendedores são indicadores que, lidos juntos, revelam a saúde do processo comercial e onde a energia da equipe deve ser concentrada.\n\nA configuração do funil — etapas, pipelines, produtos — define a estrutura sobre a qual toda a operação comercial se apoia. Mudanças nessa configuração afetam como as oportunidades são organizadas e como os dados aparecem nos relatórios. Por isso, as etapas devem refletir fielmente o processo real de vendas da empresa, não um processo idealizado.\n\nA separação por pipelines é útil quando há equipes ou processos muito distintos (ex.: pipeline de novos clientes versus pipeline de renovação). Misturar oportunidades de naturezas diferentes em um único pipeline torna os relatórios menos precisos e dificulta a análise por segmento.",
      keywords: ["dashboard", "relatorio", "configuracoes", "pipeline", "etapa", "produto", "crm", "kpi"],
    },
  ),

  // ─── CONFIGURAÇÕES ───────────────────────────────────────────────────────────
  article(
    "config-mensagens-tags",
    "configuracoes",
    "Configurar mensagens rápidas e tags",
    "Como cadastrar respostas padronizadas para o chat e criar classificações para contatos e atendimentos.",
    [
      "Acesse Configurações pelo menu lateral.",
      "Clique na aba 'Mensagens Rápidas'. Você verá a lista de mensagens já cadastradas. Clique em '+ Nova mensagem'.",
      "Defina o nome do atalho (sem espaços, ex.: 'horario', 'politica_troca'). Esse é o termo que o atendente digitará após / no chat para encontrar a mensagem.",
      "Escreva o conteúdo completo da mensagem no campo de texto. Você pode usar variáveis dinâmicas como {nome_cliente} se o sistema suportar — verifique a documentação ou tooltip da tela.",
      "Salve a mensagem. Ela ficará disponível imediatamente para todos os atendentes no campo de chat.",
      "Para editar ou excluir uma mensagem existente, clique na linha correspondente e use as ações disponíveis.",
      "Para configurar Tags, clique na aba 'Tags'. Clique em '+ Nova tag' e informe o nome e a cor de identificação.",
      "Tags criadas ficam disponíveis no painel do cliente (durante o atendimento) e na área de Contatos para classificação e segmentação.",
      "Revise periodicamente as mensagens rápidas e tags — remova as desatualizadas e atualize textos que possam ter mudado de política ou precificação.",
    ],
    {
      relatedRoute: "/settings",
      requiredPermissions: ["settings.view"],
      featured: true,
      order: 1,
      content:
        "Mensagens rápidas e tags são os dois recursos de padronização mais usados no dia a dia da operação. Mensagens rápidas garantem que informações críticas — preços, políticas, instruções — sejam comunicadas de forma precisa e consistente, independentemente de qual atendente está em turno. Tags organizam a base de contatos de maneira que permite segmentação para campanhas e análise de perfil de cliente.\n\nA manutenção dessas configurações é responsabilidade de quem tem acesso de administrador às configurações do sistema. Um bom processo é revisar mensagens rápidas toda vez que uma política muda (ex.: novo prazo de entrega, novo horário de atendimento) para evitar que atendentes enviem informações desatualizadas.\n\nTags funcionam melhor quando há um padrão definido pela empresa. Equipes sem critério claro de tagueamento acabam com dezenas de tags redundantes (ex.: 'cliente vip', 'VIP', 'Cliente VIP'), o que prejudica os filtros e a qualidade das listas de transmissão.",
      keywords: ["mensagem", "rapida", "tag", "classificacao", "configuracoes", "padrao"],
    },
  ),

  article(
    "config-filiais-categorias",
    "configuracoes",
    "Configurar filiais e categorias de produto",
    "Como criar e gerenciar unidades do negócio e organizar produtos por categoria para relatórios e estoque.",
    [
      "Acesse Configurações e clique na aba 'Filiais'.",
      "Para criar uma nova filial, clique em '+ Nova filial'. Informe o nome, CNPJ (se diferente da matriz), endereço e telefone.",
      "Defina qual filial é a principal (matriz). A filial principal é usada como padrão em operações que não especificam uma unidade.",
      "Salve. A nova filial ficará disponível como opção em transferências de estoque, pedidos de compra e cadastro de produtos.",
      "Para editar uma filial existente, clique sobre ela e atualize as informações necessárias.",
      "Para excluir uma filial, o sistema verificará se há movimentações vinculadas. Se houver, será solicitado que você remapeie os dados para outra filial antes de confirmar a exclusão.",
      "Para configurar Categorias de produto, clique na aba 'Categorias'.",
      "Clique em '+ Nova categoria', informe o nome (ex.: 'Eletrônicos', 'Vestuário', 'Alimentos') e salve.",
      "Categorias criadas ficam disponíveis no cadastro de produtos e nos filtros de relatório de estoque. Use hierarquia de nomes quando necessário (ex.: 'Vestuário / Masculino').",
    ],
    {
      relatedRoute: "/settings",
      requiredPermissions: ["settings.view"],
      order: 2,
      content:
        "Filiais e categorias são configurações estruturais que impactam como o estoque e os relatórios são organizados. Uma empresa com múltiplas unidades precisa de filiais corretamente cadastradas para rastrear onde cada produto está e para separar indicadores por unidade.\n\nCategorias de produto servem a dois propósitos: organização visual no cadastro e segmentação em relatórios. Com categorias bem definidas, é possível filtrar o estoque por linha de produto, identificar quais categorias estão com giro mais alto ou em queda, e planejar pedidos por segmento.\n\nEvite criar muitas categorias granulares no início — comece com as grandes divisões do portfólio e subdivida apenas quando houver necessidade real de análise separada. Categorias demais criam confusão no momento do cadastro de produtos e na leitura dos relatórios.",
      keywords: ["filial", "unidade", "categoria", "produto", "configuracoes", "matriz"],
    },
  ),

  article(
    "config-webhook-ia-nps",
    "configuracoes",
    "Configurar webhook, IA e NPS",
    "Como verificar a URL de integração, personalizar o prompt da IA de atendimento e gerenciar perguntas do NPS.",
    [
      "Acesse Configurações e clique na aba 'Integrações' ou 'Webhook'.",
      "Copie a URL do webhook exibida. Essa URL é única para a sua conta e deve ser configurada no sistema externo (ERP, e-commerce, plataforma de automação) que enviará eventos para o sistema.",
      "O status do webhook indica se as últimas requisições foram recebidas com sucesso. Em caso de falha, verifique se a URL no sistema externo está correta e se não há bloqueio de rede.",
      "Para configurar a IA, clique na aba 'IA' ou 'Assistente'.",
      "No campo de prompt, escreva as instruções que definem o comportamento da IA: tom de voz, restrições de assunto, informações sobre a empresa, produtos e políticas. Seja específico — a qualidade das respostas da IA depende diretamente da clareza do prompt.",
      "Salve o prompt. Você pode testá-lo iniciando um atendimento de teste e observando como a IA responde.",
      "Para configurar o NPS, clique na aba 'NPS'.",
      "Clique em '+ Nova pergunta', escreva o texto da pergunta e defina a ordem de exibição.",
      "Use o botão de prévia para simular como o cliente verá a pesquisa antes de publicar.",
      "Reordene perguntas arrastando-as e salve. As perguntas configuradas serão exibidas na URL pública de NPS que você compartilha com clientes.",
    ],
    {
      relatedRoute: "/settings",
      requiredPermissions: ["settings.view"],
      order: 3,
      content:
        "Essas três configurações — webhook, IA e NPS — são funcionalidades avançadas que, quando bem configuradas, elevam significativamente a capacidade operacional do sistema.\n\nO webhook permite que sistemas externos (ERPs, e-commerces, plataformas de automação) se comuniquem com o sistema em tempo real. Por exemplo: um pedido aprovado em um e-commerce pode automaticamente criar um atendimento ou notificar a equipe via webhook. A URL é o ponto de entrada dessas notificações.\n\nA IA de atendimento usa o prompt configurado como base de conhecimento e tom de voz. Um prompt bem escrito — com informações sobre horários, políticas, produtos e linguagem esperada — faz a IA funcionar como um atendente bem treinado, reduzindo o esforço humano em dúvidas repetitivas.\n\nO NPS (Net Promoter Score) mede a satisfação e a lealdade dos clientes por meio de perguntas simples. As respostas coletadas permitem identificar promotores (clientes satisfeitos), neutros e detratores (clientes insatisfeitos), orientando ações de retenção e melhoria de produto.",
      keywords: ["webhook", "integracao", "ia", "prompt", "nps", "satisfacao", "configuracoes"],
    },
  ),

  // ─── INTEGRAÇÕES META ────────────────────────────────────────────────────────
  article(
    "meta-whatsapp-templates",
    "integracoes-meta",
    "Gerenciar WhatsApp Cloud API e templates de mensagem",
    "Como conectar o WhatsApp Business, criar templates aprovados pela Meta e disparar mensagens ativas.",
    [
      "Acesse o módulo 'Gestão da Meta' pelo menu lateral.",
      "Na aba WhatsApp, verifique se a integração está ativa. Se o status mostrar erro ou desconectado, clique em 'Reconectar' e siga as instruções de autenticação com sua conta Meta Business.",
      "Para criar um template, acesse a aba 'Templates' e clique em '+ Novo template'.",
      "Defina o nome do template (apenas letras minúsculas, números e underscores — sem espaços), o idioma e a categoria (Utilitário, Marketing ou Autenticação).",
      "Monte a estrutura do template: Cabeçalho (texto, imagem, vídeo ou documento), Corpo da mensagem (texto principal com variáveis {{1}}, {{2}} etc.) e Rodapé (texto menor opcional).",
      "Adicione botões se necessário: Resposta rápida, URL ou Telefone. Cada template pode ter até 3 botões.",
      "Salve e envie para aprovação da Meta. O processo de aprovação leva geralmente de alguns minutos a algumas horas.",
      "Após aprovado, o template fica disponível para uso em disparos individuais ou em lote via listas de transmissão.",
      "Para disparo em lote, acesse a aba de envio em massa, selecione o template, a lista de transmissão e o mapeamento de variáveis (como {nome_cliente}). Confirme antes de disparar.",
    ],
    {
      relatedRoute: "/meta-management",
      requiredPermissions: ["settings.api_meta"],
      order: 1,
      content:
        "A integração com o WhatsApp Cloud API permite que o sistema envie mensagens ativas para clientes — ao contrário do WhatsApp comum, onde apenas o cliente inicia a conversa fora da janela de 24 horas. Com a Cloud API, sua empresa pode iniciar contatos proativos usando templates aprovados pela Meta.\n\nTemplates são necessários para qualquer mensagem enviada fora da janela de 24 horas após a última mensagem do cliente. A aprovação da Meta garante que o conteúdo segue as políticas da plataforma. Templates reprovados precisam ser revisados e reenviados para aprovação.\n\nO disparo em lote via lista de transmissão é a funcionalidade mais poderosa: em vez de enviar mensagens uma a uma, você seleciona um template, uma lista de contatos e o sistema envia automaticamente para todos, substituindo as variáveis pelo dado real de cada contato (nome, valor, produto etc.).",
      keywords: ["whatsapp", "template", "cloud api", "meta", "disparo", "transmissao", "aprovacao"],
    },
  ),

  article(
    "meta-ads-instagram",
    "integracoes-meta",
    "Consultar Meta Ads e Instagram",
    "Como acompanhar o desempenho de campanhas de anúncio e métricas do Instagram conectado.",
    [
      "Acesse 'Gestão da Meta' e clique na aba 'Meta Ads'.",
      "Selecione a conta de anúncios que deseja analisar (se houver mais de uma conectada).",
      "Defina o período de análise usando o seletor de datas no topo.",
      "Visualize as campanhas ativas e pausadas com seus respectivos indicadores: impressões, cliques, CTR (taxa de clique), CPC (custo por clique) e gasto total.",
      "Clique em uma campanha para expandir e ver os conjuntos de anúncios e os criativos individuais, com métricas detalhadas por anúncio.",
      "Use a aba 'Instagram' para acompanhar o perfil conectado: resumo de seguidores, alcance, impressões e engajamento.",
      "Em 'Mídias', veja as publicações mais recentes com métricas por post: curtidas, comentários, salvamentos e alcance.",
      "Em 'Comentários', gerencie os comentários das publicações diretamente pelo sistema — responda, oculte ou marque como lido sem precisar sair da plataforma.",
      "Use os filtros de período para comparar desempenho entre semanas, meses ou campanhas específicas.",
    ],
    {
      relatedRoute: "/meta-management",
      requiredPermissions: ["settings.api_meta"],
      order: 2,
      content:
        "A integração com Meta Ads e Instagram traz para dentro do sistema os dados de marketing pago e orgânico da empresa, eliminando a necessidade de alternar entre o Gerenciador de Anúncios da Meta e o sistema operacional para tomar decisões.\n\nA análise de campanhas dentro do sistema permite cruzar dados de marketing com dados de atendimento: se uma campanha gerou um pico de conversas no chat, o dado fica visível em ambos os contextos. Esse cruzamento ajuda a entender o custo real de aquisição por atendimento e por venda.\n\nGerenciar comentários do Instagram pelo sistema é especialmente útil para equipes que precisam responder rapidamente. Comentários sem resposta em posts de produto são oportunidades de atendimento perdidas — a centralização no sistema permite que a equipe de atendimento gerencie comentários junto com as demais filas de conversa.",
      keywords: ["meta ads", "instagram", "campanha", "anuncio", "ctr", "cpc", "midia", "comentarios"],
    },
  ),

  // ─── USUÁRIOS E PERMISSÕES ───────────────────────────────────────────────────
  article(
    "usuarios-equipe",
    "usuarios",
    "Criar, editar e gerenciar usuários e permissões",
    "Como adicionar novos colaboradores, configurar o que cada um pode acessar e respeitar o limite do plano.",
    [
      "Acesse 'Gestão de Equipe' pelo menu lateral.",
      "Verifique o contador de usuários ativos no topo: ele mostra quantos usuários sua conta já tem e qual é o limite do plano atual.",
      "Para criar um novo usuário, clique em '+ Novo usuário'.",
      "Preencha o nome completo, o e-mail de acesso e defina uma senha temporária. O usuário deverá alterar a senha no primeiro acesso.",
      "Na seção de permissões, marque cada módulo e ação que esse colaborador deve poder executar. Siga o princípio do menor privilégio: libere apenas o que a função exige.",
      "Exemplos de configuração por perfil: Atendente (chat.view, contacts.view); Vendedor (commercial.view, commercial.pipeline); Estoquista (stock.view, stock.products.manage); Financeiro (financial.manage); Administrador (todas as permissões).",
      "Salve. O usuário receberá um e-mail de boas-vindas com as instruções de acesso.",
      "Para editar permissões de um usuário existente, clique sobre o usuário na lista, ajuste as permissões e salve.",
      "Para desativar um usuário que saiu da empresa (sem excluir o histórico), clique em 'Desativar'. O usuário perderá acesso mas seus dados e atendimentos permanecem no sistema.",
    ],
    {
      relatedRoute: "/usuarios",
      requiredPermissions: ["users.manage"],
      featured: true,
      content:
        "A gestão de usuários é uma das configurações mais sensíveis do sistema. Permissões mal configuradas — seja por excesso (liberar mais do que necessário) ou por falta (bloquear o que o colaborador precisa para trabalhar) — causam problemas de segurança ou travamentos operacionais.\n\nO princípio do menor privilégio é a melhor prática: cada usuário deve ter acesso somente ao que sua função exige. Isso reduz o risco de alterações acidentais em áreas que o colaborador não deveria modificar e facilita a auditoria de ações no sistema.\n\nAo desligar um colaborador, desative o usuário imediatamente — antes mesmo de devolver equipamentos. Manter um usuário ativo após o desligamento representa um risco de segurança. A desativação preserva todo o histórico (atendimentos, vendas, registros) sem excluí-lo, o que é importante para continuidade operacional e auditoria.",
      keywords: ["usuario", "permissao", "equipe", "acesso", "perfil", "colaborador", "criar", "editar"],
    },
  ),

  // ─── FINANCEIRO ──────────────────────────────────────────────────────────────
  article(
    "financeiro-dashboard-contas",
    "financeiro",
    "Dashboard financeiro, contas a pagar e contas a receber",
    "Como visualizar o resultado financeiro e registrar títulos de pagamento e recebimento.",
    [
      "Acesse o módulo Financeiro pelo menu lateral.",
      "O Dashboard financeiro carrega automaticamente os indicadores do período atual: saldo total, receitas, despesas, resultado líquido e inadimplência.",
      "Use o seletor de período para ajustar a visão: dia, semana, mês ou intervalo personalizado.",
      "Para criar um novo título a pagar, clique em 'Contas a Pagar' e depois em '+ Novo lançamento'.",
      "Preencha: descrição, fornecedor ou beneficiário, valor, data de vencimento, categoria e conta bancária de pagamento.",
      "Salve. O título aparecerá na lista com status 'Em aberto'. No vencimento, registre o pagamento clicando em 'Pagar' e informando a data e forma de pagamento efetiva.",
      "Para contas a receber, acesse 'Contas a Receber' e clique em '+ Novo lançamento'. Preencha cliente, valor, vencimento e categoria.",
      "Quando o cliente pagar, localize o título e clique em 'Receber', informando data e forma de recebimento. O status muda para 'Liquidado'.",
      "Títulos vencidos e não pagos ficam marcados como 'Vencido' e aparecem em destaque nos alertas. Acompanhe diariamente para não perder vencimentos.",
    ],
    {
      relatedRoute: "/financeiro",
      requiredPermissions: ["financial.manage"],
      featured: true,
      order: 1,
      content:
        "O módulo financeiro centraliza o controle de entradas e saídas da empresa. Ao registrar títulos a pagar e a receber, você cria uma visão prospectiva do fluxo de caixa — sabendo antecipadamente quais pagamentos estão por vir e quais recebimentos estão previstos.\n\nO Dashboard financeiro mostra a realidade do momento: quanto já entrou, quanto já saiu e qual é o saldo atual. Combinado com os títulos em aberto, ele oferece uma projeção do que está por vir — essencial para decisões de investimento, compras e contratações.\n\nO controle de inadimplência — clientes que não pagaram no vencimento — é tão importante quanto o registro de novos recebimentos. Títulos vencidos ignorados distorcem o fluxo de caixa e podem gerar surpresas negativas. Defina uma rotina de cobrança para títulos em atraso.",
      keywords: ["financeiro", "pagar", "receber", "dashboard", "titulo", "fluxo", "caixa", "vencimento"],
    },
  ),

  article(
    "financeiro-lancamentos-categorias-alertas",
    "financeiro",
    "Lançamentos, categorias financeiras e alertas",
    "Como consultar o extrato de movimentações, organizar receitas e despesas por categoria e monitorar alertas.",
    [
      "Acesse Financeiro e clique na aba 'Lançamentos'.",
      "A tela exibe o extrato de todas as movimentações registradas: entradas (positivas) e saídas (negativas), com data, descrição, categoria e valor.",
      "Use os filtros disponíveis: período, tipo (receita/despesa), categoria, status (liquidado/em aberto/vencido) e conta bancária.",
      "Para categorizar adequadamente os lançamentos, acesse a aba 'Categorias'. Clique em '+ Nova categoria' e defina nome e tipo (Receita ou Despesa).",
      "Exemplos de categorias de receita: 'Vendas PDV', 'Assinaturas', 'Serviços'. Exemplos de despesas: 'Fornecedores', 'Folha de pagamento', 'Aluguel', 'Marketing'.",
      "Com categorias bem definidas, os gráficos do Dashboard financeiro ficam mais informativos, mostrando quais categorias concentram mais gastos ou mais receitas.",
      "Para monitorar alertas, acesse a aba 'Alertas'. O sistema gera alertas automáticos para: títulos vencidos, saldo baixo em conta e metas financeiras atingidas.",
      "Clique em cada alerta para ver os detalhes e a ação recomendada. Marque como lido após resolver ou ciência do alerta.",
      "Revise os alertas diariamente — ignorar alertas acumulados reduz a utilidade do recurso e pode fazer você perder avisos críticos.",
    ],
    {
      relatedRoute: "/financeiro",
      requiredPermissions: ["financial.manage"],
      order: 2,
      content:
        "Lançamentos são o registro histórico de toda movimentação financeira. Um extrato completo e bem categorizado é a base para análise de custos, planejamento orçamentário e prestação de contas — seja internamente para a gestão ou externamente para contador e sócios.\n\nCategorias financeiras transformam uma lista genérica de movimentações em informação estruturada. Com categorias consistentes, é possível responder perguntas como 'quanto gastamos com marketing esse mês?' ou 'qual é o crescimento de receita de serviços nos últimos 3 meses?' sem precisar de planilhas externas.\n\nAlertas automáticos funcionam como um copiloto financeiro: eles sinalizam situações que precisam de atenção antes que se tornem problemas maiores. Um alerta de título vencido ignorado por dias vira uma dívida em atraso; um alerta de saldo baixo antecipado dá tempo de providenciar cobertura antes do vencimento de um compromisso.",
      keywords: ["lancamentos", "extrato", "categoria", "alerta", "financeiro", "despesa", "receita"],
    },
  ),

  article(
    "financeiro-comissoes-assinaturas",
    "financeiro",
    "Comissões de vendedores e assinaturas recorrentes",
    "Como cadastrar metas por usuário, finalizar comissões mensais e controlar serviços com cobrança recorrente.",
    [
      "Acesse Financeiro e clique na aba 'Comissões'.",
      "Para cadastrar uma meta, clique em '+ Nova comissão' ou '+ Nova meta'. Selecione o usuário (vendedor), o mês de referência e o valor ou percentual de meta.",
      "O sistema pode calcular a comissão automaticamente com base nas vendas do funil vinculadas ao usuário no período, se essa integração estiver configurada.",
      "Ao final do mês, acesse as comissões do período encerrado e clique em 'Finalizar mês'. Isso congela os dados e gera o valor de comissão a pagar.",
      "O valor de comissão gerado pode ser lançado automaticamente como conta a pagar para o colaborador.",
      "Para gerenciar assinaturas recorrentes (serviços que sua empresa presta ou contrata com cobrança mensal), acesse a aba 'Assinaturas'.",
      "Clique em '+ Nova assinatura'. Informe o cliente ou fornecedor, a descrição do serviço, o valor, a periodicidade (mensal, trimestral, anual) e a data de início.",
      "O sistema gerará automaticamente os títulos futuros com base na periodicidade definida, facilitando o controle de recorrências.",
      "Para encerrar uma assinatura, acesse-a e clique em 'Inativar'. Os títulos futuros serão cancelados automaticamente.",
    ],
    {
      relatedRoute: "/financeiro",
      requiredPermissions: ["financial.manage"],
      order: 3,
      content:
        "O controle de comissões no sistema conecta o desempenho de vendas ao financeiro: vendedores que fecham mais negócios no funil geram comissões que precisam ser calculadas com precisão e pagas no prazo. Automatizar esse cálculo elimina disputas e erros que surgem de planilhas manuais.\n\nMetas bem definidas — com valor claro e período fechado — também funcionam como motivação para a equipe comercial. Quando o vendedor sabe exatamente o que precisa vender para atingir sua comissão, o comportamento de trabalho se orienta de forma mais eficiente.\n\nAssinaturas recorrentes são especialmente úteis para empresas que vendem serviços ou contratos mensais. Em vez de criar um título novo manualmente todo mês, a assinatura gera os títulos automaticamente, garantindo que nenhum recebimento seja esquecido e que o fluxo de caixa futuro seja previsível.",
      keywords: ["comissao", "meta", "vendedor", "assinatura", "recorrente", "mensal", "financeiro"],
    },
  ),

  // ─── ASSINATURA E SUPORTE ────────────────────────────────────────────────────
  article(
    "assinatura-planos",
    "assinatura",
    "Gerenciar plano, add-ons e pagamentos",
    "Como ver o plano atual, comparar opções, contratar add-ons e consultar o histórico de faturas.",
    [
      "Acesse 'Planos e Suporte' pelo menu lateral.",
      "Na tela inicial, você verá o resumo do plano atual: nome, ciclo (mensal ou anual), data de renovação, usuários ativos e limites utilizados.",
      "Para comparar planos, clique em 'Ver planos' ou 'Trocar plano'. A tela de comparação exibe os recursos disponíveis em cada nível lado a lado.",
      "Selecione o plano desejado e o ciclo de cobrança. Planos anuais geralmente oferecem desconto em relação ao mensal.",
      "Clique em 'Contratar' ou 'Fazer upgrade'. Você será direcionado para o checkout onde informará os dados de pagamento (cartão de crédito ou boleto).",
      "Após a confirmação, o plano é ativado imediatamente. Se for um upgrade, o valor proporcional ao período restante já pago é descontado.",
      "Para contratar um add-on (recurso adicional), localize a seção de Add-ons e clique em 'Adicionar'. Cada add-on tem descrição de funcionalidade e custo adicional.",
      "Para consultar faturas anteriores, acesse 'Histórico de pagamentos'. Você pode baixar o PDF de cada fatura para envio à contabilidade.",
    ],
    {
      relatedRoute: "/assinatura",
      requiredPermissions: ["financial.manage"],
      order: 1,
      content:
        "O gerenciamento de plano e pagamentos é onde você controla o acesso a funcionalidades e os custos da plataforma. Entender os limites do plano atual — número de usuários, canais conectados, funcionalidades disponíveis — é essencial para planejar o crescimento da operação sem surpresas de bloqueio.\n\nAdd-ons permitem expandir capacidades específicas sem mudar de plano integralmente. Se sua operação precisa de mais usuários ou de um canal adicional de WhatsApp mas não precisa de todos os recursos do plano superior, contratar somente o add-on relevante pode ser mais econômico.\n\nManter o histórico de faturas organizado facilita a prestação de contas à contabilidade e o acompanhamento de custos de software no fluxo financeiro da empresa. Baixe os PDFs das faturas mensalmente e armazene junto à documentação fiscal.",
      keywords: ["plano", "assinatura", "add-on", "fatura", "pagamento", "upgrade", "planos"],
    },
  ),

  article(
    "assinatura-suporte",
    "assinatura",
    "Solicitar suporte técnico ou enviar uma sugestão",
    "Como acionar o time de suporte para problemas técnicos e como enviar ideias de melhoria para o sistema.",
    [
      "Acesse 'Planos e Suporte' pelo menu lateral.",
      "Para abrir um chamado de suporte, clique em 'Suporte técnico' ou no botão de ajuda.",
      "No formulário, descreva o problema com o máximo de detalhes: qual funcionalidade está com erro, o que você tentou fazer, o que apareceu na tela (mensagem de erro, comportamento inesperado) e em qual navegador/dispositivo você está.",
      "Se possível, anexe uma captura de tela ou vídeo do problema. Isso acelera significativamente o diagnóstico pela equipe de suporte.",
      "Informe o nível de urgência: Crítico (sistema parado, operação bloqueada), Alto (funcionalidade importante com erro) ou Normal (dúvida ou ajuste menor).",
      "Envie e anote o número do chamado gerado. O retorno ocorrerá pelo canal definido (e-mail ou WhatsApp) conforme o SLA do seu plano.",
      "Para enviar uma sugestão de melhoria, clique em 'Sugestão' ou 'Feedback'. Descreva a ideia, o problema que ela resolveria e como você imagina que funcionaria.",
      "Sugestões são analisadas pela equipe de produto e podem ser implementadas em versões futuras — especialmente quando múltiplos clientes solicitam a mesma melhoria.",
    ],
    {
      relatedRoute: "/assinatura",
      requiredPermissions: ["financial.manage"],
      order: 2,
      content:
        "O suporte técnico é o canal oficial para resolver problemas que impedem ou dificultam o uso do sistema. Chamados bem descritos — com contexto claro, passos para reproduzir o problema e evidências visuais — são resolvidos muito mais rápido do que relatos vagos como 'o sistema não está funcionando'.\n\nO nível de urgência impacta a priorização pelo time de suporte. Reserve a classificação 'Crítico' para situações em que a operação está de fato parada — não para inconveniências ou preferências. Isso garante que quem está com problema crítico real receba atendimento prioritário.\n\nSugestões de melhoria são o principal insumo para a evolução do produto. A equipe de desenvolvimento analisa as solicitações recorrentes para priorizar o roadmap. Se você identificou uma maneira de fazer o sistema funcionar melhor para a sua operação, não hesite em registrar — sua sugestão pode beneficiar toda a base de usuários.",
      keywords: ["suporte", "sugestao", "chamado", "ajuda", "problema", "feedback", "melhoria"],
    },
  ),

  // ─── RH / PONTO ──────────────────────────────────────────────────────────────
  article(
    "rh-registrar-ponto",
    "rh",
    "Registrar ponto e consultar o calendário de horas",
    "Como bater o ponto de entrada e saída, ver o saldo de horas do dia e acompanhar o histórico do mês.",
    [
      "Acesse o módulo 'RH / Ponto' pelo menu lateral.",
      "A tela principal exibe o calendário do mês atual. Cada dia é representado por uma célula que mostra o status do ponto: completo (verde), incompleto (amarelo), faltante (vermelho) ou feriado/folga (cinza).",
      "Para registrar o ponto do dia atual, clique no dia de hoje no calendário e depois em 'Registrar ponto'.",
      "Confirme o registro. O sistema salva automaticamente a data, hora exata e a localização (se habilitada). O registro é imutável após confirmação — não é possível alterá-lo depois.",
      "Repita o processo para cada batida: entrada, intervalo de almoço (saída e retorno) e saída. O número de batidas depende da configuração do horário cadastrado para o seu perfil.",
      "Ao fim do dia, volte ao calendário e clique no dia para ver o resumo: horas trabalhadas, horas previstas e saldo do dia (positivo ou negativo).",
      "Clique nos dias anteriores para revisar o histórico. Dias com saldo negativo precisam de justificativa ou compensação.",
      "Em caso de esquecimento de alguma batida, use a funcionalidade de justificativa (artigo 'Enviar e analisar justificativas') para comunicar o gestor.",
    ],
    {
      relatedRoute: "/rh/ponto",
      requiredPermissions: ["rh.point.register"],
      featured: true,
      order: 1,
      content:
        "O controle de ponto digital substitui o ponto em papel ou o cartão físico, centralizando os registros de todos os colaboradores em um único sistema acessível em tempo real pela gestão.\n\nCada registro de ponto é um evento timestampado e imutável — ele não pode ser editado pelo próprio usuário após a confirmação, o que garante a integridade do controle. Alterações só podem ser feitas pelo gestor através da edição de ponto, com rastreamento de quem fez a mudança.\n\nO calendário visual permite que cada colaborador acompanhe seu próprio histórico de presença, saldo de horas e pendências sem precisar acionar o RH. Isso promove autonomia e reduz dúvidas recorrentes sobre saldo de horas extras, atrasos e banco de horas.",
      keywords: ["ponto", "registro", "hora", "calendario", "entrada", "saida", "jornada"],
    },
  ),

  article(
    "rh-justificativas",
    "rh",
    "Enviar justificativas e análise pelo gestor",
    "Como colaborador solicita aprovação de ausência ou ponto perdido e como o gestor aprova ou reprova.",
    [
      "Como colaborador, acesse 'RH / Ponto' e clique no dia que precisa ser justificado.",
      "Clique em 'Justificar este dia' ou 'Nova justificativa'.",
      "Selecione o tipo de justificativa: Falta justificada, Ponto esquecido, Atestado médico, Day-off, Férias ou outro tipo disponível.",
      "Informe o período da justificativa (pode abranger mais de um dia) e escreva uma descrição clara do motivo.",
      "Se houver documentação de suporte (atestado, declaração), anexe o arquivo em PDF, JPG ou PNG.",
      "Envie a justificativa. Ela ficará com status 'Aguardando aprovação' até que o gestor analise.",
      "Como gestor, acesse 'Gestão de RH' > 'Justificativas'. Você verá todas as solicitações pendentes da equipe.",
      "Clique em uma justificativa para ver os detalhes, o período, o texto e os anexos enviados.",
      "Clique em 'Aprovar' para aceitar a justificativa (o dia será marcado como regularizado no ponto) ou em 'Reprovar' informando o motivo da reprovação.",
      "O colaborador receberá a notificação do resultado e o status do dia no calendário será atualizado.",
    ],
    {
      relatedRoute: "/rh/ponto",
      requiredPermissions: ["rh.point.register"],
      order: 2,
      content:
        "Justificativas são o mecanismo de regularização de ocorrências no ponto — faltas por motivo de doença, ponto esquecido por trabalho externo ou ausência programada não registrada previamente. Elas criam um fluxo formal de comunicação entre colaborador e gestor, com rastreamento e anexos.\n\nA exigência de justificativa aprovada — em vez de simplesmente ignorar o ponto faltante — garante que o controle de presença seja levado a sério pela equipe e que o gestor tenha ciência de todas as ausências. Isso também protege o colaborador: uma justificativa aprovada evita descontos indevidos na folha.\n\nGestores devem analisar justificativas com agilidade, especialmente as de atestado médico que podem envolver prazo legal de apresentação. Justificativas acumuladas sem análise geram incerteza para o colaborador e distorcem os relatórios de presença da equipe.",
      keywords: ["justificativa", "falta", "atestado", "aprovacao", "gestor", "ponto", "ausencia"],
    },
  ),

  article(
    "rh-gestao",
    "rh",
    "Gestão de RH: horários, feriados, férias, day-off e relatórios",
    "Como o administrador configura jornadas, registra feriados, aprova férias e gera relatórios de ponto.",
    [
      "Acesse 'Gestão de RH' pelo menu lateral (disponível apenas para perfis com permissão de gestão).",
      "Na aba 'Funcionários', localize o colaborador desejado usando a busca por nome.",
      "Clique no colaborador para editar: defina o horário de trabalho (turno, horas diárias, dias da semana) e o tipo de contrato.",
      "Na aba 'Horários', configure os horários padrão disponíveis para a empresa (ex.: Comercial 08h-18h, Turno Tarde 13h-22h). Esses horários são atribuídos individualmente a cada colaborador.",
      "Na aba 'Feriados', cadastre os feriados nacionais, estaduais e municipais relevantes para a empresa. Dias marcados como feriado não contam como falta no ponto.",
      "Para registrar férias de um colaborador, localize-o e clique em 'Férias'. Informe o período (data de início e fim) e confirme. O calendário do colaborador marcará automaticamente esses dias.",
      "Para registrar day-off (folga avulsa), clique em 'Day-off', informe a data e o motivo. O dia será marcado no calendário sem contar como falta.",
      "Para corrigir um ponto incorreto, acesse 'Editar ponto', selecione o colaborador e o dia, e faça o ajuste com justificativa obrigatória.",
      "Na aba 'Relatórios', gere o relatório de presença filtrando por colaborador, período e status. Exporte em PDF ou CSV para conferência com a folha de pagamento.",
    ],
    {
      relatedRoute: "/rh/admin",
      requiredPermissions: ["rh.point.manage"],
      order: 3,
      content:
        "A gestão de RH é a área de operação do módulo de ponto reservada para administradores e gestores de equipe. Ela centraliza todas as configurações que definem como o ponto de cada colaborador é calculado — jornada, feriados, férias, folgas — garantindo que o sistema reflita a realidade contratual de cada funcionário.\n\nA configuração correta dos horários é o alicerce do módulo: sem um horário definido para o colaborador, o sistema não consegue calcular saldo de horas, identificar atrasos ou gerar relatórios precisos. Priorize configurar os horários de todos os colaboradores antes de ativar o controle de ponto.\n\nRelatórios de ponto são documentos operacionais e, em alguns contextos, legais. Eles servem de base para o cálculo da folha de pagamento, controle de banco de horas e, em caso de disputa trabalhista, evidência do histórico de presença. Mantenha o hábito de gerar e arquivar relatórios mensais mesmo que o controle seja feito internamente.",
      keywords: ["gestao", "rh", "horario", "ferias", "feriado", "day-off", "relatorio", "ponto", "jornada"],
    },
  ),

  // ─── TRANSAÇÕES PDV ──────────────────────────────────────────────────────────
  article(
    "pdv-transacoes",
    "transacoes-pdv",
    "Consultar e filtrar transações do PDV",
    "Como revisar vendas realizadas no ponto de venda, filtrar por operador, caixa, pagamento e status.",
    [
      "Acesse 'Transações PDV' pelo menu lateral.",
      "A tela exibe a lista de todas as transações com as colunas: ID, data, operador, caixa, forma de pagamento, total e status.",
      "Use o filtro de data para definir o período de análise (hoje, ontem, semana, mês ou intervalo personalizado).",
      "Filtre por operador para ver as transações de um caixa específico — útil para conferências de fechamento.",
      "Filtre por forma de pagamento (dinheiro, cartão de débito, crédito, Pix) para identificar o mix de meios de pagamento.",
      "Filtre por status: Aprovado, Cancelado ou Pendente. Transações canceladas devem ser investigadas para confirmar se o cancelamento foi autorizado.",
      "Clique em uma transação para ver os detalhes: itens vendidos, quantidades, valores unitários, desconto aplicado, subtotal, recebido e troco.",
      "Use a busca por ID ou operador para localizar uma transação específica rapidamente — útil em casos de contestação ou reimpressão.",
      "Para reconciliação financeira, exporte a listagem filtrada em CSV e cruze com o extrato bancário do período.",
    ],
    {
      relatedRoute: "/transacoes",
      requiredPermissions: ["sales.view"],
      order: 1,
      content:
        "As transações do PDV são o registro de cada venda realizada no ponto de venda físico. Consultar e revisar esse histórico é fundamental para o fechamento de caixa diário, auditorias e reconciliação com o financeiro.\n\nO filtro por operador é especialmente útil em operações com múltiplos caixas: ao filtrar por um operador específico, você visualiza apenas as transações daquele turno, facilitando a conferência do valor total a ser prestado nas contas.\n\nTransações canceladas merecem atenção especial. Um volume de cancelamentos acima do normal pode indicar erro de operador, problemas com o sistema ou — em casos mais graves — manipulação de caixa. Revise cancelamentos regularmente e confirme que cada um teve uma justificativa válida.",
      keywords: ["pdv", "transacao", "venda", "caixa", "operador", "pagamento", "cancelamento"],
    },
  ),

  // ─── NPS ─────────────────────────────────────────────────────────────────────
  article(
    "nps-responder",
    "nps",
    "Responder a pesquisa de satisfação (NPS)",
    "Como o cliente final acessa e preenche a pesquisa pública de satisfação do sistema.",
    [
      "O cliente recebe o link da pesquisa por WhatsApp, e-mail ou outro canal de comunicação da empresa.",
      "Ao abrir o link, a pesquisa é exibida com a primeira pergunta em tela cheia — sem necessidade de cadastro ou login.",
      "Cada pergunta apresenta uma escala de notas de 1 a 10. O cliente clica na nota que representa a sua percepção.",
      "Após selecionar a nota, clique em 'Próxima' para avançar para a pergunta seguinte. A barra de progresso indica quantas perguntas restam.",
      "Na última pergunta, após selecionar a nota, clique em 'Finalizar' para confirmar o envio das respostas.",
      "Uma tela de agradecimento confirma que as respostas foram registradas com sucesso.",
      "O link de pesquisa pode ser respondido apenas uma vez por acesso — respostas duplicadas do mesmo contato podem ser filtradas na gestão.",
    ],
    {
      relatedRoute: "/nps",
      featured: false,
      order: 1,
      content:
        "A pesquisa NPS (Net Promoter Score) é uma ferramenta de medição de satisfação amplamente utilizada para entender o quanto os clientes estão dispostos a recomendar a empresa. A pontuação varia de 1 a 10, e os respondentes são classificados em três grupos: Promotores (9-10), Neutros (7-8) e Detratores (1-6).\n\nA simplicidade é a força do NPS: poucas perguntas, escala visual e envio rápido tornam a taxa de resposta naturalmente mais alta do que pesquisas longas e complexas. O cliente consegue completar a pesquisa em menos de um minuto.\n\nA efetividade do NPS depende de quando e como o link é enviado. Enviar imediatamente após um atendimento finalizado — quando a experiência ainda está fresca na memória do cliente — tende a gerar respostas mais precisas e taxas de resposta mais altas do que envios genéricos sem contexto.",
      keywords: ["nps", "pesquisa", "satisfacao", "nota", "cliente", "responder"],
    },
  ),

  article(
    "nps-configurar",
    "nps",
    "Configurar as perguntas da pesquisa NPS",
    "Como o administrador cria, reordena e pré-visualiza as perguntas exibidas na pesquisa pública.",
    [
      "Acesse Configurações pelo menu lateral.",
      "Clique na aba 'NPS'. Você verá as perguntas já cadastradas na ordem em que são exibidas para o cliente.",
      "Para criar uma nova pergunta, clique em '+ Nova pergunta'.",
      "Escreva o texto da pergunta de forma clara e direta. Perguntas NPS funcionam melhor quando são específicas (ex.: 'Como você avalia o tempo de resposta do nosso atendimento?') do que genéricas.",
      "Defina a ordem de exibição da pergunta. Inicie pela pergunta mais ampla e avance para as mais específicas — isso cria uma progressão natural na pesquisa.",
      "Salve a pergunta.",
      "Para reordenar, arraste as perguntas para a posição desejada e salve a nova ordem.",
      "Para editar uma pergunta existente, clique sobre ela, faça as alterações e salve.",
      "Use o botão 'Pré-visualizar pesquisa' para ver exatamente como o cliente verá as perguntas antes de publicar alterações.",
      "Compartilhe o link público de NPS (disponível nessa mesma tela) no final de cada atendimento finalizado para coletar respostas.",
    ],
    {
      relatedRoute: "/settings",
      requiredPermissions: ["settings.view"],
      order: 2,
      content:
        "A configuração das perguntas é o que define a qualidade do diagnóstico que o NPS oferece. Uma pesquisa com perguntas bem formuladas e ordenadas logicamente gera insights acionáveis; uma pesquisa genérica gera apenas notas sem contexto.\n\nA quantidade de perguntas é um fator importante: pesquisas muito longas têm taxa de conclusão mais baixa. O ideal é entre 3 e 6 perguntas focadas nos pontos mais críticos da experiência do cliente — atendimento, produto, entrega, preço e recomendação geral.\n\nRevisite as perguntas periodicamente. Perguntas relevantes em um momento da empresa podem se tornar irrelevantes após mudanças no produto ou no processo. Uma pesquisa atualizada mantém a coleta de dados alinhada com os desafios atuais do negócio.",
      keywords: ["nps", "configurar", "pergunta", "pesquisa", "satisfacao", "ordem", "preview"],
    },
  ),
];
