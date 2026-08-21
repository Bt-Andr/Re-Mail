import { useState } from 'react';
import { Text } from 'react-native';
import { signup } from '../../api/auth';
import { describeError } from '../../api/client';
import { useSession } from '../../context/SessionContext';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ResendConnectSheet } from './ResendConnectSheet';

// "Créer une entreprise" depuis l'écran d'accueil : symétrique à l'inscription "pro" de
// (auth)/signup.tsx, juste réduite à ce cas précis — puis enchaîne directement sur
// ResendConnectSheet (réutilisé tel quel) une fois la session établie.
export function CreateEnterpriseFlow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { connectOrganization } = useSession();
  const [signedUp, setSignedUp] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [nom, setNom] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const close = () => {
    setSignedUp(false);
    setOrgName('');
    setNom('');
    setUsername('');
    setEmail('');
    setPassword('');
    setError('');
    onClose();
  };

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await signup({ accountType: 'pro', orgName, nom, username: username.trim(), email: email.trim(), password });
      // Connexion ADDITIVE : ne remplace jamais l'identité personnelle déjà en place
      // (welcome.tsx n'ouvre ce flow qu'une fois hasPersonalAccount vrai).
      await connectOrganization(data.token, data.user, data.organization);
      setSignedUp(true);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  if (signedUp) {
    return <ResendConnectSheet open onClose={close} onConnected={close} />;
  }

  return (
    <Modal open={open} title="Créer votre entreprise" onClose={close}>
      <Input label="Nom de l'organisation" value={orgName} onChangeText={setOrgName} returnKeyType="next" />
      <Input label="Votre nom" value={nom} onChangeText={setNom} returnKeyType="next" />
      <Input label="Nom d'utilisateur" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" />
      <Input label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry returnKeyType="done" onSubmitEditing={submit} />
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
      <Button
        onPress={submit}
        loading={loading}
        disabled={!nom.trim() || !username.trim() || !email.trim() || !password || !orgName.trim()}
      >
        Continuer
      </Button>
    </Modal>
  );
}
