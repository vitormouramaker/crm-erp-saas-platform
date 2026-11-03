import { useState, useEffect } from 'react';
import { Input } from '../common/Input/Input';
import type { Supplier } from '../../data/mockData';
import './SupplierForm.css';

type SupplierCreationData = Omit<Supplier, 'id'>;

interface SupplierFormProps {
  onSave: (supplierData: Supplier | SupplierCreationData) => void;
  onCancel: () => void;
  initialData?: Supplier | null;
}

export function SupplierForm({ onSave, onCancel, initialData }: SupplierFormProps) {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cnpj, setCnpj] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setContactPerson(initialData.contactPerson);
      setPhone(initialData.phone);
      setEmail(initialData.email);
      setCnpj(initialData.cnpj || '');
    } else {
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setCnpj('');
    }
  }, [initialData]);

  // Função para aplicar máscara no telefone
  const formatPhone = (value: string) => {
    value = value.replace(/\D/g, ''); // remove tudo que não for número
    if (value.length <= 10) {
      return value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else {
      return value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    }
  };

  // Função para aplicar máscara no CNPJ
  const formatCnpj = (value: string) => {
    value = value.replace(/\D/g, ''); // remove tudo que não for número
    return value
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const supplierData = { name, contactPerson, phone, email, cnpj };

    if (initialData) {
      onSave({ ...supplierData, id: initialData.id });
    } else {
      onSave(supplierData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="supplier-form">
      <Input
        label="Nome do Fornecedor"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex: TechDistribuidora Ltda."
        required
      />
      <Input
        label="Pessoa de Contato"
        value={contactPerson}
        onChange={(e) => setContactPerson(e.target.value)}
        placeholder="Ex: Carlos Silva"
        required
      />
      <Input
        label="CNPJ"
        value={cnpj}
        onChange={(e) => setCnpj(formatCnpj(e.target.value))}
        placeholder="Ex: 12.345.678/0001-90"
        required
      />
      <Input
        label="Telefone"
        value={phone}
        onChange={(e) => setPhone(formatPhone(e.target.value))}
        placeholder="Ex: (11) 98765-4321"
        required
      />
      <Input
        label="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Ex: contato@techdist.example.com"
        required
      />
      <div className="form-actions">
        <button type="button" className="cancel-button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="save-button">
          Salvar
        </button>
      </div>
    </form>
  );
}
