import React, { useState } from 'react';
import type { DutInfo } from '../../domain/types.js';

interface Props {
  templateName: string;
  onStart: (dut: DutInfo, executedBy: string) => void;
  onCancel: () => void;
}

interface FormState {
  serialNumber: string;
  model: string;
  location: string;
  executedBy: string;
}

export function DutInfoView({ templateName, onStart, onCancel }: Props): React.ReactElement {
  const [form, setForm] = useState<FormState>({
    serialNumber: '',
    model: '',
    location: '',
    executedBy: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (form.serialNumber.trim() === '') newErrors.serialNumber = 'Champ obligatoire';
    if (form.model.trim() === '') newErrors.model = 'Champ obligatoire';
    if (form.executedBy.trim() === '') newErrors.executedBy = 'Champ obligatoire';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const dut: { serialNumber: string; model: string; location?: string } = {
      serialNumber: form.serialNumber.trim(),
      model: form.model.trim(),
    };
    if (form.location.trim() !== '') dut.location = form.location.trim();

    onStart(dut, form.executedBy.trim());
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Informations de l'équipement testé</h2>
        <p style={styles.sub}>Template : <strong>{templateName}</strong></p>

        <form onSubmit={handleSubmit} noValidate>
          <Field
            label="Numéro de série *"
            value={form.serialNumber}
            onChange={set('serialNumber')}
            error={errors.serialNumber}
            autoFocus
            placeholder="ex. SN-202410-0042"
          />
          <Field
            label="Modèle / type *"
            value={form.model}
            onChange={set('model')}
            error={errors.model}
            placeholder="ex. Défibrilateur XYZ-3000"
          />
          <Field
            label="Lieu / service"
            value={form.location}
            onChange={set('location')}
            error={undefined}
            placeholder="ex. Bloc opératoire B"
          />

          <hr style={styles.sep} />

          <Field
            label="Technicien *"
            value={form.executedBy}
            onChange={set('executedBy')}
            error={errors.executedBy}
            placeholder="Nom du technicien"
          />

          <div style={styles.footer}>
            <button type="button" onClick={onCancel} style={styles.btnCancel}>
              Annuler
            </button>
            <button type="submit" style={styles.btnStart}>
              Démarrer le test ▶
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error: string | undefined;
  placeholder?: string;
  autoFocus?: boolean;
}): React.ReactElement {
  return (
    <div style={fieldStyles.group}>
      <label style={fieldStyles.label}>{label}</label>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={error !== undefined ? fieldStyles.inputError : fieldStyles.input}
        aria-invalid={error !== undefined}
      />
      {error !== undefined && <span role="alert" style={fieldStyles.errorMsg}>{error}</span>}
    </div>
  );
}

const styles = {
  overlay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f0f2f5',
    padding: '24px',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: '8px',
    border: '1px solid #dee2e6',
    padding: '32px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  heading: {
    margin: '0 0 4px 0',
    fontSize: '18px',
    fontWeight: 700 as const,
    color: '#212529',
  },
  sub: {
    margin: '0 0 24px 0',
    fontSize: '13px',
    color: '#6c757d',
  },
  sep: {
    border: 'none',
    borderTop: '1px solid #e9ecef',
    margin: '16px 0',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '24px',
  },
  btnCancel: {
    padding: '8px 18px',
    background: 'transparent',
    border: '1px solid #adb5bd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#495057',
  },
  btnStart: {
    padding: '8px 20px',
    background: '#198754',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500 as const,
  },
} as const;

const fieldStyles = {
  group: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    marginBottom: '14px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500 as const,
    color: '#495057',
  },
  input: {
    padding: '7px 10px',
    fontSize: '14px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    outline: 'none',
  },
  inputError: {
    padding: '7px 10px',
    fontSize: '14px',
    border: '1px solid #dc3545',
    borderRadius: '4px',
    outline: 'none',
  },
  errorMsg: {
    fontSize: '12px',
    color: '#dc3545',
  },
} as const;
