import { createContext, useContext } from 'react'
import { theme } from 'antd'

// Token lấy từ ui/stitch_c/algorithmic_precision_ide/DESIGN.md
const shared = {
  colorPrimary: '#2563eb',
  colorInfo: '#0284c7',
  colorSuccess: '#10b981',
  colorError: '#ef4444',
  colorWarning: '#f59e0b',
  borderRadius: 6,
  borderRadiusSM: 4,
  borderRadiusLG: 8,
  fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontFamilyCode: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, ui-monospace, monospace",
  fontSize: 14,
}

export function buildTheme(mode) {
  const dark = mode === 'dark'
  return {
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: dark
      ? {
          ...shared,
          colorBgLayout: '#0b1220',
          colorBgContainer: '#111a2b',
          colorBorderSecondary: '#1f2a3d',
          colorBorder: '#2b3950',
        }
      : {
          ...shared,
          colorBgLayout: '#f8fafc',
          colorBgContainer: '#ffffff',
          colorBorderSecondary: '#e2e8f0',
          colorBorder: '#cbd5e1',
          colorText: '#0f172a',
          colorTextSecondary: '#475569',
          colorTextTertiary: '#94a3b8',
        },
    components: {
      Layout: { headerBg: dark ? '#111a2b' : '#ffffff', headerHeight: 56, headerPadding: '0 20px' },
      Card: { headerFontSize: 15 },
      Table: { headerBg: dark ? '#152036' : '#f8fafc', cellPaddingBlock: 10 },
      Menu: { horizontalItemSelectedColor: '#2563eb', itemBg: 'transparent' },
    },
  }
}

export const ThemeModeContext = createContext({ mode: 'light', toggle: () => {} })

export function useThemeMode() {
  return useContext(ThemeModeContext)
}
