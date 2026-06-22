# BITMIND CANONICAL STATE v1
Last Updated: 2026-06-21
Status: ACTIVE
Authority: This document is the single source of truth for Bitmind.

==============================================================================
MISSION
==============================================================================

Bitmind is a distributed Bitcoin mining ecosystem consisting of:

- ESP32 mining devices
- VPS backend
- Stratum mining infrastructure
- Bitcoin Core RPC integration
- Device management platform
- Device provisioning and onboarding system
- Future commerce ecosystem

Primary Goal:

Create a stable, scalable, and production-ready mining platform where
devices can be deployed globally and managed centrally.

==============================================================================
CANONICAL RULES (DO NOT OVERRIDE)
==============================================================================

RULE 1:
If a feature already works end-to-end, DO NOT redesign it.

RULE 2:
No architecture changes without updating this document first.

RULE 3:
GitHub is the source of truth for code.

RULE 4:
Production VPS receives changes ONLY from GitHub.

RULE 5:
No manual hotfixes on VPS that are not committed to GitHub.

RULE 6:
If uncertain about system behavior, verify against this document.

RULE 7:
Chats are execution environments, NOT sources of truth.

RULE 8:
Windsurf is used for diagnostics, tracking, logs, and implementation work.

RULE 9:
No duplicate implementations of existing functionality.

RULE 10:
Phase A scope is frozen until officially completed.

==============================================================================
PROJECT STATUS
==============================================================================

Current Phase:
[ ] Planning
[X] Phase A
[ ] Phase B
[ ] Phase C

Current Priority:

PHASE A COMPLETION

Target Deadline:

END OF JUNE 2026

==============================================================================
SYSTEM ARCHITECTURE
==============================================================================

                                   INTERNET
                                        |
                                        |
                                BITMIND VPS
                                        |
                  ------------------------------------------------
                  |                                              |
                  |                                              |
             BACKEND API                                   STRATUM
                  |                                              |
                  |                                              |
        REGISTRATION STORE (SQLite)                   MINING JOBS
                  |                                              |
                  |                                              |
             WEBSOCKET                                    STATE (Memory)
                  |                                              |
                  ------------------------------------------------
                                        |
                                        |
                                 TAILSCALE VPN
                                        |
                                        |
                            BITCOIN CORE NODE
                              (Windows Host)
                                        |
                                        |
                                  BITCOIN NETWORK

                                        |
                                        |
                              ESP32 DEVICES WORLDWIDE

==============================================================================
CANONICAL DEPLOYMENT MODEL
==============================================================================

GitHub
   ↓
Windsurf Changes
   ↓
Commit
   ↓
Push
   ↓
VPS git pull
   ↓
PM2 restart

No alternative deployment path exists.

==============================================================================
BITCOIN CORE ARCHITECTURE
==============================================================================

STATUS: FINAL

Bitcoin Core Location:

Windows Machine

Datadir:

D:\BitmindNode

Connectivity:

Tailscale

Important:

The VPS DOES NOT run Bitcoin Core locally.

The remote Bitcoin Core node is the ONLY Bitcoin RPC source.

No localhost Bitcoin Core assumptions are allowed.

==============================================================================
RPC ARCHITECTURE
==============================================================================

STATUS: FINAL

Single RPC Authority:

rpcService

Requirements:

- Single source of RPC truth
- No duplicate state systems
- No fallback state trackers
- No competing RPC status providers
- No localhost assumptions

==============================================================================
PHASE A (LOCKED SCOPE)
==============================================================================

STATUS:
ACTIVE

TARGET:
END OF JUNE 2026

IMPORTANT:

No additional features unless required to complete Phase A.

==============================================================================
PHASE A OBJECTIVES
==============================================================================

1. RPC STABILITY

Goal:

Stable RPC communication with remote Bitcoin Core.

Requirements:

[ ] Stable connection
[ ] Accurate state detection
[ ] No false negatives
[ ] No race conditions

------------------------------------------------------------------------------

2. BACKEND STABILITY

Requirements:

[ ] Stable API
[ ] Stable WebSocket layer
[ ] Stable device communication
[ ] Stable state synchronization

------------------------------------------------------------------------------

3. FIRMWARE STABILITY

Old ESP Firmware:

[ ] Architecture defined
[ ] Stable

OLED Firmware:

[ ] Architecture defined
[ ] Stable

Requirements:

[ ] Connect reliably
[ ] Mine reliably
[ ] Recover from disconnects
[ ] No crash loops

------------------------------------------------------------------------------

4. MINING FLOW

Canonical Flow:

ESP
  ->
Stratum
  ->
Bitcoin Core
  ->
Mining Process

Requirements:

[ ] End-to-end stable
[ ] No duplicate job logic
[ ] No reward path issues

------------------------------------------------------------------------------

5. DEVICE MANAGEMENT

Requirements:

[X] Device registration (persistent via RegistrationStore)
[X] Device identification (deviceId + token)
[X] Device status reporting (WebSocket + API)
[X] Device management (API endpoints)

------------------------------------------------------------------------------

6. QR ONBOARDING

STATUS:

EXISTS

Requirements:

[ ] Fully functional
[ ] Tested
[ ] Stable

------------------------------------------------------------------------------

7. UI / UX

Requirements:

[ ] Connect Miner button functional
[ ] Device status visible
[ ] Dashboard stable
[ ] Mobile friendly

==============================================================================
FIRMWARE ARCHITECTURE
==============================================================================

STATUS: FINAL

Authority Document:

BITMIND_FIRMWARE_ARCHITECTURE.md

Firmware Variants:

1. Legacy ESP Firmware (no screen)
2. OLED Firmware (with screen) - ARCHIVED (Reference Implementation)
3. TFT Firmware (with screen) - ACTIVE (Production Firmware)

Shared Architecture:

- Device Identity: EFuse MAC-based
- Worker Identity: Canonical model
- Configuration: Preferences NV storage
- Protocol: Bitmind Device Protocol v1
- Mining: Real SHA256
- WebSocket: SSL to getbitmind.com

All firmware implementation must follow BITMIND_FIRMWARE_ARCHITECTURE.md

No feature additions without architecture update.

==============================================================================
OLED TRACK
==============================================================================

**Phase O2 - Display Foundation Implementation:**
- Status: COMPLETE
- Date: 2026-06-22
- Commit: cfb1d02

**Achievements:**
- DisplayManager introduced - OLED initialization and control
- ScreenManager introduced - Screen routing and lifecycle
- DeviceStateManager introduced - Centralized device state model
- Screen lifecycle established - 6 initial screen types implemented
- OLED firmware variant created - bitmind_oled_v1
- Adafruit SSD1306 and GFX libraries integrated

**Scope Compliance:**
- No protocol changes
- No backend changes
- No mining changes
- Display code consumes state, does not own business logic
- Existing AP, registration, mining systems unchanged

**Architecture:**
- Display layer as presentation only
- Loose coupling between display and business logic
- Single source of truth for device state
- Screen transitions driven by device state

**Files Added:** 24 files, 2314 lines

------------------------------------------------------------------------------

**Phase O3 - AP Provisioning OLED Integration:**
- Status: COMPLETE
- Date: 2026-06-22
- Commit: c276a24

**Achievements:**
- Existing AP provisioning integrated with OLED
- Setup screen operational
- AP status screen operational
- OLED-driven provisioning workflow established
- DeviceStateManager extended with AP SSID
- Screen transitions verified (Setup → Connecting → Registering → Mining)

**Scope Compliance:**
- No protocol changes
- No backend changes
- No mining changes
- Display code consumes state, does not own business logic
- Existing AP, registration, mining systems unchanged

**Architecture:**
- Display layer as presentation only
- Loose coupling between display and business logic
- Single source of truth for device state
- Screen transitions driven by device state
- Existing AP provisioning system reused (no redesign)

**Files Modified:** 4 files, 12 insertions, 4 deletions

------------------------------------------------------------------------------

**Phase O4 - QR Onboarding Implementation:**
- Status: COMPLETE
- Date: 2026-06-22
- Commit: d96a229

**Achievements:**
- QR onboarding implemented
- State-driven QR payload architecture
- OLED setup workflow enhanced
- QR code generation using ricmoo/QRCode library
- QR code display on OLED in AP mode
- Manual URL fallback remains visible

**Scope Compliance:**
- No protocol changes
- No backend changes
- No mining changes
- Display code consumes state, does not own business logic
- Existing AP, registration, mining systems unchanged

**Architecture:**
- Display layer as presentation only
- Loose coupling between display and business logic
- Single source of truth for device state
- Screen transitions driven by device state
- QR payload state-driven (not hardcoded in display code)

**Files Modified:** 7 files, 63 insertions, 2 deletions

------------------------------------------------------------------------------

**Phase O5 - Mining Dashboard Design Review:**
- Status: COMPLETE
- Date: 2026-06-22
- Commit: N/A (Design review only, no implementation)

**Achievements:**
- 3 distinct OLED dashboard layout proposals designed
- Proposal 1 (Compact Header Layout) recommended
- Design goals established (readability, professional appearance, visual balance)
- Landscape orientation specified (128x64)
- Required metrics defined (branding, worker, hashrate, temperature, status)
- Excluded metrics identified (pool, accepted shares, rejected shares, uptime, wallet, debug data)

**Scope Compliance:**
- Design review only (no implementation)
- No protocol changes
- No backend changes
- No mining changes

------------------------------------------------------------------------------

**Phase O6 - Mining Dashboard Implementation:**
- Status: COMPLETE
- Date: 2026-06-22
- Commit: b03c39e

**Achievements:**
- Mining dashboard implemented using Proposal 1 (Compact Header Layout)
- BITMIND branding displayed in top bar
- Status indicator displayed in top bar
- Worker name displayed with truncation (12 characters)
- Hashrate displayed prominently (size 2)
- Mining status displayed with icon
- Excluded metrics removed (accepted shares, rejected shares, uptime)
- Temperature removed (no real, validated temperature metric available)

**Scope Compliance:**
- No protocol changes
- No backend changes
- No mining logic changes
- Display code consumes state, does not own business logic
- Existing AP, registration, mining systems unchanged

**Architecture:**
- Display layer as presentation only
- Loose coupling between display and business logic
- Single source of truth for device state
- Screen transitions driven by device state

**Files Modified:** 4 files, 2 insertions, 20 deletions

**Status:** ARCHIVED (Reference Implementation)
**Reason:** Incompatible with production hardware (ESP32-2432S028)
**Purpose:** Reference for display architecture patterns
**Final Commit:** bb66379

==============================================================================
TFT TRACK
==============================================================================

**Phase T0 - Foundation Audit:**
- Status: COMPLETE
- Date: 2026-06-22
- Commit: f3bb86a

**Achievements:**
- Hardware audit completed for ESP32-2432S028 (Cheap Yellow Display - CYD)
- ILI9341 TFT controller specifications documented (240×320, 16-bit RGB)
- XPT2046 touch controller specifications documented (resistive, separate SPI bus)
- TFT_eSPI configuration requirements documented
- Pin mapping validated (HSPI for display, VSPI for touch)
- Memory impact analyzed (Flash: +120-170 KB, RAM: +5-10 KB partial buffer)
- Architecture reuse evaluation completed (100% reuse except DisplayManager)
- Display abstraction strategy defined (replace DisplayManager only)
- Migration plan created (T1: DisplayManager, T2: Screens, T3: QR, T4: Touch)

**Scope Compliance:**
- Audit only (no code implementation)
- No display driver integration
- No touch implementation
- No backend changes
- No protocol changes
- No mining changes

**Architecture:**
- **Reusable (100%):** DeviceStateManager, ScreenManager, screen lifecycle, state models
- **Replaced:** DisplayManager (TFT_eSPI-based), display libraries, screen render() methods
- **Unchanged:** Backend protocol, mining protocol, device protocol, all business logic

**Files Added:**
- BITMIND_DISPLAY_HARDWARE_AUDIT.md
- BITMIND_TFT_PHASE_T0_AUDIT.md
- BITMIND_TFT_ARCHITECTURE_PLAN.md
- BITMIND_CANONICAL_STATE_UPDATE_REQUEST_T0.md

**Architecture Decision:**
- Create separate bitmind_tft_v1 firmware variant
- Preserve OLED firmware variant as reference implementation
- Reuse existing device architecture (DeviceState, ScreenManager, screen lifecycle)
- Replace only DisplayManager layer (TFT_eSPI instead of Adafruit SSD1306)
- No backend, protocol, or mining changes required

**Production Hardware:** ESP32-2432S028 (Cheap Yellow Display - CYD)

------------------------------------------------------------------------------

**Phase T1 - DisplayManager Implementation:**
- Status: COMPLETE
- Date: 2026-06-22
- Commit: 90a8823

**Achievements:**
- TFT firmware variant created (bitmind_tft_v1)
- DisplayManager implemented with TFT_eSPI
- ILI9341 driver configuration (240×320, 16-bit RGB)
- SPI initialization (HSPI, 40 MHz)
- Backlight control (GPIO 21)
- Color support (16-bit RGB)
- Serial logging implemented
- Boot test validation (BITMIND, TFT INITIALIZED, ESP32-2432S028)
- PlatformIO configuration created

**Scope Compliance:**
- DisplayManager implementation only
- No touch implementation
- No QR implementation (placeholder only)
- No screen redesign
- No onboarding changes
- No backend changes
- No protocol changes
- No mining changes

**Architecture:**
- **Reusable (100%):** DeviceState, DeviceStateManager, ScreenManager, Screen lifecycle, all screen files
- **Replaced:** DisplayManager (TFT_eSPI-based instead of Adafruit SSD1306)
- **Unchanged:** Backend protocol, mining protocol, device protocol, all business logic

**Files Added:**
- esp32_firmware/bitmind_tft_v1/ (new directory)
  - platformio.ini (TFT_eSPI configuration)
  - src/bitmind_tft_v1.ino (main firmware entry)
  - src/display/DisplayManager.h (TFT implementation)
  - src/display/DisplayManager.cpp (TFT implementation)
  - src/display/DeviceState.h (copied from OLED)
  - src/display/DeviceState.cpp (copied from OLED)
  - src/display/ScreenManager.h (copied from OLED)
  - src/display/ScreenManager.cpp (copied from OLED)
  - src/display/Screen.h (copied from OLED)
  - src/display/screens/*.cpp (copied from OLED)
- BITMIND_TFT_PHASE_T1_DELIVERABLES.md
- BITMIND_CANONICAL_STATE_UPDATE_REQUEST_T1.md

------------------------------------------------------------------------------

**Phase T2 - Screen Layout Implementation:**
- Status: COMPLETE
- Date: 2026-06-22
- Commit: 6fd3ba7

**Achievements:**
- All 5 screen render() methods implemented for TFT
- Bitcoin Orange brand identity color system applied
- ScreenManager integrated with bitmind_tft_v1 firmware
- Typography hierarchy implemented (sizes 1-4)
- Color hierarchy implemented (brand, status, secondary)
- Mining dashboard implemented with hashrate display
- All core screens migrated to TFT rendering

**Scope Compliance:**
- Screen render() implementation only
- Bitcoin Orange/Black/White color system applied
- No touch implementation
- No QR implementation (placeholder only)
- No backend changes
- No protocol changes
- No mining changes

**Architecture:**
- **Reusable (100%):** DeviceState, DeviceStateManager, ScreenManager, Screen lifecycle
- **Replaced:** Screen render() methods (TFT layouts with Bitcoin Orange branding)
- **Unchanged:** Backend protocol, mining protocol, device protocol, all business logic

**Files Modified:**
- DisplayManager.h (color constants)
- SplashScreen.cpp (TFT render)
- SetupScreen.cpp (TFT render)
- ConnectingScreen.cpp (TFT render)
- RegisteringScreen.cpp (TFT render)
- MiningScreen.cpp (TFT render)
- bitmind_tft_v1.ino (ScreenManager integration)
- BITMIND_CANONICAL_STATE_UPDATE_REQUEST_T2.md

**Deferred:**
- Touch implementation (Phase T4)
- QR code implementation (Phase T3)

==============================================================================
KNOWN COMPLETED FEATURES
==============================================================================

Update ONLY when verified.

[X] Stratum integration complete
[ ] Real mining tested
[ ] Reward path verified
[ ] QR onboarding functional
[X] Device registration working (persistent via RegistrationStore)
[X] Worker name storage working (RegistrationStore + NV storage)
[X] Firmware architecture defined
[X] Identity architecture implemented (RegistrationStore + SQLite)
[X] Token lifecycle fixed (generated once, preserved)
[X] Onboarding alignment implemented (workerName + walletAddress in payload)

==============================================================================
WORKER IDENTITY MODEL
==============================================================================

STATUS: FINAL

Worker Identity Model:

Primary device identity consists of:
- workerName (user-provided, stored in NV storage and RegistrationStore)
- walletAddress (user-provided, stored in NV storage and RegistrationStore)
- deviceId (MAC-based for ESP32, random hex for virtual)
- token (backend-generated, 32-byte hex, persisted)

Requirements:

- Single identity source (RegistrationStore)
- No duplicate naming systems
- No secondary worker mappings
- Token-based authentication
- Persistent identity (survives backend/PM2/VPS restarts)

==============================================================================
IDENTITY ARCHITECTURE
==============================================================================

STATUS: FINAL

Authority Document:

BITMIND_F5_IDENTITY_ARCHITECTURE_DESIGN.md

Identity Model:

deviceId + token + registration persistence

Components:

- RegistrationStore: Storage-agnostic abstraction layer
- SQLite: Phase A storage backend (server/data/registrations.db)
- Token: 32-byte hex, generated once, preserved across reconnections
- workerName: User-provided, stored in NV storage and RegistrationStore
- walletAddress: User-provided, stored in NV storage and RegistrationStore

Persistence:

- Registrations persist across backend/PM2/VPS restarts
- Token persists across all restart scenarios
- Identity preserved across firmware reboots

Scalability:

- Phase A: SQLite (10,000+ devices)
- Phase B+: PostgreSQL (100,000+ devices)
- Phase C: Redis + PostgreSQL (1,000,000+ devices)

No identity architecture changes without updating BITMIND_F5_IDENTITY_ARCHITECTURE_DESIGN.md first.

==============================================================================
REGISTRATION STORE
==============================================================================

STATUS: FINAL

Purpose:

Persistent device registration storage

Implementation:

- Interface: server/services/registrationStore.js
- Backend: server/services/registrationStore/sqlite.js
- Database: server/data/registrations.db

Schema:

registrations table:
- deviceId (PK)
- token
- workerName
- walletAddress
- deviceType
- firmwareVersion
- registeredAt
- lastSeen

Methods:

- registerDevice()
- getDevice()
- updateDevice()
- removeDevice()
- validateToken()
- isRegistered()
- getAllRegistrations()
- getRegistrationCount()
- clear()
- initialize()
- close()

No RegistrationStore changes without updating BITMIND_F5_IDENTITY_ARCHITECTURE_DESIGN.md first.

==============================================================================
TOKEN LIFECYCLE
==============================================================================

STATUS: FINAL

Token Format:

32-byte hex (64 hex characters)

Generation:

- Generated once on first registration
- Generated by backend (RegistrationStore)
- Cryptographically random

Persistence:

- Backend: SQLite database (registrations table)
- Firmware: NV storage (Preferences)

Lifecycle:

1. First Registration: Token generated, stored in database and NV storage
2. Reconnection: Same token reused, retrieved from database
3. Backend Restart: Token preserved in database
4. PM2 Restart: Token preserved in database
5. VPS Reboot: Token preserved in database
6. Factory Reset: Token cleared, new token generated on next registration

Validation:

- Token validated on every WebSocket connection
- Token validation logging-only (Phase A)
- Token mismatch: Connection rejected (Phase B+)

No token lifecycle changes without updating BITMIND_F5_IDENTITY_ARCHITECTURE_DESIGN.md first.

==============================================================================
ONBOARDING ALIGNMENT
==============================================================================

STATUS: FINAL

Purpose:

Align firmware registration with onboarding flow

Implementation:

- Firmware device.register includes workerName and walletAddress
- Protocol schema updated (device-protocol-v1.json)
- workerName and walletAddress are optional (backward compatible)
- Virtual devices already aligned (Connect Miner)

Flow:

1. AP Provisioning: User configures workerName and walletAddress
2. NV Storage: workerName and walletAddress saved to Preferences
3. Device Registration: device.register includes workerName and walletAddress
4. RegistrationStore: workerName and walletAddress stored in database
5. Mining: workerName and walletAddress used for pool identification

Backward Compatibility:

- Old firmware (without fields) continues to work
- New firmware (with fields) fully aligned
- No protocol breaking changes

No onboarding alignment changes without updating BITMIND_F5_P2_ONBOARDING_CONTRACT.md first.

==============================================================================
PHASE A EXCLUSIONS
==============================================================================

NOT REQUIRED FOR PHASE A COMPLETION

[ ] MoonPay
[ ] E-commerce automation
[ ] Delivery automation
[ ] Advanced analytics
[ ] Scaling optimizations
[ ] Marketplace features

Unless required for launch.

==============================================================================
PHASE B (POST PHASE A)
==============================================================================

Commerce

[ ] Product catalog
[ ] Product images
[ ] Pricing
[ ] Checkout

Payments

[ ] MoonPay integration
[ ] Payment verification

Shipping

[ ] Delivery workflow
[ ] Order management

Advanced UX

[ ] Enhanced onboarding
[ ] Additional dashboards

==============================================================================
OPEN ISSUES
==============================================================================

Issue ID:
Description:
Priority:
Owner:
Status:

------------------------------------------------------------------------------

Issue ID:
Description:
Priority:
Owner:
Status:

==============================================================================
DECISION LOG
==============================================================================

Date: 2026-06-21
Decision: Implement persistent device identity architecture (F5-P0)
Reason: Critical architectural defect - in-memory DeviceRegistry lost on restart
Approved By: F5-P0 Design Document

------------------------------------------------------------------------------

Date: 2026-06-21
Decision: Replace DeviceRegistry with RegistrationStore (F5-P1)
Reason: Enable persistent device identity across backend/PM2/VPS restarts
Approved By: F5-P1 Implementation

------------------------------------------------------------------------------

Date: 2026-06-21
Decision: Use SQLite as Phase A storage backend (F5-P1)
Reason: Simple, file-based, no external dependencies, sufficient for 10,000 devices
Approved By: F5-P1 Implementation

------------------------------------------------------------------------------

Date: 2026-06-21
Decision: Fix token lifecycle to be stable (F5-P1)
Reason: Token was regenerated on every connection, causing identity instability
Approved By: F5-P1 Implementation

------------------------------------------------------------------------------

Date: 2026-06-21
Decision: Align firmware registration with onboarding flow (F5-P2)
Reason: Firmware device.register missing workerName and walletAddress
Approved By: F5-P2 Implementation

==============================================================================
DO NOT CHANGE WITHOUT EXPLICIT APPROVAL
==============================================================================

- Deployment workflow
- Bitcoin Core location
- Tailscale architecture
- Worker identity model
- RPC authority model
- Phase A scope
- Identity architecture (F5-P0)
- RegistrationStore abstraction (F5-P1)
- Token lifecycle (F5-P1)
- Onboarding alignment (F5-P2)

==============================================================================
END OF DOCUMENT
==============================================================================
