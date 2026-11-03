import { useState, useEffect } from 'react';
import { IMaskInput } from 'react-imask';
import { FiX } from 'react-icons/fi';
import type { Conversation } from '../../data/mockData';
import { Input } from '../common/Input/Input';
import { useShortcuts } from '../../contexts/ShortcutsContext';
import { useAuth } from '../../contexts/AuthContext';
import { encrypt, decrypt } from '../../utils/cripto';
import { API_BASE } from '../../config/api';
import { formatPhoneForInput, normalizePhoneForWhatsApp } from '../../utils/phone';
import './ContactForm.css';

type ContactFormData = Partial<Conversation>;
type ContactFormTab = 'empresa' | 'endereco';
type ContactTagItem = { id: number; name: string };

interface ContactFormProps {
  onSave: (contactData: ContactFormData) => void;
  onCancel: () => void;
  initialData?: Conversation | null;
}

export function ContactForm({ onSave, onCancel, initialData }: ContactFormProps) {
  const { tagInputRef } = useShortcuts();
  const { user } = useAuth();
  const isEditing = Boolean(initialData?.id);
  const [activeTab, setActiveTab] = useState<ContactFormTab>('empresa');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthday, setBirthday] = useState('');
  const [origem, setOrigem] = useState('manual');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [cep, setCep] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [cargo, setCargo] = useState('');
  const [faturamento, setFaturamento] = useState('');
  const [tags, setTags] = useState<ContactTagItem[]>([]);
  const [searchTag, setSearchTag] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const phoneMasks = [
    { mask: '(00) 0000-0000' },
    { mask: '(00) 00000-0000' },
  ];

  useEffect(() => {
    setActiveTab('empresa');
    if (initialData) {
      setName(initialData.name);
      setEmail(initialData.email || '');
      setPhone(formatPhoneForInput(initialData.phone || ''));
      setCpf(String(initialData.cpf || ''));
      setBirthday(initialData.birthday || '');
      setOrigem(String(initialData.origem || 'manual'));
      setLogradouro(String(initialData.logradouro || ''));
      setNumero(String(initialData.numero || ''));
      setComplemento(String(initialData.complemento || ''));
      setBairro(String(initialData.bairro || ''));
      setCidade(String(initialData.cidade || ''));
      setUf(String(initialData.uf || ''));
      setCep(String(initialData.cep || ''));
      setEmpresa(String(initialData.empresa || ''));
      setCargo(String(initialData.cargo || ''));
      setFaturamento(
        initialData.faturamento === null || initialData.faturamento === undefined
          ? ''
          : String(initialData.faturamento)
      );
      setTags(
        Array.isArray(initialData.tags)
          ? initialData.tags
              .map((tag) => ({
                id: Number(tag.id),
                name: String(tag.name || '').trim(),
              }))
              .filter((tag) => Number.isInteger(tag.id) && tag.id > 0 && tag.name)
          : []
      );
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setCpf('');
      setBirthday('');
      setOrigem('manual');
      setLogradouro('');
      setNumero('');
      setComplemento('');
      setBairro('');
      setCidade('');
      setUf('');
      setCep('');
      setEmpresa('');
      setCargo('');
      setFaturamento('');
      setTags([]);
    }
  }, [initialData]);

  useEffect(() => {
    const fetchTags = async () => {
      if (searchTag.length < 2) {
        setTagSuggestions([]);
        return;
      }

      if (!user?.empresa_id) {
        setTagSuggestions([]);
        return;
      }

      try {
        const encrypted = await encrypt({ pesquisa: searchTag, empresa_id: user.empresa_id });
        const response = await fetch(`${API_BASE}/user/busca_tag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: encrypted }),
        });
        const respData = await response.json();
        const resp = await decrypt(respData.payload) as {
          boleano: boolean;
          obj?: { id: number; name: string }[];
          mensagem?: string;
        };
        console.log(resp);
        const currentTagIds = new Set(tags.map((tag) => Number(tag.id)));
        setTagSuggestions(
          (resp.obj || []).filter((tag) => !currentTagIds.has(Number(tag.id)))
        );
      } catch (err) {
        console.error('Erro ao buscar tags:', err);
      }
    };

    fetchTags();
  }, [searchTag, tags, user?.empresa_id]);

  const handleSelectTag = async (tag: { id: number; name: string }) => {
    if (!initialData?.id) return;

    const normalizedTagId = Number(tag.id);
    const normalizedTagName = String(tag.name || '').trim();
    if (!Number.isInteger(normalizedTagId) || normalizedTagId <= 0 || !normalizedTagName) {
      return;
    }

    if (tags.some((currentTag) => Number(currentTag.id) === normalizedTagId)) {
      setSearchTag('');
      setTagSuggestions([]);
      return;
    }

    try {
      const encrypted = await encrypt({ cliente_id: initialData.id, tag_id: normalizedTagId });
      await fetch(`${API_BASE}/user/vincular_tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: encrypted }),
      });
      setTags((prev) => [...prev, { id: normalizedTagId, name: normalizedTagName }]);
      setSearchTag('');
      setTagSuggestions([]);
    } catch (err) {
      console.error('Erro ao vincular tag:', err);
      alert('Erro ao vincular tag.');
    }
  };

  const handleRemoveTag = async (tagToRemove: ContactTagItem) => {
    if (!initialData?.id) return;

    try {
      const encrypted = await encrypt({
        cliente_id: initialData.id,
        tag_id: tagToRemove.id,
      });
      await fetch(`${API_BASE}/user/remover_vinculo_tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: encrypted }),
      });
      setTags((prev) => prev.filter((tag) => Number(tag.id) !== Number(tagToRemove.id)));
    } catch (err) {
      console.error('Erro ao remover tag:', err);
      alert('Erro ao remover tag.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedPhone = normalizePhoneForWhatsApp(phone);
    if (!normalizedPhone) {
      alert('Informe um telefone valido com DDD. Ex.: 11999998888 ou +55 11 99999-8888.');
      return;
    }

    const normalizedRevenue =
      faturamento.trim() === '' ? null : Number(String(faturamento).replace(',', '.'));

    if (normalizedRevenue !== null && !Number.isFinite(normalizedRevenue)) {
      alert('Informe um faturamento valido.');
      return;
    }

    const payload = isEditing
      ? {
          cliente_id: initialData?.id,
          nome: name,
          email,
          cpf,
          data_aniversario: birthday || null,
          origem,
          logradouro,
          numero,
          complemento,
          bairro,
          cidade,
          uf,
          cep,
          empresa,
          cargo,
          faturamento: normalizedRevenue,
        }
      : {
          empresa_id: user?.empresa_id,
          nome: name,
          email,
          telefone: normalizedPhone,
          cpf,
          data_aniversario: birthday || null,
          origem,
          logradouro,
          numero,
          complemento,
          bairro,
          cidade,
          uf,
          cep,
          empresa,
          cargo,
          faturamento: normalizedRevenue,
        };

    setLoading(true);
    try {
      const encrypted = await encrypt(payload);
      const response = await fetch(
        `${API_BASE}/user/${isEditing ? 'alterar_cliente' : 'criar_cliente'}`,
        {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: encrypted }),
        }
      );

      const respData = await response.json();
      const resp = await decrypt(respData.payload) as {
        boleano: boolean;
        obj?: Partial<Conversation> & {
          id?: number;
          nome?: string;
          telefone?: string;
          email?: string;
          cpf?: string | null;
          data_aniversario?: string | null;
          logradouro?: string | null;
          numero?: string | null;
          complemento?: string | null;
          bairro?: string | null;
          cidade?: string | null;
          uf?: string | null;
          cep?: string | null;
          empresa?: string | null;
          cargo?: string | null;
          faturamento?: number | string | null;
        };
        mensagem?: string;
      };

      if (resp?.boleano) {
        onSave({
          id: initialData?.id || resp?.obj?.id,
          name,
          email,
          phone: isEditing ? initialData?.phone || normalizedPhone : normalizedPhone,
          cpf,
          birthday,
          origem,
          logradouro,
          numero,
          complemento,
          bairro,
          cidade,
          uf: uf.toUpperCase(),
          cep,
          empresa,
          cargo,
          faturamento: normalizedRevenue,
        });
      } else {
        alert(`Erro ao salvar: ${resp?.mensagem || 'Falha desconhecida'}`);
      }
    } catch (err) {
      console.error('Erro ao alterar contato:', err);
      alert(err instanceof Error ? err.message : 'Erro ao salvar contato.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="contact-form">
      <Input
        label="Nome do Contato"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Input
        label="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="CPF"
        type="text"
        value={cpf}
        onChange={(e) => setCpf(e.target.value)}
      />
      <div className="input-wrapper">
        <label htmlFor="phone-input">Telefone</label>
        <IMaskInput
          id="phone-input"
          className="input-field"
          mask={phoneMasks}
          dispatch={(appended, dynamicMasked) => {
            const digits = `${dynamicMasked.value}${appended}`.replace(/\D/g, '');
            return digits.length > 10
              ? dynamicMasked.compiledMasks[1]
              : dynamicMasked.compiledMasks[0];
          }}
          value={phone}
          onAccept={(value: any) => setPhone(value)}
          placeholder="(11) 99999-8888"
          disabled={isEditing}
        />
        <small className="contact-form__hint">
          {isEditing
            ? "O telefone do cliente fica bloqueado para edição. Se precisar corrigir, crie um novo cadastro ou ajuste diretamente no fluxo de importação/webhook."
            : "Digite com DDD. Para este fluxo, o sistema salva o numero em formato canônico sem o nono digito."}
        </small>
      </div>
      <Input
        label="Aniversario"
        type="date"
        value={birthday}
        onChange={(e) => setBirthday(e.target.value)}
      />
      <div className="input-wrapper">
        <label htmlFor="contact-origin">Origem</label>
        <select
          id="contact-origin"
          className="input-field"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
        >
          <option value="manual">Criação manual</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="meta_ads">Meta Ads</option>
          <option value="importacao">Importação</option>
          <option value="comercial">Comercial</option>
        </select>
      </div>
      <div className="contact-form__tabs" role="tablist" aria-label="Secoes complementares do cadastro">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'empresa'}
          className={`contact-form__tab ${activeTab === 'empresa' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('empresa')}
        >
          Empresa
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'endereco'}
          className={`contact-form__tab ${activeTab === 'endereco' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('endereco')}
        >
          Endereco
        </button>
      </div>
      <div className="contact-form__tab-panel" role="tabpanel">
        {activeTab === 'empresa' ? (
          <>
            <Input
              label="Empresa"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
            />
            <Input
              label="Cargo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            />
            <Input
              label="Faturamento"
              type="number"
              value={faturamento}
              onChange={(e) => setFaturamento(e.target.value)}
              placeholder="Ex.: 15000"
            />
          </>
        ) : (
          <>
            <Input
              label="Logradouro"
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
            />
            <div className="contact-form__grid">
              <Input
                label="Numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
              <Input
                label="Complemento"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
              />
            </div>
            <Input
              label="Bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
            />
            <div className="contact-form__grid">
              <Input
                label="Cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
              />
              <Input
                label="UF"
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                maxLength={2}
              />
            </div>
            <Input
              label="CEP"
              value={cep}
              onChange={(e) => setCep(e.target.value)}
            />
          </>
        )}
      </div>

      <div className="input-wrapper" style={{ position: 'relative' }}>
        <label>Tags</label>
        <input
          type="text"
          ref={tagInputRef}
          value={searchTag}
        onChange={(e) => setSearchTag(e.target.value)}
        placeholder="Pesquisar tag..."
        className="input-field"
        disabled={!initialData?.id}
        />
        {tagSuggestions.length > 0 && (
          <ul className="contact-form__tag-suggestions">
            {tagSuggestions.map(tag => (
              <li className="tag-item" key={tag.id} onClick={() => handleSelectTag(tag)}>
                {tag.name}
              </li>
            ))}
          </ul>
        )}

        <div className="selected-tags">
          {tags.map((tag) => (
            <span key={tag.id} className="contact-form__selected-tag">
              <span>{tag.name}</span>
              {initialData?.id ? (
                <button
                  type="button"
                  className="contact-form__remove-tag"
                  onClick={() => void handleRemoveTag(tag)}
                  aria-label={`Remover tag ${tag.name}`}
                  title={`Remover tag ${tag.name}`}
                >
                  <FiX size={12} />
                </button>
              ) : null}
            </span>
          ))}
        </div>
        {!initialData?.id && (
          <small>As tags podem ser vinculadas depois que o contato for criado.</small>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-button" onClick={onCancel} disabled={loading}>
          Cancelar
        </button>
        <button type="submit" className="save-button" disabled={loading}>
          {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar contato'}
        </button>
      </div>
    </form>
  );
}
