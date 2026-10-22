import { createContext, useContext } from 'react'
import { theme } from 'antd'

// Token toàn hệ thống – Phong cách Modern Tech (Linear & Raycast inspired)
const shared = {
  colorPrimary: '#4f46e5',
  colorInfo: '#06b6d4',
  colorSuccess: '#10b981',
  colorError: '#f43f5e',
  colorWarning: '#f59e0b',
  borderRadius: 8,
  borderRadiusSM: 6,
  borderRadiusLG: 12,
  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontFamilyCode: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
  fontSize: 14,
}

export function buildTheme(mode) {
  const dark = mode === 'dark'
  return {
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: dark
      ? {
          ...shared,
          colorPrimary: '#6366f1',
          colorPrimaryHover: '#818cf8',
          colorBgLayout: '#070a13',
          colorBgContainer: '#0c1120',
          colorBgElevated: '#131a30',
          colorBorderSecondary: 'rgba(255, 255, 255, 0.08)',
          colorBorder: 'rgba(99, 102, 241, 0.22)',
          colorText: '#f8fafc',
          colorTextSecondary: '#94a3b8',
          colorTextTertiary: '#64748b',
          colorTextQuaternary: '#475569',
          colorSplit: 'rgba(99, 102, 241, 0.12)',
        }
      : {
          ...shared,
          colorPrimary: '#4f46e5',
          colorPrimaryHover: '#4338ca',
          colorBgLayout: 'transparent',
          colorBgContainer: 'rgba(255, 255, 255, 0.85)',
          colorBgElevated: 'rgba(255, 255, 255, 0.95)',
          colorBorderSecondary: 'rgba(226, 232, 240, 0.7)',
          colorBorder: 'rgba(203, 213, 225, 0.8)',
          colorText: '#0f172a',
          colorTextSecondary: '#334155',
          colorTextTertiary: '#64748b',
          colorTextQuaternary: '#94a3b8',
          colorSplit: 'rgba(226, 232, 240, 0.7)',
        },
    components: {
      Layout: {
        headerBg: dark ? 'rgba(10, 15, 29, 0.85)' : 'rgba(255, 255, 255, 0.82)',
        headerHeight: 60,
        headerPadding: '0 24px',
        bodyBg: 'transparent',
        footerBg: 'transparent',
      },
      Card: {
        headerFontSize: 16,
        headerHeight: 48,
        borderRadiusLG: 12,
      },
      Button: {
        controlHeight: 36,
        controlHeightLG: 42,
        borderRadius: 8,
        fontWeight: 600,
      },
      Table: {
        headerBg: dark ? '#10172a' : '#f8fafc',
        headerColor: dark ? '#f1f5f9' : '#0f172a',
        cellPaddingBlock: 12,
        rowHoverBg: dark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(79, 70, 229, 0.05)',
        borderRadiusLG: 10,
      },
      Menu: {
        horizontalItemSelectedColor: dark ? '#818cf8' : '#4f46e5',
        itemBorderRadius: 8,
        itemHoverBg: dark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(79, 70, 229, 0.08)',
        itemSelectedBg: dark ? 'rgba(99, 102, 241, 0.18)' : 'rgba(79, 70, 229, 0.1)',
        itemBg: 'transparent',
        fontSize: 14,
      },
      Tabs: {
        inkBarColor: dark ? '#6366f1' : '#4f46e5',
        itemSelectedColor: dark ? '#818cf8' : '#4f46e5',
        itemHoverColor: dark ? '#a5b4fc' : '#6366f1',
        horizontalItemPadding: '10px 16px',
        titleFontSize: 14,
      },
      Input: {
        controlHeight: 38,
        borderRadius: 8,
      },
      Select: {
        controlHeight: 38,
        borderRadius: 8,
      },
      Tag: {
        borderRadiusSM: 6,
      },
    },
  }
}

export const ThemeModeContext = createContext({ mode: 'light', toggle: () => {} })

export function useThemeMode() {
  return useContext(ThemeModeContext)
}
