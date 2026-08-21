import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { KeyRound, Building2 } from 'lucide-react-native';
import { login as loginRequest } from '../../api/auth';
import { describeError } from '../../api/client';
import { useSession } from '../../context/SessionContext';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CreateEnterpriseFlow } from './CreateEnterpriseFlow';

type AddMode = 'menu' | 'login';

// "Ajouter un compte" depuis l'app déjà connectée — toujours une connexion ADDITIVE
// (une identité personnelle existe forcément déjà pour arriver ici, voir
// DrawerContent). Pas de gate "identité perso d'abord" nécessaire ici, contrairement à
// welcome.tsx/activate.tsx.
//
// Pas de "Rejoindre une entreprise" ici : (auth)/activate.tsx vit dans le groupe
// (auth), inatteignable une fois authentifié ((auth)/_layout.tsx redirige) — rejoindre
// une entreprise depuis l'app déjà connectée nécessiterait de sortir cet écran de ce
// groupe, hors périmètre de ce chantier. Le lien d'invitation par email reste le chemin
// normal pour ce cas.
export function AddAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login, connectOrganization } = useSession();
  const [mode, setMode] = useState<AddMode>('menu');
  const [createOpen, setCreateOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const close = () => {
    setMode('menu');
    setUsername('');
    setPassword('');
    setError('');
    onClose();
  };

  const submitLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await loginRequest(username.trim(), password);
      if (data.organization.isPersonal) await login(data.token, data.user, data.organization);
      else await connectOrganization(data.token, data.user, data.organization);
      close();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  if (createOpen) {
    return (
      <CreateEnterpriseFlow
        open
        onClose={() => {
          setCreateOpen(false);
          close();
        }}
      />
    );
  }

  return (
    <Modal open={open} title="Ajouter un compte" onClose={close}>
      {mode === 'menu' && (
        <View className="-mx-5 -my-2">
          <Pressable onPress={() => setMode('login')} className="flex-row items-center gap-3 px-5 py-3.5">
            <KeyRound size={20} color="#9ca3af" />
            <Text className="flex-1 text-sm text-neutral-900 dark:text-neutral-100">Se connecter à une organisation</Text>
          </Pressable>
          <Pressable onPress={() => setCreateOpen(true)} className="flex-row items-center gap-3 px-5 py-3.5">
            <Building2 size={20} color="#9ca3af" />
            <Text className="flex-1 text-sm text-neutral-900 dark:text-neutral-100">Créer une entreprise</Text>
          </Pressable>
        </View>
      )}

      {mode === 'login' && (
        <View className="gap-4">
          <Input label="Nom d'utilisateur" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
          <Input label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry returnKeyType="done" onSubmitEditing={submitLogin} />
          {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
          <Button onPress={submitLogin} loading={loading}>
            Se connecter
          </Button>
        </View>
      )}
    </Modal>
  );
}
