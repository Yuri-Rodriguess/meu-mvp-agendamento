import React from 'react';
import { PRESETS, DEFAULT_THEME } from '../theme';

export default function ThemeSettings({ theme, onChange, onClose }) {
    const update = (patch) => onChange({ ...theme, ...patch });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content theme-modal" onClick={(e) => e.stopPropagation()}>
                <h3 style={{ color: 'var(--color-text)' }}>🎨 Aparência</h3>
                <p style={{ color: 'var(--color-text-soft)', marginBottom: '20px', fontSize: '0.9rem' }}>
                    Personalize as cores para combinar com a identidade do seu salão, barbearia ou clínica.
                </p>

                <div className="segmented-control" style={{ width: '100%' }}>
                    <button type="button" className={theme.mode === 'light' ? 'active' : ''} onClick={() => update({ mode: 'light' })} style={{ flex: 1 }}>
                        ☀️ Claro
                    </button>
                    <button type="button" className={theme.mode === 'dark' ? 'active' : ''} onClick={() => update({ mode: 'dark' })} style={{ flex: 1 }}>
                        🌙 Escuro
                    </button>
                </div>

                <p className="field-label" style={{ textAlign: 'left', marginTop: '18px' }}>Combinações prontas</p>
                <div className="theme-preset-grid">
                    {PRESETS.map((preset) => (
                        <button
                            key={preset.name}
                            type="button"
                            className={`theme-preset-swatch ${theme.primary === preset.primary && theme.accent === preset.accent ? 'active' : ''}`}
                            style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})` }}
                            onClick={() => update({ primary: preset.primary, accent: preset.accent })}
                            title={preset.name}
                            aria-label={preset.name}
                        />
                    ))}
                </div>

                <div className="theme-custom-colors">
                    <div>
                        <label className="field-label" htmlFor="theme-primary-color">Cor principal</label>
                        <input
                            id="theme-primary-color"
                            type="color"
                            value={theme.primary}
                            onChange={(e) => update({ primary: e.target.value })}
                            className="theme-color-input"
                        />
                    </div>
                    <div>
                        <label className="field-label" htmlFor="theme-accent-color">Cor secundária</label>
                        <input
                            id="theme-accent-color"
                            type="color"
                            value={theme.accent}
                            onChange={(e) => update({ accent: e.target.value })}
                            className="theme-color-input"
                        />
                    </div>
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => onChange(DEFAULT_THEME)}>Restaurar padrão</button>
                    <button className="btn-confirm" style={{ background: 'var(--gradient-brand)' }} onClick={onClose}>
                        Concluído
                    </button>
                </div>
            </div>
        </div>
    );
}
