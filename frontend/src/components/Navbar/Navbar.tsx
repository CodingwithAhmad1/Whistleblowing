import { NavLink } from 'react-router-dom'
import styles from './Navbar.module.css'

export function Navbar() {
  return (
    <nav className={styles.nav} aria-label="Main navigation">
      <div className={styles.links}>
        <NavLink
          to="/"
          className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
          end
        >
          Home
        </NavLink>
        <NavLink
          to="/admin"
          className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
        >
          Admin
        </NavLink>
        <NavLink
          to="/analysis"
          className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
        >
          Analysis
        </NavLink>
      </div>
    </nav>
  )
}
