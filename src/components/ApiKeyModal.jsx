import { useState } from 'react'
import { useApp } from '../context/AppContext'

export default function ApiKeyModal({ onClose }) {
  const { apiKey, saveConfig } = useApp()
  const [value, setValue] = useState(apiKey)

  function handleSave() {
    saveConfig({ apiKey: value.trim() })
    onClose?.()
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Update API Key</h2>
        <input
          type="password"
          style={styles.input}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Enter API key..."
          autoFocus
        />
        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={styles.saveBtn} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  input: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: {
    background: 'var(--accent-primary)',
    border: 'none',
    color: '#fff',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}
