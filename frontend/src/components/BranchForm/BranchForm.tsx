import { useState, useEffect } from 'react';
import { Input } from '../common/Input/Input';
import type { Branch } from '../../data/mockData';
import './BranchForm.css';

type BranchCreationData = Omit<Branch, 'id'>;

interface BranchFormProps {
  onSave: (branchData: Branch | BranchCreationData) => void;
  onCancel: () => void;
  initialData?: Branch | null;
  isPrimaryDisabled?: boolean;
}

// Funções de máscara
const maskCNPJ = (value: string) => {
  let v = value.replace(/\D/g, ''); // Remove tudo que não é número
  v = v.slice(0, 14); // Limita a 14 dígitos
  return v
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const maskPhone = (value: string) => {
  let v = value.replace(/\D/g, '');
  v = v.slice(0, 11); // Limita a 11 dígitos (DDD + número)
  if (v.length <= 10) {
    return v.replace(/^(\d{2})(\d{4})(\d+)/, '($1) $2-$3');
  } else {
    return v.replace(/^(\d{2})(\d{5})(\d+)/, '($1) $2-$3');
  }
};

export function BranchForm({ onSave, onCancel, initialData, isPrimaryDisabled = false }: BranchFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    cnpj: '',
    manager: '',
    contact: '',
    isPrimary: false,
    latitude: '',
    longitude: '',
    toleranceMeters: '100',
  });
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        address: initialData.address || '',
        cnpj: initialData.cnpj || '',
        manager: initialData.manager || '',
        contact: initialData.contact || '',
        isPrimary: Boolean(initialData.isPrimary),
        latitude:
          initialData.latitude === null || initialData.latitude === undefined
            ? ''
            : String(initialData.latitude),
        longitude:
          initialData.longitude === null || initialData.longitude === undefined
            ? ''
            : String(initialData.longitude),
        toleranceMeters:
          initialData.toleranceMeters === null || initialData.toleranceMeters === undefined
            ? '100'
            : String(initialData.toleranceMeters),
      });
    } else {
      setFormData({
        name: '',
        address: '',
        cnpj: '',
        manager: '',
        contact: '',
        isPrimary: false,
        latitude: '',
        longitude: '',
        toleranceMeters: '100',
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    let newValue = value;
    if (name === 'cnpj') {
      newValue = maskCNPJ(value);
    } else if (name === 'contact') {
      newValue = maskPhone(value);
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : newValue
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      latitude: formData.latitude ? Number(formData.latitude) : null,
      longitude: formData.longitude ? Number(formData.longitude) : null,
      toleranceMeters: formData.toleranceMeters
        ? Number(formData.toleranceMeters)
        : 100,
    };
    if (initialData) {
      onSave({ ...payload, id: initialData.id });
    } else {
      onSave(payload);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalizacao nao suportada neste navegador.');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(7),
          longitude: position.coords.longitude.toFixed(7),
        }));
        setLocationLoading(false);
      },
      () => {
        setLocationLoading(false);
        alert('Nao foi possivel capturar a localizacao atual.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  const hasCoordinates = formData.latitude && formData.longitude;
  const mapUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`
    : '';

  return (
    <form onSubmit={handleSubmit} className="branch-form">
      <Input label="Nome da Filial" name="name" value={formData.name} onChange={handleChange} required />
      <Input label="Endereço" name="address" value={formData.address} onChange={handleChange} required />
      <Input 
        label="CNPJ" 
        name="cnpj" 
        value={formData.cnpj} 
        onChange={handleChange} 
        required 
        // A propriedade 'disabled' é true se 'initialData' existir (modo de edição)
        disabled={!!initialData} 
        title={initialData ? "O CNPJ não pode ser editado." : ""}
      />
      <Input label="Responsável" name="manager" value={formData.manager} onChange={handleChange} required />
      <Input label="Contato (Telefone)" name="contact" value={formData.contact} onChange={handleChange} required />
      <div className="branch-form-location-grid">
        <Input
          label="Latitude"
          name="latitude"
          type="number"
          step="0.0000001"
          value={formData.latitude}
          onChange={handleChange}
          placeholder="-5.0892100"
        />
        <Input
          label="Longitude"
          name="longitude"
          type="number"
          step="0.0000001"
          value={formData.longitude}
          onChange={handleChange}
          placeholder="-42.8012300"
        />
      </div>
      <Input
        label="Tolerancia do ponto (metros)"
        name="toleranceMeters"
        type="number"
        min="1"
        step="1"
        value={formData.toleranceMeters}
        onChange={handleChange}
        required
      />
      <div className="branch-form-location-actions">
        <button
          type="button"
          className="location-helper-button"
          onClick={handleUseCurrentLocation}
          disabled={locationLoading}
        >
          {locationLoading ? 'Capturando localizacao...' : 'Usar localizacao atual'}
        </button>
        {hasCoordinates ? (
          <a
            className="location-helper-link"
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
          >
            Abrir no mapa
          </a>
        ) : null}
      </div>
      <div className="checkbox-wrapper">
        <input 
          type="checkbox" 
          id="isPrimary"
          name="isPrimary" 
          checked={formData.isPrimary} 
          onChange={handleChange}
          disabled={isPrimaryDisabled}
        />
        <label htmlFor="isPrimary">
          Marcar como Filial Principal
          {isPrimaryDisabled && <span className="tooltip">Já existe uma filial principal.</span>}
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="cancel-button" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="save-button">Salvar</button>
      </div>
    </form>
  );
}
