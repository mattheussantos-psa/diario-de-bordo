// Estratégias que o closer pode usar ao atuar no negócio, por segmento.
// O id é gravado no briefing ("b2b-3"), então não pode mudar depois de usado —
// para reescrever um item, altere título/descrição e mantenha o id.
const _EST = {
  B2B: [
    {
      id: "b2b-1",
      titulo: "Conteúdo ou notícia do segmento",
      desc: '"Vi e lembrei de vocês". Pesquisa pública, zero dependência. Usa a leitura do cliente que você já faz antes da reunião.',
    },
    {
      id: "b2b-2",
      titulo: "Vulnerabilidade (história do Busch)",
      desc: "Técnica de conversa pura. Sem custo, sem ativo, sem aprovação. É a de maior alavancagem da lista porque destrava o motivo real do silêncio.",
    },
    {
      id: "b2b-3",
      titulo: "Pré-briefing",
      desc: "Só depende de agenda sua com o cliente. É a lógica Smacna: vender método de curadoria antes de nome.",
    },
    {
      id: "b2b-4",
      titulo: "Short ou corte de palestra do nome indicado",
      desc: "Autônoma se o conteúdo já for público (YouTube, Instagram do palestrante). Se precisar de material bruto interno, vira dependente.",
    },
    {
      id: "b2b-5",
      titulo: "Case do palestrante em empresa do mesmo segmento",
      desc: "Autônoma, mas hoje exige garimpo deal a deal no HubSpot. Executável sozinho, só é lento.",
    },
    {
      id: "b2b-6",
      titulo: "Case próprio (evento semelhante bem-sucedido)",
      desc: "Você tem os seus cases. Não precisa do Felipe para contar um evento que você mesmo fechou.",
    },
    {
      id: "b2b-7",
      titulo: "PSA Experience",
      desc: 'Compartilha o case e sonda: "quem ou qual linha você gostaria de assistir?". A pergunta devolve o perfil desejado sem queimar nome.',
    },
    {
      id: "b2b-8",
      titulo: "TBS e TBW",
      desc: "Mapear leads com aderência é análise da sua própria base. Com a final da 3ª edição em 21/11, a janela é sua.",
    },
    {
      id: "b2b-9",
      titulo: "Troca de jogador dentro da shortlist já curada",
      desc: "Se o substituto já passou por curadoria e screening, é decisão comercial. Se exige nome novo, vira demanda de curadoria e sai da lista.",
    },
    {
      id: "b2b-10",
      titulo: "Escassez com lastro verificável no CRM",
      desc: "Cheque no HubSpot se existe outro deal aberto com o mesmo palestrante na mesma data. Isso é escassez real e defensável. Reajuste de cachê não entra: depende do palestrante.",
    },
  ],
  B2C: [
    {
      id: "b2c-1",
      titulo: "Demanda do B2B que ele poderia ser indicado",
      desc: "Enviar demanda do B2B em que ele poderia ser indicado se estivesse no TBW.",
    },
    {
      id: "b2c-2",
      titulo: "Print da rede social do cliente",
      desc: "Printar a rede social do cliente e perguntar se o contratante fecharia vendo aquilo / se está claro o que ele resolve.",
    },
    {
      id: "b2c-3",
      titulo: "Evidências dos temas mais vendidos",
      desc: "Enviar evidências dos temas mais vendidos e mostrar que tem dinheiro na mesa.",
    },
    {
      id: "b2c-4",
      titulo: "Comparação com palestrante do mesmo tema",
      desc: "Mandar rede social de palestrante do mesmo tema/cachê e perguntar qual é o diferencial do lead e por que o cliente escolheria ele.",
    },
    {
      id: "b2c-5",
      titulo: "Contato de ex-alunos do mesmo tema",
      desc: "Enviar nomes e contatos de ex-alunos do mesmo tema para ele conversar.",
    },
    {
      id: "b2c-6",
      titulo: "Chamar o NICO para a reunião de FUP",
      desc: "Trazer o NICO para a reunião de follow-up.",
    },
    {
      id: "b2c-7",
      titulo: "Desconto vinculado ao lote de fechamento",
      desc: "R$ 12k essa semana → R$ 15k semana que vem → R$ 18k em setembro.",
    },
    {
      id: "b2c-8",
      titulo: "Vídeo de depoimento de ex-participante",
      desc: "Enviar vídeo de depoimento de quem já participou.",
    },
    {
      id: "b2c-9",
      titulo: "Chamar o lead para LIVE com o Márcio",
      desc: "Convidar o lead para uma live com o Márcio.",
    },
    {
      id: "b2c-10",
      titulo: "Cadeira no TBD ou Plataforma",
      desc: "Dar cadeira no TBD ou Plataforma para fechar TBW.",
    },
  ],
};

// Farmer atua no funil B2B e usa as mesmas dez estratégias do B2B.
export const ESTRATEGIAS = { ..._EST, Farmer: _EST.B2B };

export const estrategiaPorId = Object.fromEntries(
  [..._EST.B2B, ..._EST.B2C].map((e) => [e.id, e])
);

// "3. Pré-briefing" — o número ajuda o closer a falar dela na reunião.
export const numeroDa = (id) => Number(String(id).split("-")[1]) || "";
