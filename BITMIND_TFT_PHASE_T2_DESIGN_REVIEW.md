# BITMIND TFT PHASE T2 - SCREEN LAYOUT DESIGN REVIEW

**Phase:** T2 - Screen Layout Design Review  
**Date:** 2026-06-22  
**Status:** COMPLETE  
**Target Hardware:** ESP32-2432S028 (Cheap Yellow Display - CYD)  
**Display:** ILI9341 TFT 320×240 landscape

---

## 1. EXECUTIVE SUMMARY

**Objective:** Design complete TFT UI architecture for ESP32-2432S028 production hardware.

**Key Design Principles:**
- Bitcoin/mining product identity
- Professional production appearance
- Color hierarchy for visual clarity
- Larger typography for readability
- Balanced spacing and layout
- Future touch integration readiness
- 320×240 landscape optimization

**Design Scope:**
- 5 screen layouts (Boot/Splash, Setup/AP, Connecting, Registration, Mining Dashboard)
- Color hierarchy definition
- Typography system
- Memory considerations
- No implementation (design review only)

---

## 2. TFT SCREEN CONSTRAINTS AND CAPABILITIES

### 2.1 Display Specifications

**Resolution:** 320×240 pixels (landscape)  
**Color Depth:** 16-bit RGB (65,536 colors)  
**Aspect Ratio:** 4:3 (landscape)  
**Pixel Density:** ~113 PPI (2.8" diagonal)  
**Viewing Angle:** >60°

### 2.2 Design Constraints

**Positive Constraints:**
- 6.25× larger than OLED (128×64)
- Color support enables visual hierarchy
- Landscape orientation suits dashboard layouts
- Sufficient space for multiple information blocks

**Negative Constraints:**
- Still limited resolution (not HD)
- Text must be large enough for readability
- Limited space for complex layouts
- Touch area minimum 20×20 pixels for usability

### 2.3 Typography Constraints

**Minimum Readable Size:**
- Size 1 (8px): Too small for main content
- Size 2 (16px): Minimum for body text
- Size 3 (24px): Good for headings
- Size 4 (26px): Large headings
- Size 6 (48px): Very large (use sparingly)

**Recommended Sizes:**
- Headings: Size 3-4
- Body text: Size 2
- Small labels: Size 1 (only if necessary)

---

## 3. COLOR HIERARCHY

### 3.1 Color Palette

**Primary Colors:**
- Background: Black (0x0000)
- Foreground: White (0xFFFF)

**Brand Accent (Bitcoin Orange):**
- Branding: Bitcoin Orange (0xFD20)
- Headers: Bitcoin Orange (0xFD20)
- Active Mining Indicators: Bitcoin Orange (0xFD20)

**Status Colors:**
- Success/Connected: Green (0x07E0)
- Error: Red (0xF800)
- Warning/Activity: Orange (0xFD20)
- Info: Blue (0x001F)

**Secondary Colors:**
- Dark Gray: 0x7BEF
- Medium Gray: 0x8410
- Light Gray: 0xC618

### 3.2 Color Usage Guidelines

**Background:**
- Primary: Black (0x0000)
- Cards/Sections: Dark Gray (0x7BEF)
- Active Elements: Medium Gray (0x8410)

**Foreground:**
- Primary Text: White (0xFFFF)
- Secondary Text: Light Gray (0xC618)
- Brand Accent Text: Bitcoin Orange (0xFD20)

**Status Indicators:**
- Mining Active: Bitcoin Orange (0xFD20)
- Connected: Green (0x07E0)
- Connecting: Blue (0x001F)
- Error: Red (0xF800)
- Warning/Activity: Orange (0xFD20)

### 3.3 Visual Hierarchy

**Level 1 (Highest Priority):**
- Branding (BITMIND) - Bitcoin Orange
- Status indicators
- Critical alerts

**Level 2 (Medium Priority):**
- Worker name
- Hashrate - Bitcoin Orange accent
- Connection status

**Level 3 (Low Priority):**
- Instructions
- Secondary information
- Debug data

---

## 4. TYPOGRAPHY SYSTEM

### 4.1 Font Selection

**Primary Font:** TFT_eSPI built-in fonts  
**Font 2 (16px):** Body text, labels  
**Font 4 (26px):** Headings, large values  
**Font 6 (48px):** Very large headings (rare)

### 4.2 Typography Hierarchy

**H1 (Page Title):**
- Size: 4 (26px)
- Color: White
- Weight: Bold (if available)
- Usage: Screen titles, branding

**H2 (Section Header):**
- Size: 3 (24px)
- Color: White
- Usage: Section headers, important labels

**Body Text:**
- Size: 2 (16px)
- Color: White
- Usage: Instructions, status messages

**Small Text:**
- Size: 1 (8px)
- Color: Light Gray
- Usage: Secondary labels, timestamps

### 4.3 Text Alignment

**General Rules:**
- Headings: Centered or left-aligned
- Body text: Left-aligned
- Values: Right-aligned (for numbers)
- Center-align for symmetry (branding, status)

---

## 5. SCREEN DESIGNS

### 5.1 Boot/Splash Screen

**Purpose:** Brand display and initialization status

**Layout:**
```
+----------------------------------+
|                                  |
|              BITMIND             |  H1 centered, size 4, white
|                                  |
|         Mining Device            |  H2 centered, size 3, Bitcoin Orange
|                                  |
|       Initializing...            |  Body centered, size 2, white
|                                  |
|      [Loading Animation]         |  Progress indicator
|                                  |
+----------------------------------+
```

**Design Details:**
- Background: Black (0x0000)
- Branding: Centered, size 4, white
- Subtitle: Centered, size 3, Bitcoin Orange accent
- Status: Centered, size 2, white
- Loading Animation: Simple progress bar or spinner

**Animation:**
- Fade in branding (500ms)
- Display loading animation
- Transition to next screen after initialization

**Memory Considerations:**
- No complex graphics
- Simple text rendering
- Minimal memory footprint

---

### 5.2 Setup/AP Screen

**Purpose:** WiFi AP provisioning and QR onboarding

**Layout:**
```
+----------------------------------+
|           BITMIND SETUP         |  H1 centered, size 3, white
+----------------------------------+  Separator line, gray
|                                  |
|  Connect to WiFi:               |  H2 left-aligned, size 2, white
|                                  |
|  SSID: Bitmind_AP               |  Body left-aligned, size 2, Bitcoin Orange
|  IP: 192.168.4.1                |  Body left-aligned, size 2, Bitcoin Orange
|                                  |
|  Scan QR code or open:          |  H2 left-aligned, size 2, white
|                                  |
|  http://192.168.4.1              |  Body left-aligned, size 2, light gray
|                                  |
|         [QR Code]                |  Centered, scale 4-5
|                                  |
|  Instructions:                  |  H2 left-aligned, size 2, white
|  1. Connect to WiFi above       |  Body left-aligned, size 1, light gray
|  2. Scan QR or open URL         |  Body left-aligned, size 1, light gray
|  3. Configure device            |  Body left-aligned, size 1, light gray
|                                  |
+----------------------------------+
```

**Design Details:**
- Background: Black (0x0000)
- Header: Centered, size 3, white
- WiFi Info: Left-aligned, size 2, Bitcoin Orange accent
- URL: Left-aligned, size 2, light gray
- QR Code: Centered, scale 4-5 (84-105px)
- Instructions: Left-aligned, size 1, light gray

**Color Usage:**
- SSID/IP: Bitcoin Orange accent (0xFD20)
- URL: Light gray (0xC618)
- Instructions: Light Gray (0xC618)

**Memory Considerations:**
- QR code rendering requires memory
- Scale 4-5 is reasonable for 320×240
- QR code library handles rendering

---

### 5.3 Connecting Screen

**Purpose:** WiFi/backend connection status

**Layout:**
```
+----------------------------------+
|           CONNECTING             |  H1 centered, size 3, white
+----------------------------------+  Separator line, gray
|                                  |
|  Connecting to WiFi...          |  Body centered, size 2, white
|                                  |
|  [WiFi Icon]  Bitmind_AP         |  Icon + text, size 2, Bitcoin Orange
|                                  |
|  Connecting to backend...       |  Body centered, size 2, white
|                                  |
|  [Server Icon] getbitmind.com   |  Icon + text, size 2, Bitcoin Orange
|                                  |
|  Please wait...                 |  Body centered, size 2, light gray
|                                  |
|      [Progress Bar]             |  Progress indicator
|                                  |
+----------------------------------+
```

**Design Details:**
- Background: Black (0x0000)
- Header: Centered, size 3, white
- Status Messages: Centered, size 2, white
- Connection Targets: Size 2, Bitcoin Orange accent
- Progress Bar: Horizontal, Bitcoin Orange accent

**Animation:**
- Progress bar fills from left to right
- Status messages update sequentially
- Smooth transitions between states

**Memory Considerations:**
- Simple icons (can be drawn with primitives)
- Progress bar is simple rectangle
- Minimal memory footprint

---

### 5.4 Registration Screen

**Purpose:** Device registration state

**Layout:**
```
+----------------------------------+
|          REGISTERING             |  H1 centered, size 3, white
+----------------------------------+  Separator line, gray
|                                  |
|  Registering device...           |  Body centered, size 2, white
|                                  |
|  Device ID: [MAC Address]       |  Body left-aligned, size 2, light gray
|  Worker: [Worker Name]          |  Body left-aligned, size 2, light gray
|                                  |
|  [Registration Icon]             |  Centered icon
|                                  |
|  Please wait...                 |  Body centered, size 2, light gray
|                                  |
|      [Progress Spinner]         |  Loading animation
|                                  |
+----------------------------------+
```

**Design Details:**
- Background: Black (0x0000)
- Header: Centered, size 3, white
- Status: Centered, size 2, white
- Device Info: Left-aligned, size 2, light gray
- Icon: Centered, green accent
- Animation: Simple spinner

**Color Usage:**
- Status: White (0xFFFF)
- Device Info: Light gray (0xC618)
- Icon: Bitcoin Orange accent (0xFD20)

**Memory Considerations:**
- Simple icon (drawn with primitives)
- Minimal text rendering
- Low memory footprint

---

### 5.5 Mining Dashboard

**Purpose:** Primary mining status display

**Layout Proposal 1 (Recommended):**
```
+----------------------------------+
|  BITMIND          [MINING]       |  Header bar, size 2, white/Bitcoin Orange
+----------------------------------+  Separator line, gray
|                                  |
|  Worker: my-miner-01            |  H2 left-aligned, size 2, white
|                                  |
|  Hashrate: 12.5 MH/s            |  H2 left-aligned, size 3, Bitcoin Orange
|                                  |
|  Status: ● Mining               |  Body left-aligned, size 2, Bitcoin Orange
|                                  |
|  Pool: stratum+tcp://...        |  Body left-aligned, size 1, light gray
|                                  |
|  Uptime: 2h 34m                |  Body left-aligned, size 1, light gray
|                                  |
+----------------------------------+
```

**Layout Proposal 2 (Alternative):**
```
+----------------------------------+
|              BITMIND             |  H1 centered, size 4, white
|          [MINING]               |  Status right-aligned, size 2, Bitcoin Orange
+----------------------------------+  Separator line, gray
|                                  |
|  Worker: my-miner-01            |  H2 left-aligned, size 2, white
|                                  |
|  12.5 MH/s                      |  H1 centered, size 4, Bitcoin Orange
|  ● Mining                       |  Body centered, size 2, Bitcoin Orange
|                                  |
|  Pool: stratum+tcp://...        |  Body left-aligned, size 1, light gray
|  Uptime: 2h 34m                |  Body left-aligned, size 1, light gray
|                                  |
+----------------------------------+
```

**Layout Proposal 3 (Compact):**
```
+----------------------------------+
|  BITMIND  [MINING]  12.5 MH/s   |  Header bar, size 2, compact
+----------------------------------+  Separator line, gray
|                                  |
|  Worker: my-miner-01            |  H2 left-aligned, size 2, white
|                                  |
|  ● Mining                       |  Body left-aligned, size 2, Bitcoin Orange
|                                  |
|  Pool: stratum+tcp://...        |  Body left-aligned, size 1, light gray
|  Uptime: 2h 34m                |  Body left-aligned, size 1, light gray
|                                  |
+----------------------------------+
```

**Recommended Layout:** Proposal 1

**Design Details:**
- Background: Black (0x0000)
- Header Bar: Size 2, white text, Bitcoin Orange status
- Worker Name: Size 2, white
- Hashrate: Size 3, Bitcoin Orange accent (prominent)
- Status: Size 2, Bitcoin Orange with icon
- Pool/Uptime: Size 1, light gray

**Color Usage:**
- Header: White (0xFFFF)
- Status: Bitcoin Orange (0xFD20)
- Hashrate: Bitcoin Orange (0xFD20)
- Worker: White (0xFFFF)
- Pool/Uptime: Light gray (0xC618)

**Typography:**
- Header: Size 2
- Worker: Size 2
- Hashrate: Size 3 (prominent)
- Status: Size 2
- Pool/Uptime: Size 1

**Icons:**
- Mining status: Circle ● (Bitcoin Orange)
- Alternative: Simple drawn icon

**Memory Considerations:**
- Simple text rendering
- No complex graphics
- Minimal memory footprint

---

## 6. DESIGN COMPARISON WITH OLED

### 6.1 OLED vs TFT Comparison

**OLED (128×64):**
- Monochrome only
- Small text sizes (1-2)
- Compact layout
- Limited information density
- Single screen fits all content

**TFT (320×240):**
- 16-bit color
- Larger text sizes (2-4)
- Spacious layout
- Higher information density
- Multiple information blocks
- Visual hierarchy through color

### 6.2 Key Improvements

**Readability:**
- Larger text sizes (2-4 vs 1-2)
- Color contrast
- Better spacing

**Information Density:**
- More metrics displayed
- Additional context (pool, uptime)
- Better organization

**Professional Appearance:**
- Bitcoin brand identity (orange accent)
- Color hierarchy
- Visual polish
- Production-ready look

---

## 7. MEMORY CONSIDERATIONS

### 7.1 Display Buffer Memory

**Partial Buffer Mode:**
- Recommended for TFT_eSPI
- Memory: ~5-10 KB
- Sufficient for 320×240
- Within ESP32 RAM limits (520 KB)

**Full Buffer Mode:**
- Memory: ~150 KB
- Not recommended (30% of RAM)
- Use only if necessary

### 7.2 Font Memory

**Loaded Fonts:**
- Font 2 (16px): ~3.5 KB
- Font 4 (26px): ~5.8 KB
- Font 6 (48px): ~2.7 KB
- **Total:** ~12 KB

**Recommendation:** Load only necessary fonts (2, 4, optionally 6)

### 7.3 QR Code Memory

**QR Code Rendering:**
- Library: ricmoo/QRCode
- Memory: ~8 KB
- Scale 4-5: Reasonable for 320×240

### 7.4 Total Memory Estimate

**Display Memory:**
- Display buffer: ~5-10 KB
- Fonts: ~12 KB
- QR code: ~8 KB
- **Total:** ~25-30 KB

**Impact:** Within ESP32 capabilities (520 KB RAM)

---

## 8. TOUCH INTEGRATION CONSIDERATIONS

### 8.1 Touch Area Guidelines

**Minimum Touch Area:**
- 20×20 pixels (finger-friendly)
- 30×30 pixels (recommended)

**Touch Targets:**
- Buttons: 40×40 pixels minimum
- Interactive elements: 30×30 pixels minimum

### 8.2 Future Touch Elements

**Potential Touch Features:**
- Back buttons
- Settings access
- Screen navigation
- Metric toggles

**Design Implications:**
- Leave space for touch targets
- Avoid placing critical information in touch areas
- Consider touch feedback (visual)

---

## 9. RECOMMENDATIONS

### 9.1 Layout Recommendation

**Mining Dashboard:** Proposal 1
- Balanced layout
- Clear hierarchy
- Prominent hashrate
- Professional appearance

**Overall Design:**
- Use color hierarchy for visual clarity
- Larger typography for readability
- Balanced spacing
- Professional production appearance

### 9.2 Implementation Priority

**Phase T2 Implementation:**
1. Boot/Splash Screen
2. Setup/AP Screen
3. Connecting Screen
4. Registration Screen
5. Mining Dashboard (Proposal 1)

**Phase T3 Integration:**
- QR code implementation
- Color scheme application
- Typography implementation

**Phase T4 (Optional):**
- Touch integration
- Interactive elements

### 9.3 Design Guidelines

**General Rules:**
- Use color for hierarchy, not decoration
- Maintain consistent spacing
- Prioritize readability
- Keep layouts simple
- Avoid clutter

**Typography Rules:**
- Use size 2 minimum for body text
- Use size 3-4 for headings
- Use size 1 sparingly (only for secondary info)
- Maintain consistent alignment

**Color Rules:**
- Black background (0x0000)
- White primary text (0xFFFF)
- Bitcoin Orange brand accent (0xFD20)
- Green for success/connected (0x07E0)
- Red for errors (0xF800)
- Light gray secondary (0xC618)
- Status colors for feedback

---

## 10. CONCLUSION

**Design Review Status:** COMPLETE

**Summary:**
- 5 screen layouts designed for 320×240 TFT
- Color hierarchy defined
- Typography system established
- Memory considerations analyzed
- Touch integration considerations documented
- Mining Dashboard Proposal 1 recommended

**Next Steps:**
- Phase T2 Implementation: Screen render() methods
- Phase T3: QR code integration
- Phase T4: Touch integration (optional)

**Design Goals Achieved:**
- Bitcoin/mining product identity ✓
- Professional production appearance ✓
- Color hierarchy for visual clarity ✓
- Larger typography for readability ✓
- Balanced spacing and layout ✓
- Future touch integration readiness ✓

---

**END OF DESIGN REVIEW**
