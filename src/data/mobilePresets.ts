export type LanguageMode = 'bilingual' | 'tanglish' | 'telugu' | 'english';

export interface DiagnosticStep {
  stepNumber: number;
  phase: string;
  title: string;
  settingsPath: string;
  instruction: string;
  whyItWorks: string;
  expectedOutcome: string;
  dialerCodeOrShortcut: string;
}

export interface DiagnosticReport {
  id?: string;
  createdAt?: string;
  detectedDeviceLabel: string;
  screenshotFinding?: string;
  screenshotPreviewUrl?: string;
  brandInput?: string;
  modelInput?: string;
  configInput?: string;
  querySnapshot?: string;
  issueTitle: string;
  category: string;
  severity: string;
  estimatedMinutes: number;
  dataLossRisk: string;
  whatIsTheProblem: string;
  teluguOrTanglishSummary: string;
  configurationImpact: {
    specLabel: string;
    impactAnalysis: string;
  }[];
  rootCauses: string[];
  steps: DiagnosticStep[];
  whatNotToDo: string[];
  whenToVisitServiceCenter: string;
}

export function buildTailoredReportFromSearch(
  brand: string,
  model: string,
  configurations: string,
  problemQuery: string,
  hasScreenshot?: boolean
): DiagnosticReport {
  const combined = `${brand} ${model} ${configurations} ${problemQuery}`.trim();
  const q = combined.toLowerCase();

  const deviceLabel =
    [brand.trim(), model.trim()].filter(Boolean).join(' ') ||
    'Your Mobile Device';
  const configLabel = configurations.trim() || 'Standard OS & Hardware Configuration';

  const isApple = q.includes('apple') || q.includes('iphone') || q.includes('ios');
  const isXiaomi =
    q.includes('xiaomi') ||
    q.includes('redmi') ||
    q.includes('poco') ||
    q.includes('miui') ||
    q.includes('hyperos');
  const isSamsung = q.includes('samsung') || q.includes('galaxy');

  const isBatteryOrHeat =
    q.includes('heat') ||
    q.includes('battery') ||
    q.includes('charg') ||
    q.includes('drain') ||
    q.includes('హీట్') ||
    q.includes('ఛార్జింగ్');

  const isNetwork =
    q.includes('network') ||
    q.includes('5g') ||
    q.includes('4g') ||
    q.includes('sim') ||
    q.includes('wifi') ||
    q.includes('internet') ||
    q.includes('signal') ||
    q.includes('call');

  const isVirusOrAds =
    q.includes('virus') ||
    q.includes('versus') ||
    q.includes('vairas') ||
    q.includes('ad') ||
    q.includes('popup') ||
    q.includes('pop-up') ||
    q.includes('hack') ||
    q.includes('malware') ||
    q.includes('వైరస్');

  const defaultScreenshotFinding = hasScreenshot
    ? `Analyzed the uploaded screenshot from ${deviceLabel}: Identified an active system/app alert or abnormal UI state requiring permission, cache, and background service cleanup.`
    : '';

  if (isVirusOrAds) {
    return {
      detectedDeviceLabel: `${deviceLabel} (${configLabel})`,
      screenshotFinding: hasScreenshot
        ? `Screenshot Analysis: Detected an unauthorized screen overlay / adware pop-up or browser notification alert on ${deviceLabel}.`
        : '',
      brandInput: brand,
      modelInput: model,
      configInput: configurations,
      querySnapshot: problemQuery,
      issueTitle: `Virus, Adware & Automatic Pop-Up Removal for ${deviceLabel}`,
      category: 'Virus & Malware',
      severity: 'High — Malware or Adware Risk',
      estimatedMinutes: 10,
      dataLossRisk: 'None (Safe for Personal Photos & Contacts)',
      whatIsTheProblem: `On ${deviceLabel} (${configLabel}), sudden pop-up ads, automatic browser redirects, or virus ("versus") behavior is caused either by a hidden third-party APK with a blank/invisible icon installed outside the official store, or by malicious website notification permissions enabled in Google Chrome.`,
      teluguOrTanglishSummary: `Mee ${deviceLabel} (${configLabel}) phone lo virus ("versus") leda automatic ads ravadaniki mukhya karanam: teliyakunda install ayina Hidden/Blank Icon App leda Chrome Notification spam. Ee kinda unna 5 step-by-step instructions follow aithe mee phone lo problem 100% clear avthundi.`,
      configurationImpact: [
        {
          specLabel: `Mobile Brand & Model: ${deviceLabel}`,
          impactAnalysis: isSamsung
            ? 'Use Settings → Apps → Sort by "Last Used" to immediately catch the hidden adware app right after an ad pops up.'
            : isXiaomi
            ? 'Check Settings → Apps → Manage apps, and also disable "msa" under Authorization & revocation to stop system ad services.'
            : 'Check Settings → Apps → See all apps for any unnamed or recently installed suspicious app.',
        },
        {
          specLabel: `Configuration: ${configLabel}`,
          impactAnalysis:
            'Background adware processes consume RAM and storage cache continuously, causing heating and lag alongside pop-ups.',
        },
      ],
      rootCauses: [
        'Hidden "Ghost APK" with no name and a blank white/transparent icon in the Apps list',
        'Google Chrome "Site Notifications" permission allowed for spam websites',
        '"Display over other apps" (Appear on top) permission granted to an unknown utility app',
      ],
      steps: [
        {
          stepNumber: 1,
          phase: 'Step 1 · Isolate Issue',
          title: 'Boot Into Safe Mode to Freeze Third-Party Virus Apps',
          settingsPath: isApple
            ? 'Settings → Safari → Clear History and Website Data'
            : 'Press & Hold Power Button → Touch & Hold "Power Off" on screen → Tap "Safe Mode"',
          instruction:
            'Press and hold your phone Power button, then touch and HOLD the "Power Off" option on the screen for 2 seconds until "Safe Mode" appears, and tap it (Power Off icon ni 2 seconds nokki pattukunte Safe Mode vastundi). In Safe Mode, virus apps cannot run or block you.',
          whyItWorks:
            'Disables all third-party malware processes temporarily so you can uninstall the offending app cleanly.',
          expectedOutcome:
            'Pop-up ads stop while in Safe Mode.',
          dialerCodeOrShortcut: 'Long-press "Power Off" on screen',
        },
        {
          stepNumber: 2,
          phase: 'Step 2 · Remove Hidden App',
          title: 'Find & Uninstall the Blank-Icon / Unnamed App in Settings → Apps',
          settingsPath: isSamsung
            ? 'Settings → Apps → Sort by: Last used'
            : isXiaomi
            ? 'Settings → Apps → Manage apps → Sort by: Install time / Used frequency'
            : 'Settings → Apps → See all apps',
          instruction:
            'Turn ON Dark Mode first (so invisible white icons show up clearly). Go to Settings → Apps → See all apps. Scroll to the very top and very bottom of the list. Look for any app with NO NAME, a blank icon, or an unknown tool you did not install, and tap Uninstall (Settings -> Apps loki velli peru leni / blank icon unna virus app ni Uninstall cheyandi).',
          whyItWorks:
            'Removes the actual adware package generating screen overlays.',
          expectedOutcome:
            'Automatic full-screen ads and browser redirects stop permanently.',
          dialerCodeOrShortcut: '',
        },
        {
          stepNumber: 3,
          phase: 'Step 3 · Overlay Permission',
          title: 'Turn Off "Display Over Other Apps / Appear on Top" for Unknown Apps',
          settingsPath: 'Settings → Apps → Special app access → Display over other apps',
          instruction:
            'Open Special app access → Display over other apps (or "Appear on top"). Revoke permission for any suspicious app, cleaner, PDF tool, or unknown package (Display over other apps lo unknown apps annitiki permission OFF cheyandi).',
          whyItWorks:
            'Blocks apps from drawing pop-ups over your home screen or other apps.',
          expectedOutcome:
            'No app can interrupt your screen while you use your phone.',
          dialerCodeOrShortcut: '',
        },
        {
          stepNumber: 4,
          phase: 'Step 4 · Browser Cleanup',
          title: 'Block Spam Website Notifications in Chrome',
          settingsPath: 'Chrome → 3-dots menu → Settings → Site settings → Notifications',
          instruction:
            'Open Chrome → Settings → Site settings → Notifications. Remove or block all unknown websites under the "Allowed" list, then clear browsing cache (Chrome -> Site settings -> Notifications lo unknown websites annitini Block cheyandi).',
          whyItWorks:
            'Stops fake "Virus Alert!" push notifications coming from websites.',
          expectedOutcome:
            'Notification bar stays completely clean.',
          dialerCodeOrShortcut: '',
        },
        {
          stepNumber: 5,
          phase: 'Step 5 · Security Scan',
          title: 'Run Google Play Protect Scan & Restart Phone Normally',
          settingsPath: 'Google Play Store → Profile Icon → Play Protect → Scan',
          instruction:
            'Open Play Store → Play Protect → tap Scan to verify no harmful apps remain, then restart your phone normally to exit Safe Mode (Play Protect Scan chesi phone ni restart cheyandi).',
          whyItWorks:
            'Confirms all malware packages are removed and restores normal phone mode.',
          expectedOutcome:
            'Phone runs smoothly without any virus or pop-ups.',
          dialerCodeOrShortcut: '',
        },
      ],
      whatNotToDo: [
        'Never click "Clean Now" on pop-up virus warnings—they are fake ads.',
        'Do not install third-party "RAM Booster" or "Antivirus Cleaner" apps.',
        'Keep "Install Unknown Apps" disabled for Chrome and File Manager.',
      ],
      whenToVisitServiceCenter:
        'If ads persist even after a Factory Data Reset (after backing up your personal photos), visit an authorized service center to re-flash official firmware.',
    };
  }

  if (isBatteryOrHeat) {
    return {
      detectedDeviceLabel: `${deviceLabel} (${configLabel})`,
      screenshotFinding: defaultScreenshotFinding,
      brandInput: brand,
      modelInput: model,
      configInput: configurations,
      querySnapshot: problemQuery,
      issueTitle: `Heating, Battery Drain & Charging Fix for ${deviceLabel}`,
      category: 'Battery & Charging',
      severity: 'Moderate — Software & Thermal Triage',
      estimatedMinutes: 10,
      dataLossRisk: 'None (Safe for All Data)',
      whatIsTheProblem: `Your ${deviceLabel} (${configLabel}) is experiencing excess background CPU activity, charging resistance, or high modem power draw regarding: "${problemQuery || 'Uploaded Screenshot Issue'}".`,
      teluguOrTanglishSummary: `Mee ${deviceLabel} (${configLabel}) lo background apps ekkuvaga run avvadam leda charging/thermal settings valla ee problem vastundi. Ee kinda unna step-by-step instructions follow aithe problem clear avthundi.`,
      configurationImpact: [
        {
          specLabel: `Mobile: ${deviceLabel}`,
          impactAnalysis:
            'Restricting runaway background apps in Battery Usage immediately lowers CPU temperature.',
        },
        {
          specLabel: `Configuration: ${configLabel}`,
          impactAnalysis:
            'Disabling virtual RAM expansion and background Wi-Fi/Bluetooth scanning reduces idle battery drain.',
        },
      ],
      rootCauses: [
        'Background apps holding CPU wake-locks when screen is off',
        'Continuous Wi-Fi / Bluetooth / 5G location scanning',
        'Dust in the charging port or virtual RAM thrashing internal storage',
      ],
      steps: [
        {
          stepNumber: 1,
          phase: 'Step 1 · Battery Audit',
          title: 'Force Stop & Restrict Top Draining Background Apps',
          settingsPath: 'Settings → Battery → Battery Usage',
          instruction:
            'Open Settings → Battery → Battery Usage. Tap the top battery-consuming app that you rarely use, select "Force Stop", and set its Background usage to "Restricted" (Settings -> Battery lo ekkuva charge tagesthunna apps ni Restrict cheyandi).',
          whyItWorks:
            'Immediately stops stuck background services from heating the processor.',
          expectedOutcome:
            'Device cools down within 10 minutes.',
          dialerCodeOrShortcut: '',
        },
        {
          stepNumber: 2,
          phase: 'Step 2 · Scanning Fix',
          title: 'Turn Off Background Wi-Fi & Bluetooth Location Scanning',
          settingsPath: 'Settings → Location → Location Services → Wi-Fi & Bluetooth scanning',
          instruction:
            'Open Location Services and turn OFF both "Wi-Fi scanning" and "Bluetooth scanning" so antennas do not poll constantly in the background.',
          whyItWorks:
            'Prevents hidden modem activity when the phone is idle.',
          expectedOutcome:
            'Reduces idle battery drain by up to 15%.',
          dialerCodeOrShortcut: '',
        },
        {
          stepNumber: 3,
          phase: 'Step 3 · Hardware & Port Check',
          title: 'Clean Charging Port & Verify Original Cable / Adapter',
          settingsPath: 'USB-C / Charging Port & Settings → Battery → Charging Settings',
          instruction:
            'Inspect the charging port with a flashlight and gently clear any lint with a wooden toothpick. Avoid using thick cases while fast charging.',
          whyItWorks:
            'Restores clean electrical contact for fast charging without heat buildup.',
          expectedOutcome:
            'Consistent charging speed and normal temperature.',
          dialerCodeOrShortcut: '',
        },
      ],
      whatNotToDo: [
        'Do not play heavy games while charging.',
        'Do not install third-party "Battery Cooler" apps.',
        'Never place a hot phone in a refrigerator.',
      ],
      whenToVisitServiceCenter:
        'If the battery is physically swollen or drops from 30% to 0% instantly, visit an authorized service center for a battery replacement.',
    };
  }

  return {
    detectedDeviceLabel: `${deviceLabel} (${configLabel})`,
    screenshotFinding: defaultScreenshotFinding,
    brandInput: brand,
    modelInput: model,
    configInput: configurations,
    querySnapshot: problemQuery,
    issueTitle: `Step-by-Step Troubleshooting for ${deviceLabel}: ${problemQuery || 'Screenshot Diagnosis'}`,
    category: isNetwork ? 'Network & Connectivity' : 'System & Hardware Diagnostics',
    severity: 'Moderate — Guided Troubleshooting',
    estimatedMinutes: 10,
    dataLossRisk: 'None (Safe for Personal Data)',
    whatIsTheProblem: `Based on your search/screenshot for ${deviceLabel} (${configLabel}), this issue typically stems from corrupted system/app cache, misconfigured OS permissions, or a system component that needs resetting.`,
    teluguOrTanglishSummary: `Meeru ichina ${deviceLabel} (${configLabel}) details mariyu screenshot/problem ఆధారంగా complete step-by-step solution kinda ivvabadindi. Ee steps okkati taruvatha okkati follow avvandi.`,
    configurationImpact: [
      {
        specLabel: `Mobile Brand & Model: ${deviceLabel}`,
        impactAnalysis:
          'Settings paths and hardware test codes below are matched to your mobile brand.',
      },
      {
        specLabel: `Configuration: ${configLabel}`,
        impactAnalysis:
          'Ensuring at least 15–20% free storage and up-to-date system components resolves most OS stutters and app errors.',
      },
    ],
    rootCauses: [
      'Corrupted temporary cache or outdated system component (Android System WebView / OS service)',
      'Misconfigured system or network/permission setting after a recent update',
      'Third-party app conflict or background resource bottleneck',
    ],
    steps: [
      {
        stepNumber: 1,
        phase: 'Step 1 · Primary Check',
        title: 'Clear App Cache & Verify System Storage Free Space',
        settingsPath: 'Settings → Apps → See all apps → Storage & cache → Clear Cache',
        instruction:
          'Go to Settings → Apps, select the affected app or system service shown in your error/screenshot, tap "Storage & cache", and tap "Clear Cache" (do not tap Clear Data). Also ensure your phone has at least 5GB to 10GB of free storage (Settings -> Apps loki velli Clear Cache cheyandi).',
        whyItWorks:
          'Removes corrupted temporary files that cause freezing, lag, or feature failures.',
        expectedOutcome:
          'App and system responsiveness improves immediately.',
        dialerCodeOrShortcut: '',
      },
      {
        stepNumber: 2,
        phase: 'Step 2 · System Component Update',
        title: 'Update Android System WebView & System Apps',
        settingsPath: 'Google Play Store → Manage apps & device → Updates available',
        instruction:
          'Open Google Play Store (or App Store) and update "Android System WebView", "Google Play Services", and any pending system app updates.',
        whyItWorks:
          'Fixes app crashes, network handshakes, and UI rendering bugs.',
        expectedOutcome:
          'Eliminates sudden app errors and glitches.',
        dialerCodeOrShortcut: '',
      },
      {
        stepNumber: 3,
        phase: 'Step 3 · Settings Reset',
        title: isNetwork
          ? 'Reset Wi-Fi, Mobile Network & APN Settings'
          : 'Test in Safe Mode & Reset System Preferences',
        settingsPath: isNetwork
          ? 'Settings → System / General Management → Reset → Reset Wi-Fi, mobile & Bluetooth'
          : 'Settings → Apps → 3-dots menu → Reset app preferences',
        instruction: isNetwork
          ? 'Reset network settings and APN to default, then toggle Airplane mode ON for 15 seconds and OFF (Network settings reset chesi Airplane mode ON/OFF cheyandi).'
          : 'Tap "Reset app preferences" inside Settings → Apps. This restores disabled system services and permissions without deleting any personal data or photos.',
        whyItWorks:
          'Restores default OS links, permissions, and communication channels.',
        expectedOutcome:
          'Restores normal operation without any data loss.',
        dialerCodeOrShortcut: '*#*#4636#*#*',
      },
      {
        stepNumber: 4,
        phase: 'Step 4 · Hardware Diagnostic Verification',
        title: 'Run Built-In Hardware Diagnostic Test & Forced Reboot',
        settingsPath: isSamsung
          ? 'Phone Dialer → Type *#0*#'
          : isXiaomi
          ? 'Phone Dialer → Type *#*#6484#*#*'
          : 'Hold Power Button + Volume Down for 10 Seconds',
        instruction:
          'Use your phone’s built-in hardware diagnostic menu (or perform a forced restart by holding Power + Volume Down for 10 seconds) to verify that all sensors, display, audio, and radios respond properly.',
        whyItWorks:
          'Confirms whether the issue is purely software or involves a physical component.',
        expectedOutcome:
          'Clean reboot with refreshed kernel and hardware drivers.',
        dialerCodeOrShortcut: isSamsung ? '*#0*#' : isXiaomi ? '*#*#6484#*#*' : '*#*#4636#*#*',
      },
    ],
    whatNotToDo: [
      'Do not tap "Clear Storage / Factory Reset" before backing up important data.',
      'Avoid installing unknown third-party repair or booster APK files.',
      'Do not force hardware buttons or ports with metal tools.',
    ],
    whenToVisitServiceCenter:
      'If the hardware diagnostic test fails or physical damage (water exposure, screen line, broken port) is present, visit an authorized service center.',
  };
}
