import { LegalFooter } from "../../components/common/LegalFooter/LegalFooter";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import "./TermsPage.css";
type Block = { paragraph: string } | { headers: string[]; rows: string[][] };
const sections: {title: string; blocks: Block[]}[] = [
  {
    "title": "1. Sobre este documento",
    "blocks": [
      {
        "paragraph": "Conteúdo fictício de demonstração. Este texto não é um contrato e não vale para nenhuma empresa real."
      },
      {
        "paragraph": "O Órbita CRM é um produto de exemplo usado para mostrar o código de uma plataforma de CRM e gestão. Contato de exemplo: contato@example.com."
      }
    ]
  },
  {
    "title": "2. Uso da plataforma",
    "blocks": [
      {
        "paragraph": "Cada empresa recebe um usuário master, que cria os demais usuários e define as permissões de cada um, dentro dos limites do plano."
      },
      {
        "paragraph": "Os usuários devem manter as senhas em sigilo e usar a plataforma apenas com dados que tenham o direito de tratar."
      }
    ]
  },
  {
    "title": "3. Integrações",
    "blocks": [
      {
        "paragraph": "Integrações com serviços de terceiros (mensageria, anúncios, pagamentos, armazenamento) são opcionais e seguem as regras de cada fornecedor."
      }
    ]
  },
  {
    "title": "4. Alterações",
    "blocks": [
      {
        "paragraph": "Numa instalação real, este espaço traria as regras de alteração, a lei aplicável e o foro. Aqui ele existe só para a tela ter conteúdo."
      }
    ]
  }
];
export function TermsPage() {
const navigate = useNavigate();
return <main className="terms-page">
<header className="terms-header">
<button className="terms-back" type="button" onClick={() => navigate(-1)} aria-label="Voltar" title="Voltar"><FiArrowLeft size={19}/></button>
<Link className="terms-brand" to="/" aria-label="Órbita CRM"><img src="/logo-wide.svg" alt="Órbita CRM"/></Link>
</header>
<div className="terms-layout">
<aside className="terms-aside"><h1>{"TERMOS DE USO (DEMONSTRAÇÃO)"}</h1></aside>
<article className="terms-content">{sections.map((section,index)=><section className="terms-section" id={String(index+1)} key={section.title}>
<h2>{section.title}</h2>
{section.blocks.map((block,i)=>"paragraph" in block ? <p key={i}>{block.paragraph}</p> : <div className="terms-table-scroll" key={i}><table><thead><tr>{block.headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{block.rows.map((row,j)=><tr key={j}>{row.map((cell,k)=><td key={k}>{cell}</td>)}</tr>)}</tbody></table></div>)}
</section>)}</article>
</div><LegalFooter /></main>;
}
