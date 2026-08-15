import Svg, { Path, Rect, Circle, Text as SvgText } from 'react-native-svg';

// Recréations simplifiées des logos de marque (pas les assets officiels — aucun asset de
// marque n'existait dans ce repo avant, remplaçables plus tard si une fidélité
// pixel-perfect est nécessaire). Utilisées uniquement dans l'écran "ajouter un compte".

interface IconProps {
  size?: number;
}

export function GoogleIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 34.7 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.6 5.6C40.4 36.9 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </Svg>
  );
}

export function OutlookIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x="4" y="4" width="40" height="40" rx="6" fill="#0364B8" />
      <Rect x="26" y="12" width="18" height="20" rx="2" fill="#28A8EA" />
      <Path d="M26 14l9 6 9-6" stroke="#fff" strokeWidth="1.5" fill="none" />
      <Circle cx="19" cy="24" r="9" fill="#fff" />
      <Circle cx="19" cy="24" r="6" fill="#0364B8" />
    </Svg>
  );
}

export function YahooIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width="48" height="48" rx="8" fill="#6001D2" />
      <SvgText x="24" y="32" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="20" fill="#fff" textAnchor="middle">
        y!
      </SvgText>
    </Svg>
  );
}

export function ExchangeIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width="48" height="48" rx="8" fill="#0078D4" />
      <SvgText x="24" y="32" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="22" fill="#fff" textAnchor="middle">
        X
      </SvgText>
    </Svg>
  );
}
