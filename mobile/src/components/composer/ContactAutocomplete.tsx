import { useEffect, useState } from 'react';
import { Pressable, Text, View, type TextInputProps } from 'react-native';
import { listContacts } from '../../api/contacts';
import { Input } from '../ui/Input';
import type { Contact } from '../../types/api';

// Autocomplétion best-effort dérivée de l'historique des échanges (GET /contacts,
// voir web/src/features/inbox/ContactAutocomplete.tsx pour l'équivalent web) — une
// erreur réseau ici ne doit jamais bloquer la saisie manuelle de l'adresse.
export function ContactAutocomplete({
  label,
  value,
  onChangeText,
  editable,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'editable'>) {
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (editable === false || !value.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      listContacts(value.trim())
        .then(setSuggestions)
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [value, editable]);

  const pick = (c: Contact) => {
    onChangeText(c.email);
    setSuggestions([]);
    setFocused(false);
  };

  return (
    <View className="gap-1.5">
      <Input
        label={label}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        onFocus={() => setFocused(true)}
        // Délai avant fermeture : laisse le temps au Pressable d'une suggestion de
        // recevoir son onPress avant que la liste ne disparaisse (le blur du champ
        // arrive avant le press sur RN, comme le onMouseDown côté web).
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        {...rest}
      />
      {focused && editable !== false && suggestions.length > 0 && (
        <View className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          {suggestions.map((c, i) => (
            <Pressable
              key={c.email}
              onPress={() => pick(c)}
              className={`px-3 py-2.5 ${i < suggestions.length - 1 ? 'border-b border-neutral-100 dark:border-neutral-800' : ''}`}
            >
              {c.name ? <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{c.name}</Text> : null}
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">{c.email}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
