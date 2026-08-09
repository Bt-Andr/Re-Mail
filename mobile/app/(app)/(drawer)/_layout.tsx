import { Drawer } from 'expo-router/drawer';
import { InboxSearchProvider } from '../../../src/context/InboxSearchContext';
import { InboxHeader } from '../../../src/components/inbox/InboxHeader';
import { InboxDrawerContent } from '../../../src/components/inbox/DrawerContent';
import { useTheme } from '../../../src/context/ThemeContext';

// Remplace les anciens onglets du bas (Inbox/Réglages) — navigation façon Gmail :
// tiroir latéral (dossiers + Brouillons + Administration + Réglages) ouvert par le
// hamburger de InboxHeader, ou par swipe depuis le bord (react-native-gesture-handler).
export default function DrawerLayout() {
  const { theme } = useTheme();
  const backgroundColor = theme === 'dark' ? '#0a0a0a' : '#ffffff';

  return (
    <InboxSearchProvider>
      <Drawer
        screenOptions={{
          header: props => <InboxHeader {...props} />,
          drawerStyle: { backgroundColor },
          sceneStyle: { backgroundColor },
        }}
        drawerContent={props => <InboxDrawerContent {...props} />}
      >
        <Drawer.Screen name="inbox" options={{ drawerLabel: 'Réception', title: 'Réception' }} />
        <Drawer.Screen name="sent" options={{ drawerLabel: 'Envoyés', title: 'Envoyés' }} />
        <Drawer.Screen name="archive" options={{ drawerLabel: 'Archivés', title: 'Archivés' }} />
        <Drawer.Screen name="trash" options={{ drawerLabel: 'Corbeille', title: 'Corbeille' }} />
      </Drawer>
    </InboxSearchProvider>
  );
}
