# FossGIS Workshop 2026

Dieses Repository enthält Beispiele, die im FossGIS Workshop "Open Source 3D-GIS im Browser: Einstieg in 3D Tiles mit deck.gl und MapComponents" verwendet werden.

## Einrichtung

Für die Einrichtung des Repositories wurden folgende Befehle ausgeführt:

```bash
npm create mapcomponents-app fossgis-workshop-2016-3dtiles
cd fossgis-workshop-2016-3dtiles
```

Anschließend wurde mit `npm` das deck.gl-Package installiert:

```bash
npm i @mapcomponents/deck-gl
```

In der Datei `src/main.tsx` wurde der DeckGlContextProvider, als Kinder des MapComponentsProvider, hinzugefügt:

```tsx
    <MapComponentsProvider>
      <DeckGlContextProvider>
        <App />
      </DeckGlContextProvider>
    </MapComponentsProvider>
```

# So verwendest du dieses Repository

Dieses Repository basiert auf dem vite ts-react Template und fügt alle
erforderlichen Basiskomponenten für eine MapComponents-Anwendung hinzu.

## Pakete installieren

```bash
npm i
```

## Entwicklungsserver starten

```bash
npm run dev
```

## Für Produktion bauen

```bash
npm run build
```