# CANONICAL STATE UPDATE REQUEST

**Date:** 2026-06-09  
**Task:** Protocol Freeze Finalization  
**Status:** COMPLETED - Protocol v1 Frozen for Phase A

---

## SECTION AFFECTED

**Phase A Objectives → 3. FIRMWARE STABILITY**

---

## EVIDENCE

**Protocol Freeze Specification:** BITMIND_PROTOCOL_V1_FREEZE.md

**Documentation Updates:**
1. docs/device-protocol-v1.json - Updated to canonical protocol v1 freeze specification
2. BITMIND_FIRMWARE_ARCHITECTURE.md - Updated to align with protocol v1 freeze

**Verification Performed:**
- Analyzed current backend protocol
- Analyzed firmware architecture requirements
- Analyzed historical firmware requirements
- Compared all three schemas
- Made canonical decisions for Phase A
- Synchronized all authoritative documents

---

## RECOMMENDED UPDATES

### 1. Update BITMIND_CANONICAL_STATE.md

**Section: PROTOCOL**

**Add/Update:**
```
PROTOCOL

[X] Protocol v1 frozen
[X] Backend aligned with protocol v1
[X] Firmware architecture aligned with protocol v1
```

**Section: FIRMWARE**

**Add/Update:**
```
FIRMWARE

[X] Firmware architecture defined
[X] Firmware architecture aligned with protocol v1
[X] Legacy ESP Firmware architecture defined
[X] OLED Firmware architecture defined
```

**Section: KNOWN COMPLETED FEATURES**

**Add:**
```
[X] Protocol v1 freeze completed
[X] Backend contract freeze verification complete
[X] Firmware architecture defined
[X] Protocol v1 frozen for Phase A
```

**Section: FIRMWARE STABILITY**

**Add/Update:**
```
Old ESP Firmware:

[X] Architecture defined
[X] Protocol v1 compliance defined
[ ] Legacy firmware implementation complete
[ ] Legacy firmware tested
[ ] Legacy firmware deployed

OLED Firmware:

[X] Architecture defined
[X] Protocol v1 compliance defined
[ ] OLED firmware implementation complete
[ ] OLED firmware tested
[ ] OLED firmware deployed
```

---

### 2. Add Document References

**Section: DOCUMENTATION**

**Add:**
```
Authoritative Documents:

- BITMIND_PROTOCOL_V1_FREEZE.md - Definitive protocol v1 specification for Phase A
- BITMIND_FIRMWARE_ARCHITECTURE.md - Canonical firmware architecture for Phase A
- docs/device-protocol-v1.json - Protocol v1 JSON schema (frozen)
```

---

## AWAITING APPROVAL

**Action Required:** Review and approve protocol v1 freeze

**After Approval:**
1. Update BITMIND_CANONICAL_STATE.md with recommended updates
2. Commit updated Canonical State
3. Push to GitHub
4. Declare protocol v1 frozen for Phase A firmware implementation

---

## FILES UPDATED

1. docs/device-protocol-v1.json
   - Status: STABLE → FROZEN
   - Last Updated: 2026-05-30 → 2026-06-09
   - Description: Updated to include "FROZEN for Phase A"
   - mining.job schema: Updated to full block template data
   - mining_stats schema: Added
   - Rate limiting: Added mining_stats rate limit

2. BITMIND_FIRMWARE_ARCHITECTURE.md
   - Message Types: Added mining_stats
   - Mining Workflow (Legacy): Updated job reception, mining loop, telemetry
   - Mining Workflow (OLED): Updated job reception, mining loop, telemetry
   - QR Onboarding Flow: Clarified Phase A scope (QR → AP Mode Portal, NOT backend-driven config)

---

## PROTOCOL V1 FREEZE STATUS

**Status:** FROZEN for Phase A firmware implementation

**Canonical Decisions:**
1. mining.job schema: Full block template data (backend implementation)
2. mining.share schema: Current protocol v1 (no changes)
3. Configuration model: AP onboarding only (device.config Phase B)
4. Telemetry model: Include mining_stats in protocol v1

**Implementation Impact:**
- Backend: No code changes required (documentation only)
- Firmware Architecture: Documentation aligned with protocol v1
- Protocol v1: Frozen for Phase A

---

## VPS DEPLOYMENT IMPACT

**Status:** DOCUMENTATION ONLY - No VPS deployment required

**Reason:** No backend code changes were made. Only documentation synchronization.

---

## END OF REQUEST
