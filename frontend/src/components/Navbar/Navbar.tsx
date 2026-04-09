import { useRef, useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useMode, type Mode } from '@/context/ModeContext'
import styles from './Navbar.module.css'

const MODE_LABELS: Record<Mode, string> = {
  reporter: 'Reporter',
  investigator: 'Investigator',
  manager: 'Manager',
}

export function Navbar() {
  const { mode, setMode } = useMode()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const selectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectMode(next: Mode) {
    setMode(next)
    setOpen(false)
    navigate('/')
  }

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      <div className={styles.inner}>
        <div className={styles.modeSelector} ref={selectorRef}>
          <button
            className={styles.modeButton}
            onClick={() => setOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            Mode <span className={styles.chevron}>▾</span>
          </button>
          {open && (
            <div className={styles.dropdown} role="listbox">
              {(Object.keys(MODE_LABELS) as Mode[]).map(m => (
                <button
                  key={m}
                  className={`${styles.dropdownItem} ${m === mode ? styles.dropdownItemActive : ''}`}
                  onClick={() => selectMode(m)}
                  role="option"
                  aria-selected={m === mode}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.links}>
          <NavLink
            to="/"
            className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            end
          >
            Home
          </NavLink>
          {(mode === 'investigator' || mode === 'manager') && (
            <NavLink
              to="/feed"
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              Feed
            </NavLink>
          )}
          {mode === 'manager' && (
            <NavLink
              to="/admin"
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              Admin
            </NavLink>
          )}
          {mode === 'manager' && (
            <NavLink
              to="/document"
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              Document
            </NavLink>
          )}
        </div>
      </div>
    </nav>
  )
}
