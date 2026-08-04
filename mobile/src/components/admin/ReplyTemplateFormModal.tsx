import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { createReplyTemplate, updateReplyTemplate } from '../../api/replyTemplates';
import { describeError } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { ReplyTemplate } from '../../types/api';

const EMPTY = { titre: '', corps: '', canal: '' };

interface ReplyTemplateFormModalProps {
  open: boolean;
  editing: ReplyTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ReplyTemplateFormModal({ open, editing, onClose, onSaved }: ReplyTemplateFormModalProps) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm(editing ? { titre: editing.titre, corps: editing.corps, canal: editing.canal ?? '' } : EMPTY);
    setError('');
  }, [editing, open]);

  const submit = async () => {
    if (!form.titre.trim() || !form.corps.trim()) return;
    setError('');
    setLoading(true);
    try {
      const values = { titre: form.titre, corps: form.corps, canal: form.canal.trim() || undefined };
      if (editing) await updateReplyTemplate(editing.id, values);
      else await createReplyTemplate(values);
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
      title={editing ? 'Modifier le modèle' : 'Nouveau modèle'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onPress={onClose}>
            Annuler
          </Button>
          <Button className="flex-1" onPress={submit} loading={loading} disabled={!form.titre.trim() || !form.corps.trim()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <Input
        label="Titre"
        placeholder="Réponse standard RH"
        value={form.titre}
        onChangeText={t => setForm(p => ({ ...p, titre: t }))}
      />
      <Input
        label="Canal (optionnel — vide = tous les canaux)"
        placeholder="rh"
        value={form.canal}
        onChangeText={t => setForm(p => ({ ...p, canal: t }))}
        autoCapitalize="none"
      />
      <Input
        label="Corps du message"
        placeholder="Bonjour, merci pour votre message…"
        value={form.corps}
        onChangeText={t => setForm(p => ({ ...p, corps: t }))}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        className="min-h-28"
      />
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
    </Modal>
  );
}
