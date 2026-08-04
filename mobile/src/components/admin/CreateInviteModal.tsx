import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { createInvite } from '../../api/invites.admin';
import { describeError } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { OrgRole } from '../../types/api';

const EMPTY = { username: '', email: '', nom: '', orgRole: 'MEMBER' as OrgRole };

export function CreateInviteModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.nom.trim()) return;
    setError('');
    setLoading(true);
    try {
      await createInvite(form);
      setForm(EMPTY);
      onCreated();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Nouvelle invitation"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onPress={onClose}>
            Annuler
          </Button>
          <Button
            className="flex-1"
            onPress={submit}
            loading={loading}
            disabled={!form.username.trim() || !form.email.trim() || !form.nom.trim()}
          >
            Créer
          </Button>
        </>
      }
    >
      <Input label="Nom complet" value={form.nom} onChangeText={t => setForm(p => ({ ...p, nom: t }))} />
      <Input
        label="Nom d'utilisateur"
        value={form.username}
        onChangeText={t => setForm(p => ({ ...p, username: t }))}
        autoCapitalize="none"
      />
      <Input
        label="Email"
        value={form.email}
        onChangeText={t => setForm(p => ({ ...p, email: t }))}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <View className="gap-1.5">
        <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Rôle</Text>
        <View className="flex-row gap-1.5">
          {(['MEMBER', 'ADMIN'] as OrgRole[]).map(role => {
            const active = form.orgRole === role;
            return (
              <Pressable
                key={role}
                onPress={() => setForm(p => ({ ...p, orgRole: role }))}
                className={`rounded-full border px-3 py-1.5 ${
                  active ? 'border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100' : 'border-neutral-200 dark:border-neutral-700'
                }`}
              >
                <Text className={`text-xs ${active ? 'font-medium text-white dark:text-neutral-900' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  {role === 'MEMBER' ? 'Membre' : 'Admin'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
    </Modal>
  );
}
