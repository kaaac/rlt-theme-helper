# RLT API Models Generator

Generator automatycznie pobiera klasy C# z repozytorium [RacingLeagueTools_RendererAPI](https://github.com/vlad-men/RacingLeagueTools_RendererAPI), parsuje je i generuje schematy JSON używane do autocomplete w rozszerzeniu.

## Jak używać

### Uruchomienie generatora

```bash
npm run generate:models
```

Lub bezpośrednio:

```bash
node scripts/generate.js
```

## Co robi generator?

1. **Pobiera pliki C# z GitHub** - z określonych folderów (Session, Driver, Team, Car, itp.)
2. **Parsuje klasy** - wyciąga nazwy klas, właściwości, typy, dziedziczenie
3. **Buduje drzewo dziedziczenia** - rozwiązuje właściwości z klas bazowych
4. **Generuje schematy JSON** - tworzy pliki w folderze `api_models/`
5. **Tworzy mapowania** - `mapping.json` mapuje ItemsSource na klasy

## Struktura wyjściowa

Po uruchomieniu generatora, w folderze `api_models/` znajdziesz:

```
api_models/
├── mapping.json              # Mapowanie ItemsSource -> Klasa
├── index.json                # Indeks wszystkich klas
├── autocomplete.json         # Dane dla autocomplete
├── DriverSessionRenderData.json
├── SessionRenderData.json
├── TeamRenderData.json
├── DriverRenderObject.json
└── ... (pozostałe klasy)
```

### mapping.json

```json
{
  "Session.Drivers": "DriverSessionRenderData",
  "Session.Teams": "TeamRenderData",
  "Driver.Features": "DriverFeatureInfo"
}
```

### Przykład schematu klasy

`DriverSessionRenderData.json`:
```json
{
  "className": "DriverSessionRenderData",
  "namespace": "RacingLeagueTools.FlexRenderer.Models",
  "properties": [
    {
      "name": "Position",
      "type": "number",
      "isNullable": false,
      "isCollection": false,
      "isComplex": false,
      "description": "Position value"
    },
    {
      "name": "Driver",
      "type": "DriverRenderObject",
      "isNullable": false,
      "isCollection": false,
      "isComplex": true,
      "description": "Driver property"
    }
  ]
}
```

## Konfiguracja

Konfiguracja znajduje się w `scripts/generate.js`:

```javascript
const CONFIG = {
    github: {
        owner: 'vlad-men',
        repo: 'RacingLeagueTools_RendererAPI',
        branch: 'cd7a546423c5aea550079f9c52a8bb223b779164', // commit "v0.9.8"
        directories: ['Base', 'Championship', 'Session', ...]
    },
    output: {
        modelsDir: path.join(__dirname, '..', 'api_models')
    }
};
```

## Komponenty generatora

### 1. fetchApiModels.js
- Listę plików `.cs` pobiera jednym zapytaniem do GitHub API (drzewo repo), same pliki z `raw.githubusercontent.com`
- Opcjonalny token w `GITHUB_TOKEN` / `GH_TOKEN` podnosi limit zapytań API (np. `GH_TOKEN=$(gh auth token) npm run generate:models`)
- Przerywa generowanie, gdy brakuje katalogu albo któryś plik się nie pobierze — częściowe pobranie nigdy nie nadpisuje modeli

### 2. parseCSharpClasses.js
- Parsuje klasy C# (regex-based)
- Wyciąga właściwości, typy, dziedziczenie
- Mapuje typy C# na typy JSON-friendly
- Buduje drzewo dziedziczenia

### 3. generateModelSchemas.js
- Generuje schematy JSON dla każdej klasy
- Tworzy `mapping.json` z mapowaniami (obiekty główne z `data-objects.md` + ręczne mapowania ItemsSource)
- Usuwa modele klas, których nie ma już w API
- Generuje `index.json` z indeksem klas
- Tworzy `autocomplete.json` dla providerów

### 4. generate.js
- Główny entry point
- Orkiestruje cały proces
- Obsługuje cleanup i error handling

## Uwagi

- Generator obecnie znajduje się w tym repo, ale zostanie przeniesiony do prywatnego repozytorium
- Wygenerowane pliki JSON pozostaną w `api_models/` w tym repozytorium
- Generator jest uruchamiany ręcznie gdy API się zmieni
- Używa konkretnego commita z GitHub dla stabilności (repo API nie ma tagów)

## Aktualizacja modeli

Gdy RacingLeagueTools API się zmieni:

1. Zaktualizuj `branch` w konfiguracji (hash commita nowej wersji) i listę `directories`, jeśli doszły nowe katalogi
2. Uruchom `npm run generate:models`
3. Zcommituj nowe/zmienione pliki w `api_models/`

## TODO

- [ ] Przenieść generator do prywatnego repo
- [ ] Dodać więcej testów parsera
- [ ] Wspierać więcej typów C# (Dictionary, Tuple, itp.)
- [ ] Auto-detect więcej mapowań ItemsSource
