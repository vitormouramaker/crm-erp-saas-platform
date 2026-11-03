import { useCallback, useEffect, useState } from "react";
import { FiArrowRight, FiBriefcase, FiCreditCard, FiEdit2, FiFileText, FiInfo, FiPlus, FiRepeat, FiTrash2, FiUsers, FiX } from "react-icons/fi";
import { useToast } from "../../contexts/ToastContext";
import {
  listFinanceiroCentrosCusto, listFinanceiroContasFinanceiras, listFinanceiroContrapartes,
  listFinanceiroEmpresasGrupo, listFinanceiroFormasPagamento, createFinanceiroTransferencia,
  saveFinanceiroCentroCusto, saveFinanceiroContaFinanceira, saveFinanceiroContraparte,
  saveFinanceiroEmpresaGrupo, saveFinanceiroFormaPagamento,
  type FinanceiroCentroCusto, type FinanceiroContaFinanceira, type FinanceiroContraparte,
  type FinanceiroEmpresaGrupo, type FinanceiroFormaPagamento,
} from "../../service/financeiroService";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type StructureSection = "contas" | "centros" | "pessoas" | "empresas" | "formas" | "transferencia";

export function FinancialStructurePanel() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<StructureSection>("contas");
  const [editing, setEditing] = useState<{ section: StructureSection; id: number } | null>(null);
  const [centros, setCentros] = useState<FinanceiroCentroCusto[]>([]);
  const [contas, setContas] = useState<FinanceiroContaFinanceira[]>([]);
  const [contrapartes, setContrapartes] = useState<FinanceiroContraparte[]>([]);
  const [empresasGrupo, setEmpresasGrupo] = useState<FinanceiroEmpresaGrupo[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FinanceiroFormaPagamento[]>([]);
  const [centro, setCentro] = useState({ codigo: "", nome: "", descricao: "" });
  const [conta, setConta] = useState({ nome: "", tipo: "conta_corrente", banco: "", saldo_inicial: "", empresas_grupo_ids: [] as number[] });
  const [contraparte, setContraparte] = useState({ nome: "", tipo: "fornecedor", cpf: "", cnpj: "", email: "", telefone: "", endereco: "", cep: "", uf: "", cidade: "" });
  const [empresaGrupo, setEmpresaGrupo] = useState({ nome: "", razao_social: "", cnpj: "" });
  const [formaPagamento, setFormaPagamento] = useState({ nome: "", taxa_percentual: "", taxa_fixa: "" });
  const [transferencia, setTransferencia] = useState({ conta_origem_id: "", conta_destino_id: "", valor: "", data_transferencia: "", observacao: "" });
  const [transferenciaComprovante, setTransferenciaComprovante] = useState<File | null>(null);
  const [transferenciaFileKey, setTransferenciaFileKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [costCenters, financialAccounts, parties, groupCompanies, paymentMethods] = await Promise.all([
        listFinanceiroCentrosCusto(), listFinanceiroContasFinanceiras(), listFinanceiroContrapartes(),
        listFinanceiroEmpresasGrupo(), listFinanceiroFormasPagamento(),
      ]);
      setCentros(costCenters); setContas(financialAccounts); setContrapartes(parties);
      setEmpresasGrupo(groupCompanies); setFormasPagamento(paymentMethods);
    } catch (error) {
      addToast({ type: "error", title: "Erro", description: error instanceof Error ? error.message : "Nao foi possivel carregar a estrutura financeira." });
    } finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { void load(); }, [load]);

  const runSave = async (action: () => Promise<unknown>, reset: () => void) => {
    setSaving(true);
    try {
      await action(); reset(); setEditing(null); await load();
      addToast({ type: "success", title: "Salvo", description: "Cadastro financeiro atualizado." });
    } catch (error) {
      addToast({ type: "error", title: "Erro", description: error instanceof Error ? error.message : "Nao foi possivel salvar." });
    } finally { setSaving(false); }
  };

  const editConta = (item: FinanceiroContaFinanceira) => {
    setActiveSection("contas"); setEditing({ section: "contas", id: item.id });
    setConta({ nome: item.nome, tipo: item.tipo, banco: item.banco || "", saldo_inicial: String(item.saldo_inicial || 0), empresas_grupo_ids: (item.empresas_grupo || []).map((x) => x.id) });
  };
  const editCentro = (item: FinanceiroCentroCusto) => {
    setActiveSection("centros"); setEditing({ section: "centros", id: item.id });
    setCentro({ codigo: item.codigo || "", nome: item.nome, descricao: item.descricao || "" });
  };
  const editPessoa = (item: FinanceiroContraparte) => {
    setActiveSection("pessoas"); setEditing({ section: "pessoas", id: item.id });
    setContraparte({ nome: item.nome, tipo: item.tipo, cpf: item.cpf || "", cnpj: item.cnpj || "", email: item.email || "", telefone: item.telefone || "", endereco: item.endereco || "", cep: item.cep || "", uf: item.uf || "", cidade: item.cidade || "" });
  };
  const editEmpresa = (item: FinanceiroEmpresaGrupo) => {
    setActiveSection("empresas"); setEditing({ section: "empresas", id: item.id });
    setEmpresaGrupo({ nome: item.nome, razao_social: item.razao_social || "", cnpj: item.cnpj || "" });
  };
  const editForma = (item: FinanceiroFormaPagamento) => {
    setActiveSection("formas"); setEditing({ section: "formas", id: item.id });
    setFormaPagamento({ nome: item.nome, taxa_percentual: String(item.taxa_percentual || 0), taxa_fixa: String(item.taxa_fixa || 0) });
  };
  const cancelEdit = () => { setEditing(null); setCentro({ codigo: "", nome: "", descricao: "" }); setConta({ nome: "", tipo: "conta_corrente", banco: "", saldo_inicial: "", empresas_grupo_ids: [] }); setContraparte({ nome: "", tipo: "fornecedor", cpf: "", cnpj: "", email: "", telefone: "", endereco: "", cep: "", uf: "", cidade: "" }); setEmpresaGrupo({ nome: "", razao_social: "", cnpj: "" }); setFormaPagamento({ nome: "", taxa_percentual: "", taxa_fixa: "" }); };

  const inactivate = async (section: StructureSection, item: FinanceiroContaFinanceira | FinanceiroCentroCusto | FinanceiroContraparte | FinanceiroEmpresaGrupo | FinanceiroFormaPagamento) => {
    if (!window.confirm(`Inativar "${item.nome}"? Registros financeiros antigos serão preservados.`)) return;
    const actions = {
      contas: () => saveFinanceiroContaFinanceira({ ...(item as FinanceiroContaFinanceira), ativo: false, empresas_grupo_ids: (item as FinanceiroContaFinanceira).empresas_grupo?.map((x) => x.id) || [] }),
      centros: () => saveFinanceiroCentroCusto({ ...(item as FinanceiroCentroCusto), ativo: false }),
      pessoas: () => saveFinanceiroContraparte({ ...(item as FinanceiroContraparte), ativo: false }),
      empresas: () => saveFinanceiroEmpresaGrupo({ ...(item as FinanceiroEmpresaGrupo), ativo: false }),
      formas: () => saveFinanceiroFormaPagamento({ ...(item as FinanceiroFormaPagamento), ativo: false }),
      transferencia: async () => undefined,
    };
    await runSave(actions[section], cancelEdit);
  };

  if (loading) return <div className="financial-loading">Carregando estrutura financeira...</div>;

  return (
    <section className="financial-panel financial-structure-panel">
      <header className="financial-panel-header">
        <div>
          <span className="financial-structure-eyebrow">Base de organização</span>
          <h2>Estrutura Financeira</h2>
          <p>Configure como o dinheiro da empresa será identificado e organizado nos registros financeiros.</p>
        </div>
      </header>

      <div className="financial-structure-intro">
        <div className="financial-structure-intro-icon"><FiInfo size={20} /></div>
        <div>
          <strong>O que esta tela faz?</strong>
          <p>
            Aqui você prepara os cadastros básicos usados para organizar pagamentos, recebimentos e
            movimentações. Cadastrar um item nesta tela não cria uma cobrança e não movimenta dinheiro.
          </p>
        </div>
      </div>

      <div className="financial-structure-guide" aria-label="Como a estrutura financeira funciona">
        <div>
          <span>1</span>
          <strong>Onde está o dinheiro?</strong>
          <small>Cadastre bancos, carteiras digitais e caixas físicos.</small>
        </div>
        <FiArrowRight className="financial-structure-guide-arrow" aria-hidden="true" />
        <div>
          <span>2</span>
          <strong>Para onde vai o valor?</strong>
          <small>Use centros de custo para separar áreas, projetos ou unidades.</small>
        </div>
        <FiArrowRight className="financial-structure-guide-arrow" aria-hidden="true" />
        <div>
          <span>3</span>
          <strong>Quem paga ou recebe?</strong>
          <small>Identifique clientes, fornecedores e outros envolvidos.</small>
        </div>
      </div>

      <nav className="financial-structure-nav" aria-label="Tipos de cadastro financeiro">
        {([
          ["contas", "Contas", FiCreditCard], ["centros", "Centros de custo", FiBriefcase],
          ["pessoas", "Clientes e fornecedores", FiUsers], ["empresas", "Empresas do grupo", FiBriefcase],
          ["formas", "Formas de pagamento", FiCreditCard], ["transferencia", "Transferir", FiRepeat],
        ] as const).map(([key, label, Icon]) => <button key={key} type="button" className={activeSection === key ? "is-active" : ""} onClick={() => { cancelEdit(); setActiveSection(key); }}><Icon /><span>{label}</span></button>)}
      </nav>

      <div className="financial-structure-grid">
        <form className={`financial-form financial-structure-form ${activeSection !== "contas" ? "is-hidden" : ""}`} onSubmit={(e) => { e.preventDefault(); void runSave(() => saveFinanceiroContaFinanceira({ ...conta, id: editing?.section === "contas" ? editing.id : undefined, saldo_inicial: Number(conta.saldo_inicial || 0) }), () => setConta({ nome: "", tipo: "conta_corrente", banco: "", saldo_inicial: "", empresas_grupo_ids: [] })); }}>
          <div className="financial-structure-form-heading">
            <span><FiCreditCard /></span>
            <div><h3>Conta bancária ou caixa</h3><p>Representa o local onde o dinheiro entra, sai ou fica guardado.</p></div>
          </div>
          <label className="financial-form-field"><span>Nome *</span><input required placeholder="Ex.: Banco principal" value={conta.nome} onChange={(e) => setConta({ ...conta, nome: e.target.value })} /><small>Um nome fácil para reconhecer esta conta.</small></label>
          <label className="financial-form-field"><span>Tipo *</span><select value={conta.tipo} onChange={(e) => setConta({ ...conta, tipo: e.target.value })}><option value="conta_corrente">Conta corrente</option><option value="carteira_digital">Carteira digital</option><option value="caixa">Caixa físico</option></select><small>Escolha onde esse dinheiro é mantido.</small></label>
          <label className="financial-form-field"><span>Banco ou instituição</span><input placeholder="Ex.: Banco do Brasil" value={conta.banco} onChange={(e) => setConta({ ...conta, banco: e.target.value })} /><small>Opcional para caixas físicos.</small></label>
          <label className="financial-form-field"><span>Saldo inicial</span><input type="number" step="0.01" placeholder="R$ 0,00" value={conta.saldo_inicial} onChange={(e) => setConta({ ...conta, saldo_inicial: e.target.value })} /><small>Quanto já havia nessa conta antes de começar o controle no sistema.</small></label>
          <label className="financial-form-field"><span>Empresas vinculadas</span><select multiple value={conta.empresas_grupo_ids.map(String)} onChange={(e) => setConta({ ...conta, empresas_grupo_ids: Array.from(e.target.selectedOptions, (option) => Number(option.value)) })}>{empresasGrupo.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select><small>Opcional. Use Ctrl para selecionar mais de uma empresa do grupo.</small></label>
          <div className="financial-structure-form-actions"><button className="financial-btn-primary" disabled={saving}>{editing?.section === "contas" ? <FiEdit2 /> : <FiPlus />} {editing?.section === "contas" ? "Salvar alterações" : "Adicionar conta"}</button>{editing?.section === "contas" && <button type="button" className="financial-btn-secondary" onClick={cancelEdit}><FiX /> Cancelar</button>}</div>
        </form>

        <form className={`financial-form financial-structure-form ${activeSection !== "centros" ? "is-hidden" : ""}`} onSubmit={(e) => { e.preventDefault(); void runSave(() => saveFinanceiroCentroCusto({ ...centro, id: editing?.section === "centros" ? editing.id : undefined }), () => setCentro({ codigo: "", nome: "", descricao: "" })); }}>
          <div className="financial-structure-form-heading">
            <span><FiBriefcase /></span>
            <div><h3>Centro de custo</h3><p>Mostra qual área, projeto ou unidade é responsável por um valor.</p></div>
          </div>
          <label className="financial-form-field"><span>Código</span><input placeholder="Ex.: MKT-01" value={centro.codigo} onChange={(e) => setCentro({ ...centro, codigo: e.target.value })} /><small>Identificação curta opcional para relatórios.</small></label>
          <label className="financial-form-field"><span>Nome *</span><input required placeholder="Ex.: Marketing" value={centro.nome} onChange={(e) => setCentro({ ...centro, nome: e.target.value })} /><small>Área ou projeto que você deseja acompanhar separadamente.</small></label>
          <label className="financial-form-field"><span>Descrição</span><input placeholder="Ex.: Campanhas e anúncios" value={centro.descricao} onChange={(e) => setCentro({ ...centro, descricao: e.target.value })} /><small>Explique quais despesas ou receitas pertencem a este centro.</small></label>
          <div className="financial-structure-form-actions"><button className="financial-btn-primary" disabled={saving}>{editing?.section === "centros" ? <FiEdit2 /> : <FiPlus />} {editing?.section === "centros" ? "Salvar alterações" : "Adicionar centro"}</button>{editing?.section === "centros" && <button type="button" className="financial-btn-secondary" onClick={cancelEdit}><FiX /> Cancelar</button>}</div>
        </form>

        <form className={`financial-form financial-structure-form ${activeSection !== "pessoas" ? "is-hidden" : ""}`} onSubmit={(e) => { e.preventDefault(); void runSave(() => saveFinanceiroContraparte({ ...contraparte, id: editing?.section === "pessoas" ? editing.id : undefined }), () => setContraparte({ nome: "", tipo: "fornecedor", cpf: "", cnpj: "", email: "", telefone: "", endereco: "", cep: "", uf: "", cidade: "" })); }}>
          <div className="financial-structure-form-heading">
            <span><FiUsers /></span>
            <div><h3>Cliente ou fornecedor</h3><p>Identifica a pessoa ou empresa envolvida em uma cobrança ou pagamento.</p></div>
          </div>
          <label className="financial-form-field"><span>Nome *</span><input required placeholder="Ex.: Empresa de Energia" value={contraparte.nome} onChange={(e) => setContraparte({ ...contraparte, nome: e.target.value })} /><small>Nome da pessoa ou razão social da empresa.</small></label>
          <label className="financial-form-field"><span>Relação *</span><select value={contraparte.tipo} onChange={(e) => setContraparte({ ...contraparte, tipo: e.target.value })}><option value="fornecedor">Fornecedor: a empresa paga</option><option value="cliente">Cliente: a empresa recebe</option><option value="outros">Outro tipo de relação</option></select><small>Informe se ele normalmente paga ou recebe da sua empresa.</small></label>
          <label className="financial-form-field"><span>CPF</span><input value={contraparte.cpf} onChange={(e) => setContraparte({ ...contraparte, cpf: e.target.value })} /></label>
          <label className="financial-form-field"><span>CNPJ</span><input value={contraparte.cnpj} onChange={(e) => setContraparte({ ...contraparte, cnpj: e.target.value })} /></label>
          <label className="financial-form-field"><span>E-mail</span><input type="email" value={contraparte.email} onChange={(e) => setContraparte({ ...contraparte, email: e.target.value })} /></label>
          <label className="financial-form-field"><span>Telefone</span><input value={contraparte.telefone} onChange={(e) => setContraparte({ ...contraparte, telefone: e.target.value })} /></label>
          <label className="financial-form-field"><span>Endereço</span><input value={contraparte.endereco} onChange={(e) => setContraparte({ ...contraparte, endereco: e.target.value })} /></label>
          <label className="financial-form-field"><span>CEP</span><input value={contraparte.cep} onChange={(e) => setContraparte({ ...contraparte, cep: e.target.value })} /></label>
          <label className="financial-form-field"><span>UF</span><input maxLength={2} value={contraparte.uf} onChange={(e) => setContraparte({ ...contraparte, uf: e.target.value.toUpperCase() })} /></label>
          <label className="financial-form-field"><span>Cidade</span><input value={contraparte.cidade} onChange={(e) => setContraparte({ ...contraparte, cidade: e.target.value })} /></label>
          <div className="financial-structure-form-actions"><button className="financial-btn-primary" disabled={saving}>{editing?.section === "pessoas" ? <FiEdit2 /> : <FiPlus />} {editing?.section === "pessoas" ? "Salvar alterações" : "Adicionar pessoa"}</button>{editing?.section === "pessoas" && <button type="button" className="financial-btn-secondary" onClick={cancelEdit}><FiX /> Cancelar</button>}</div>
        </form>

        <form className={`financial-form financial-structure-form ${activeSection !== "empresas" ? "is-hidden" : ""}`} onSubmit={(e) => { e.preventDefault(); void runSave(() => saveFinanceiroEmpresaGrupo({ ...empresaGrupo, id: editing?.section === "empresas" ? editing.id : undefined }), () => setEmpresaGrupo({ nome: "", razao_social: "", cnpj: "" })); }}>
          <div className="financial-structure-form-heading"><span><FiBriefcase /></span><div><h3>Empresa do grupo</h3><p>Separa movimentações entre empresas da mesma organização.</p></div></div>
          <label className="financial-form-field"><span>Nome *</span><input required value={empresaGrupo.nome} onChange={(e) => setEmpresaGrupo({ ...empresaGrupo, nome: e.target.value })} /></label>
          <label className="financial-form-field"><span>Razão social</span><input value={empresaGrupo.razao_social} onChange={(e) => setEmpresaGrupo({ ...empresaGrupo, razao_social: e.target.value })} /></label>
          <label className="financial-form-field"><span>CNPJ</span><input value={empresaGrupo.cnpj} onChange={(e) => setEmpresaGrupo({ ...empresaGrupo, cnpj: e.target.value })} /></label>
          <div className="financial-structure-form-actions"><button className="financial-btn-primary" disabled={saving}>{editing?.section === "empresas" ? <FiEdit2 /> : <FiPlus />} {editing?.section === "empresas" ? "Salvar alterações" : "Adicionar empresa"}</button>{editing?.section === "empresas" && <button type="button" className="financial-btn-secondary" onClick={cancelEdit}><FiX /> Cancelar</button>}</div>
        </form>

        <form className={`financial-form financial-structure-form ${activeSection !== "formas" ? "is-hidden" : ""}`} onSubmit={(e) => { e.preventDefault(); void runSave(() => saveFinanceiroFormaPagamento({ id: editing?.section === "formas" ? editing.id : undefined, nome: formaPagamento.nome, taxa_percentual: Number(formaPagamento.taxa_percentual || 0), taxa_fixa: Number(formaPagamento.taxa_fixa || 0) }), () => setFormaPagamento({ nome: "", taxa_percentual: "", taxa_fixa: "" })); }}>
          <div className="financial-structure-form-heading"><span><FiCreditCard /></span><div><h3>Forma de pagamento</h3><p>Configura taxas para calcular valor bruto, taxa e líquido.</p></div></div>
          <label className="financial-form-field"><span>Nome *</span><input required placeholder="Ex.: Cartão 2x" value={formaPagamento.nome} onChange={(e) => setFormaPagamento({ ...formaPagamento, nome: e.target.value })} /></label>
          <label className="financial-form-field"><span>Taxa percentual (%)</span><input type="number" min="0" step="0.0001" value={formaPagamento.taxa_percentual} onChange={(e) => setFormaPagamento({ ...formaPagamento, taxa_percentual: e.target.value })} /></label>
          <label className="financial-form-field"><span>Taxa fixa (R$)</span><input type="number" min="0" step="0.01" value={formaPagamento.taxa_fixa} onChange={(e) => setFormaPagamento({ ...formaPagamento, taxa_fixa: e.target.value })} /></label>
          <div className="financial-structure-form-actions"><button className="financial-btn-primary" disabled={saving}>{editing?.section === "formas" ? <FiEdit2 /> : <FiPlus />} {editing?.section === "formas" ? "Salvar alterações" : "Adicionar forma"}</button>{editing?.section === "formas" && <button type="button" className="financial-btn-secondary" onClick={cancelEdit}><FiX /> Cancelar</button>}</div>
        </form>

        <form
          className={`financial-form financial-structure-form ${activeSection !== "transferencia" ? "is-hidden" : ""}`}
          onSubmit={(event) => {
            event.preventDefault();
            void runSave(
              () => createFinanceiroTransferencia({
                conta_origem_id: Number(transferencia.conta_origem_id),
                conta_destino_id: Number(transferencia.conta_destino_id),
                valor: Number(transferencia.valor),
                data_transferencia: transferencia.data_transferencia || null,
                observacao: transferencia.observacao,
                comprovante: transferenciaComprovante,
              }),
              () => {
                setTransferencia({ conta_origem_id: "", conta_destino_id: "", valor: "", data_transferencia: "", observacao: "" });
                setTransferenciaComprovante(null);
                setTransferenciaFileKey((current) => current + 1);
              },
            );
          }}
        >
          <div className="financial-structure-form-heading"><span><FiRepeat /></span><div><h3>Transferência entre contas</h3><p>Move saldo sem criar receita ou despesa.</p></div></div>
          <label className="financial-form-field"><span>Conta de origem *</span><select required value={transferencia.conta_origem_id} onChange={(e) => setTransferencia({ ...transferencia, conta_origem_id: e.target.value })}><option value="">Selecione</option>{contas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <label className="financial-form-field"><span>Conta de destino *</span><select required value={transferencia.conta_destino_id} onChange={(e) => setTransferencia({ ...transferencia, conta_destino_id: e.target.value })}><option value="">Selecione</option>{contas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <label className="financial-form-field"><span>Valor *</span><input required type="number" min="0.01" step="0.01" value={transferencia.valor} onChange={(e) => setTransferencia({ ...transferencia, valor: e.target.value })} /></label>
          <label className="financial-form-field"><span>Data</span><input type="datetime-local" value={transferencia.data_transferencia} onChange={(e) => setTransferencia({ ...transferencia, data_transferencia: e.target.value })} /></label>
          <label className="financial-form-field"><span>Observação</span><input value={transferencia.observacao} onChange={(e) => setTransferencia({ ...transferencia, observacao: e.target.value })} /></label>
          <label className="financial-form-field financial-transfer-receipt-field">
            <span>Comprovante da transferência</span>
            <div className="financial-transfer-receipt-input">
              <FiFileText />
              <input
                key={transferenciaFileKey}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => setTransferenciaComprovante(event.target.files?.[0] || null)}
              />
              <strong>{transferenciaComprovante?.name || "Selecionar comprovante"}</strong>
            </div>
            <small>Opcional. Envie PDF, JPG, PNG ou WEBP com até 10 MB.</small>
          </label>
          <button className="financial-btn-primary" disabled={saving}><FiRepeat /> Transferir</button>
        </form>
      </div>

      <div className="financial-structure-list-heading">
        <div><span>Cadastros existentes</span><h3>Itens desta categoria</h3></div>
        <small>Editar mantém os vínculos existentes. Inativar oculta o item sem apagar o histórico.</small>
      </div>
      <div className="financial-structure-lists">
        {activeSection === "contas" && <div><h3>Contas e caixas <span>{contas.length}</span></h3>{contas.length === 0 ? <p className="financial-structure-empty">Nenhuma conta cadastrada.</p> : contas.map((x) => <article key={x.id}><span><strong>{x.nome}</strong><small>{x.banco || x.tipo.replaceAll("_", " ")} · {(x.empresas_grupo || []).map((e) => e.nome).join(", ") || "Sem empresa vinculada"}</small></span><div className="financial-structure-item-side"><b>{currency.format(Number(x.saldo_atual ?? x.saldo_inicial))}</b><div className="financial-structure-item-actions"><button type="button" onClick={() => editConta(x)} title="Editar"><FiEdit2 /></button><button type="button" className="danger" onClick={() => void inactivate("contas", x)} title="Inativar"><FiTrash2 /></button></div></div></article>)}</div>}
        {activeSection === "centros" && <div><h3>Centros de custo <span>{centros.length}</span></h3>{centros.length === 0 ? <p className="financial-structure-empty">Nenhum centro cadastrado.</p> : centros.map((x) => <article key={x.id}><span><strong>{x.nome}</strong><small>{x.codigo || "Sem código"}</small></span><div className="financial-structure-item-actions"><button type="button" onClick={() => editCentro(x)} title="Editar"><FiEdit2 /></button><button type="button" className="danger" onClick={() => void inactivate("centros", x)} title="Inativar"><FiTrash2 /></button></div></article>)}</div>}
        {activeSection === "pessoas" && <div><h3>Clientes e fornecedores <span>{contrapartes.length}</span></h3>{contrapartes.length === 0 ? <p className="financial-structure-empty">Nenhuma pessoa cadastrada.</p> : contrapartes.map((x) => <article key={x.id}><span><strong>{x.nome}</strong><small>{x.tipo} · {x.cpf || x.cnpj || x.telefone || "Sem documento"}</small></span><div className="financial-structure-item-actions"><button type="button" onClick={() => editPessoa(x)} title="Editar"><FiEdit2 /></button><button type="button" className="danger" onClick={() => void inactivate("pessoas", x)} title="Inativar"><FiTrash2 /></button></div></article>)}</div>}
        {activeSection === "empresas" && <div><h3>Empresas do grupo <span>{empresasGrupo.length}</span></h3>{empresasGrupo.length === 0 ? <p className="financial-structure-empty">Nenhuma empresa cadastrada.</p> : empresasGrupo.map((x) => <article key={x.id}><span><strong>{x.nome}</strong><small>{x.cnpj || "Sem CNPJ"}</small></span><div className="financial-structure-item-actions"><button type="button" onClick={() => editEmpresa(x)} title="Editar"><FiEdit2 /></button><button type="button" className="danger" onClick={() => void inactivate("empresas", x)} title="Inativar"><FiTrash2 /></button></div></article>)}</div>}
        {activeSection === "formas" && <div><h3>Formas de pagamento <span>{formasPagamento.length}</span></h3>{formasPagamento.length === 0 ? <p className="financial-structure-empty">Nenhuma forma cadastrada.</p> : formasPagamento.map((x) => <article key={x.id}><span><strong>{x.nome}</strong><small>{Number(x.taxa_percentual)}% + {currency.format(Number(x.taxa_fixa))}</small></span><div className="financial-structure-item-actions"><button type="button" onClick={() => editForma(x)} title="Editar"><FiEdit2 /></button><button type="button" className="danger" onClick={() => void inactivate("formas", x)} title="Inativar"><FiTrash2 /></button></div></article>)}</div>}
        {activeSection === "transferencia" && <div className="financial-structure-transfer-note"><FiInfo /><span><strong>Onde consultar?</strong><small>Após transferir, a operação aparece na aba Lançamentos com origem, destino e valor.</small></span></div>}
      </div>
    </section>
  );
}
