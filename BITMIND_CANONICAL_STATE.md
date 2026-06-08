# BITMIND CANONICAL STATE v1
Last Updated: 2026-06-08
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
             WEBSOCKET                                    MINING JOBS
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

[ ] Stable

OLED Firmware:

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

[ ] Device registration
[ ] Device identification
[ ] Device status reporting
[ ] Device management

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
KNOWN COMPLETED FEATURES
==============================================================================

Update ONLY when verified.

[ ] Stratum integration complete
[ ] Real mining tested
[ ] Reward path verified
[ ] QR onboarding functional
[ ] Device registration working
[ ] Worker name storage working

==============================================================================
WORKER IDENTITY MODEL
==============================================================================

STATUS: FINAL

Worker Name:

Primary device identity

Requirements:

- Single identity source
- No duplicate naming systems
- No secondary worker mappings

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

Date:
Decision:
Reason:
Approved By:

------------------------------------------------------------------------------

Date:
Decision:
Reason:
Approved By:

==============================================================================
DO NOT CHANGE WITHOUT EXPLICIT APPROVAL
==============================================================================

- Deployment workflow
- Bitcoin Core location
- Tailscale architecture
- Worker identity model
- RPC authority model
- Phase A scope

==============================================================================
END OF DOCUMENT
==============================================================================
