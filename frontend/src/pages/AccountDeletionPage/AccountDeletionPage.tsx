import { LegalFooter } from "../../components/common/LegalFooter/LegalFooter";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import "../TermsPage/TermsPage.css";
type Block = { paragraph: string } | { headers: string[]; rows: string[][] };
const sections: {title: string; blocks: Block[]}[] = [
  {
    "title": "1. Como pedir a exclusão",
    "blocks": [
      {
        "paragraph": "Conteúdo fictício de demonstração. Para pedir a exclusão da conta ou dos dados, o usuário enviaria um e-mail para contato@example.com informando o e-mail cadastrado e a empresa."
      }
    ]
  },
  {
    "title": "2. Pelo aplicativo",
    "blocks": [
      {
        "paragraph": "O usuário também pode excluir a própria conta no aplicativo, em Perfil > Excluir conta. O acesso é encerrado na hora."
      }
    ]
  },
  {
    "title": "3. O que pode ser mantido",
    "blocks": [
      {
        "paragraph": "Numa instalação real, este trecho explicaria quais registros ficam guardados por obrigação legal e por quanto tempo."
      }
    ]
  }
];
export function AccountDeletionPage() {
const navigate = useNavigate();
return <main className="terms-page">
<header className="terms-header">
<button className="terms-back" type="button" onClick={() => navigate(-1)} aria-label="Voltar" title="Voltar"><FiArrowLeft size={19}/></button>
<Link className="terms-brand" to="/" aria-label="Órbita CRM"><img src="/logo-wide.svg" alt="Órbita CRM"/></Link>
</header>
<div className="terms-layout">
<aside className="terms-aside"><h1>{"EXCLUSÃO DE CONTA E DADOS"}</h1></aside>
<article className="terms-content">{sections.map((section,index)=><section className="terms-section" id={String(index+1)} key={section.title}>
<h2>{section.title}</h2>
{section.blocks.map((block,i)=>"paragraph" in block ? <p key={i}>{block.paragraph.split("contato@example.com").map((part, partIndex) => <span key={partIndex}>{partIndex > 0 && <a href="mailto:contato@example.com?subject=%C3%93rbita%20CRM%20%E2%80%94%20exclus%C3%A3o%20de%20conta%20ou%20dados">contato@example.com</a>}{part}</span>)}</p> : <div className="terms-table-scroll" key={i}><table><thead><tr>{block.headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{block.rows.map((row,j)=><tr key={j}>{row.map((cell,k)=><td key={k}>{cell}</td>)}</tr>)}</tbody></table></div>)}
</section>)}</article>
</div><LegalFooter /></main>;
}
