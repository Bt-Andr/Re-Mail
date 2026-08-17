const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// SDK 57's monorepo auto-detection ne résout pas @re-mail/design-tokens (package
// scope symlinké dans node_modules/@re-mail/ depuis packages/design-tokens) dans cet
// environnement — confirmé après `expo start --clear` (cache non en cause). Watch
// folders + nodeModulesPaths explicites : pattern documenté par Expo pour les
// monorepos pré-SDK 52, toujours accepté en complément de l'auto-détection SDK 57.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// watchFolders/nodeModulesPaths seuls ne suffisent pas ici : Metro échoue à
// résoudre le symlink node_modules/@re-mail/design-tokens (workspace npm) dans cet
// environnement. Alias direct vers le vrai dossier du package — contourne la
// résolution de symlink plutôt que d'en dépendre.
config.resolver.extraNodeModules = {
  '@re-mail/design-tokens': path.resolve(workspaceRoot, 'packages/design-tokens'),
};
config.resolver.unstable_enableSymlinks = true;

module.exports = withNativeWind(config, { input: './global.css' });
