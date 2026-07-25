const rawUrl = process.env.EXPO_PUBLIC_API_URL;

if (!rawUrl) {
  console.warn(
    '[config] EXPO_PUBLIC_API_URL manquant — voir mobile/.env.example. Repli sur http://localhost:3001/api.'
  );
}

export const API_URL = (rawUrl ?? 'http://localhost:3001/api').replace(/\/$/, '');
