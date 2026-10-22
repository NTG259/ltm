import React, { useMemo } from 'react'

/**
 * CyberBackground - Modern Tech / Linear / Raycast Style Background
 * Features:
 * 1. Dot Matrix Grid (Lưới chấm tọa độ)
 * 2. 3D Topographic Wireframe Wave (Lưới lượn sóng không gian số)
 * 3. Ambient Atmospheric Glows & Luminous Nodes (Đốm sáng công nghệ)
 */
export default function CyberBackground({ mode }) {
  const isDark = mode === 'dark'

  // Tạo các đường lượn sóng topo 3D toán học toàn màn hình (không bao giờ đứt đoạn)
  const topoCurves = useMemo(() => {
    const curves = []
    const totalLines = 20
    for (let i = 0; i < totalLines; i++) {
      const step = i / totalLines

      // Bắt đầu hoàn toàn bên ngoài mép phải màn hình (X >= 1500 trên canvas 1440)
      const startX = 1500
      const startY = -60 + i * 36

      // Điểm uốn 1: lượn mượt mà từ trên cao vào khoảng giữa góc phải
      const cp1X = 1120 + i * 14
      const cp1Y = 40 + i * 32

      // Điểm uốn 2: quét sâu xuống dưới và lượn sang trái dưới các thẻ card
      const cp2X = 760 + i * 24
      const cp2Y = 380 + i * 26

      // Điểm kết thúc: lượn thoát hoàn toàn ra khỏi mép phải màn hình
      const endX = 1500
      const endY = 580 + i * 30

      curves.push({
        id: i,
        d: `M ${startX},${startY} C ${cp1X},${cp1Y} ${cp2X},${cp2Y} ${endX},${endY}`,
        opacity: isDark ? 0.18 + step * 0.42 : 0.32 + step * 0.48,
        width: i % 4 === 0 ? 1.8 : 1.15,
      })
    }
    return curves
  }, [isDark])

  // Tọa độ các đốm sáng dạ quang li ti (Luminous Nodes)
  const glowingNodes = [
    { top: '14%', right: '12%', color: '#818cf8', delay: '0s', size: 4 },
    { top: '28%', right: '22%', color: '#a855f7', delay: '1.2s', size: 3.5 },
    { top: '42%', right: '8%', color: '#06b6d4', delay: '2.4s', size: 4 },
    { top: '65%', right: '18%', color: '#6366f1', delay: '0.8s', size: 3 },
    { top: '22%', left: '8%', color: '#6366f1', delay: '1.8s', size: 3.5 },
    { top: '75%', left: '12%', color: '#a855f7', delay: '2.8s', size: 4 },
  ]

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* 1. Lớp Ambient Atmospheric Mesh Glows (Hiệu ứng Cực Quang Đa Sắc Đậm Nét) */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          right: '-10%',
          width: '65vw',
          height: '65vw',
          maxWidth: 900,
          maxHeight: 900,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, rgba(168, 85, 247, 0.1) 45%, transparent 70%)'
            : 'radial-gradient(circle, rgba(168, 85, 247, 0.38) 0%, rgba(192, 132, 252, 0.25) 45%, transparent 70%)',
          filter: 'blur(75px)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          left: '-10%',
          width: '55vw',
          height: '55vw',
          maxWidth: 750,
          maxHeight: 750,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(99, 102, 241, 0.06) 50%, transparent 70%)'
            : 'radial-gradient(circle, rgba(14, 165, 233, 0.35) 0%, rgba(99, 102, 241, 0.2) 50%, transparent 70%)',
          filter: 'blur(70px)',
        }}
      />

      {/* Đốm cực quang hồng ấm ở góc dưới phải (Dành riêng cho Light mode để tạo chiều sâu) */}
      {!isDark && (
        <div
          style={{
            position: 'absolute',
            bottom: '5%',
            right: '15%',
            width: '48vw',
            height: '48vw',
            maxWidth: 650,
            maxHeight: 650,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(244, 114, 182, 0.32) 0%, rgba(168, 85, 247, 0.18) 45%, transparent 70%)',
            filter: 'blur(65px)',
          }}
        />
      )}

      {/* 2. Lớp Lưới Chấm Tọa Độ Ma Trận (Dot Matrix Grid) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: isDark
            ? 'radial-gradient(rgba(129, 140, 248, 0.22) 1.25px, transparent 1.25px)'
            : 'radial-gradient(rgba(99, 102, 241, 0.22) 1.3px, transparent 1.3px)',
          backgroundSize: '26px 26px',
          backgroundPosition: '0 0',
          maskImage:
            'radial-gradient(ellipse at 50% 40%, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.5) 60%, rgba(0, 0, 0, 0.1) 90%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at 50% 40%, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.5) 60%, rgba(0, 0, 0, 0.1) 90%)',
          opacity: 0.9,
        }}
      />

      {/* 3. Lớp Vân Sóng Không Gian Số 3D (Topographic Silk Waves mượt mà, bao phủ toàn màn hình, không bao giờ đứt đoạn) */}
      <svg
        viewBox="0 0 1440 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMaxYMid slice"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: isDark ? 0.95 : 0.88,
          overflow: 'hidden',
          maskImage:
            'radial-gradient(ellipse at 88% 65%, rgba(0, 0, 0, 1) 35%, rgba(0, 0, 0, 0.7) 65%, rgba(0, 0, 0, 0) 95%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at 88% 65%, rgba(0, 0, 0, 1) 35%, rgba(0, 0, 0, 0.7) 65%, rgba(0, 0, 0, 0) 95%)',
        }}
      >
        <defs>
          <linearGradient id="cyberTopoGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={isDark ? 0.85 : 0.9} />
            <stop offset="50%" stopColor="#a855f7" stopOpacity={isDark ? 0.7 : 0.85} />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity={isDark ? 0.4 : 0.75} />
          </linearGradient>
          {isDark && (
            <filter id="topoGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          )}
        </defs>

        {topoCurves.map((curve) => (
          <path
            key={curve.id}
            d={curve.d}
            stroke="url(#cyberTopoGrad)"
            strokeWidth={curve.width}
            strokeOpacity={curve.opacity}
            filter={curve.id % 5 === 0 && isDark ? 'url(#topoGlow)' : undefined}
          />
        ))}
      </svg>

      {/* 4. Các Điểm Nút Phát Sáng Dạ Quang (Hiển thị ở cả 2 theme) */}
      {glowingNodes.map((node, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            top: node.top,
            right: node.right,
            left: node.left,
            width: node.size,
            height: node.size,
            borderRadius: '50%',
            backgroundColor: node.color,
            boxShadow: isDark
              ? `0 0 8px ${node.color}, 0 0 16px ${node.color}`
              : `0 0 6px ${node.color}, 0 0 12px rgba(99, 102, 241, 0.45)`,
            opacity: isDark ? 0.85 : 0.7,
            animation: `cyberPulse 3.5s ease-in-out infinite alternate`,
            animationDelay: node.delay,
          }}
        />
      ))}
    </div>
  )
}
