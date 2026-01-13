# VS Code Offline Konfiguration

Diese Konfigurationsdateien ermöglichen die Nutzung des Gitea Remote Repositories Extensions ohne Marketplace-Zugriff.

## Dateien

### `.vscode/settings.json`
Deaktiviert alle Marketplace-Funktionen:
- ✅ Marketplace Service URLs
- ✅ Extension-Updates
- ✅ Recommendations
- ✅ Telemetry
- ✅ Experiments
- ✅ Settings Sync

### `.vscode/extensions.json`
Definiert optionale lokale Extensions (falls offline vorhanden):
- `esbenp.prettier-vscode` - Code Formatter
- `dbaeumer.vscode-eslint` - ESLint Integration

### `.vscodeignore`
Optimiert das VSIX-Paket für Offline-Nutzung:
- Entfernt node_modules (nicht benötigt)
- Entfernt TypeScript Definition Maps
- Entfernt Development-Dateien

## Verwendung

1. **VS Code Offline starten:**
   ```bash
   code --no-internet
   ```

2. **Extension aus VSIX installieren:**
   ```bash
   code --install-extension g2r-1.0.1.vsix
   ```

3. **Einstellungen prüfen:**
   - Öffne `File → Preferences → Settings`
   - Suche nach "extensions" oder "update"
   - Alle Einstellungen sollten deaktiviert sein

## Sicherheit

Diese Konfiguration sorgt dafür, dass VS Code:
- ❌ Keine Verbindung zum Marketplace aufbaut
- ❌ Keine Updates prüft
- ❌ Keine Telemetrie sendet
- ❌ Keine Experimente durchführt
- ❌ Settings nicht synchronisiert

## Für Workspace-Nutzung

Diese Einstellungen gelten nur für diesen Workspace. Sie können auch global in `~/.config/Code/User/settings.json` konfiguriert werden.
