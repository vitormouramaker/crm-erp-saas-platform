import { LegalFooter } from "../../components/common/LegalFooter/LegalFooter";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import "../TermsPage/TermsPage.css";
import "./PrivacyPage.css";
type Block = { paragraph: string } | { headers: string[]; rows: string[][] };
const sections: {title: string; blocks: Block[]}[] = [
  {
    "title": "1. Sobre este documento",
    "blocks": [
      {
        "paragraph": "Conteúdo fictício de demonstração. Esta não é a política de privacidade de nenhuma empresa real."
      }
    ]
  },
  {
    "title": "2. Dados tratados",
    "blocks": [
      {
        "headers": [
          "Categoria",
          "Exemplos",
          "Finalidade"
        ],
        "rows": [
          [
            "Conta",
            "nome, e-mail, telefone",
            "acesso e suporte"
          ],
          [
            "Operação",
            "contatos, conversas, vendas, estoque",
            "uso das funções do CRM"
          ],
          [
            "Técnicos",
            "registros de acesso",
            "segurança"
          ]
        ]
      }
    ]
  },
  {
    "title": "3. Direitos do titular",
    "blocks": [
      {
        "paragraph": "Pedidos de acesso, correção ou exclusão seriam enviados para contato@example.com, um endereço de exemplo."
      }
    ]
  },
  {
    "title": "4. Armazenamento local",
    "blocks": [
      {
        "paragraph": "O front guarda no navegador apenas o necessário para a sessão e as preferências (tema, menu lateral)."
      }
    ]
  }
];
export function PrivacyPage() {
const navigate = useNavigate();
return <main className="terms-page privacy-page">
<header className="terms-header">
<button className="terms-back" type="button" onClick={() => navigate(-1)} aria-label="Voltar" title="Voltar"><FiArrowLeft size={19}/></button>
<Link className="terms-brand" to="/" aria-label="Órbita CRM"><img src="/logo-wide.svg" alt="Órbita CRM"/></Link>
</header>
<div className="terms-layout">
<aside className="terms-aside"><h1>{"POLÍTICA DE PRIVACIDADE"}</h1></aside>
<article className="terms-content">{sections.map((section,index)=><section className="terms-section" id={String(index+1)} key={section.title}>
<h2>{section.title}</h2>
{section.blocks.map((block,i)=>"paragraph" in block ? <p key={i}>{block.paragraph}</p> : <div className="terms-table-scroll" key={i}><table><thead><tr>{block.headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{block.rows.map((row,j)=><tr key={j}>{row.map((cell,k)=><td key={k}>{cell}</td>)}</tr>)}</tbody></table></div>)}
</section>)}</article>
</div><LegalFooter /></main>;
}
