import { useState } from 'react'

export function AntiRetaliationBanner() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ fontFamily: 'inherit', padding: '0 0 24px' }}>
      <div style={{
        border: '1px solid #dbe8f8',
        borderRadius: '10px',
        background: '#f7faff',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '20px 22px 18px' }}>
          <div style={{
            flexShrink: 0,
            width: '42px',
            height: '42px',
            background: 'linear-gradient(135deg, #2563eb, #1e40af)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e3a5f', marginBottom: '6px', letterSpacing: '0.01em' }}>
              You are protected. Speaking up is safe.
            </div>
            <p style={{ fontSize: '13.5px', color: '#4b6080', lineHeight: 1.65, margin: '0 0 10px' }}>
              The Firm has a strict anti-retaliation policy. Coming forward <span style={{ fontWeight: 500, color: '#1e3a5f' }}>cannot and will not</span> affect your
              employment, standing, or relationships at work.
            </p>
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'none',
                border: 'none',
                padding: 0,
                fontFamily: 'inherit',
                fontSize: '12px',
                fontWeight: 500,
                color: '#6b8ab0',
                cursor: 'pointer',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="6" cy="6" r="5"/><line x1="6" y1="4" x2="6" y2="6.5"/><circle cx="6" cy="8.5" r="0.5" fill="currentColor"/>
              </svg>
              Legal protections &amp; sources
              <span style={{ fontSize: '9px', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>&#9654;</span>
            </button>

            {open && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px' }}>
                <div>
                  <a
                    href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L1937"
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                  >
                    <span style={{ width: '18px', height: '18px', background: '#dbeafe', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"><path d="M2 10V4l4-2 4 2v6l-4 2z"/></svg>
                    </span>
                    EU Whistleblower Protection Directive (2019/1937)
                  </a>
                  <div style={{ fontSize: '11px', color: '#6b8ab0', marginLeft: '25px', marginTop: '-1px' }}>Guarantees confidentiality and prohibits retaliation across EU member states</div>
                </div>
                <div>
                  <a
                    href="https://www.uaelegislation.gov.ae"
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                  >
                    <span style={{ width: '18px', height: '18px', background: '#dbeafe', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"><path d="M2 10V4l4-2 4 2v6l-4 2z"/></svg>
                    </span>
                    UAE Federal Law No. 4 of 2016
                  </a>
                  <div style={{ fontSize: '11px', color: '#6b8ab0', marginLeft: '25px', marginTop: '-1px' }}>Establishes reporter confidentiality obligations within regulated entities</div>
                </div>
                <div>
                  <a
                    href="https://www.whistleblowers.gov"
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                  >
                    <span style={{ width: '18px', height: '18px', background: '#dbeafe', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"><path d="M2 10V4l4-2 4 2v6l-4 2z"/></svg>
                    </span>
                    U.S. Whistleblower Protection Program (DOL)
                  </a>
                  <div style={{ fontSize: '11px', color: '#6b8ab0', marginLeft: '25px', marginTop: '-1px' }}>Federal protections for employees reporting violations in good faith</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
