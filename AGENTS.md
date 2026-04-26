# VOID OSINT // ANONYMOUS - Context Memory

## Project Mission
VOID OSINT is a recursive intelligence engine designed for open-source data exploitation, relationship mapping, and forensic analysis. It bridges the gap between raw data collection and actionable high-level intelligence using AI-driven synthesis.

## Core Architectural Pillars

### 1. Visual Forensics (The Fractal Graph)
- **Component**: `src/components/Graph.tsx`
- **Logic**: Uses D3.js to render complex relationship networks.
- **Node Coloring**: 
  - `TARGET`: Green (`#00ff00`)
  - `EMAIL`: Cyan (`#00ffff`)
  - `DOMAIN`: Yellow (`#ffff00`)
  - `SOCIAL`: Magenta (`#ff00ff`)
  - `LEAK`: Red (`#ff0000`)
  - `PERSON`: Green (`#00ff00`)
  - `COMPANY`: Royal Blue (`#3366ff`)
  - `POLITICAL`: Orange (`#ff9900`)
  - `FINANCIAL`: Emerald (`#00cc66`)
- **Interactions**: Neighbor highlighting on hover, search-to-focus, and node expansion using AI.

### 2. The "Brazil Layer" OSINT
- **Specialization**: Deep-dive patterns for Brazilian entities (CPF, CNPJ, Placas, Renavam, Chassi).
- **Service**: Integrated in `geminiService.ts` and `osintRegex.ts`.
- **Targeting**: Maps historical government and leaked database patterns unique to the region.

### 3. Lite Mode & Token Optimization
- **Trigger**: Automatically enables when billing/paid quota errors occur or manual toggle in UI.
- **Impact**: 
  - Disables `googleSearch` and `googleMaps` tools.
  - Switches to `gemini-1.5-flash` for all tasks.
  - Limits output tokens to 4k to conserve free-tier resources.
- **UI**: Displays amber warnings on restricted modules (Multimedia/Maps).

### 4. Continuous Generation
- **Problem**: AI often truncates long investigative reports.
- **Solution**: A logic in `App.tsx` checks for truncated responses and provides a "CONTINUE GENERATION" button that merges state.

## Intelligence Resources & Integrated Repositories
The system's "Brazil Layer" and cognitive reasoning are grounded in the following specialized OSINT resources:

- **OSINT Brazuca**: Primary repository for public Brazilian data (CNPJ, TSE, Receita Federal).
- **OSINTKit-Brasil**: Collection of 1,600+ specialized Brazilian OSINT links.
- **Capivara OSINT**: Brazilian fork of the global OSINT Framework.
- **br-acc (World Transparency Graph)**: ETL for cross-referencing transparency data.
- **Blackbird & Sherlock**: Integrated for deep username/social footprint mapping.
- **Data Sources**: Registro.br, IBGE, Sancionados, and Wigle.net for signal intelligence.

## Technical Stack
- **Frontend**: React 18, Tailwind CSS (Design: Cyberpunk/Brutalist).
- **AI Backend**: `@google/genai` (SDK).
- **Database**: Firebase Firestore (Enterprise Edition).
- **State Management**: React Hooks + Persistence in LocalStorage for session safety.

## Persistence Model (Firestore)
- `/history`: Full investigation logs, including graph states and chat messages.
- `/targets`: Persistent entities for real-time monitoring.
- `/alerts`: Triggered intelligence notifications.
- `/learned_patterns`: A global feedback loop where the AI records successful extraction paths.

## Current Operational Status (2026-04-20)
- **Firebase Issue**: Current account has exceeded project creation quotas. 
- **Workaround**: `src/firebase.ts` has been modified to use "Soft Degradation". The app will warn about database connectivity but remains 100% functional for real-time intelligence gathering without persistence.
- **Security**: Firestore rules configured for health-check transparency (`/_internal_/connection_test`).

## Agent Instructions (Rules for Future Assistants)
1. **Design First**: Maintain the high-contrast, information-dense aesthetic. No soft pastels. Use only `lucide-react`.
2. **Lite Mode Sensitivity**: Always check `liteMode` state before suggesting features that require paid search APIs.
3. **Graph Integrity**: When modifying data structures, ensure `Node` and `Link` interfaces in `src/types.ts` are respected to avoid breaking the D3 simulation.
4. **Resilience**: Never remove the `try-catch` blocks around Firestore calls; the app must function even if the database is unreachable.
