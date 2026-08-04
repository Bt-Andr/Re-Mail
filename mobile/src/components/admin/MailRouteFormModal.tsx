import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { createMailRoute, updateMailRoute } from '../../api/mailRoutes';
import { describeError } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { MailRoute } from '../../types/api';

const EMPTY = { alias: '', personalEmail: '', displayName: '' };

interface MailRouteFormModalProps {
  open: boolean;
  editing: MailRoute | null;
  onClose: () => void;
  onSaved: () => void;
}

export function MailRouteFormModal({ open, editing, onClose, onSaved }: MailRouteFormModalProps) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm(editing ? { alias: editing.alias, personalEmail: editing.personalEmail, displayName: editing.displayName || '' } : EMPTY);
    setError('');
  }, [editing, open]);

  const submit = async () => {
    if (!form.alias.trim()) return;
    setError('');
    setLoading(true);
    try {
      if (editing) await updateMailRoute(editing.id, form);
      else await createMailRoute(form);
      onSaved();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={editing ? "Modifier l'adresse" : 'Nouvelle adresse'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onPress={onClose}>
            Annuler
          </Button>
          <Button className="flex-1" onPress={submit} loading={loading} disabled={!form.alias.trim()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <Input
        label="Adresse"
        placeholder="contact@votredomaine.com"
        value={form.alias}
        onChangeText={t => setForm(p => ({ ...p, alias: t }))}
        autoCapitalize="none"
      />
      <Input
        label="Transférer vers (optionnel)"
        placeholder="vous@gmail.com"
        value={form.personalEmail}
        onChangeText={t => setForm(p => ({ ...p, personalEmail: t }))}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Input
        label="Nom affiché (optionnel)"
        placeholder="Service Commercial"
        value={form.displayName}
        onChangeText={t => setForm(p => ({ ...p, displayName: t }))}
      />
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
    </Modal>
  );
}
