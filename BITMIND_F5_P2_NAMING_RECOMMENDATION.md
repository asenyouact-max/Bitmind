# BITMIND F5-P2 CONNECT MINER NAMING RECOMMENDATION

**Phase:** F5-P2 - Onboarding Alignment Implementation  
**Date:** 2026-06-21  
**Purpose:** Review Connect Miner flow and provide naming recommendation

---

## SECTION 1: CURRENT FLOW ANALYSIS

### 1.1 Current Implementation

**Button Text:** "Connect Miner" (or "Connect Bitminer")

**Flow:**
1. User clicks "Connect Miner" button
2. Modal opens with form fields:
   - Bitcoin wallet address (required)
   - Worker name (required, min 3 characters)
   - Device type (dropdown: ESP32, ASIC, GPU, CPU)
   - Mining mode (optional: Standard, Eco, Turbo)
3. User submits form
4. Backend generates virtual deviceId (16-byte hex)
5. Backend registers device in RegistrationStore
6. Backend creates runtime state
7. Backend broadcasts miner_connected WebSocket event
8. Frontend displays connected miner in dashboard

### 1.2 Current Name Analysis

**Name:** "Connect Miner"

**Implied Meaning:**
- Connecting to an existing miner
- Establishing a connection to hardware
- Linking to a device that already exists

**Actual Action:**
- Creating a new virtual device identity
- Registering a new miner in the system
- Setting up wallet and worker name for a virtual device

**Mismatch:**
- "Connect" implies existing device
- Actual action is creating/adding new device
- No physical connection to hardware (virtual device only)

---

## SECTION 2: NAMING OPTIONS

### Option A: Keep "Connect Miner"

**Pros:**
- Already implemented and deployed
- Users may be familiar with current name
- No UI changes required
- No documentation updates required

**Cons:**
- Misleading name (doesn't match actual action)
- Implies connection to existing hardware
- Confusing for new users
- Doesn't align with "add/create" mental model

**UX Reasoning:**
- "Connect" is typically used for establishing connections to existing resources (e.g., "Connect to WiFi", "Connect to server")
- This flow creates a new resource, not connects to an existing one
- Users might expect to see a list of existing miners to connect to, not a form to create a new one

**Recommendation:** ❌ NOT RECOMMENDED

---

### Option B: Rename to "Add Device"

**Pros:**
- Accurately describes the action (adding a new device)
- Aligns with common UI patterns (e.g., "Add Account", "Add Payment Method")
- Clear mental model for users
- Distinguishes from physical device connection
- Generic enough to cover future device types

**Cons:**
- Requires UI changes (button text, modal title)
- Requires documentation updates
- May confuse existing users if changed suddenly
- "Device" is generic (could be any type of device)

**UX Reasoning:**
- "Add" is the standard verb for creating new resources in UI
- "Device" accurately describes what's being added (a mining device)
- Clear expectation: user will see a form to configure the new device
- Aligns with RESTful API pattern (POST /api/miners/connect creates a new resource)

**Recommendation:** ✅ RECOMMENDED

---

### Option C: Alternative Naming Options

#### Option C1: "Add Miner"

**Pros:**
- More specific than "Add Device"
- Clearly indicates mining context
- Aligns with industry terminology (mining pools use "add worker")
- Accurately describes the action

**Cons:**
- Requires UI changes
- "Miner" could be ambiguous (person vs device)
- Less generic than "Add Device"

**UX Reasoning:**
- "Add Miner" is clear and specific
- Mining pools commonly use "add worker" terminology
- Users familiar with mining will understand immediately
- Distinguishes from other types of devices

**Recommendation:** ✅ STRONG ALTERNATIVE

#### Option C2: "Register Miner"

**Pros:**
- Accurately describes the registration process
- Aligns with backend terminology (RegistrationStore)
- Clear that this is a setup/registration flow

**Cons:**
- "Register" sounds formal/administrative
- Less user-friendly than "Add"
- Implies pre-existing account or system

**UX Reasoning:**
- "Register" is technically accurate but less approachable
- Users might expect a login form, not a device setup form
- Better suited for account registration than device setup

**Recommendation:** ⚠️ ACCEPTABLE BUT LESS IDEAL

#### Option C3: "Setup Miner"

**Pros:**
- Implies configuration process
- Clear that this is a setup flow
- User-friendly language

**Cons:**
- "Setup" implies device already exists
- Could be confused with device configuration (WiFi, etc.)
- Less standard than "Add"

**UX Reasoning:**
- "Setup" is often used for configuring existing devices
- This flow creates a new device, not configures an existing one
- Less clear than "Add" or "Register"

**Recommendation:** ❌ NOT RECOMMENDED

---

## SECTION 3: FINAL RECOMMENDATION

### Primary Recommendation: "Add Miner"

**Rationale:**
1. **Accuracy:** "Add" accurately describes creating a new resource
2. **Specificity:** "Miner" clearly indicates the context (mining device)
3. **Industry Alignment:** Mining pools use "add worker" terminology
4. **User Expectation:** Clear that user will configure a new mining device
5. **Differentiation:** Distinguishes from physical device connection

**Implementation:**
- Change button text from "Connect Miner" to "Add Miner"
- Change modal title from "Connect Miner" to "Add Miner"
- Update any documentation references
- No backend changes required (API endpoint remains /api/miners/connect)

### Secondary Recommendation: "Add Device"

**Rationale:**
1. **Generality:** Covers future device types (OLED, ASIC, GPU, etc.)
2. **Standard Pattern:** Aligns with common UI patterns
3. **Clarity:** Clear mental model for users
4. **Future-Proof:** Generic name won't need changes as device types expand

**Implementation:**
- Change button text from "Connect Miner" to "Add Device"
- Change modal title from "Connect Miner" to "Add Device"
- Update any documentation references
- No backend changes required

---

## SECTION 4: DEPLOYMENT STRATEGY

### Option 1: Immediate Rename

**Pros:**
- Fixes naming issue immediately
- Aligns with accurate terminology
- Prevents further user confusion

**Cons:**
- May confuse existing users
- Requires UI deployment
- Requires documentation updates

**Timeline:** 1-2 days

### Option 2: Gradual Transition

**Pros:**
- Allows users to adapt
- Can A/B test new name
- Reduces shock of sudden change

**Cons:**
- Prolongs naming issue
- More complex implementation
- May confuse users during transition

**Timeline:** 1-2 weeks

### Option 3: Keep Current Name

**Pros:**
- No changes required
- No user confusion
- No deployment needed

**Cons:**
- Perpetuates misleading name
- Continues user confusion
- Doesn't align with actual action

**Timeline:** N/A

---

## SECTION 5: USER EXPERIENCE CONSIDERATIONS

### Mental Model Alignment

**Current Mental Model (Connect Miner):**
- User expects: List of existing miners to connect to
- User gets: Form to create new miner
- Result: Confusion and mismatch

**Proposed Mental Model (Add Miner):**
- User expects: Form to add new miner
- User gets: Form to add new miner
- Result: Clear alignment

### First-Time User Experience

**Scenario:** New user visits Bitmind dashboard

**Current Flow:**
1. User sees "Connect Miner" button
2. User expects to connect existing hardware
3. User clicks button
4. User sees form for wallet address and worker name
5. User is confused: "I don't have a miner to connect, I want to set one up"

**Proposed Flow:**
1. User sees "Add Miner" button
2. User expects to add a new miner
3. User clicks button
4. User sees form for wallet address and worker name
5. User understands: "I'm adding a new miner to my account"

### Existing User Experience

**Scenario:** Existing user returns to dashboard

**Current Flow:**
1. User sees "Connect Miner" button
2. User knows what it does (learned from previous use)
3. User clicks button to add another miner
4. User is accustomed to the misleading name

**Proposed Flow:**
1. User sees "Add Miner" button
2. User may be confused by name change
3. User clicks button to add another miner
4. User adapts to new name over time

**Mitigation:**
- Add tooltip or help text explaining the change
- Update onboarding documentation
- Add announcement about terminology update

---

## SECTION 6: TECHNICAL CONSIDERATIONS

### API Endpoint

**Current:** POST /api/miners/connect

**Question:** Should API endpoint be renamed?

**Recommendation:** NO

**Rationale:**
- API endpoint naming is internal implementation detail
- Renaming endpoint would break existing integrations
- Frontend can call any endpoint regardless of button text
- "connect" in API context means "establish connection to system", not "connect to existing device"

### Database Schema

**Impact:** None

**Rationale:**
- Naming change is UI-only
- No database schema changes required
- No migration required

### WebSocket Events

**Impact:** None

**Rationale:**
- miner_connected event name is appropriate
- Event describes what happened (miner connected to system)
- No changes required

---

## SECTION 7: CONCLUSION

### Final Recommendation: "Add Miner"

**Summary:**
"Add Miner" is the recommended name for the current "Connect Miner" flow. It accurately describes the action (adding a new mining device), aligns with industry terminology, and provides clear user expectations. The change is UI-only and requires no backend changes.

**Implementation Priority:** MEDIUM

**Rationale:**
- Current name is misleading but functional
- Change improves UX but is not critical
- Can be deployed as part of broader UI improvements

**Next Steps:**
1. Update button text to "Add Miner"
2. Update modal title to "Add Miner"
3. Update documentation references
4. Consider adding tooltip or help text
5. Deploy to staging for testing
6. Deploy to production with user communication

**Alternative:** If "Add Miner" is deemed too specific, "Add Device" is an acceptable alternative with similar benefits.

**Status:** RECOMMENDATION PROVIDED (NO IMPLEMENTATION YET)
